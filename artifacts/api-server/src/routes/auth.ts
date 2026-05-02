import { Router, type IRouter, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}

const router: IRouter = Router();

const RegisterBody = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
});

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/register", async (req: Request, res: Response) => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  const { email, password, name } = parsed.data;

  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()))
    .limit(1);

  if (existing.length > 0) {
    res.status(400).json({ error: "Email already registered" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const [user] = await db
    .insert(usersTable)
    .values({
      email: email.toLowerCase(),
      name,
      passwordHash,
      plan: "free",
    })
    .returning({
      id: usersTable.id,
      email: usersTable.email,
      name: usersTable.name,
      plan: usersTable.plan,
      createdAt: usersTable.createdAt,
    });

  if (!user) {
    res.status(500).json({ error: "Failed to create user" });
    return;
  }

  req.session.userId = user.id;

  res.status(201).json({ user });
});

router.post("/login", async (req: Request, res: Response) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const { email, password } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()))
    .limit(1);

  if (!user) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  req.session.userId = user.id;

  res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      agentName: user.agentName,
      onboardingCompleted: user.onboardingCompleted,
      createdAt: user.createdAt,
    },
  });
});

router.post("/logout", (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: "Failed to logout" });
      return;
    }
    res.clearCookie("zanix.sid");
    res.json({ success: true });
  });
});

router.get("/me", async (req: Request, res: Response) => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [user] = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      name: usersTable.name,
      plan: usersTable.plan,
      agentName: usersTable.agentName,
      agentPersonality: usersTable.agentPersonality,
      userInterests: usersTable.userInterests,
      userBackground: usersTable.userBackground,
      chatBackground: usersTable.chatBackground,
      onboardingCompleted: usersTable.onboardingCompleted,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .where(eq(usersTable.id, req.session.userId))
    .limit(1);

  if (!user) {
    req.session.destroy(() => {});
    res.status(401).json({ error: "User not found" });
    return;
  }

  res.json({ user });
});

const OnboardingBody = z.object({
  agentName: z.string().min(1).max(50),
  agentPersonality: z.enum(["analytical", "creative", "friendly", "professional"]),
  userInterests: z.array(z.string()).optional(),
  userBackground: z.string().max(500).optional(),
  chatBackground: z.string().optional(),
});

router.put("/profile/onboarding", async (req: Request, res: Response) => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = OnboardingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  const { agentName, agentPersonality, userInterests, userBackground, chatBackground } = parsed.data;

  try {
    const [user] = await db
      .update(usersTable)
      .set({
        agentName,
        agentPersonality,
        userInterests: userInterests ? JSON.stringify(userInterests) : null,
        userBackground: userBackground || null,
        chatBackground: chatBackground || null,
        onboardingCompleted: true,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, req.session.userId))
      .returning({
        id: usersTable.id,
        email: usersTable.email,
        name: usersTable.name,
        agentName: usersTable.agentName,
        agentPersonality: usersTable.agentPersonality,
        userInterests: usersTable.userInterests,
        userBackground: usersTable.userBackground,
        chatBackground: usersTable.chatBackground,
        onboardingCompleted: usersTable.onboardingCompleted,
      });

    if (!user) {
      res.status(500).json({ error: "Failed to update profile" });
      return;
    }

    res.json({ user });
  } catch (error) {
    console.error("Onboarding error:", error);
    res.status(500).json({ error: "Failed to complete onboarding" });
  }
});

export default router;
