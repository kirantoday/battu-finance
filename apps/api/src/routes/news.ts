import { Hono } from 'hono'
import { newsProvider } from '@battu/data'
import type { NewsArticle } from '@battu/shared'

export const newsRoutes = new Hono()

// ── In-memory cache ─────────────────────────────────────────────────────────
// NewsAPI's free tier ships 100 requests / day. We cache per URL+query for 15
// minutes so navigation doesn't burn through the quota during dev. Redis goes
// here once we're past the prototype.
const CACHE_TTL = 15 * 60 * 1000  // 15 minutes
const newsCache = new Map<string, { data: NewsArticle[]; cachedAt: number }>()

function getCached(key: string): NewsArticle[] | null {
  const entry = newsCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.cachedAt > CACHE_TTL) {
    newsCache.delete(key)
    return null
  }
  return entry.data
}

function setCache(key: string, data: NewsArticle[]): void {
  newsCache.set(key, { data, cachedAt: Date.now() })
}

// Static paths must be registered before /:ticker — otherwise Hono treats
// "headlines" / "search" as ticker values.

// GET /api/v1/news/headlines/top — top market headlines (N / TOP commands)
newsRoutes.get('/headlines/top', async (c) => {
  const limit = parseInt(c.req.query('limit') || '30')
  const cacheKey = `top:${limit}`
  let articles = getCached(cacheKey)
  let cached = true
  if (!articles) {
    cached = false
    articles = await newsProvider.getTopHeadlines({ limit })
    if (articles.length > 0) setCache(cacheKey, articles)
  }
  return c.json({
    data:     articles,
    error:    null,
    provider: newsProvider.providerName,
    count:    articles.length,
    cached,
  })
})

// GET /api/v1/news/search?q={query} — free-text search
newsRoutes.get('/search', async (c) => {
  const query = (c.req.query('q') || '').trim()
  if (!query) {
    return c.json({ data: [], error: 'q param required', count: 0, provider: newsProvider.providerName })
  }
  const limit = parseInt(c.req.query('limit') || '20')
  const cacheKey = `search:${query.toLowerCase()}:${limit}`
  let articles = getCached(cacheKey)
  let cached = true
  if (!articles) {
    cached = false
    articles = await newsProvider.search(query, { limit })
    if (articles.length > 0) setCache(cacheKey, articles)
  }
  return c.json({
    data:     articles,
    error:    null,
    provider: newsProvider.providerName,
    query,
    count:    articles.length,
    cached,
  })
})

// GET /api/v1/news/:ticker — ticker-specific news (NI / CN commands)
newsRoutes.get('/:ticker', async (c) => {
  const ticker = c.req.param('ticker').toUpperCase()
  // Defense against the wildcard path catching reserved subpaths
  if (ticker === 'HEADLINES' || ticker === 'SEARCH') {
    return c.json({ data: null, error: 'Use /headlines/top or /search', count: 0 }, 400)
  }
  const limit = parseInt(c.req.query('limit') || '30')
  const cacheKey = `ticker:${ticker}:${limit}`
  let articles = getCached(cacheKey)
  let cached = true
  if (!articles) {
    cached = false
    articles = await newsProvider.getTickerNews(ticker, { limit })
    if (articles.length > 0) setCache(cacheKey, articles)
  }
  return c.json({
    data:     articles,
    error:    null,
    provider: newsProvider.providerName,
    ticker,
    count:    articles.length,
    cached,
  })
})
