export { db, pgSql } from './client'
export * from './schema/battu'

// Re-export the SQL operators app code needs, so consumers don't have to add
// drizzle-orm as a direct dep alongside @battu/db.
export { eq, and, or, ne, gt, lt, gte, lte, inArray, notInArray, sql } from 'drizzle-orm'
