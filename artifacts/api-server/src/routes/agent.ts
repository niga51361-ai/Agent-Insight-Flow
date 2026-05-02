import { Router, type IRouter, type Request, type Response } from "express";
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import {
  agentSessionsTable,
  agentTasksTable,
  agentStepsTable,
  agentArtifactsTable,
  orchestrationsTable,
  subAgentRunsTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { createDefaultRegistry } from "../agent/tools/registry.js";
import { MemoryManager } from "../agent/memory/manager.js";
import { runAgent } from "../agent/executor/runner.js";
import { orchestrate } from "../agent/executor/orchestrator.js";

const router: IRouter = Router();

const CreateSessionBody = z.object({
  title: z.string().optional(),
});

const CreateTaskBody = z.object({
  sessionId: z.string(),
  goal: z.string().min(1).max(10000),
  model: z.string().optional(),
});

router.post("/sessions", async (req: Request, res: Response) => {
  const parsed = CreateSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error });
    return;
  }

  const sessionId = randomUUID();
  const [session] = await db
    .insert(agentSessionsTable)
    .values({
      sessionId,
      title: parsed.data.title ?? `Session ${new Date().toLocaleDateString()}`,
    })
    .returning();

  res.json({ session });
});

router.get("/sessions", async (_req: Request, res: Response) => {
  const sessions = await db
    .select()
    .from(agentSessionsTable)
    .orderBy(desc(agentSessionsTable.createdAt))
    .limit(50);
  res.json({ sessions });
});

router.get("/sessions/:sessionId", async (req: Request, res: Response) => {
  const { sessionId } = req.params as { sessionId: string };
  const [session] = await db
    .select()
    .from(agentSessionsTable)
    .where(eq(agentSessionsTable.sessionId, sessionId))
    .limit(1);

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const tasks = await db
    .select()
    .from(agentTasksTable)
    .where(eq(agentTasksTable.sessionId, sessionId))
    .orderBy(desc(agentTasksTable.createdAt));

  res.json({ session, tasks });
});

router.post("/tasks", async (req: Request, res: Response) => {
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error });
    return;
  }

  const { sessionId, goal } = parsed.data;

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
  const [task] = await db
    .insert(agentTasksTable)
    .values({
      sessionId,
      taskId,
      goal,
      status: "pending",
    })
    .returning();

  res.json({ task });
});

