// Yahoo Finance — development market data provider.
// Free, no auth. Requires User-Agent header on every request (Yahoo 401s otherwise).

import type { MarketProvider, MarketQuote, OHLCVBar } from '@battu/shared'

const BASE = 'https://query1.finance.yahoo.com'
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept':     'application/json',
}

interface YahooChartMeta {
  symbol:                  string
  longName?:               string
  shortName?:              string
  regularMarketPrice:      number
  regularMarketDayHigh:    number
  regularMarketDayLow:     number
  regularMarketVolume:     number
  regularMarketTime:       number   // seconds since epoch
  chartPreviousClose:      number
  fiftyTwoWeekHigh:        number
  fiftyTwoWeekLow:         number
  currency?:               string
  fullExchangeName?:       string
  exchangeName?:           string
  preMarketPrice?:         number
  postMarketPrice?:        number
}

interface YahooChartQuote {
  open?:   (number | null)[]
  high?:   (number | null)[]
  low?:    (number | null)[]
  close?:  (number | null)[]
  volume?: (number | null)[]
}

interface YahooChartResult {
  meta:        YahooChartMeta
  timestamp?:  number[]
  indicators?: {
    quote?:    YahooChartQuote[]
    adjclose?: Array<{ adjclose?: (number | null)[] }>
  }
}

interface YahooScreenerQuote {
  symbol:                       string
  longName?:                    string
  shortName?:                   string
  regularMarketPrice?:          number
  regularMarketOpen?:           number
  regularMarketDayHigh?:        number
  regularMarketDayLow?:         number
  regularMarketPreviousClose?:  number
  regularMarketChange?:         number
  regularMarketChangePercent?:  number
  regularMarketVolume?:         number
  regularMarketTime?:           number
  averageDailyVolume3Month?:    number
  marketCap?:                   number
  fiftyTwoWeekHigh?:            number
  fiftyTwoWeekLow?:             number
  currency?:                    string
  fullExchangeName?:            string
  exchangeName?:                string
}

export class YahooFinanceClient implements MarketProvider {
  readonly providerName = 'yahoo' as const

  /** Fetch raw chart payload for a ticker/range/interval combo. */
  private async fetchChart(ticker: string, range: string, interval: string): Promise<YahooChartResult | null> {
    const url = `${BASE}/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${interval}&range=${range}`
    try {
      const res = await fetch(url, { headers: HEADERS })
      if (!res.ok) {
        console.warn(`[yahoo] chart fetch failed: ${ticker} ${res.status}`)
        return null
      }
      const json = await res.json() as { chart?: { result?: YahooChartResult[] | null; error?: unknown } }
      return json.chart?.result?.[0] ?? null
    } catch (err) {
      console.warn(`[yahoo] chart fetch error: ${ticker} ${(err as Error).message}`)
      return null
    }
  }

  async getQuote(ticker: string): Promise<MarketQuote | null> {
    try {
      const result = await this.fetchChart(ticker, '1d', '1d')
      if (!result) return null
      const meta = result.meta
      const q = result.indicators?.quote?.[0]
      return {
        ticker:          meta.symbol,
        name:            meta.longName || meta.shortName || meta.symbol,
        price:           meta.regularMarketPrice,
        open:            q?.open?.[0] ?? meta.regularMarketPrice,
        high:            meta.regularMarketDayHigh,
        low:             meta.regularMarketDayLow,
        prevClose:       meta.chartPreviousClose,
        change:          meta.regularMarketPrice - meta.chartPreviousClose,
        changePct:       meta.chartPreviousClose
          ? ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose) * 100
          : 0,
        volume:          meta.regularMarketVolume,
        week52High:      meta.fiftyTwoWeekHigh,
        week52Low:       meta.fiftyTwoWeekLow,
        currency:        meta.currency || 'USD',
        exchange:        meta.fullExchangeName || meta.exchangeName || '',
        timestamp:       meta.regularMarketTime * 1000,
        preMarketPrice:  meta.preMarketPrice ?? undefined,
        postMarketPrice: meta.postMarketPrice ?? undefined,
      }
    } catch (err) {
      console.error('[yahoo] getQuote error:', ticker, err)
      return null
    }
  }

  async getQuotes(tickers: string[]): Promise<MarketQuote[]> {
    // Yahoo has no batch chart endpoint on the public path — fetch sequentially with
    // a small delay so we don't get throttled on a watchlist of 20+ tickers.
    const results: MarketQuote[] = []
    for (const ticker of tickers) {
      const quote = await this.getQuote(ticker)
      if (quote) results.push(quote)
      await new Promise(r => setTimeout(r, 100))
    }
    return results
  }

  async getBars(ticker: string, opts: { range: string; interval: string }): Promise<OHLCVBar[]> {
    try {
      const result = await this.fetchChart(ticker, opts.range, opts.interval)
      if (!result) return []
      const timestamps = result.timestamp ?? []
      const q = result.indicators?.quote?.[0] ?? {}
      const adjclose = result.indicators?.adjclose?.[0]?.adjclose ?? []

      const bars: OHLCVBar[] = timestamps.map((ts, i) => ({
        timestamp: ts * 1000,
        open:      q.open?.[i]   ?? 0,
        high:      q.high?.[i]   ?? 0,
        low:       q.low?.[i]    ?? 0,
        close:     adjclose[i]   ?? q.close?.[i] ?? 0,
        volume:    q.volume?.[i] ?? 0,
      }))
      // Yahoo includes null bars for market holidays — drop those.
      return bars.filter(b => b.open > 0)
    } catch (err) {
      console.error('[yahoo] getBars error:', ticker, err)
      return []
    }
  }

  async getMovers(direction: 'gainers' | 'losers' | 'active'): Promise<MarketQuote[]> {
    try {
      const screenMap = {
        gainers: 'day_gainers',
        losers:  'day_losers',
        active:  'most_actives',
      } as const
      const screen = screenMap[direction]
      const url = `${BASE}/v1/finance/screener/predefined/saved?scrIds=${screen}&count=20`
      const res = await fetch(url, { headers: HEADERS })
      if (!res.ok) {
        console.warn(`[yahoo] movers fetch failed: ${direction} ${res.status}`)
        return []
      }
      const json = await res.json() as {
        finance?: { result?: Array<{ quotes?: YahooScreenerQuote[] }> }
      }
      const quotes = json.finance?.result?.[0]?.quotes ?? []
      return quotes.map((q): MarketQuote => ({
        ticker:     q.symbol,
        name:       q.longName || q.shortName || q.symbol,
        price:      q.regularMarketPrice ?? 0,
        open:       q.regularMarketOpen ?? q.regularMarketPrice ?? 0,
        high:       q.regularMarketDayHigh ?? q.regularMarketPrice ?? 0,
        low:        q.regularMarketDayLow  ?? q.regularMarketPrice ?? 0,
        prevClose:  q.regularMarketPreviousClose ?? q.regularMarketPrice ?? 0,
        change:     q.regularMarketChange ?? 0,
        changePct:  q.regularMarketChangePercent ?? 0,
        volume:     q.regularMarketVolume ?? 0,
        avgVolume:  q.averageDailyVolume3Month,
        marketCap:  q.marketCap,
        week52High: q.fiftyTwoWeekHigh ?? 0,
        week52Low:  q.fiftyTwoWeekLow ?? 0,
        currency:   q.currency || 'USD',
        exchange:   q.fullExchangeName || q.exchangeName || '',
        timestamp:  (q.regularMarketTime ?? Date.now() / 1000) * 1000,
      }))
    } catch (err) {
      console.error('[yahoo] getMovers error:', err)
      return []
    }
  }
}
