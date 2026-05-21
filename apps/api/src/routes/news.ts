import { Hono } from 'hono'
import { newsProvider } from '@battu/data'

export const newsRoutes = new Hono()

// Static paths must be registered before /:ticker — otherwise Hono treats
// "headlines" / "search" as ticker values.

// GET /api/v1/news/headlines/top — top market headlines
newsRoutes.get('/headlines/top', async (c) => {
  const limit = parseInt(c.req.query('limit') || '20')
  const articles = await newsProvider.getTopHeadlines({ limit })
  return c.json({ data: articles, error: null, provider: newsProvider.providerName })
})

// GET /api/v1/news/search?q={query} — free-text search
newsRoutes.get('/search', async (c) => {
  const query = c.req.query('q') || ''
  if (!query) return c.json({ data: [], error: 'q param required', provider: newsProvider.providerName })
  const limit = parseInt(c.req.query('limit') || '20')
  const articles = await newsProvider.search(query, { limit })
  return c.json({ data: articles, error: null, provider: newsProvider.providerName })
})

// GET /api/v1/news/:ticker — news for a specific ticker
newsRoutes.get('/:ticker', async (c) => {
  const ticker = c.req.param('ticker').toUpperCase()
  const limit = parseInt(c.req.query('limit') || '20')
  const articles = await newsProvider.getTickerNews(ticker, { limit })
  return c.json({ data: articles, error: null, provider: newsProvider.providerName })
})
