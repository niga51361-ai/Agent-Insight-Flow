import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";

export const platformConfigTable = pgTable("platform_config", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: integer("updated_by"),
});

export const platformSecretsTable = pgTable("platform_secrets", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  encryptedValue: text("encrypted_value").notNull(),
  description: text("description"),
  hint: text("hint"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: integer("updated_by"),
});

export const adminAuditLogTable = pgTable("admin_audit_log", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").notNull(),
  adminEmail: text("admin_email"),
  action: text("action").notNull(),
  target: text("target"),
  details: jsonb("details"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PlatformConfig = typeof platformConfigTable.$inferSelect;
export type PlatformSecret = typeof platformSecretsTable.$inferSelect;
export type AdminAuditLog = typeof adminAuditLogTable.$inferSelect;
