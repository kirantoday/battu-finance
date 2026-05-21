import { Hono } from 'hono'
import { fmpClient, marketProvider } from '@battu/data'
import type {
  FMPEstimates, FMPIncomeStatement, FMPBalanceSheet, FMPCashFlow,
} from '@battu/data'
import type { DESProfile, FAData, FAStatement } from '@battu/shared'
import { NOT_IMPLEMENTED } from './_notImplemented'

/**
 * From an array of analyst-estimate entries, pick the earliest date that is
 * strictly in the future AND within the next 12 months. Returns null when no
 * entry qualifies — the UI displays that as "—".
 */
function pickNextEarningsDate(estimates: FMPEstimates[] | null | undefined): string | null {
  if (!estimates || estimates.length === 0) return null
  const now = Date.now()
  const horizon = now + 365 * 24 * 60 * 60 * 1000 // ≈ 12 months
  const candidates: Array<{ date: string; t: number }> = []
  for (const e of estimates) {
    if (!e?.date) continue
    const t = new Date(e.date).getTime()
    if (Number.isNaN(t)) continue
    if (t > now && t <= horizon) candidates.push({ date: e.date, t })
  }
  if (candidates.length === 0) return null
  candidates.sort((a, b) => a.t - b.t)
  return candidates[0].date
}

/**
 * Combine one period's IS, BS, and CF rows from FMP into the FAStatement
 * the frontend consumes. Each statement comes from a separate FMP endpoint,
 * so we index by array position (FMP returns them in descending date order).
 */
function buildFAStatement(
  inc: FMPIncomeStatement | undefined,
  bal: FMPBalanceSheet    | undefined,
  cf:  FMPCashFlow        | undefined,
  period: 'annual' | 'quarter',
): FAStatement | null {
  if (!inc) return null

  const rev = inc.revenue         ?? null
  const gp  = inc.grossProfit     ?? null
  const oi  = inc.operatingIncome ?? null
  const ni  = inc.netIncome       ?? null

  // Stable returns epsDiluted (camelCase); v3 returns epsdiluted (lowercase)
  const epsDiluted = inc.epsDiluted ?? inc.epsdiluted ?? inc.eps ?? null

  // Stable splits dividends into common/preferred/net — common is what most
  // analysts mean. v3 returned a single dividendsPaid field as fallback.
  const dividendsPaid =
       cf?.commonDividendsPaid
    ?? cf?.netDividendsPaid
    ?? cf?.dividendsPaid
    ?? null

  // freeCashFlow is computed by FMP on stable; derive from OCF + capex when
  // missing (capex is already negative, so OCF + capex == OCF - |capex|).
  const ocf   = cf?.operatingCashFlow ?? cf?.netCashProvidedByOperatingActivities ?? null
  const capex = cf?.capitalExpenditure ?? null
  const fcf   = cf?.freeCashFlow ?? (ocf != null && capex != null ? ocf + capex : null)

  // Period label:
  //   annual → year ("2024")
  //   quarter → "Q{n} YYYY" (FMP reports period as "Q1"|"Q2"|"Q3"|"Q4" + fiscalYear)
  let label = ''
  if (period === 'annual') {
    label = inc.date ? new Date(inc.date).getFullYear().toString() : (inc.calendarYear || '')
  } else {
    const yr = inc.calendarYear || (inc.date ? new Date(inc.date).getFullYear().toString() : '')
    const q  = inc.period && /^Q[1-4]$/.test(inc.period) ? inc.period : ''
    label = q && yr ? `${q} ${yr}` : (inc.date?.slice(0, 7) ?? '')
  }

  return {
    period:             label,
    date:               inc.date || '',
    revenue:            rev,
    grossProfit:        gp,
    grossMargin:        rev && gp != null ? gp / rev : null,
    operatingIncome:    oi,
    operatingMargin:    rev && oi != null ? oi / rev : null,
    netIncome:          ni,
    netMargin:          rev && ni != null ? ni / rev : null,
    epsDiluted,
    totalAssets:        bal?.totalAssets ?? null,
    totalDebt:          bal?.totalDebt ?? null,
    cashAndEquiv:       bal?.cashAndShortTermInvestments ?? bal?.cashAndCashEquivalents ?? null,
    shareholdersEquity: bal?.totalStockholdersEquity ?? null,
    operatingCF:        ocf,
    capex,
    freeCashFlow:       fcf,
    dividendsPaid,
  }
}

export const fundamentalsRoutes = new Hono()

