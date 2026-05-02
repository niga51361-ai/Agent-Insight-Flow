import { pgTable, serial, text, timestamp, integer, numeric } from 'drizzle-orm/pg-core';

export const creditsTable = pgTable('credits', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().unique(), // Link to users table
  balance: numeric('balance', { precision: 10, scale: 2 }).notNull().default('0.00'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const creditTransactionsTable = pgTable('credit_transactions', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(), // Link to users table
  type: text('type').notNull(), // e.g., 'purchase', 'usage', 'refund', 'bonus'
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
