import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as battuSchema from './schema/battu'

// CRITICAL: use port 6543 transaction pooler — required for Supabase
const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is required')

const sql = postgres(connectionString, {
  max: 10,
  ssl: 'require',
})

export const db = drizzle(sql, {
  schema: { ...battuSchema },
})

export type DB = typeof db
