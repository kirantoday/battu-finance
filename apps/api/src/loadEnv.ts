// Side-effect module — loads env from the monorepo root BEFORE any other
// import in apps/api/src/index.ts. This must come first so that singletons
// instantiated during downstream module loads (e.g. newsProvider from
// @battu/data) see the env vars they need.

import path from 'node:path'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') })
dotenv.config({ path: path.resolve(__dirname, '../../../.env'), override: false })
