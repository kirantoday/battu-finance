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
  | 'LIQ' | 'LEGAL' | 'LEG' | 'OWN' | 'SECF'
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
  LEGAL: 'Legal & governance — counsel, auditor, litigation',
  LEG:   'Legal & governance — same as LEGAL',
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

// ── LIQ (Liquidity / Cash Runway) ─────────────────────────────────────────────

export interface LIQData {
  ticker:              string
  computedAt:          string

  // Cash position
  cashAndEquivB:       number | null   // billions
  shortTermInvestB:    number | null
  quarterlyBurnB:      number | null
  cashRunwayQtrs:      number | null

  // Shelf registration
  hasShelf:            boolean
  shelfTotalB:         number | null
  shelfDrawdownsB:     number | null
  shelfRemainingB:     number | null
  shelfFilingDate:     string | null
  shelfExpiryDate:     string | null
  isATMProgram:        boolean

  // Credit facility
  hasCreditFacility:   boolean
  creditFacilityType:  string | null
  creditTotalB:        number | null
  creditDrawnB:        number | null
  creditUndrawnB:      number | null
  creditExpiryDate:    string | null
  creditLender:        string | null
  creditInterestRate:  string | null

  totalLiquidityB:     number | null

  // Governance flags — cross-referenced from company_governance so the LIQ
  // header can warn when a ticker has a going-concern note or an active SEC
  // investigation alongside its liquidity profile.
  hasGoingConcern:     boolean
  secInvestigation:    boolean

  sources: {
    balanceSheet?: string
    shelfFiling?:  string
    creditFiling?: string
    drawdowns?:    string[]
  }

  dataQuality:    'full' | 'partial' | 'minimal'
  missingFields:  string[]
}

// LEGAL screen — backed by battu.company_governance (populated by ingest:liq).
// Served from /api/v1/legal/:ticker; pure DB read, no per-request extraction.
export interface LEGALData {
  ticker:                string
  extractedAt:           string | null

  // Counsel
  counselPrimary:        string | null
  counselSpecial:        string | null

  // Audit
  auditorName:           string | null
  auditorSince:          string | null
  auditOpinionClean:     boolean
  hasGoingConcern:       boolean

  // Litigation
  litigationCount:       number | null
  litigationSummary:     string | null
  secInvestigation:      boolean
  regulatoryProceedings: string | null

  // FDA (biotech / pharma)
  fdaStatus:             string | null
  fdaLastAction:         string | null
  fdaLastDate:           string | null

  // Insider activity (placeholder — populated when insider feed lands)
  insiderNet90d:         string | null
  insiderLastDate:       string | null
  ceoActivity90d:        string | null

  // Sources
  source10kUrl:          string | null
  sourceS3Url:           string | null
  sourceProxyUrl:        string | null

  // Quality
  dataQuality:           'full' | 'partial' | 'minimal'
  missingFields:         string[]
}

export interface LIQProgress {
  step:    string
  done:    boolean
  error?:  string
}

// ── FA Financial Analysis (Income/Balance/CashFlow combined) ──────────────────

export interface FAStatement {
  period:             string         // "2024" or "Q1 2025"
  date:               string         // ISO date
  // Income statement
  revenue:            number | null
  grossProfit:        number | null
  grossMargin:        number | null  // decimal — 0.46 = 46%
  operatingIncome:    number | null
  operatingMargin:    number | null
  netIncome:          number | null
  netMargin:          number | null
  epsDiluted:         number | null
  // Balance sheet
  totalAssets:        number | null
  totalDebt:          number | null
  cashAndEquiv:       number | null
  shareholdersEquity: number | null
  // Cash flow
  operatingCF:        number | null
  capex:              number | null
  freeCashFlow:       number | null
  dividendsPaid:      number | null
}

export interface FAData {
  ticker:     string
  name:       string
  currency:   string
  period:     'annual' | 'quarter'
  statements: FAStatement[]   // most recent first, up to 5 periods
}

// ── DES Profile (Security Description response) ───────────────────────────────

