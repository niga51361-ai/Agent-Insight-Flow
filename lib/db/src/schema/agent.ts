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

export const taskStatusEnum = pgEnum("task_status", [
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

export const stepTypeEnum = pgEnum("step_type", [
  "think",
  "search",
  "browse",
  "code",
  "write_file",
  "read_file",
  "shell",
  "done",
]);

export const agentSessionsTable = pgTable("agent_sessions", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  title: text("title"),
  userId: integer("user_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const agentTasksTable = pgTable("agent_tasks", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  taskId: text("task_id").notNull().unique(),
  goal: text("goal").notNull(),
  status: taskStatusEnum("status").default("pending").notNull(),
  result: text("result"),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const agentStepsTable = pgTable("agent_steps", {
  id: serial("id").primaryKey(),
  taskId: text("task_id").notNull(),
  stepIndex: integer("step_index").notNull(),
  stepType: stepTypeEnum("step_type").notNull(),
  thought: text("thought"),
  toolName: text("tool_name"),
  toolInput: jsonb("tool_input"),
  toolOutput: jsonb("tool_output"),
  observation: text("observation"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const agentPersonalitiesTable = pgTable("agent_personalities", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  name: text("name").notNull().default("Zanix AI"),
  description: text("description"),
  tone: text("tone").default("helpful and professional"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const agentMemoryTable = pgTable("agent_memory", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  memoryType: text("memory_type").notNull().default("fact"),
  key: text("key").notNull(),
  value: text("value").notNull(),
  embedding: jsonb("embedding"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
});

export const agentArtifactsTable = pgTable("agent_artifacts", {
  id: serial("id").primaryKey(),
  taskId: text("task_id").notNull(),
  artifactType: text("artifact_type").notNull(),
  name: text("name").notNull(),
  content: text("content").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAgentSessionSchema = createInsertSchema(agentSessionsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export const insertAgentTaskSchema = createInsertSchema(agentTasksTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export const insertAgentStepSchema = createInsertSchema(agentStepsTable).omit({
  id: true, createdAt: true,
});
export const insertAgentMemorySchema = createInsertSchema(agentMemoryTable).omit({
  id: true, createdAt: true,
});
export const insertAgentArtifactSchema = createInsertSchema(agentArtifactsTable).omit({
  id: true, createdAt: true,
});

export type AgentSession = typeof agentSessionsTable.$inferSelect;
export type AgentTask = typeof agentTasksTable.$inferSelect;
export type AgentStep = typeof agentStepsTable.$inferSelect;
export type AgentMemory = typeof agentMemoryTable.$inferSelect;
export type AgentArtifact = typeof agentArtifactsTable.$inferSelect;
export type InsertAgentSession = z.infer<typeof insertAgentSessionSchema>;
export type InsertAgentTask = z.infer<typeof insertAgentTaskSchema>;
export type InsertAgentStep = z.infer<typeof insertAgentStepSchema>;
