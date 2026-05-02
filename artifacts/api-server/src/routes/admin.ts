import { Router, type IRouter, type Request, type Response } from "express";
import {
  db, usersTable, agentTasksTable, agentSessionsTable,
  platformConfigTable, platformSecretsTable, adminAuditLogTable,
} from "@workspace/db";
import { eq, desc, count, sql, asc } from "drizzle-orm";
import { requireAdmin } from "../middleware/adminMiddleware.js";
import { encrypt, decrypt, maskSecret } from "../lib/encryption.js";
import { refreshSecret, refreshConfig, deleteSecretFromCache } from "../lib/secretsLoader.js";
import { z } from "zod";
import { logger } from "../lib/logger.js";
import { pool } from "@workspace/db";

const router: IRouter = Router();
router.use(requireAdmin);

// ─── Audit helper ─────────────────────────────────────────────────
async function audit(
  req: Request,
  action: string,
  target?: string,
  details?: Record<string, unknown>
) {
  try {
    const [admin] = await db.select({ email: usersTable.email }).from(usersTable)
      .where(eq(usersTable.id, req.session.userId!)).limit(1);
    await db.insert(adminAuditLogTable).values({
      adminId: req.session.userId!,
      adminEmail: admin?.email ?? "unknown",
      action,
      target: target ?? null,
      details: details ?? null,
      ipAddress: (req.headers["x-forwarded-for"] as string) ?? req.socket.remoteAddress ?? null,
    });
  } catch (e) {
    logger.warn({ e }, "Audit log failed");
  }
}

// ─── Dashboard Stats ──────────────────────────────────────────────
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const [users] = await db.select({ count: count() }).from(usersTable);
    const [tasks] = await db.select({ count: count() }).from(agentTasksTable);
    const [sessions] = await db.select({ count: count() }).from(agentSessionsTable);
    const [completed] = await db.select({ count: count() }).from(agentTasksTable).where(eq(agentTasksTable.status, "completed"));
    const [failed] = await db.select({ count: count() }).from(agentTasksTable).where(eq(agentTasksTable.status, "failed"));
    const [running] = await db.select({ count: count() }).from(agentTasksTable).where(eq(agentTasksTable.status, "running"));
    const [proUsers] = await db.select({ count: count() }).from(usersTable).where(eq(usersTable.plan, "pro"));
    const [adminUsers] = await db.select({ count: count() }).from(usersTable).where(eq(usersTable.role, "admin"));

    const totalTasks = Number(tasks?.count ?? 0);
    const completedCount = Number(completed?.count ?? 0);
    const successRate = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

    const recentTasks = await db.select({
      taskId: agentTasksTable.taskId, goal: agentTasksTable.goal,
      status: agentTasksTable.status, createdAt: agentTasksTable.createdAt,
    }).from(agentTasksTable).orderBy(desc(agentTasksTable.createdAt)).limit(5);

    const recentUsers = await db.select({
      id: usersTable.id, name: usersTable.name, email: usersTable.email,
      plan: usersTable.plan, role: usersTable.role, createdAt: usersTable.createdAt,
    }).from(usersTable).orderBy(desc(usersTable.createdAt)).limit(5);

    res.json({
      stats: {
        totalUsers: Number(users?.count ?? 0), totalTasks,
        totalSessions: Number(sessions?.count ?? 0),
        completedTasks: completedCount, failedTasks: Number(failed?.count ?? 0),
        runningTasks: Number(running?.count ?? 0), successRate,
        proUsers: Number(proUsers?.count ?? 0), adminUsers: Number(adminUsers?.count ?? 0),
      },
      recentTasks, recentUsers,
    });
  } catch (err) {
    logger.error({ err }, "Admin stats error");
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// ─── Users Management ─────────────────────────────────────────────
router.get("/users", async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1")));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "50"))));
    const offset = (page - 1) * limit;
    const users = await db.select({
      id: usersTable.id, name: usersTable.name, email: usersTable.email,
      plan: usersTable.plan, role: usersTable.role, agentName: usersTable.agentName,
      onboardingCompleted: usersTable.onboardingCompleted,
      createdAt: usersTable.createdAt, updatedAt: usersTable.updatedAt,
    }).from(usersTable).orderBy(desc(usersTable.createdAt)).limit(limit).offset(offset);
    const [total] = await db.select({ count: count() }).from(usersTable);
    res.json({ users, pagination: { page, limit, total: Number(total?.count ?? 0) } });
  } catch (err) {
    logger.error({ err }, "Admin users error");
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
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid user ID" }); return; }
  if (userId === req.session.userId) { res.status(400).json({ error: "Cannot modify your own account" }); return; }
  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request" }); return; }
  try {
    const [updated] = await db.update(usersTable).set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(usersTable.id, userId))
      .returning({ id: usersTable.id, name: usersTable.name, email: usersTable.email, plan: usersTable.plan, role: usersTable.role });
    if (!updated) { res.status(404).json({ error: "User not found" }); return; }
    await audit(req, "update_user", `user:${userId}`, parsed.data);
    res.json({ user: updated });
  } catch (err) {
    logger.error({ err }, "Admin update user error");
    res.status(500).json({ error: "Failed to update user" });
  }
});