router.post("/tasks/:taskId/run", async (req: Request, res: Response) => {
  const { taskId } = req.params as { taskId: string };

  const [task] = await db
    .select()
    .from(agentTasksTable)
    .where(eq(agentTasksTable.taskId, taskId))
    .limit(1);

  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  if (task.status === "running") {
    res.status(409).json({ error: "Task is already running" });
    return;
  }

  const registry = createDefaultRegistry(task.sessionId);
  const memory = new MemoryManager(task.sessionId);
  await memory.getAll();

  try {
    const result = await runAgent(
      taskId,
      task.sessionId,
      task.goal,
      registry,
      memory,
      (step) => {
        req.log.info({ taskId, step }, "Agent step");
      }
    );

    res.json({
      success: result.success,
      taskId,
      result: result.result,
      steps: result.steps,
      artifacts: result.artifacts.map((a) => ({
        name: a.name,
        type: a.type,
        contentLength: a.content.length,
      })),
      tokensUsed: result.tokensUsed,
    });
  } catch (err) {
    await db
      .update(agentTasksTable)
      .set({
        status: "failed",
        errorMessage: err instanceof Error ? err.message : String(err),
        updatedAt: new Date(),
      })
      .where(eq(agentTasksTable.taskId, taskId));

    res.status(500).json({
      error: "Task execution failed",
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

router.post("/run", async (req: Request, res: Response) => {
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error });
    return;
  }

  const { sessionId, goal } = parsed.data;

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
  await db.insert(agentTasksTable).values({
    sessionId,
    taskId,
    goal,
    status: "running",
  });

  const registry = createDefaultRegistry(sessionId);
  const memory = new MemoryManager(sessionId);
  await memory.getAll();

  try {
    const result = await runAgent(taskId, sessionId, goal, registry, memory);

    res.json({
      success: result.success,
      taskId,
      goal,
      result: result.result,
      steps: result.steps,
      artifacts: result.artifacts,
      tokensUsed: result.tokensUsed,
    });
  } catch (err) {
    await db
      .update(agentTasksTable)
      .set({
        status: "failed",
        errorMessage: err instanceof Error ? err.message : String(err),
        updatedAt: new Date(),
      })
      .where(eq(agentTasksTable.taskId, taskId));

    res.status(500).json({
      error: "Agent execution failed",
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

router.get("/tasks/:taskId", async (req: Request, res: Response) => {
  const { taskId } = req.params as { taskId: string };

  const [task] = await db
    .select()
    .from(agentTasksTable)
    .where(eq(agentTasksTable.taskId, taskId))
    .limit(1);

  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const steps = await db
    .select()
    .from(agentStepsTable)
    .where(eq(agentStepsTable.taskId, taskId))
    .orderBy(agentStepsTable.stepIndex);

  const artifacts = await db
    .select()
    .from(agentArtifactsTable)
    .where(eq(agentArtifactsTable.taskId, taskId));

  res.json({ task, steps, artifacts });
});

router.get("/tasks/:taskId/artifacts", async (req: Request, res: Response) => {
  const { taskId } = req.params as { taskId: string };

  const artifacts = await db
    .select()
    .from(agentArtifactsTable)
    .where(eq(agentArtifactsTable.taskId, taskId))
    .orderBy(agentArtifactsTable.createdAt);

  res.json({ artifacts });
});

router.get("/tasks/:taskId/artifacts/:artifactId", async (req: Request, res: Response) => {
  const { taskId, artifactId } = req.params as { taskId: string; artifactId: string };

  const [artifact] = await db
    .select()
    .from(agentArtifactsTable)
    .where(eq(agentArtifactsTable.taskId, taskId))
    .limit(1);

  if (!artifact || String(artifact.id) !== artifactId) {
    res.status(404).json({ error: "Artifact not found" });
    return;
  }

  const contentType = getContentType(artifact.artifactType);
  res.setHeader("Content-Type", contentType);
  res.send(artifact.content);
});

// ─── SSE: Real-time task streaming ───────────────────────────────────────────
const sseClients = new Map<string, Set<Response>>();

router.get("/tasks/:taskId/stream", async (req: Request, res: Response) => {
  const { taskId } = req.params as { taskId: string };

  const [task] = await db
    .select()
    .from(agentTasksTable)
    .where(eq(agentTasksTable.taskId, taskId))
    .limit(1);

  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Add to SSE clients map
  if (!sseClients.has(taskId)) sseClients.set(taskId, new Set());
  sseClients.get(taskId)!.add(res);

  // Send existing steps immediately
  const existingSteps = await db
    .select()
    .from(agentStepsTable)
    .where(eq(agentStepsTable.taskId, taskId))
    .orderBy(agentStepsTable.stepIndex);

  for (const step of existingSteps) {
    send("step", {
      stepIndex: step.stepIndex,
      type: step.stepType,
      thought: step.thought,
      toolName: step.toolName,
      toolInput: step.toolInput,
      observation: step.observation,
      status: "completed",
    });
  }

  if (task.status === "completed" || task.status === "failed") {
    send("done", { status: task.status, result: task.result, error: task.errorMessage });
    res.end();
    return;
  }

  send("connected", { taskId, status: task.status });

  const keepAlive = setInterval(() => {
    res.write(": heartbeat\n\n");
  }, 15000);

  req.on("close", () => {
    clearInterval(keepAlive);
    sseClients.get(taskId)?.delete(res);
    if (sseClients.get(taskId)?.size === 0) sseClients.delete(taskId);
  });
});

export function broadcastTaskEvent(taskId: string, event: string, data: unknown) {
  const clients = sseClients.get(taskId);
  if (!clients || clients.size === 0) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    client.write(payload);
  }
}

// ─── SSE-powered run endpoint ─────────────────────────────────────────────────
router.post("/run/stream", async (req: Request, res: Response) => {
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error });
    return;
  }

  const { sessionId, goal, model } = parsed.data;
  const selectedModel = model ?? "gpt-5.2";

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
  await db.insert(agentTasksTable).values({
    sessionId,
    taskId,
    goal,
    status: "running",
  });

  const registry = createDefaultRegistry(sessionId);
  const memory = new MemoryManager(sessionId);
  await memory.getAll();

  res.json({ taskId, status: "started" });

  runAgent(taskId, sessionId, goal, registry, memory, (step) => {
    broadcastTaskEvent(taskId, "step", {
      stepIndex: step.stepIndex,
      type: step.stepType,
      thought: step.thought,
      toolName: step.toolName,
      toolInput: step.toolInput,
      observation: step.observation,
      status: step.status,
    });
  }, selectedModel).then((result) => {
    broadcastTaskEvent(taskId, "done", {
      status: result.success ? "completed" : "failed",
      result: result.result,
      tokensUsed: result.tokensUsed,
    });
  }).catch((err) => {
    broadcastTaskEvent(taskId, "done", {
      status: "failed",
      error: err instanceof Error ? err.message : String(err),
    });
  });
});

router.get("/tools", (_req: Request, res: Response) => {
  const registry = createDefaultRegistry();
  const tools = registry.getAll().map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));
  res.json({ tools, count: tools.length });
});

const OrchestrationBody = z.object({
  sessionId: z.string().uuid(),
  goal: z.string().min(1).max(20000),
  maxAgents: z.number().int().min(1).max(6).optional(),
});

router.post("/orchestrate", async (req: Request, res: Response) => {
  const parsed = OrchestrationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error });
    return;
  }

  const { sessionId, goal, maxAgents = 4 } = parsed.data;

  const sessionRows = await db
    .select()
    .from(agentSessionsTable)
    .where(eq(agentSessionsTable.sessionId, sessionId))
    .limit(1);

  if (!sessionRows.length) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const orchestrationId = randomUUID();

  const [orch] = await db
    .insert(orchestrationsTable)
    .values({
      orchestrationId,
      sessionId,
      parentGoal: goal,
      status: "decomposing",
    })
    .returning();

  res.json({
    orchestrationId,
    sessionId,
    goal,
    status: "started",
    message: "Orchestration started. Use GET /orchestrations/:id to poll results.",
    orch,
  });

  orchestrate(orchestrationId, sessionId, goal, maxAgents).catch((err: unknown) => {
    console.error("Orchestration failed:", err);
  });
});

