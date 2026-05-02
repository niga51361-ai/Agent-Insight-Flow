import {
  pgTable,
  text,
  serial,
  timestamp,
  jsonb,
  integer,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const orchestrationStatusEnum = pgEnum("orchestration_status", [
  "decomposing",
  "running",
  "synthesizing",
  "completed",
  "failed",
]);

export const subAgentStatusEnum = pgEnum("sub_agent_status", [
  "pending",
  "running",
  "completed",
  "failed",
]);

export const agentSpecializationEnum = pgEnum("agent_specialization", [
  "researcher",
  "coder",
  "builder",
  "analyst",
  "fetcher",
  "writer",
  "generalist",
]);

export const orchestrationsTable = pgTable("orchestrations", {
  id: serial("id").primaryKey(),
  orchestrationId: text("orchestration_id").notNull().unique(),
  sessionId: text("session_id").notNull(),
  parentGoal: text("parent_goal").notNull(),
  strategicOverview: text("strategic_overview"),
  decompositionPlan: jsonb("decomposition_plan"),
  status: orchestrationStatusEnum("status").default("decomposing").notNull(),
  finalResult: text("final_result"),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata"),
  totalSubAgents: integer("total_sub_agents").default(0),
  completedSubAgents: integer("completed_sub_agents").default(0),
  totalTokensUsed: integer("total_tokens_used").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const subAgentRunsTable = pgTable("sub_agent_runs", {
  id: serial("id").primaryKey(),
  subAgentId: text("sub_agent_id").notNull().unique(),
  orchestrationId: text("orchestration_id").notNull(),
  subTaskIndex: integer("sub_task_index").notNull(),
  subGoal: text("sub_goal").notNull(),
  specialization: agentSpecializationEnum("specialization").default("generalist").notNull(),
  status: subAgentStatusEnum("status").default("pending").notNull(),
  result: text("result"),
  steps: jsonb("steps"),
  artifacts: jsonb("artifacts"),
  errorMessage: text("error_message"),
  retryAttempts: integer("retry_attempts").default(0),
  tokensUsed: integer("tokens_used").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const sharedMemoryBusTable = pgTable("shared_memory_bus", {
  id: serial("id").primaryKey(),
  orchestrationId: text("orchestration_id").notNull(),
  subAgentId: text("sub_agent_id"),
  key: text("key").notNull(),
  value: text("value").notNull(),
  valueType: text("value_type").default("text"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertOrchestrationSchema = createInsertSchema(orchestrationsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export const insertSubAgentRunSchema = createInsertSchema(subAgentRunsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});

export type Orchestration = typeof orchestrationsTable.$inferSelect;
export type SubAgentRun = typeof subAgentRunsTable.$inferSelect;
export type SharedMemoryBus = typeof sharedMemoryBusTable.$inferSelect;
export type InsertOrchestration = z.infer<typeof insertOrchestrationSchema>;
export type InsertSubAgentRun = z.infer<typeof insertSubAgentRunSchema>;
