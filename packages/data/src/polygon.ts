// Polygon.io REST client — thin typed wrapper.
// Reference: https://polygon.io/docs/stocks/

export interface PolygonBar {
  o: number   // open
  h: number   // high
  l: number   // low
  c: number   // close
  v: number   // volume
  vw: number  // vwap
  t: number   // unix ms
  n: number   // number of trades
}

export interface PolygonSnapshotDay {
  o: number; h: number; l: number; c: number; v: number; vw: number
}

export interface PolygonSnapshotMin {
  o: number; h: number; l: number; c: number; v: number; vw: number; t: number; n: number
}

export interface PolygonSnapshotQuote {
  P: number   // ask price
  S: number   // ask size
  p: number   // bid price
  s: number   // bid size
  t: number   // timestamp
}

export interface PolygonSnapshotTrade {
  c: number[]   // conditions
  i: string     // trade id
  p: number     // price
  s: number     // size
  t: number     // timestamp ns
  x: number     // exchange id
}

export interface PolygonSnapshot {
  ticker: string
  todaysChange: number
  todaysChangePerc: number
  updated: number
  day: PolygonSnapshotDay
  min?: PolygonSnapshotMin
  prevDay: PolygonSnapshotDay
  lastQuote?: PolygonSnapshotQuote
  lastTrade?: PolygonSnapshotTrade
}

export interface AggsOptions {
  multiplier: number
  timespan: 'minute' | 'hour' | 'day' | 'week' | 'month'
  from: string   // YYYY-MM-DD
  to: string     // YYYY-MM-DD
  adjusted?: boolean
  limit?: number
}

export class PolygonClient {
  private baseUrl = 'https://api.polygon.io'

  constructor(private apiKey: string) {}

  private async get<T>(path: string, params: Record<string, string | number | boolean> = {}): Promise<T> {
    const url = new URL(this.baseUrl + path)
    url.searchParams.set('apiKey', this.apiKey)
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, String(v))
    }
    const res = await fetch(url.toString())
    if (!res.ok) {
      throw new Error(`Polygon ${path} failed: ${res.status} ${res.statusText}`)
    }
    return res.json() as Promise<T>
  }

  // GET /v2/snapshot/locale/us/markets/stocks/tickers/{ticker}
  async getSnapshot(ticker: string): Promise<PolygonSnapshot> {
    const res = await this.get<{ ticker: PolygonSnapshot }>(
      `/v2/snapshot/locale/us/markets/stocks/tickers/${ticker.toUpperCase()}`
    )
    return res.ticker
  }

  // GET /v2/aggs/ticker/{ticker}/range/{mult}/{timespan}/{from}/{to}
  async getAggs(ticker: string, opts: AggsOptions): Promise<PolygonBar[]> {
    const { multiplier, timespan, from, to, adjusted = true, limit = 5000 } = opts
    const res = await this.get<{ results?: PolygonBar[] }>(
      `/v2/aggs/ticker/${ticker.toUpperCase()}/range/${multiplier}/${timespan}/${from}/${to}`,
      { adjusted, limit, sort: 'asc' }
    )
    return res.results ?? []
  }

  // GET /v2/snapshot/locale/us/markets/stocks/{gainers|losers}
  async getMovers(direction: 'gainers' | 'losers'): Promise<PolygonSnapshot[]> {
    const res = await this.get<{ tickers?: PolygonSnapshot[] }>(
      `/v2/snapshot/locale/us/markets/stocks/${direction}`
    )
    return res.tickers ?? []
  }

  // WebSocket message builders — actual WS singleton lives in the frontend.
  buildSubscribeMessage(tickers: string[]): string {
    const channels = tickers.map(t => `T.${t.toUpperCase()}`).join(',')
    return JSON.stringify({ action: 'subscribe', params: channels })
  }

  buildUnsubscribeMessage(tickers: string[]): string {
    const channels = tickers.map(t => `T.${t.toUpperCase()}`).join(',')
    return JSON.stringify({ action: 'unsubscribe', params: channels })
  }
}