router.delete("/users/:id", async (req: Request, res: Response) => {
  const userId = parseInt(req.params.id);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid user ID" }); return; }
  if (userId === req.session.userId) { res.status(400).json({ error: "Cannot delete your own account" }); return; }
  try {
    const [deleted] = await db.delete(usersTable).where(eq(usersTable.id, userId))
      .returning({ id: usersTable.id, email: usersTable.email });
    if (!deleted) { res.status(404).json({ error: "User not found" }); return; }
    await audit(req, "delete_user", `user:${userId}`, { email: deleted.email });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Admin delete user error");
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// ─── Tasks ────────────────────────────────────────────────────────
router.get("/tasks", async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1")));
    const limit = Math.min(100, parseInt(String(req.query.limit ?? "50")));
    const offset = (page - 1) * limit;
    const statusFilter = req.query.status as string | undefined;

    const rows = statusFilter && statusFilter !== "all"
      ? await db.select({ id: agentTasksTable.id, taskId: agentTasksTable.taskId, sessionId: agentTasksTable.sessionId, goal: agentTasksTable.goal, status: agentTasksTable.status, result: agentTasksTable.result, errorMessage: agentTasksTable.errorMessage, createdAt: agentTasksTable.createdAt, completedAt: agentTasksTable.completedAt }).from(agentTasksTable).where(eq(agentTasksTable.status, statusFilter as any)).orderBy(desc(agentTasksTable.createdAt)).limit(limit).offset(offset)
      : await db.select({ id: agentTasksTable.id, taskId: agentTasksTable.taskId, sessionId: agentTasksTable.sessionId, goal: agentTasksTable.goal, status: agentTasksTable.status, result: agentTasksTable.result, errorMessage: agentTasksTable.errorMessage, createdAt: agentTasksTable.createdAt, completedAt: agentTasksTable.completedAt }).from(agentTasksTable).orderBy(desc(agentTasksTable.createdAt)).limit(limit).offset(offset);

    const [total] = await db.select({ count: count() }).from(agentTasksTable);
    res.json({ tasks: rows, pagination: { page, limit, total: Number(total?.count ?? 0) } });
  } catch (err) {
    logger.error({ err }, "Admin tasks error");
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

// ─── Platform Config (System Prompt etc.) ─────────────────────────
router.get("/config", async (_req: Request, res: Response) => {
  try {
    const configs = await db.select().from(platformConfigTable).orderBy(asc(platformConfigTable.key));
    res.json({ configs });
  } catch (err) {
    logger.error({ err }, "Admin config error");
    res.status(500).json({ error: "Failed to fetch config" });
  }
});

const UpdateConfigBody = z.object({ value: z.string().min(1) });

router.patch("/config/:key", async (req: Request, res: Response) => {
  const parsed = UpdateConfigBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid value" }); return; }
  try {
    const [updated] = await db.insert(platformConfigTable)
      .values({ key: req.params.key, value: parsed.data.value, updatedAt: new Date(), updatedBy: req.session.userId })
      .onConflictDoUpdate({ target: platformConfigTable.key, set: { value: parsed.data.value, updatedAt: new Date(), updatedBy: req.session.userId } })
      .returning();
    refreshConfig(req.params.key, parsed.data.value);
    await audit(req, "update_config", `config:${req.params.key}`, { key: req.params.key });
    res.json({ config: updated });
  } catch (err) {
    logger.error({ err }, "Admin update config error");
    res.status(500).json({ error: "Failed to update config" });
  }
});

// ─── Secrets (API Keys) ───────────────────────────────────────────
router.get("/secrets", async (_req: Request, res: Response) => {
  try {
    const secrets = await db.select({
      id: platformSecretsTable.id,
      key: platformSecretsTable.key,
      description: platformSecretsTable.description,
      hint: platformSecretsTable.hint,
      createdAt: platformSecretsTable.createdAt,
      updatedAt: platformSecretsTable.updatedAt,
    }).from(platformSecretsTable).orderBy(asc(platformSecretsTable.key));

    const envKeys = [
      { key: "AI_INTEGRATIONS_OPENAI_API_KEY", description: "OpenAI API Key (Replit Integration)" },
      { key: "AI_INTEGRATIONS_OPENAI_BASE_URL", description: "OpenAI Base URL Override" },
      { key: "DATABASE_URL", description: "PostgreSQL Connection String" },
      { key: "SESSION_SECRET", description: "Session Encryption Secret" },
      { key: "SERPER_API_KEY", description: "Serper Web Search API Key" },
    ];

    const envStatus = envKeys.map((k) => ({
      key: k.key,
      description: k.description,
      set: !!process.env[k.key],
      source: "environment",
      hint: process.env[k.key] ? maskSecret(process.env[k.key]!) : null,
    }));

    res.json({ secrets, envStatus });
  } catch (err) {
    logger.error({ err }, "Admin secrets error");
    res.status(500).json({ error: "Failed to fetch secrets" });
  }
});

const SecretBody = z.object({
  key: z.string().min(1).max(100).regex(/^[A-Z0-9_]+$/, "Key must be uppercase letters, numbers, and underscores"),
  value: z.string().min(1),
  description: z.string().max(200).optional(),
});

router.post("/secrets", async (req: Request, res: Response) => {
  const parsed = SecretBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }
  try {
    const encryptedValue = encrypt(parsed.data.value);
    const hint = maskSecret(parsed.data.value);
    const [upserted] = await db.insert(platformSecretsTable)
      .values({
        key: parsed.data.key, encryptedValue, hint,
        description: parsed.data.description ?? null,
        updatedAt: new Date(), updatedBy: req.session.userId,
      })
      .onConflictDoUpdate({
        target: platformSecretsTable.key,
        set: { encryptedValue, hint, description: parsed.data.description ?? null, updatedAt: new Date(), updatedBy: req.session.userId },
      })
      .returning({ id: platformSecretsTable.id, key: platformSecretsTable.key, hint: platformSecretsTable.hint, description: platformSecretsTable.description, updatedAt: platformSecretsTable.updatedAt });

    refreshSecret(parsed.data.key, parsed.data.value);
    await audit(req, "upsert_secret", `secret:${parsed.data.key}`, { key: parsed.data.key });
    res.json({ secret: upserted });
  } catch (err) {
    logger.error({ err }, "Admin upsert secret error");
    res.status(500).json({ error: "Failed to save secret" });
  }
});

router.delete("/secrets/:key", async (req: Request, res: Response) => {
  const key = req.params.key;
  if (!key || key.length > 100) { res.status(400).json({ error: "Invalid key" }); return; }
  try {
    const [deleted] = await db.delete(platformSecretsTable)
      .where(eq(platformSecretsTable.key, key))
      .returning({ key: platformSecretsTable.key });
    if (!deleted) { res.status(404).json({ error: "Secret not found" }); return; }
    deleteSecretFromCache(key);
    await audit(req, "delete_secret", `secret:${key}`, { key });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Admin delete secret error");
    res.status(500).json({ error: "Failed to delete secret" });
  }
});

// ─── Database Explorer ────────────────────────────────────────────
const ALLOWED_TABLES = [
  "users", "agent_sessions", "agent_tasks", "agent_steps", "agent_memory",
  "agent_artifacts", "agent_personalities", "orchestrations", "sub_agent_runs",
  "shared_memory_bus", "credits", "credit_transactions", "api_keys", "integrations",
  "scheduled_tasks", "autonomous_tasks", "platform_config", "platform_secrets",
  "admin_audit_log", "user_sessions",
];

router.get("/db/tables", async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT
        t.table_name,
        (SELECT COUNT(*) FROM information_schema.columns c WHERE c.table_name = t.table_name AND c.table_schema = 'public') AS column_count,
        pg_size_pretty(pg_total_relation_size(quote_ident(t.table_name))) AS size
      FROM information_schema.tables t
      WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
      ORDER BY t.table_name
    `);

    const tablesWithCounts = await Promise.all(
      result.rows.map(async (row: any) => {
        try {
          if (!ALLOWED_TABLES.includes(row.table_name)) return { ...row, row_count: "?" };
          const countRes = await pool.query(`SELECT COUNT(*) FROM "${row.table_name}"`);
          return { ...row, row_count: parseInt(countRes.rows[0].count) };
        } catch { return { ...row, row_count: "?" }; }
      })
    );

    res.json({ tables: tablesWithCounts });
  } catch (err) {
    logger.error({ err }, "DB tables error");
    res.status(500).json({ error: "Failed to list tables" });
  }
});

router.get("/db/table/:name", async (req: Request, res: Response) => {
  const tableName = req.params.name;
  if (!ALLOWED_TABLES.includes(tableName)) {
    res.status(403).json({ error: "Table not accessible" });
    return;
  }
  const page = Math.max(1, parseInt(String(req.query.page ?? "1")));
  const limit = Math.min(100, parseInt(String(req.query.limit ?? "50")));
  const offset = (page - 1) * limit;
  try {
    const colsRes = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `, [tableName]);

    const safeTable = `"${tableName.replace(/[^a-z_]/g, '')}"`;
    const dataRes = await pool.query(`SELECT * FROM ${safeTable} ORDER BY id DESC LIMIT $1 OFFSET $2`, [limit, offset]);
    const countRes = await pool.query(`SELECT COUNT(*) FROM ${safeTable}`);

    res.json({
      columns: colsRes.rows,
      rows: dataRes.rows,
      total: parseInt(countRes.rows[0].count),
      page, limit,
    });
  } catch (err) {
    logger.error({ err }, "DB table view error");
    res.status(500).json({ error: "Failed to query table" });
  }
});

