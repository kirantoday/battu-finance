import type { Config } from 'drizzle-kit'

export default {
  schema: './src/schema/battu.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  schemaFilter: ['battu'],  // only touch battu schema — never public
} satisfies Config
