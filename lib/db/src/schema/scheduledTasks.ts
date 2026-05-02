import { pgTable, uuid, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const scheduledTasksTable = pgTable("scheduled_tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  prompt: text("prompt").notNull(),
  cronExpression: text("cron_expression").notNull(),
  repeat: boolean("repeat").notNull().default(false),
  status: text("status").notNull().default("pending"), // pending, running, completed, failed, cancelled
  lastRunAt: timestamp("last_run_at"),
  nextRunAt: timestamp("next_run_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ScheduledTask = typeof scheduledTasksTable.$inferSelect;
export type NewScheduledTask = typeof scheduledTasksTable.$inferInsert;