const QueryBody = z.object({
  sql: z.string().min(1).max(2000),
});

const BLOCKED_KEYWORDS = /^\s*(update|delete|insert|drop|alter|create|truncate|grant|revoke|copy|vacuum|analyze|explain\s+analyze)/i;

router.post("/db/query", async (req: Request, res: Response) => {
  const parsed = QueryBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid query" }); return; }

  const query = parsed.data.sql.trim();

  if (BLOCKED_KEYWORDS.test(query)) {
    res.status(403).json({ error: "Only SELECT queries are allowed in the explorer" });
    return;
  }
  if (!/^\s*select\s/i.test(query)) {
    res.status(403).json({ error: "Query must start with SELECT" });
    return;
  }
  const hasLimit = /\blimit\s+\d+/i.test(query);
  const finalQuery = hasLimit ? query : `${query} LIMIT 100`;

  try {
    const start = Date.now();
    const result = await pool.query(finalQuery);
    const duration = Date.now() - start;
    await audit(req, "db_query", undefined, { sql: query.slice(0, 200) });
    res.json({ rows: result.rows, rowCount: result.rowCount, duration });
  } catch (err: any) {
    res.status(400).json({ error: err.message ?? "Query failed" });
  }
});

// ─── System Monitor ───────────────────────────────────────────────
router.get("/system", async (_req: Request, res: Response) => {
  const envKeys = [
    { key: "AI_INTEGRATIONS_OPENAI_API_KEY", label: "OpenAI (Integration)" },
    { key: "AI_INTEGRATIONS_OPENAI_BASE_URL", label: "OpenAI Base URL" },
    { key: "DATABASE_URL", label: "Database URL" },
    { key: "SESSION_SECRET", label: "Session Secret" },
    { key: "SERPER_API_KEY", label: "Serper API" },
    { key: "PORT", label: "Server Port" },
  ];

  const envStatus = envKeys.map((k) => ({
    key: k.key, label: k.label,
    set: !!process.env[k.key],
    hint: process.env[k.key] ? maskSecret(process.env[k.key]!) : null,
    source: "environment",
  }));

  const mem = process.memoryUsage();
  try {
    const byStatus = await pool.query(`
      SELECT status, COUNT(*)::int AS count FROM agent_tasks GROUP BY status
    `);
    const statusMap: Record<string, number> = {};
    for (const r of byStatus.rows) statusMap[r.status] = r.count;

    const dbStats = await pool.query(`SELECT COUNT(*)::int AS total FROM users`);

    res.json({
      uptime: process.uptime(),
      memory: { heapUsed: Math.round(mem.heapUsed / 1024 / 1024), heapTotal: Math.round(mem.heapTotal / 1024 / 1024), rss: Math.round(mem.rss / 1024 / 1024), external: Math.round(mem.external / 1024 / 1024) },
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
      envStatus,
      tasksByStatus: { pending: statusMap.pending ?? 0, running: statusMap.running ?? 0, completed: statusMap.completed ?? 0, failed: statusMap.failed ?? 0 },
      dbUserCount: dbStats.rows[0]?.total ?? 0,
    });
  } catch (err) {
    logger.error({ err }, "Admin system error");
    res.status(500).json({ error: "Failed to fetch system info" });
  }
});

