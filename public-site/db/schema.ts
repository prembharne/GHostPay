import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
export const requests = sqliteTable('claim_requests', {
  id: text('id').primaryKey(), paymentId: text('payment_id').notNull(),
  chainId: integer('chain_id').notNull(), contract: text('contract').notNull(),
  recipient: text('recipient').notNull(), status: text('status').notNull().default('pending'),
  createdAt: integer('created_at').notNull(), deadline: text('deadline'), signature: text('signature'),
  version: integer('version').notNull().default(0),
}, table => [uniqueIndex('request_recipient').on(table.chainId, table.contract, table.paymentId, table.recipient)]);
export const rates = sqliteTable('rate_windows', {
  key: text('key').primaryKey(), hits: integer('hits').notNull(), expiresAt: integer('expires_at').notNull(),
}, table => [index('rate_expiry').on(table.expiresAt)]);

export const profiles = sqliteTable('wallet_profiles', {
  wallet: text('wallet').primaryKey(), username: text('username').notNull(), createdAt: integer('created_at').notNull(),
}, table => [uniqueIndex('wallet_username').on(table.username)]);