// GET /api/v1/fundamentals/profile/:ticker — DES screen backend
// Parallel fetch from FMP (profile, ratios-ttm, key-metrics-ttm, analyst estimates)
// plus the market provider for real-time price. Each source is independent —
// Promise.allSettled lets us degrade gracefully when a single endpoint 401s
// (common on the FMP demo key beyond AAPL).
fundamentalsRoutes.get('/profile/:ticker', async (c) => {
  const ticker = c.req.param('ticker').toUpperCase()

  const [profileRes, ratiosRes, metricsRes, earningsRes, quoteRes] = await Promise.allSettled([
    fmpClient.getProfile(ticker),
    fmpClient.getRatiosTTM(ticker),
    fmpClient.getKeyMetricsTTM(ticker),
    // FMP's free/standard plans only allow period=annual; period=quarter is
    // Premium-only and returns "Premium Query Parameter" errors. Use annual
    // with limit=10 so we can pick the nearest future fiscal-year-end within
    // the 12-month window. For mega-cap companies this still lands within
    // 4–12 months and is a reasonable proxy for the next earnings call.
    fmpClient.getAnalystEstimates(ticker, { period: 'annual', limit: 10 }),
    marketProvider.getQuote(ticker),
  ])

  // Log each rejected source on its own line so the operator can see exactly
  // which provider failed (typically: FMP demo key returning "Invalid API KEY").
  const sources: Array<[string, PromiseSettledResult<unknown>]> = [
    ['fmp.profile',        profileRes],
    ['fmp.ratios-ttm',     ratiosRes],
    ['fmp.key-metrics-ttm',metricsRes],
    ['fmp.estimates',      earningsRes],
    ['market.quote',       quoteRes],
  ]
  for (const [name, res] of sources) {
    if (res.status === 'rejected') {
      console.warn(`[fundamentals] ${ticker} ${name} failed: ${(res.reason as Error)?.message ?? res.reason}`)
    }
  }

  const profile  = profileRes.status  === 'fulfilled' ? profileRes.value  : null
  const ratios   = ratiosRes.status   === 'fulfilled' ? ratiosRes.value   : null
  const metrics  = metricsRes.status  === 'fulfilled' ? metricsRes.value  : null
  const earnings = earningsRes.status === 'fulfilled' ? earningsRes.value : null
  const quote    = quoteRes.status    === 'fulfilled' ? quoteRes.value    : null

  // If neither FMP nor the market provider answered, treat as not found.
  if (!profile && !quote) {
    return c.json({ data: null, error: `Ticker not found: ${ticker}` }, 404)
  }

  // FMP profile.range is a "low-high" string like "193.46-303.20"
  const rangeParts = profile?.range?.split('-').map(s => Number(s.trim())) ?? []
  const profile52Low  = rangeParts[0] || 0
  const profile52High = rangeParts[1] || 0

  // fullTimeEmployees comes as a string from FMP; coerce defensively
  const empNum = profile?.fullTimeEmployees ? Number(String(profile.fullTimeEmployees).replace(/,/g, '')) : NaN
  const employees = Number.isFinite(empNum) && empNum > 0 ? empNum : null

  // Prefer ratios-ttm dividend yield (covers stable, v3-typo, and lastDividend/price fallback)
  const lastDividend = profile?.lastDividend ?? profile?.lastDiv
  const divYieldTTM =
       ratios?.dividendYieldTTM
    ?? ratios?.dividendYielTTM
    ?? (lastDividend && profile?.price ? lastDividend / profile.price : null)

  // P/E TTM: stable uses priceToEarningsRatioTTM; v3 used peRatioTTM
  const peTTM =
       ratios?.priceToEarningsRatioTTM
    ?? ratios?.peRatioTTM
    ?? ratios?.priceEarningsRatioTTM
    ?? metrics?.peRatioTTM
    ?? profile?.pe
    ?? null

  // EPS TTM: stable returns netIncomePerShareTTM, v3 had epsTTM, profile sometimes has eps
  const epsTTM = ratios?.netIncomePerShareTTM ?? ratios?.epsTTM ?? profile?.eps ?? null

  const pbRatio = ratios?.priceToBookRatioTTM ?? metrics?.pbRatioTTM ?? metrics?.ptbRatioTTM ?? null

  // EV/EBITDA TTM: stable spells it evToEBITDATTM (capital BITDA); v3 had evToEbitdaTTM /
  // enterpriseValueOverEBITDATTM; ratios endpoint also has enterpriseValueMultipleTTM
  const evEbitda =
       metrics?.evToEBITDATTM
    ?? metrics?.evToEbitdaTTM
    ?? metrics?.enterpriseValueOverEBITDATTM
    ?? ratios?.enterpriseValueMultipleTTM
    ?? null

  const marketCapRaw = profile?.marketCap ?? profile?.mktCap ?? metrics?.marketCapTTM ?? 0
  // Stable /profile drops sharesOutstanding — derive from marketCap / price as fallback.
  const sharesOutRaw =
       profile?.sharesOutstanding
    ?? (marketCapRaw > 0 && profile?.price && profile.price > 0 ? marketCapRaw / profile.price : 0)
  const avgVolume    = profile?.averageVolume ?? profile?.volAvg ?? 0

  const des: DESProfile = {
    ticker,
    name:          profile?.companyName || quote?.name || ticker,
    // Prefer the long exchange label ("NASDAQ Global Select") over the short
    // code ("NASDAQ"); fall back to v3 / market-provider names if absent.
    exchange:      profile?.exchangeFullName || profile?.exchange || profile?.exchangeShortName || quote?.exchange || '',
    currency:      profile?.currency || quote?.currency || 'USD',
    country:       profile?.country || 'US',
    isin:          profile?.isin || undefined,
    cusip:         profile?.cusip || undefined,
    cik:           profile?.cik || undefined,

    price:         quote?.price     ?? profile?.price ?? 0,
    change:        quote?.change    ?? profile?.change ?? profile?.changes ?? 0,
    changePct:     quote?.changePct ?? profile?.changePercentage ?? 0,
    volume:        quote?.volume    ?? 0,
    avgVolume,
    week52High:    quote?.week52High || profile52High,
    week52Low:     quote?.week52Low  || profile52Low,
    open:          quote?.open      ?? 0,
    prevClose:     quote?.prevClose ?? 0,

    marketCapB:    marketCapRaw / 1e9,
    sharesOutB:    sharesOutRaw / 1e9,
    peRatioTTM:    peTTM,
    epsTTM,
    dividendYield: divYieldTTM,
    beta:          profile?.beta ?? null,
    pbRatio,
    evEbitda,

    sector:        profile?.sector   || '',
    industry:      profile?.industry || '',
    ceo:           profile?.ceo      || '',
    employees,
    founded:       profile?.ipoDate  || null,
    website:       profile?.website  || '',
    description:   profile?.description || '',

    nextEarningsDate: pickNextEarningsDate(earnings),

    secFilingsUrl: profile?.cik
      ? `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${profile.cik}`
      : `https://www.sec.gov/cgi-bin/browse-edgar?company=${ticker}&action=getcompany`,
  }

  // Legacy aliases — the validation suite extractors look for these raw field
  // names (e.g. `marketCap` in dollars, `sharesOutstanding` raw shares).
  // Keeping both shapes in one response means web + validator both work.
  return c.json({
    data: {
      ...des,
      marketCap:          marketCapRaw,
      sharesOutstanding:  sharesOutRaw,
      peRatio:            peTTM,
      eps:                epsTTM,
    },
    error: null,
  })
})

