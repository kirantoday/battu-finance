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

// ── Theme System ──────────────────────────────────────────────────────────────

export type ThemeName = 'amber' | 'ice' | 'phosphor'

export interface ThemeTokens {
  bg:           string
  surface:      string
  border:       string
  text:         string
  muted:        string
  accent:       string
  positive:     string
  negative:     string
  warning:      string
  cursor:       string
  headerBg:     string
  cmdBg:        string
  screenBg:     string
  tickerBg:     string
  labelColor:   string
  valueColor:   string
  titleColor:   string
  divider:      string
  scrollbar:    string
  glow:         string
}

export const THEMES: Record<ThemeName, { label: string; tokens: ThemeTokens }> = {
  amber: {
    label: 'Amber Terminal',
    tokens: {
      bg:           '#0D0A00',
      surface:      '#130E00',
      border:       '#1F1500',
      text:         '#F5CC60',
      muted:        '#78530A',
      accent:       '#F59E0B',
      positive:     '#86C232',
      negative:     '#CC4444',
      warning:      '#F59E0B',
      cursor:       '#F59E0B',
      headerBg:     '#0A0700',
      cmdBg:        '#100D00',
      screenBg:     '#0D0A00',
      tickerBg:     '#0A0700',
      labelColor:   '#78530A',
      valueColor:   '#F5CC60',
      titleColor:   '#F59E0B',
      divider:      '#1F1500',
      scrollbar:    '#1F1500',
      glow:         'none',
    },
  },
  ice: {
    label: 'Ice Blue',
    tokens: {
      bg:           '#020B18',
      surface:      '#041020',
      border:       '#0A2030',
      text:         '#E2E8F0',
      muted:        '#1E5070',
      accent:       '#38BDF8',
      positive:     '#34D399',
      negative:     '#F87171',
      warning:      '#FBBF24',
      cursor:       '#38BDF8',
      headerBg:     '#020B18',
      cmdBg:        '#041020',
      screenBg:     '#020B18',
      tickerBg:     '#020B18',
      labelColor:   '#1E5070',
      valueColor:   '#CBD5E1',
      titleColor:   '#38BDF8',
      divider:      '#0A2030',
      scrollbar:    '#0A2030',
      glow:         'none',
    },
  },
  phosphor: {
    label: 'Green Phosphor',
    tokens: {
      bg:           '#010801',
      surface:      '#010A01',
      border:       '#003300',
      text:         '#00CC33',
      muted:        '#005520',
      accent:       '#00FF41',
      positive:     '#00FF41',
      negative:     '#FF4444',
      warning:      '#FFCC00',
      cursor:       '#00FF41',
      headerBg:     '#010801',
      cmdBg:        '#010A01',
      screenBg:     '#010801',
      tickerBg:     '#010801',
      labelColor:   '#005520',
      valueColor:   '#00AA2A',
      titleColor:   '#00FF41',
      divider:      '#003300',
      scrollbar:    '#002200',
      glow:         '0 0 8px rgba(0,255,65,0.35)',
    },
  },
}

export const DEFAULT_THEME: ThemeName = 'amber'
