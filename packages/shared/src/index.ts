// ── Tiers ────────────────────────────────────────────────────────────────────
export type UserTier = 'free' | 'analyst' | 'professional' | 'institutional'

export const TIER_LIMITS: Record<UserTier, {
  realtimePrices: boolean
  historyYears: number
  watchlistMax: number
  askQueriesPerMonth: number
  screens: string[]
}> = {
  free: {
    realtimePrices: false,
    historyYears: 2,
    watchlistMax: 3,
    askQueriesPerMonth: 0,
    screens: ['DES', 'GP', 'FA'],
  },
  analyst: {
    realtimePrices: true,
    historyYears: 10,
    watchlistMax: 999,
    askQueriesPerMonth: 50,
    screens: ['DES','GP','GIP','HP','QR','FA','NI','LIQ','WL',
              'EE','ANR','RV','OWN','EQS','EVTS','MOST','SECF',
              'GPC','COMP','SCTR','DVD'],
  },
  professional: {
    realtimePrices: true,
    historyYears: 20,
    watchlistMax: 999,
    askQueriesPerMonth: 999999,
    screens: ['ALL'],
  },
  institutional: {
    realtimePrices: true,
    historyYears: 20,
    watchlistMax: 999,
    askQueriesPerMonth: 999999,
    screens: ['ALL'],
  },
}

// ── Commands ─────────────────────────────────────────────────────────────────
export type ScreenCommand =
  | 'DES' | 'GP' | 'GIP' | 'HP' | 'QR'
  | 'FA' | 'EE' | 'ANR' | 'RV' | 'EQS'
  | 'CN' | 'NI' | 'N' | 'TOP'
  | 'LIQ' | 'OWN' | 'SECF'
  | 'ECO' | 'MOV' | 'MOST' | 'W'
  | 'GPC' | 'COMP' | 'SCTR' | 'DVD'
  | 'EVTS' | 'ERN' | 'WL' | 'PORT'
  | 'ASK'

export interface ParsedCommand {
  screen: ScreenCommand
  ticker?: string           // primary ticker (uppercase)
  tickers?: string[]        // for GPC multi-ticker
  timeframe?: string        // for GP: '1D'|'1W'|'1M'|'3M'|'1Y'|'5Y'
  query?: string            // for /ask natural language
  raw: string               // original raw input
}

export const COMMAND_DESCRIPTIONS: Record<ScreenCommand, string> = {
  DES:   'Security description — company overview, key stats',
  GP:    'Price chart — candlestick with indicators',
  GIP:   'Intraday graph — real-time tick chart',
  HP:    'Historical prices — daily OHLCV table',
  QR:    'Quote recap — bid/ask/VWAP snapshot',
  FA:    'Financial analysis — IS/BS/CF statements',
  EE:    'Earnings estimates — consensus EPS/revenue',
  ANR:   'Analyst recommendations — ratings & price targets',
  RV:    'Relative valuation — comp table vs peers',
  EQS:   'Equity screener — multi-factor stock filter',
  CN:    'Company news — ticker-specific headlines',
  NI:    'News — same as CN',
  N:     'Market news — broad financial news feed',
  TOP:   'Top headlines — market-moving news',
  LIQ:   'Liquidity — cash runway & shelf registration',
  OWN:   'Ownership — 13F institutional holders',
  SECF:  'SEC filings — 10-K, 10-Q, 8-K, 13F',
  ECO:   'Economic calendar — macro releases',
  MOV:   'Market movers — top gainers/losers',
  MOST:  'Most active — highest volume movers',
  W:     'World markets — global indices dashboard',
  GPC:   'Graph price comparison — multi-ticker overlay',
  COMP:  'Comparable companies — peer list',
  SCTR:  'Sector analysis — sector performance',
  DVD:   'Dividend history',
  EVTS:  'Earnings calendar — upcoming events',
  ERN:   'Earnings calendar — same as EVTS',
  WL:    'Watchlist — live price monitor',
  PORT:  'Portfolio — P&L and exposure',
  ASK:   'AI query — natural language research',
}

// ── Theme ─────────────────────────────────────────────────────────────────────
export const THEME = {
  bg:       '#0A0E1A',
  surface:  '#111827',
  border:   '#1F2937',
  text:     '#E8E8E8',
  muted:    '#6B7280',
  accent:   '#2E86DE',
  positive: '#10B981',
  negative: '#EF4444',
  warning:  '#F59E0B',
  cursor:   '#F59E0B',
} as const

// ── API Response Types ────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  data: T | null
  error: string | null
  cached?: boolean
  cachedAt?: string
}

export interface TickerPrice {
  ticker: string
  price: number
  change: number
  changePct: number
  volume: number
  high: number
  low: number
  open: number
  prevClose: number
  bid?: number
  ask?: number
  vwap?: number
  timestamp: number
}
