import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable, agentTasksTable, agentSessionsTable } from "@workspace/db";
import { eq, desc, count, sql } from "drizzle-orm";
import { requireAdmin } from "../middleware/adminMiddleware.js";
import { z } from "zod";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

router.use(requireAdmin);

// ─── Dashboard Stats ──────────────────────────────────────────────────
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const [totalUsersResult] = await db.select({ count: count() }).from(usersTable);
    const [totalTasksResult] = await db.select({ count: count() }).from(agentTasksTable);
    const [totalSessionsResult] = await db.select({ count: count() }).from(agentSessionsTable);

    const [completedResult] = await db
      .select({ count: count() })
      .from(agentTasksTable)
      .where(eq(agentTasksTable.status, "completed"));

    const [failedResult] = await db
      .select({ count: count() })
      .from(agentTasksTable)
      .where(eq(agentTasksTable.status, "failed"));

    const [runningResult] = await db
      .select({ count: count() })
      .from(agentTasksTable)
      .where(eq(agentTasksTable.status, "running"));

    const [proUsersResult] = await db
      .select({ count: count() })
      .from(usersTable)
      .where(eq(usersTable.plan, "pro"));

    const [adminUsersResult] = await db
      .select({ count: count() })
      .from(usersTable)
      .where(eq(usersTable.role, "admin"));

    const totalTasks = Number(totalTasksResult?.count ?? 0);
    const completed = Number(completedResult?.count ?? 0);
    const failed = Number(failedResult?.count ?? 0);
    const successRate = totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0;

    const recentTasks = await db
      .select({
        taskId: agentTasksTable.taskId,
        goal: agentTasksTable.goal,
        status: agentTasksTable.status,
        createdAt: agentTasksTable.createdAt,
      })
      .from(agentTasksTable)
      .orderBy(desc(agentTasksTable.createdAt))
      .limit(5);

    const recentUsers = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        plan: usersTable.plan,
        role: usersTable.role,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .orderBy(desc(usersTable.createdAt))
      .limit(5);

    res.json({
      stats: {
        totalUsers: Number(totalUsersResult?.count ?? 0),
        totalTasks,
        totalSessions: Number(totalSessionsResult?.count ?? 0),
        completedTasks: completed,
        failedTasks: failed,
        runningTasks: Number(runningResult?.count ?? 0),
        successRate,
        proUsers: Number(proUsersResult?.count ?? 0),
        adminUsers: Number(adminUsersResult?.count ?? 0),
      },
      recentTasks,
      recentUsers,
    });
  } catch (err) {
    logger.error({ err }, "Admin stats error");
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// ─── Users Management ─────────────────────────────────────────────────
router.get("/users", async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1")));
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? "20"))));
    const offset = (page - 1) * limit;

    const users = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        plan: usersTable.plan,
        role: usersTable.role,
        agentName: usersTable.agentName,
        onboardingCompleted: usersTable.onboardingCompleted,
        createdAt: usersTable.createdAt,
        updatedAt: usersTable.updatedAt,
      })
      .from(usersTable)
      .orderBy(desc(usersTable.createdAt))
      .limit(limit)
      .offset(offset);

    const [totalResult] = await db.select({ count: count() }).from(usersTable);
    const total = Number(totalResult?.count ?? 0);

    res.json({
      users,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    logger.error({ err }, "Admin list users error");
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

const UpdateUserBody = z.object({
  role: z.enum(["user", "admin"]).optional(),
  plan: z.enum(["free", "pro", "enterprise"]).optional(),
  name: z.string().min(1).max(100).optional(),
});

router.patch("/users/:id", async (req: Request, res: Response) => {
  const userId = parseInt(req.params.id);
  if (isNaN(userId)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  if (userId === req.session.userId) {
    res.status(400).json({ error: "Cannot modify your own account via admin panel" });
    return;
  }

  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.role !== undefined) updates.role = parsed.data.role;
  if (parsed.data.plan !== undefined) updates.plan = parsed.data.plan;
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;

  try {
    const [updated] = await db
      .update(usersTable)
      .set(updates)
      .where(eq(usersTable.id, userId))
      .returning({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        plan: usersTable.plan,
        role: usersTable.role,
      });

    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    logger.info({ adminId: req.session.userId, targetUserId: userId, updates: parsed.data }, "Admin updated user");
    res.json({ user: updated });
  } catch (err) {
    logger.error({ err }, "Admin update user error");
    res.status(500).json({ error: "Failed to update user" });
  }
});

router.delete("/users/:id", async (req: Request, res: Response) => {
  const userId = parseInt(req.params.id);
  if (isNaN(userId)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  if (userId === req.session.userId) {
    res.status(400).json({ error: "Cannot delete your own account" });
    return;
  }

  try {
    const [deleted] = await db
      .delete(usersTable)
      .where(eq(usersTable.id, userId))
      .returning({ id: usersTable.id, email: usersTable.email });

    if (!deleted) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    logger.info({ adminId: req.session.userId, deletedUserId: userId }, "Admin deleted user");
    res.json({ success: true, deleted });
  } catch (err) {
    logger.error({ err }, "Admin delete user error");
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// ─── Tasks Management ─────────────────────────────────────────────────
router.get("/tasks", async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1")));
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? "20"))));
    const offset = (page - 1) * limit;
    const statusFilter = req.query.status as string | undefined;

    let query = db
      .select({
        id: agentTasksTable.id,
        taskId: agentTasksTable.taskId,
        sessionId: agentTasksTable.sessionId,
        goal: agentTasksTable.goal,
        status: agentTasksTable.status,
        result: agentTasksTable.result,
        errorMessage: agentTasksTable.errorMessage,
        createdAt: agentTasksTable.createdAt,
        completedAt: agentTasksTable.completedAt,
      })
      .from(agentTasksTable)
      .orderBy(desc(agentTasksTable.createdAt))
      .limit(limit)
      .offset(offset);

    const tasks = await (statusFilter
      ? db
          .select({
            id: agentTasksTable.id,
            taskId: agentTasksTable.taskId,
            sessionId: agentTasksTable.sessionId,
            goal: agentTasksTable.goal,
            status: agentTasksTable.status,
            result: agentTasksTable.result,
            errorMessage: agentTasksTable.errorMessage,
            createdAt: agentTasksTable.createdAt,
            completedAt: agentTasksTable.completedAt,
          })
          .from(agentTasksTable)
          .where(eq(agentTasksTable.status, statusFilter as any))
          .orderBy(desc(agentTasksTable.createdAt))
          .limit(limit)
          .offset(offset)
      : query);

    const [totalResult] = await db.select({ count: count() }).from(agentTasksTable);
    const total = Number(totalResult?.count ?? 0);

    res.json({
      tasks,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    logger.error({ err }, "Admin list tasks error");
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

// ─── System Monitor ───────────────────────────────────────────────────
router.get("/system", async (_req: Request, res: Response) => {
  const envKeys = [
    "AI_INTEGRATIONS_OPENAI_API_KEY",
    "AI_INTEGRATIONS_OPENAI_BASE_URL",
    "DATABASE_URL",
    "SESSION_SECRET",
    "OPENAI_API_KEY",
  ];

  const envStatus = envKeys.map((key) => ({
    key,
    set: !!process.env[key],
    preview: process.env[key]
      ? `${process.env[key]!.substring(0, 4)}${"*".repeat(12)}`
      : null,
  }));

  const memUsage = process.memoryUsage();

  try {
    const [taskCountByStatus] = await db
      .select({
        pending: sql<number>`count(*) filter (where status = 'pending')`,
        running: sql<number>`count(*) filter (where status = 'running')`,
        completed: sql<number>`count(*) filter (where status = 'completed')`,
        failed: sql<number>`count(*) filter (where status = 'failed')`,
      })
      .from(agentTasksTable);

    res.json({
      uptime: process.uptime(),
      memory: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        rss: Math.round(memUsage.rss / 1024 / 1024),
      },
      nodeVersion: process.version,
      platform: process.platform,
      envStatus,
      tasksByStatus: taskCountByStatus,
    });
  } catch (err) {
    logger.error({ err }, "Admin system error");
    res.status(500).json({ error: "Failed to fetch system info" });
  }
});

// ─── Agent Configuration ──────────────────────────────────────────────
router.get("/agent-config", async (_req: Request, res: Response) => {
  res.json({
    config: {
      defaultModel: "gpt-5.2",
      availableModels: [
        { id: "gpt-5.2", label: "Zanix Max", description: "أقوى نموذج، مثالي للمهام المعقدة" },
        { id: "gpt-5-nano", label: "Zanix Flash", description: "سريع جداً، مثالي للمحادثات اليومية" },
        { id: "o4-mini", label: "Zanix Think", description: "متخصص في التفكير المنطقي والرياضيات" },
      ],
      maxIterations: 12,
      maxTokens: 8192,
      streamingEnabled: true,
      tools: {
        webSearch: true,
        browseWeb: true,
        codeExecution: true,
        imageGeneration: true,
        fileManager: true,
        dataAnalyzer: true,
        calculator: true,
        translator: true,
        diagramGenerator: true,
        documentWriter: true,
        httpClient: true,
        spawnAgents: true,
        semanticMemory: true,
        githubTool: true,
        googleDriveTool: true,
        slackTool: true,
        notionTool: true,
      },
    },
  });
});

// ─── Activity Log ─────────────────────────────────────────────────────
router.get("/activity", async (_req: Request, res: Response) => {
  try {
    const recentTasks = await db
      .select({
        id: agentTasksTable.id,
        taskId: agentTasksTable.taskId,
        goal: agentTasksTable.goal,
        status: agentTasksTable.status,
        createdAt: agentTasksTable.createdAt,
        completedAt: agentTasksTable.completedAt,
      })
      .from(agentTasksTable)
      .orderBy(desc(agentTasksTable.createdAt))
      .limit(50);

    const recentUsers = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        plan: usersTable.plan,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .orderBy(desc(usersTable.createdAt))
      .limit(10);

    res.json({ recentTasks, recentUsers });
  } catch (err) {
    logger.error({ err }, "Admin activity error");
    res.status(500).json({ error: "Failed to fetch activity" });
  }
});

export default router;
