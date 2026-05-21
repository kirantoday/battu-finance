import path from 'node:path'
import dotenv from 'dotenv'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

// Load env from monorepo root (pnpm --filter sets cwd to packages/db, not repo root)
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') })
dotenv.config({ path: path.resolve(__dirname, '../../../.env'), override: false })

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is required')

  const sql = postgres(connectionString, { max: 1, ssl: 'require' })
  const db = drizzle(sql)

  // Resolve migrations folder relative to this source file (not cwd), so the
  // script works regardless of which directory pnpm runs it from.
  const migrationsFolder = path.resolve(__dirname, '../drizzle')

  console.log(`Running migrations from ${migrationsFolder}`)
  console.log('Target: battu schema (DATABASE_URL points at Supabase pooler)')
  await migrate(db, { migrationsFolder })
  console.log('Migrations complete.')
  await sql.end()
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
