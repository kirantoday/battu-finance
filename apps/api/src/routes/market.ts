import { Hono } from 'hono'
import { marketProvider } from '@battu/data'
import { TIMEFRAME_MAP } from '@battu/shared'

export const marketRoutes = new Hono()

// Static paths must be registered before /:ticker to avoid `quotes`/`movers`
// being parsed as a ticker value.

// GET /api/v1/market/quotes?tickers=AAPL,MSFT,NVDA — batch quotes (WL)
marketRoutes.get('/quotes', async (c) => {
  const tickersParam = c.req.query('tickers') || ''
  if (!tickersParam) {
    return c.json({ data: [], error: 'tickers query param required', provider: marketProvider.providerName })
  }
  const tickers = tickersParam.split(',').map(t => t.trim().toUpperCase()).filter(Boolean)
  const quotes = await marketProvider.getQuotes(tickers)
  return c.json({ data: quotes, error: null, provider: marketProvider.providerName })
})

// GET /api/v1/market/bars/:ticker?timeframe=3M — OHLCV for GP chart
marketRoutes.get('/bars/:ticker', async (c) => {
  const ticker    = c.req.param('ticker').toUpperCase()
  const timeframe = (c.req.query('timeframe') || '3M').toUpperCase()
  const tf        = TIMEFRAME_MAP[timeframe] || TIMEFRAME_MAP['3M']
  const bars = await marketProvider.getBars(ticker, tf)
  return c.json({ data: bars, error: null, provider: marketProvider.providerName, timeframe })
})

// GET /api/v1/market/movers/:direction — gainers | losers | active
marketRoutes.get('/movers/:direction', async (c) => {
  const direction = c.req.param('direction') as 'gainers' | 'losers' | 'active'
  if (!['gainers', 'losers', 'active'].includes(direction)) {
    return c.json({ data: null, error: 'direction must be gainers, losers, or active' }, 400)
  }
  const movers = await marketProvider.getMovers(direction)
  return c.json({ data: movers, error: null, provider: marketProvider.providerName })
})

// GET /api/v1/market/price/:ticker — single quote (DES, QR, WL)
marketRoutes.get('/price/:ticker', async (c) => {
  const ticker = c.req.param('ticker').toUpperCase()
  const quote = await marketProvider.getQuote(ticker)
  if (!quote) {
    return c.json({ data: null, error: `No quote found for ${ticker}`, provider: marketProvider.providerName }, 404)
  }
  return c.json({ data: quote, error: null, provider: marketProvider.providerName })
})

// Legacy stub kept for back-compat with the validation suite — same data as bars
marketRoutes.get('/ohlcv/:ticker', async (c) => {
  const ticker    = c.req.param('ticker').toUpperCase()
  const timeframe = (c.req.query('timeframe') || '3M').toUpperCase()
  const tf        = TIMEFRAME_MAP[timeframe] || TIMEFRAME_MAP['3M']
  const bars = await marketProvider.getBars(ticker, tf)
  return c.json({ data: bars, error: null, provider: marketProvider.providerName, timeframe })
})
