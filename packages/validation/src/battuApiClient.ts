// HTTP client for the BATTU API. Used by the validator to compare BATTU's
// data against the ground-truth file.
//
// Endpoints that have not been built yet return:
//   { data: null, error: 'Not yet implemented' }
// We detect that exact shape and return { ok: false, kind: 'MISSING_ENDPOINT' }
// so the runner reports MISSING_ENDPOINT rather than ERROR — letting us run
// the suite incrementally as screens come online.

interface ApiEnvelope<T> {
  data: T | null
  error: string | null
  cached?: boolean
  cachedAt?: string
}

export type FetchResult<T> =
  | { ok: true;  data: T }
  | { ok: false; kind: 'MISSING_ENDPOINT' | 'ERROR'; message: string }

const BASE_URL = process.env.BATTU_API_URL || 'http://localhost:3000'

async function call<T>(path: string, init?: RequestInit): Promise<FetchResult<T>> {
  const url = `${BASE_URL}${path}`
  let res: Response
  try {
    res = await fetch(url, init)
  } catch (e) {
    return { ok: false, kind: 'ERROR', message: `Network error: ${(e as Error).message}` }
  }

  if (res.status === 404) {
    return { ok: false, kind: 'MISSING_ENDPOINT', message: `404 ${path}` }
  }
  if (!res.ok) {
    return { ok: false, kind: 'ERROR', message: `HTTP ${res.status} on ${path}` }
  }

  let body: ApiEnvelope<T>
  try {
    body = (await res.json()) as ApiEnvelope<T>
  } catch (e) {
    return { ok: false, kind: 'ERROR', message: `Bad JSON: ${(e as Error).message}` }
  }

  if (body.error === 'Not yet implemented') {
    return { ok: false, kind: 'MISSING_ENDPOINT', message: `${path} — stub` }
  }
  if (body.error) {
    return { ok: false, kind: 'ERROR', message: body.error }
  }
  if (body.data === null || body.data === undefined) {
    return { ok: false, kind: 'ERROR', message: `Empty data on ${path}` }
  }
  return { ok: true, data: body.data }
}

// ── Response shapes ──
// Loose typings — fields may be present or absent depending on API maturity.
// The validator pulls keys out defensively.

export interface DESResponse {
  marketCap?:         number
  sharesOutstanding?: number
  peRatio?:           number
  eps?:               number
  dividendYield?:     number
  beta?:              number
}

export interface FAResponse {
  revenue?:         number
  grossMargin?:     number
  operatingMargin?: number
  netMargin?:       number
  totalDebt?:       number
  cash?:            number
}

export interface EEResponse {
  epsEstimateNTM?:     number
  revenueEstimateNTM?: number
}

export interface ANRResponse {
  consensusRating?: number
  priceTarget?:     number
}

export interface HPResponse {
  ticker: string
  date:   string
  close:  number
}

export interface LIQResponse {
  cashRunwayQtrs?:  number
  totalLiquidityB?: number
  cashAndEquivB?:   number
}

export interface PriceResponse {
  ticker: string
  price:  number
}

// ── Fetchers ──

export const fetchDES   = (ticker: string) =>
  call<DESResponse>(`/api/v1/fundamentals/profile/${ticker}`)

export const fetchFA    = (ticker: string) =>
  call<FAResponse>(`/api/v1/fundamentals/financials/${ticker}?period=annual&limit=1`)

export const fetchEE    = (ticker: string) =>
  call<EEResponse>(`/api/v1/fundamentals/estimates/${ticker}`)

export const fetchANR   = (ticker: string) =>
  call<ANRResponse>(`/api/v1/fundamentals/grades/${ticker}`)

export const fetchHP    = (ticker: string, date: string) =>
  call<HPResponse>(`/api/v1/market/ohlcv/${ticker}?from=${date}&to=${date}&timespan=day`)

export const fetchLIQ   = (ticker: string) =>
  call<LIQResponse>(`/api/v1/liq/${ticker}`)

export const fetchPrice = (ticker: string) =>
  call<PriceResponse>(`/api/v1/market/price/${ticker}`)

/** Health probe — used by the runner to decide whether the API is up at all. */
export async function ping(): Promise<{ up: boolean; message: string }> {
  try {
    const res = await fetch(`${BASE_URL}/health`)
    if (res.ok) return { up: true, message: `${BASE_URL} OK` }
    return { up: false, message: `${BASE_URL} returned ${res.status}` }
  } catch (e) {
    return { up: false, message: `${BASE_URL} unreachable: ${(e as Error).message}` }
  }
}

/** Bundle of all responses for a given ticker. */
export interface AllBattuResponses {
  des:    FetchResult<DESResponse>
  fa:     FetchResult<FAResponse>
  ee:     FetchResult<EEResponse>
  anr:    FetchResult<ANRResponse>
  hp:     FetchResult<HPResponse>
  liq:    FetchResult<LIQResponse>
  price:  FetchResult<PriceResponse>
}

export async function fetchAll(ticker: string, hpDate: string): Promise<AllBattuResponses> {
  const [des, fa, ee, anr, hp, liq, price] = await Promise.all([
    fetchDES(ticker),
    fetchFA(ticker),
    fetchEE(ticker),
    fetchANR(ticker),
    fetchHP(ticker, hpDate),
    fetchLIQ(ticker),
    fetchPrice(ticker),
  ])
  return { des, fa, ee, anr, hp, liq, price }
}
