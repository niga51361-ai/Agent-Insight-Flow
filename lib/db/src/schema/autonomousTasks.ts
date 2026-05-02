import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  boolean,
} from "drizzle-orm/pg-core";

export const autonomousTasksTable = pgTable("autonomous_tasks", {
  id: serial("id").primaryKey(),
  taskId: text("task_id").notNull().unique(),
  sessionId: text("session_id").notNull(),
  userId: text("user_id"),
  goal: text("goal").notNull(),
  status: text("status").notNull().default("queued"),
  progress: integer("progress").notNull().default(0),
  currentStep: text("current_step"),
  result: text("result"),
  error: text("error"),
  totalIterations: integer("total_iterations").default(0),
  useCritic: boolean("use_critic").default(true),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type AutonomousTask = typeof autonomousTasksTable.$inferSelect;
export type NewAutonomousTask = typeof autonomousTasksTable.$inferInsert;
