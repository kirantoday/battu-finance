import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as battuSchema from './schema/battu'

// CRITICAL: use port 6543 transaction pooler — required for Supabase
const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is required')

const _sql = postgres(connectionString, {
  max: 10,
  ssl: 'require',
})

export const db = drizzle(_sql, {
  schema: { ...battuSchema },
})

/**
 * Raw postgres template tag — for ad-hoc queries that don't go through Drizzle
 * (e.g. reading pre-extracted LIQ tables). Named `pgSql` to avoid colliding
 * with the `sql` operator re-exported from drizzle-orm.
 */
export const pgSql = _sql

export type DB = typeof db
