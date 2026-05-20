import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

import { marketRoutes }        from './routes/market'
import { fundamentalsRoutes }  from './routes/fundamentals'
import { newsRoutes }          from './routes/news'
import { liqRoutes }           from './routes/liq'
import { ownershipRoutes }     from './routes/ownership'
import { aiRoutes }            from './routes/ai'
import { userRoutes }          from './routes/user'

const app = new Hono()

app.use('*', cors({ origin: ['http://localhost:5173', 'https://battu.finance'] }))
app.use('*', logger())

// Health check — used by validation suite to confirm API is running
app.get('/health', (c) => c.json({
  status: 'ok',
  product: 'BATTU Finance Screen',
  version: '0.1.0',
  timestamp: new Date().toISOString(),
}))

app.route('/api/v1/market',        marketRoutes)
app.route('/api/v1/fundamentals',  fundamentalsRoutes)
app.route('/api/v1/news',          newsRoutes)
app.route('/api/v1/liq',           liqRoutes)
app.route('/api/v1/ownership',     ownershipRoutes)
app.route('/api/v1/ai',            aiRoutes)
app.route('/api/v1/user',          userRoutes)

app.notFound((c) => c.json({ error: 'Not found', path: c.req.path }, 404))

app.onError((err, c) => {
  console.error('API error:', err)
  return c.json({ error: 'Internal server error', message: err.message }, 500)
})

const PORT = parseInt(process.env.PORT || '3000')
serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`BATTU API running on http://localhost:${PORT}`)
  console.log(`Health: http://localhost:${PORT}/health`)
})

export default app