// ─── Agent Config ─────────────────────────────────────────────────
router.get("/agent-config", async (_req: Request, res: Response) => {
  res.json({
    config: {
      defaultModel: "gpt-5.2",
      availableModels: [
        { id: "gpt-5.2", label: "Zanix Max", description: "أقوى نموذج، مثالي للمهام المعقدة", tokens: "128K" },
        { id: "gpt-5-nano", label: "Zanix Flash", description: "سريع جداً، مثالي للمحادثات اليومية", tokens: "32K" },
        { id: "o4-mini", label: "Zanix Think", description: "متخصص في التفكير المنطقي والرياضيات", tokens: "64K" },
      ],
      maxIterations: 12, maxTokens: 8192, streamingEnabled: true,
      tools: {
        web_search: true, browse_web: true, write_code: true, execute_code: true,
        debug_code: true, build_website: true, save_file: true, list_files: true,
        analyze_data: true, calculator: true, translator: true, http_request: true,
        generate_diagram: true, write_document: true, store_memory: true,
        search_memory: true, semantic_memory_search: true, spawn_agents: true,
        analyze_image: true, generate_image: true, github: true, google_drive: true,
        slack: true, notion: true, sandboxed_code_executor: true,
      },
    },
  });
});

// ─── Audit Log ────────────────────────────────────────────────────
router.get("/audit", async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1")));
    const limit = Math.min(100, parseInt(String(req.query.limit ?? "50")));
    const offset = (page - 1) * limit;
    const logs = await db.select().from(adminAuditLogTable)
      .orderBy(desc(adminAuditLogTable.createdAt))
      .limit(limit).offset(offset);
    const [total] = await db.select({ count: count() }).from(adminAuditLogTable);
    res.json({ logs, total: Number(total?.count ?? 0) });
  } catch (err) {
    logger.error({ err }, "Admin audit log error");
    res.status(500).json({ error: "Failed to fetch audit log" });
  }
});

// ─── Activity ─────────────────────────────────────────────────────
router.get("/activity", async (_req: Request, res: Response) => {
  try {
    const recentTasks = await db.select({ id: agentTasksTable.id, taskId: agentTasksTable.taskId, goal: agentTasksTable.goal, status: agentTasksTable.status, createdAt: agentTasksTable.createdAt, completedAt: agentTasksTable.completedAt }).from(agentTasksTable).orderBy(desc(agentTasksTable.createdAt)).limit(50);
    const recentUsers = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, plan: usersTable.plan, createdAt: usersTable.createdAt }).from(usersTable).orderBy(desc(usersTable.createdAt)).limit(10);
    res.json({ recentTasks, recentUsers });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch activity" });
  }
});

export default router;