// GET /api/v1/fundamentals/financials/:ticker?period=annual|quarter&limit=5
// Returns combined IS + BS + CF over the last N periods (default 5).
fundamentalsRoutes.get('/financials/:ticker', async (c) => {
  const ticker = c.req.param('ticker').toUpperCase()
  const rawPeriod = c.req.query('period') === 'quarter' ? 'quarter' : 'annual'
  const limit = Math.max(1, Math.min(20, parseInt(c.req.query('limit') || '5')))

  const [incomeRes, balanceRes, cashflowRes] = await Promise.allSettled([
    fmpClient.getIncomeStatement(ticker, rawPeriod, limit),
    fmpClient.getBalanceSheet(ticker,   rawPeriod, limit),
    fmpClient.getCashFlow(ticker,       rawPeriod, limit),
  ])

  const sources: Array<[string, PromiseSettledResult<unknown>]> = [
    ['fmp.income-statement',        incomeRes],
    ['fmp.balance-sheet-statement', balanceRes],
    ['fmp.cash-flow-statement',     cashflowRes],
  ]
  for (const [name, res] of sources) {
    if (res.status === 'rejected') {
      console.warn(`[financials] ${ticker} ${name} failed: ${(res.reason as Error)?.message ?? res.reason}`)
    }
  }

  const income   = incomeRes.status   === 'fulfilled' ? (incomeRes.value   ?? []) : []
  const balance  = balanceRes.status  === 'fulfilled' ? (balanceRes.value  ?? []) : []
  const cashflow = cashflowRes.status === 'fulfilled' ? (cashflowRes.value ?? []) : []

  if (income.length === 0) {
    return c.json({ data: null, error: `No financial data for ${ticker}` }, 404)
  }

  const statements: FAStatement[] = []
  for (let i = 0; i < Math.min(income.length, limit); i++) {
    const stmt = buildFAStatement(income[i], balance[i], cashflow[i], rawPeriod)
    if (stmt) statements.push(stmt)
  }

  const data: FAData = {
    ticker,
    name:       '',   // DES profile carries the long name
    currency:   income[0]?.reportedCurrency || 'USD',
    period:     rawPeriod,
    statements,
  }
  return c.json({ data, error: null })
})
fundamentalsRoutes.get('/ratios/:ticker',       (c) => c.json(NOT_IMPLEMENTED))
fundamentalsRoutes.get('/peers/:ticker',        (c) => c.json(NOT_IMPLEMENTED))
fundamentalsRoutes.get('/estimates/:ticker',    (c) => c.json(NOT_IMPLEMENTED))
fundamentalsRoutes.get('/grades/:ticker',       (c) => c.json(NOT_IMPLEMENTED))
fundamentalsRoutes.post('/screener',            (c) => c.json(NOT_IMPLEMENTED))
fundamentalsRoutes.get('/earnings-calendar',    (c) => c.json(NOT_IMPLEMENTED))
fundamentalsRoutes.get('/dividends/:ticker',    (c) => c.json(NOT_IMPLEMENTED))