export interface DESProfile {
  // Identity
  ticker:           string
  name:             string
  exchange:         string
  currency:         string
  country:          string
  isin?:            string
  cusip?:           string
  cik?:             string

  // Price (from market provider — more real-time than FMP)
  price:            number
  change:           number
  changePct:        number
  volume:           number
  avgVolume:        number    // FMP profile averageVolume (~90-day)
  avgVol20d:        number | null  // 20-day average daily volume
  week52High:       number
  week52Low:        number
  open:             number
  prevClose:        number

  // Fundamentals
  marketCapB:       number    // in billions
  sharesOutB:       number    // in billions
  peRatioTTM:       number | null
  epsTTM:           number | null
  dividendYield:    number | null  // as decimal — 0.005 = 0.5%
  beta:             number | null
  pbRatio:          number | null
  evEbitda:         number | null

  // Company info
  sector:           string
  industry:         string
  ceo:              string
  employees:        number | null
  founded:          string | null
  website:          string
  description:      string

  // Next earnings
  nextEarningsDate: string | null  // ISO date

  // SEC
  secFilingsUrl:    string
}

// ── Market Data ───────────────────────────────────────────────────────────────

export interface OHLCVBar {
  timestamp: number   // Unix timestamp in milliseconds
  open:      number
  high:      number
  low:       number
  close:     number
  volume:    number
  vwap?:     number   // not always available
}

export interface MarketQuote {
  ticker:           string
  price:            number
  open:             number
  high:             number
  low:              number
  prevClose:        number
  change:           number    // price - prevClose
  changePct:        number    // ((price - prevClose) / prevClose) * 100
  volume:           number
  avgVolume?:       number
  marketCap?:       number
  week52High:       number
  week52Low:        number
  bid?:             number
  ask?:             number
  vwap?:            number
  preMarketPrice?:  number
  postMarketPrice?: number
  timestamp:        number    // Unix ms
  currency:         string
  exchange:         string
  name:             string    // company long name
}

export interface MarketProvider {
  /** Current quote — DES, QR, WL screens */
  getQuote(ticker: string): Promise<MarketQuote | null>

  /** Multiple quotes at once — WL watchlist */
  getQuotes(tickers: string[]): Promise<MarketQuote[]>

  /**
   * Historical OHLCV bars — GP, HP screens.
   * range:    '1d'|'5d'|'1mo'|'3mo'|'6mo'|'1y'|'2y'|'5y'|'10y'|'ytd'|'max'
   * interval: '1m'|'5m'|'15m'|'30m'|'1h'|'1d'|'1wk'|'1mo'
   */
  getBars(ticker: string, opts: {
    range:    string
    interval: string
  }): Promise<OHLCVBar[]>

  /** Market movers — MOV, MOST screens */
  getMovers(direction: 'gainers' | 'losers' | 'active'): Promise<MarketQuote[]>

  readonly providerName: 'yahoo' | 'massive'
}

export type MarketProviderName = 'yahoo' | 'massive'

/** UI timeframe label → Yahoo-style range+interval. */
export const TIMEFRAME_MAP: Record<string, { range: string; interval: string }> = {
  '1D':  { range: '1d',   interval: '5m'  },
  '1W':  { range: '5d',   interval: '30m' },
  '1M':  { range: '1mo',  interval: '1d'  },
  '3M':  { range: '3mo',  interval: '1d'  },
  '6M':  { range: '6mo',  interval: '1d'  },
  '1Y':  { range: '1y',   interval: '1d'  },
  '5Y':  { range: '5y',   interval: '1wk' },
  '10Y': { range: '10y',  interval: '1mo' },
}

// ── News Provider ─────────────────────────────────────────────────────────────

export interface NewsArticle {
  id:          string        // unique — use url hash if no native id
  publishedAt: string        // ISO datetime string
  headline:    string
  summary:     string | null
  url:         string
  source:      string        // e.g. "Reuters", "Bloomberg", "CNBC"
  author:      string | null
  tickers:     string[]      // ticker symbols this article relates to
  category:    'earnings' | 'analyst' | 'ma' | 'macro' | 'general'
}

