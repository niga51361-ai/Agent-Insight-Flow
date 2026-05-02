import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import agentRouter from "./agent.js";
import authRouter from "./auth.js";
import creditsRouter from "./credits.js";
import agentPersonalityRouter from "./agentPersonality.js";
import scheduledTasksRouter from "./scheduledTasks.js";
import apiKeysRouter from "./apiKeys.js";
import publicApiRouter from "./publicApi.js";
import integrationsRouter from "./integrations.js";
import autonomousTasksRouter from "./autonomousTasks.js";
import adminRouter from "./admin.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/agent", agentRouter);
router.use("/credits", creditsRouter);
router.use("/agent-personality", agentPersonalityRouter);
router.use("/scheduled-tasks", scheduledTasksRouter);
router.use("/api-keys", apiKeysRouter);
router.use("/public-api", publicApiRouter);
router.use("/integrations", integrationsRouter);
router.use("/agent/autopilot", autonomousTasksRouter);
router.use("/admin", adminRouter);

export default router;
