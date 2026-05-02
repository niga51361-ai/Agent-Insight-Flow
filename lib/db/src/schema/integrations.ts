import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export const integrationsTable = pgTable("integrations", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  provider: text("provider").notNull(), // e.g., 'github', 'google-drive', 'slack', 'notion'
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at"),
  config: jsonb("config"), // Store additional provider-specific configuration
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Integration = typeof integrationsTable.$inferSelect;
export type NewIntegration = typeof integrationsTable.$inferInsert;
