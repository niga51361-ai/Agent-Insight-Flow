import { pgTable, text, serial, timestamp, pgEnum, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const planEnum = pgEnum("user_plan", ["free", "pro", "enterprise"]);
export const personalityEnum = pgEnum("agent_personality", ["analytical", "creative", "friendly", "professional"]);
export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  plan: planEnum("plan").default("free").notNull(),
  role: userRoleEnum("role").default("user").notNull(),

  // Onboarding fields
  agentName: text("agent_name"),
  agentPersonality: personalityEnum("agent_personality"),
  userInterests: text("user_interests"),
  userBackground: text("user_background"),
  chatBackground: text("chat_background"),
  onboardingCompleted: boolean("onboarding_completed").default(false).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true, createdAt: true, updatedAt: true,
});

export type User = typeof usersTable.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