router.post("/orchestrate/sync", async (req: Request, res: Response) => {
  const parsed = OrchestrationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error });
    return;
  }

  const { sessionId, goal, maxAgents = 4 } = parsed.data;

  const sessionRows = await db
    .select()
    .from(agentSessionsTable)
    .where(eq(agentSessionsTable.sessionId, sessionId))
    .limit(1);

  if (!sessionRows.length) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const orchestrationId = randomUUID();

  await db.insert(orchestrationsTable).values({
    orchestrationId,
    sessionId,
    parentGoal: goal,
    status: "decomposing",
  });

  try {
    const result = await orchestrate(orchestrationId, sessionId, goal, maxAgents);
    res.json({
      success: true,
      orchestrationId: result.orchestrationId,
      goal: result.goal,
      strategy: result.strategy,
      subAgentCount: result.subAgentCount,
      finalAnswer: result.finalAnswer,
      executionTimeMs: result.executionTimeMs,
      totalTokensUsed: result.totalTokensUsed,
      subResults: result.subResults.map((r) => ({
        specialization: r.specialization,
        subGoal: r.subGoal,
        success: r.success,
        stepsCount: r.steps.length,
        artifactsCount: r.artifacts.length,
        resultPreview: r.result.substring(0, 500),
      })),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Orchestration failed", details: msg });
  }
});

router.get("/orchestrations", async (_req: Request, res: Response) => {
  const orchestrations = await db
    .select()
    .from(orchestrationsTable)
    .orderBy(desc(orchestrationsTable.createdAt))
    .limit(50);
  res.json({ orchestrations });
});

router.get("/orchestrations/:id", async (req: Request, res: Response) => {
  const orchId = String(req.params["id"] ?? "");

  const [orchestration] = await db
    .select()
    .from(orchestrationsTable)
    .where(eq(orchestrationsTable.orchestrationId, orchId))
    .limit(1);

  if (!orchestration) {
    res.status(404).json({ error: "Orchestration not found" });
    return;
  }

  const subAgents = await db
    .select()
    .from(subAgentRunsTable)
    .where(eq(subAgentRunsTable.orchestrationId, orchId))
    .orderBy(subAgentRunsTable.subTaskIndex);

  res.json({
    orchestration,
    subAgents,
    progress: {
      total: orchestration.totalSubAgents ?? 0,
      completed: orchestration.completedSubAgents ?? 0,
      status: orchestration.status,
    },
  });
});

function getContentType(artifactType: string): string {
  const types: Record<string, string> = {
    html: "text/html",
    css: "text/css",
    javascript: "application/javascript",
    json: "application/json",
    markdown: "text/markdown",
    text: "text/plain",
    website: "text/html",
    code: "text/plain",
  };
  return types[artifactType.toLowerCase()] ?? "text/plain";
}

export default router;
