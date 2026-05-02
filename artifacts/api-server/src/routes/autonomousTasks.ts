import { Router, type IRouter, type Request, type Response } from "express";
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import {
  autonomousTasksTable,
  agentSessionsTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { startAutonomousTask } from "../agent/autopilot/autonomous-loop.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

const CreateAutonomousTaskBody = z.object({
  sessionId: z.string(),
  goal: z.string().min(1).max(50000),
  useCritic: z.boolean().optional().default(true),
});

router.post("/", async (req: Request, res: Response) => {
  const parsed = CreateAutonomousTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  const { sessionId, goal, useCritic } = parsed.data;

  const [session] = await db
    .select()
    .from(agentSessionsTable)
    .where(eq(agentSessionsTable.sessionId, sessionId))
    .limit(1);

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const taskId = randomUUID();
  const userId = req.session?.userId ? String(req.session.userId) : undefined;

  const [task] = await db
    .insert(autonomousTasksTable)
    .values({
      taskId,
      sessionId,
      userId,
      goal,
      status: "queued",
      progress: 0,
      useCritic,
      currentStep: "Queued — waiting to start",
    })
    .returning();

  setImmediate(() => {
    startAutonomousTask(taskId, sessionId, goal, useCritic).catch((err) => {
      logger.error({ err, taskId }, "Autonomous task failed");
    });
  });

  res.json({
    taskId,
    sessionId,
    status: "queued",
    message: "Autonomous task started. Use GET /agent/autopilot/:taskId to poll progress.",
    goal: goal.slice(0, 200),
  });
});

router.get("/:taskId", async (req: Request, res: Response) => {
  const { taskId } = req.params as { taskId: string };

  const [task] = await db
    .select()
    .from(autonomousTasksTable)
    .where(eq(autonomousTasksTable.taskId, taskId))
    .limit(1);

  if (!task) {
    res.status(404).json({ error: "Autonomous task not found" });
    return;
  }

  res.json({ task });
});

router.get("/session/:sessionId", async (req: Request, res: Response) => {
  const { sessionId } = req.params as { sessionId: string };

  const tasks = await db
    .select()
    .from(autonomousTasksTable)
    .where(eq(autonomousTasksTable.sessionId, sessionId))
    .orderBy(desc(autonomousTasksTable.createdAt))
    .limit(20);

  res.json({ tasks });
});

router.delete("/:taskId", async (req: Request, res: Response) => {
  const { taskId } = req.params as { taskId: string };

  await db
    .update(autonomousTasksTable)
    .set({ status: "failed", error: "Cancelled by user", updatedAt: new Date() })
    .where(eq(autonomousTasksTable.taskId, taskId));

  res.json({ success: true });
});

export default router;
