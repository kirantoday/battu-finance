import { Hono } from 'hono'
import { db, watchlists, eq, and } from '@battu/db'

export const userRoutes = new Hono()

// Pre-auth placeholder — every request maps to this demo user until Session 10
// wires up real auth. Real UUID so the uuid-column type check passes.
const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001'

const DEFAULT_TICKERS = ['AAPL', 'MSFT', 'NVDA', 'BIIB']

// GET /api/v1/user/watchlist
// Returns every watchlist for the current user. Creates a default one with
// AAPL/MSFT/NVDA/BIIB if the user has none yet.
userRoutes.get('/watchlist', async (c) => {
  try {
    const lists = await db
      .select()
      .from(watchlists)
      .where(eq(watchlists.userId, DEMO_USER_ID))

    if (lists.length === 0) {
      const [created] = await db
        .insert(watchlists)
        .values({
          userId:  DEMO_USER_ID,
          name:    'My Watchlist',
          tickers: DEFAULT_TICKERS,
        })
        .returning()
      return c.json({ data: [created], error: null })
    }

    return c.json({ data: lists, error: null })
  } catch (err) {
    console.error('[watchlist] GET error:', err)
    return c.json({ data: null, error: 'Database error' }, 500)
  }
})

// POST /api/v1/user/watchlist/:id/tickers   body: { "ticker": "TSLA" }
userRoutes.post('/watchlist/:id/tickers', async (c) => {
  const id = c.req.param('id')
  let ticker = ''
  try {
    const body = await c.req.json().catch(() => ({}))
    ticker = String(body?.ticker ?? '').toUpperCase().trim()
  } catch {
    return c.json({ data: null, error: 'Invalid JSON body' }, 400)
  }
  if (!ticker) {
    return c.json({ data: null, error: 'ticker required' }, 400)
  }

  try {
    const [list] = await db
      .select()
      .from(watchlists)
      .where(and(eq(watchlists.id, id), eq(watchlists.userId, DEMO_USER_ID)))

    if (!list) {
      return c.json({ data: null, error: 'Watchlist not found' }, 404)
    }
    if (list.tickers.includes(ticker)) {
      return c.json({ data: list, error: null })   // idempotent — already present
    }

    const [updated] = await db
      .update(watchlists)
      .set({ tickers: [...list.tickers, ticker] })
      .where(eq(watchlists.id, id))
      .returning()

    return c.json({ data: updated, error: null })
  } catch (err) {
    console.error('[watchlist] POST ticker error:', err)
    return c.json({ data: null, error: 'Database error' }, 500)
  }
})

// DELETE /api/v1/user/watchlist/:id/tickers/:ticker
userRoutes.delete('/watchlist/:id/tickers/:ticker', async (c) => {
  const id     = c.req.param('id')
  const ticker = decodeURIComponent(c.req.param('ticker')).toUpperCase()

  try {
    const [list] = await db
      .select()
      .from(watchlists)
      .where(and(eq(watchlists.id, id), eq(watchlists.userId, DEMO_USER_ID)))

    if (!list) {
      return c.json({ data: null, error: 'Watchlist not found' }, 404)
    }

    const [updated] = await db
      .update(watchlists)
      .set({ tickers: list.tickers.filter(t => t !== ticker) })
      .where(eq(watchlists.id, id))
      .returning()

    return c.json({ data: updated, error: null })
  } catch (err) {
    console.error('[watchlist] DELETE ticker error:', err)
    return c.json({ data: null, error: 'Database error' }, 500)
  }
})

// PUT /api/v1/user/watchlist/:id  body: { "name": "Biotech Picks" }
userRoutes.put('/watchlist/:id', async (c) => {
  const id = c.req.param('id')
  let name = ''
  try {
    const body = await c.req.json().catch(() => ({}))
    name = String(body?.name ?? '').trim()
  } catch {
    return c.json({ data: null, error: 'Invalid JSON body' }, 400)
  }
  if (!name) {
    return c.json({ data: null, error: 'name required' }, 400)
  }

  try {
    const [updated] = await db
      .update(watchlists)
      .set({ name })
      .where(and(eq(watchlists.id, id), eq(watchlists.userId, DEMO_USER_ID)))
      .returning()

    if (!updated) {
      return c.json({ data: null, error: 'Watchlist not found' }, 404)
    }
    return c.json({ data: updated, error: null })
  } catch (err) {
    console.error('[watchlist] PUT name error:', err)
    return c.json({ data: null, error: 'Database error' }, 500)
  }
})
