import {
  pgSchema, uuid, text, integer, boolean,
  timestamp, jsonb, numeric,
} from 'drizzle-orm/pg-core'

// CRITICAL: all tables in 'battu' schema, never 'public'
export const battuSchema = pgSchema('battu')

export const users = battuSchema.table('users', {
  id:               uuid('id').defaultRandom().primaryKey(),
  email:            text('email').notNull().unique(),
  tier:             text('tier').notNull().default('free'),
  orgId:            uuid('org_id'),
  stripeCustomerId: text('stripe_customer_id'),
  createdAt:        timestamp('created_at').defaultNow().notNull(),
  updatedAt:        timestamp('updated_at').defaultNow().notNull(),
})

export const organizations = battuSchema.table('organizations', {
  id:                   uuid('id').defaultRandom().primaryKey(),
  name:                 text('name').notNull(),
  domain:               text('domain'),
  seatCount:            integer('seat_count').notNull().default(1),
  stripeSubscriptionId: text('stripe_subscription_id'),
  createdAt:            timestamp('created_at').defaultNow().notNull(),
})

export const watchlists = battuSchema.table('watchlists', {
  id:        uuid('id').defaultRandom().primaryKey(),
  userId:    uuid('user_id').notNull(),
  name:      text('name').notNull(),
  tickers:   text('tickers').array().notNull().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const portfolios = battuSchema.table('portfolios', {
  id:        uuid('id').defaultRandom().primaryKey(),
  userId:    uuid('user_id').notNull(),
  positions: jsonb('positions').notNull().default({}),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const savedScreens = battuSchema.table('saved_screens', {
  id:        uuid('id').defaultRandom().primaryKey(),
  userId:    uuid('user_id').notNull(),
  command:   text('command').notNull(),
  params:    jsonb('params').notNull().default({}),
  pinned:    boolean('pinned').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const alerts = battuSchema.table('alerts', {
  id:        uuid('id').defaultRandom().primaryKey(),
  userId:    uuid('user_id').notNull(),
  ticker:    text('ticker').notNull(),
  condition: text('condition').notNull(),
  threshold: numeric('threshold').notNull(),
  active:    boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const liqCache = battuSchema.table('liq_cache', {
  ticker:         text('ticker').primaryKey(),
  computedAt:     timestamp('computed_at').notNull(),
  data:           jsonb('data').notNull(),
  sourceFilings:  jsonb('source_filings').notNull().default({}),
})

export const queryHistory = battuSchema.table('query_history', {
  id:          uuid('id').defaultRandom().primaryKey(),
  userId:      uuid('user_id').notNull(),
  query:       text('query').notNull(),
  tier:        text('tier').notNull(),
  tokensUsed:  integer('tokens_used').notNull().default(0),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
})

// Type exports
export type User =          typeof users.$inferSelect
export type NewUser =       typeof users.$inferInsert
export type Watchlist =     typeof watchlists.$inferSelect
export type Portfolio =     typeof portfolios.$inferSelect
export type LiqCache =      typeof liqCache.$inferSelect
export type QueryHistory =  typeof queryHistory.$inferSelect
