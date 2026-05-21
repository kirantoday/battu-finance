import path from 'node:path'
import dotenv from 'dotenv'
import type { Config } from 'drizzle-kit'

// drizzle-kit invokes this file from packages/db/, so .env.local at the
// monorepo root isn't auto-loaded — wire it up explicitly.
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') })
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: false })

export default {
  schema: './src/schema/battu.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  schemaFilter: ['battu'],  // only touch battu schema — never public
} satisfies Config
