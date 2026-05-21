// Massive / Polygon — production market data provider.
// Uses api.polygon.io endpoints (same after the Massive rebrand).
// Snapshot endpoint requires the paid Starter plan ($29/mo).

import type { MarketProvider, MarketQuote, OHLCVBar } from '@battu/shared'

const BASE = 'https://api.polygon.io'

interface PolygonSnapDay { o?: number; h?: number; l?: number; c?: number; v?: number; vw?: number }
interface PolygonSnapQuote { P?: number; p?: number; S?: number; s?: number; t?: number }
interface PolygonSnapTrade { p?: number; s?: number; t?: number; x?: number; i?: string }

interface PolygonSnap {
  ticker:            string
  todaysChange?:     number
  todaysChangePerc?: number
  day?:              PolygonSnapDay
  prevDay?:          PolygonSnapDay
  lastTrade?:        PolygonSnapTrade
  lastQuote?:        PolygonSnapQuote
}

interface PolygonAggBar { t: number; o: number; h: number; l: number; c: number; v: number; vw?: number }

export class MassiveClient implements MarketProvider {
  readonly providerName = 'massive' as const

  constructor(private apiKey: string) {}

  private get headers(): Record<string, string> {
    return { 'Authorization': `Bearer ${this.apiKey}` }
  }

  private mapSnapshot(snap: PolygonSnap): MarketQuote {
    const day  = snap.day  ?? {}
    const prev = snap.prevDay ?? {}
    return {
      ticker:     snap.ticker,
      name:       snap.ticker,   // snapshot doesn't include company name
      price:      snap.lastTrade?.p ?? day.c ?? 0,
      open:       day.o ?? 0,
      high:       day.h ?? 0,
      low:        day.l ?? 0,
      prevClose:  prev.c ?? 0,
      change:     snap.todaysChange ?? 0,
      changePct:  snap.todaysChangePerc ?? 0,
      volume:     day.v ?? 0,
      vwap:       day.vw,
      week52High: 0,            // not in snapshot
      week52Low:  0,
      currency:   'USD',
      exchange:   '',
      timestamp:  snap.lastTrade?.t ?? Date.now(),
      bid:        snap.lastQuote?.P,
      ask:        snap.lastQuote?.p,
    }
  }

  async getQuote(ticker: string): Promise<MarketQuote | null> {
    try {
      const res = await fetch(
        `${BASE}/v2/snapshot/locale/us/markets/stocks/tickers/${encodeURIComponent(ticker)}`,
        { headers: this.headers }
      )
      if (!res.ok) {
        console.warn(`[massive] snapshot ${ticker}: ${res.status} — check plan tier`)
        return null
      }
      const json = await res.json() as { ticker?: PolygonSnap }
      if (!json.ticker) return null
      return this.mapSnapshot(json.ticker)
    } catch (err) {
      console.error('[massive] getQuote error:', ticker, err)
      return null
    }
  }

  async getQuotes(tickers: string[]): Promise<MarketQuote[]> {
    try {
      const tickerList = tickers.join(',')
      const res = await fetch(
        `${BASE}/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${encodeURIComponent(tickerList)}`,
        { headers: this.headers }
      )
      if (!res.ok) {
        console.warn(`[massive] batch snapshot failed: ${res.status}`)
        return []
      }
      const json = await res.json() as { tickers?: PolygonSnap[] }
      return (json.tickers ?? []).map(s => this.mapSnapshot(s))
    } catch (err) {
      console.error('[massive] getQuotes error:', err)
      return []
    }
  }

  async getBars(ticker: string, opts: { range: string; interval: string }): Promise<OHLCVBar[]> {
    try {
      // Yahoo-style interval → Polygon multiplier+timespan
      const intervalMap: Record<string, { multiplier: number; timespan: string }> = {
        '1m':  { multiplier: 1,  timespan: 'minute' },
        '5m':  { multiplier: 5,  timespan: 'minute' },
        '15m': { multiplier: 15, timespan: 'minute' },
        '30m': { multiplier: 30, timespan: 'minute' },
        '1h':  { multiplier: 1,  timespan: 'hour'   },
        '1d':  { multiplier: 1,  timespan: 'day'    },
        '1wk': { multiplier: 1,  timespan: 'week'   },
        '1mo': { multiplier: 1,  timespan: 'month'  },
      }
      const { multiplier, timespan } = intervalMap[opts.interval] ?? { multiplier: 1, timespan: 'day' }

      // Yahoo-style range → days lookback
      const rangeMap: Record<string, number> = {
        '1d': 1, '5d': 5, '1mo': 30, '3mo': 90,
        '6mo': 180, '1y': 365, '2y': 730, '5y': 1825, '10y': 3650,
      }
      const to = new Date()
      const from = new Date()
      from.setDate(from.getDate() - (rangeMap[opts.range] ?? 90))
      const fromStr = from.toISOString().split('T')[0]
      const toStr   = to.toISOString().split('T')[0]

      const res = await fetch(
        `${BASE}/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/${multiplier}/${timespan}/${fromStr}/${toStr}?adjusted=true&sort=asc&limit=5000`,
        { headers: this.headers }
      )
      if (!res.ok) {
        console.warn(`[massive] aggs ${ticker}: ${res.status}`)
        return []
      }
      const json = await res.json() as { results?: PolygonAggBar[] }
      return (json.results ?? []).map((bar): OHLCVBar => ({
        timestamp: bar.t,
        open:      bar.o,
        high:      bar.h,
        low:       bar.l,
        close:     bar.c,
        volume:    bar.v,
        vwap:      bar.vw,
      }))
    } catch (err) {
      console.error('[massive] getBars error:', ticker, err)
      return []
    }
  }

  async getMovers(direction: 'gainers' | 'losers' | 'active'): Promise<MarketQuote[]> {
    try {
      // Polygon doesn't expose a true "most active" endpoint — fall back to gainers.
      const endpoint = direction === 'losers' ? 'losers' : 'gainers'
      const res = await fetch(
        `${BASE}/v2/snapshot/locale/us/markets/stocks/${endpoint}`,
        { headers: this.headers }
      )
      if (!res.ok) {
        console.warn(`[massive] movers ${endpoint}: ${res.status}`)
        return []
      }
      const json = await res.json() as { tickers?: PolygonSnap[] }
      return (json.tickers ?? []).map(s => this.mapSnapshot(s))
    } catch (err) {
      console.error('[massive] getMovers error:', err)
      return []
    }
  }
}
