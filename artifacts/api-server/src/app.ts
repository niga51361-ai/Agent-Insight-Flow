import express, { type Express } from "express";
import cors from "cors";
import session from "express-session";
import connectPg from "connect-pg-simple";
import pinoHttp from "pino-http";
import helmet from "helmet";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import router from "./routes";
import { logger } from "./lib/logger";

const PgSession = connectPg(session);

// ─── Session Secret Validation ────────────────────────────────────────────────
const SESSION_SECRET = process.env["SESSION_SECRET"];
if (!SESSION_SECRET) {
  if (process.env["NODE_ENV"] === "production") {
    throw new Error(
      "SESSION_SECRET environment variable is required in production. Set it before deploying."
    );
  }
  logger.warn(
    "SESSION_SECRET is not set — using insecure fallback. Set it before going to production."
  );
}

// ─── CORS Allowed Origins ─────────────────────────────────────────────────────
const isDev = process.env["NODE_ENV"] !== "production";
const ALLOWED_ORIGINS = new Set<string>([
  ...(process.env["REPLIT_DOMAINS"]
    ?.split(",")
    .map((d) => `https://${d.trim()}`) ?? []),
  ...(process.env["ALLOWED_ORIGINS"]
    ?.split(",")
    .map((o) => o.trim())
    .filter(Boolean) ?? []),
]);

// ─── Rate Limiters ────────────────────────────────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
  skip: () => isDev,
});

const agentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many agent requests. Please slow down." },
  skip: () => isDev,
  keyGenerator: (req) => {
    const userId = (req.session as Record<string, unknown>)?.["userId"];
    return userId ? String(userId) : ipKeyGenerator(req);
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many authentication attempts. Please try again later." },
});

const autopilotLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Autopilot rate limit reached. Maximum 10 tasks per hour." },
  skip: () => isDev,
  keyGenerator: (req) => {
    const userId = (req.session as Record<string, unknown>)?.["userId"];
    return userId ? String(userId) : ipKeyGenerator(req);
  },
});

const app: Express = express();
app.set("trust proxy", 1);

// ─── Security Headers ─────────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

// ─── Logger ───────────────────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  })
);

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || isDev || ALLOWED_ORIGINS.has(origin)) {
        return callback(null, true);
      }
      callback(new Error(`CORS: origin '${origin}' is not allowed`));
    },
    credentials: true,
  })
);

// ─── Body Parsers ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ─── Session ──────────────────────────────────────────────────────────────────
app.use(
  session({
    store: new PgSession({
      conString: process.env["DATABASE_URL"],
      tableName: "user_sessions",
    }),
    name: "zanix.sid",
    secret: SESSION_SECRET ?? "zanix-dev-secret-do-not-use-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env["NODE_ENV"] === "production",
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: "lax",
    },
  })
);

// ─── Rate Limiting ────────────────────────────────────────────────────────────
app.use("/api", generalLimiter);
app.use("/api/auth", authLimiter);
app.use("/api/agent/run", agentLimiter);
app.use("/api/agent/orchestrate", agentLimiter);
app.use("/api/agent/autopilot", autopilotLimiter);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api", router);

export default app;
