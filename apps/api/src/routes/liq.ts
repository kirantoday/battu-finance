import { Hono } from 'hono'
import { db, liqCache, eq } from '@battu/db'
import { computeLIQ } from '@battu/edgar'
import type { LIQData } from '@battu/edgar'
import { fmpClient } from '@battu/data'

export const liqRoutes = new Hono()

// Cache TTL — 90 days per CLAUDE.md guidance ("Cache aggressively")
const CACHE_TTL_MS = 90 * 24 * 60 * 60 * 1000

function isCacheFresh(computedAt: Date): boolean {
  return Date.now() - computedAt.getTime() < CACHE_TTL_MS
}

async function upsertCache(ticker: string, data: LIQData) {
  await db
    .insert(liqCache)
    .values({
      ticker,
      computedAt:       new Date(data.computedAt),
      data:             data as unknown as Record<string, unknown>,
      sourceFilings:    data.sources as unknown as Record<string, unknown>,
      ingestionVersion: 'v1',
      tickerCik:        null,
    })
    .onConflictDoUpdate({
      target: liqCache.ticker,
      set: {
        computedAt:    new Date(data.computedAt),
        data:          data as unknown as Record<string, unknown>,
        sourceFilings: data.sources as unknown as Record<string, unknown>,
      },
    })
}

// GET /api/v1/liq/:ticker — cache-first, computes on miss
liqRoutes.get('/:ticker', async (c) => {
  const ticker = c.req.param('ticker').toUpperCase()

  // 1. Check cache
  try {
    const cached = await db
      .select()
      .from(liqCache)
      .where(eq(liqCache.ticker, ticker))
      .limit(1)

    if (cached.length > 0 && cached[0].computedAt) {
      const fresh = isCacheFresh(cached[0].computedAt)
      return c.json({
        data:       cached[0].data as LIQData,
        error:      null,
        cached:     true,
        stale:      !fresh,
        computedAt: cached[0].computedAt,
      })
    }
  } catch (err) {
    console.error('[liq] cache read error:', err)
  }

  // 2. On-demand compute
  console.log(`[liq] Computing on-demand for ${ticker}...`)
  try {
    const liqData = await computeLIQ(ticker, fmpClient)
    await upsertCache(ticker, liqData)
    return c.json({
      data:       liqData,
      error:      null,
      cached:     false,
      computedAt: new Date(liqData.computedAt),
    })
  } catch (err) {
    console.error('[liq] compute error:', err)
    return c.json({ data: null, error: `Failed to compute LIQ for ${ticker}` }, 500)
  }
})

// POST /api/v1/liq/:ticker/refresh — force recompute, bypass cache
liqRoutes.post('/:ticker/refresh', async (c) => {
  const ticker = c.req.param('ticker').toUpperCase()
  console.log(`[liq] Force refresh for ${ticker}...`)

  try {
    const liqData = await computeLIQ(ticker, fmpClient)
    await upsertCache(ticker, liqData)
    return c.json({
      data:       liqData,
      error:      null,
      cached:     false,
      computedAt: new Date(liqData.computedAt),
    })
  } catch (err) {
    console.error('[liq] refresh error:', err)
    return c.json({ data: null, error: String(err) }, 500)
  }
})