export interface NewsProvider {
  /** News for a specific ticker */
  getTickerNews(ticker: string, options?: {
    limit?: number
    from?:  string   // ISO date
  }): Promise<NewsArticle[]>

  /** Top market headlines */
  getTopHeadlines(options?: {
    limit?: number
  }): Promise<NewsArticle[]>

  /** Free-text search */
  search(query: string, options?: {
    limit?: number
    from?:  string
  }): Promise<NewsArticle[]>

  /** Provider name — for logging and UI attribution */
  readonly providerName: 'newsapi' | 'benzinga'
}

export type NewsProviderName = 'newsapi' | 'benzinga'

// ── Theme System ──────────────────────────────────────────────────────────────

export type ThemeName = 'amber' | 'ice' | 'phosphor'

export interface ThemeTokens {
  font:         string
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
      font:         "'JetBrains Mono', 'Menlo', 'Monaco', 'Courier New', monospace",
      bg:           '#0D0A00',
      surface:      '#130E00',
      border:       '#1F1500',
      text:         '#E6EDF3',   // near-white — primary values
      muted:        '#8B949E',   // medium gray — labels, secondary
      accent:       '#F0B429',   // gold — only for key highlights
      positive:     '#86C232',
      negative:     '#CC4444',
      warning:      '#F59E0B',
      cursor:       '#F59E0B',
      headerBg:     '#0A0700',
      cmdBg:        '#100D00',
      screenBg:     '#0D0A00',
      tickerBg:     '#0A0700',
      labelColor:   '#8B949E',   // same as muted — labels recede
      valueColor:   '#E6EDF3',   // same as text — values bright
      titleColor:   '#F59E0B',
      divider:      '#1F1500',
      scrollbar:    '#1F1500',
      glow:         'none',
    },
  },
  ice: {
    label: 'Ice Blue',
    tokens: {
      font:         "'JetBrains Mono', 'Menlo', 'Monaco', 'Courier New', monospace",
      bg:           '#020B18',
      surface:      '#041020',
      border:       '#0A2030',
      text:         '#E6EDF3',   // near-white — primary values
      muted:        '#7B8FA6',   // blue-gray — labels, secondary
      accent:       '#58A6FF',   // blue accent for ice
      positive:     '#34D399',
      negative:     '#F87171',
      warning:      '#FBBF24',
      cursor:       '#38BDF8',
      headerBg:     '#020B18',
      cmdBg:        '#041020',
      screenBg:     '#020B18',
      tickerBg:     '#020B18',
      labelColor:   '#7B8FA6',   // same as muted — labels recede
      valueColor:   '#E6EDF3',   // same as text — values bright
      titleColor:   '#38BDF8',
      divider:      '#0A2030',
      scrollbar:    '#0A2030',
      glow:         'none',
    },
  },
  phosphor: {
    label: 'Green Phosphor',
    tokens: {
      font:         "'JetBrains Mono', 'Menlo', 'Monaco', 'Courier New', monospace",
      bg:           '#010801',
      surface:      '#010A01',
      border:       '#003300',
      text:         '#AAFFAA',   // bright phosphor green — primary values
      muted:        '#4D9950',   // medium green — labels, secondary
      accent:       '#00FF41',   // pure phosphor green
      positive:     '#00FF41',
      negative:     '#FF4444',
      warning:      '#FFCC00',
      cursor:       '#00FF41',
      headerBg:     '#010801',
      cmdBg:        '#010A01',
      screenBg:     '#010801',
      tickerBg:     '#010801',
      labelColor:   '#4D9950',   // same as muted — labels recede
      valueColor:   '#AAFFAA',   // same as text — values bright
      titleColor:   '#00FF41',
      divider:      '#003300',
      scrollbar:    '#002200',
      glow:         '0 0 8px rgba(0,255,65,0.35)',
    },
  },
}

export const DEFAULT_THEME: ThemeName = 'amber'
