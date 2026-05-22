// Side-effect module — load env from monorepo root before any singleton
// (db client, Anthropic client, postgres connection) is constructed.

import path from 'node:path'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') })
dotenv.config({ path: path.resolve(__dirname, '../../../.env'), override: false })
