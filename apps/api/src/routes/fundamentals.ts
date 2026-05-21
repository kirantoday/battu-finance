import { Hono } from 'hono'
import { fmpClient, marketProvider } from '@battu/data'
import type { DESProfile } from '@battu/shared'
import { NOT_IMPLEMENTED } from './_notImplemented'

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
    fmpClient.getAnalystEstimates(ticker),
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

  // Prefer ratios-ttm dividend yield (with FMP typo fallback), then profile
  const divYieldTTM =
       ratios?.dividendYieldTTM
    ?? ratios?.dividendYielTTM
    ?? (profile?.lastDiv && profile?.price ? profile.lastDiv / profile.price : null)

  // P/E: ratios-ttm first (multiple spellings exist), then key-metrics, then profile
  const peTTM = ratios?.peRatioTTM ?? ratios?.priceEarningsRatioTTM ?? metrics?.peRatioTTM ?? profile?.pe ?? null
  const epsTTM = ratios?.epsTTM ?? profile?.eps ?? null
  const pbRatio = ratios?.priceToBookRatioTTM ?? metrics?.pbRatioTTM ?? metrics?.ptbRatioTTM ?? null
  const evEbitda = metrics?.evToEbitdaTTM ?? metrics?.enterpriseValueOverEBITDATTM ?? null

  const marketCapRaw = profile?.mktCap ?? 0
  const sharesOutRaw = profile?.sharesOutstanding ?? 0

  const des: DESProfile = {
    ticker,
    name:          profile?.companyName || quote?.name || ticker,
    exchange:      profile?.exchangeShortName || quote?.exchange || '',
    currency:      profile?.currency || quote?.currency || 'USD',
    country:       profile?.country || 'US',
    isin:          profile?.isin || undefined,
    cusip:         profile?.cusip || undefined,
    cik:           profile?.cik || undefined,

    price:         quote?.price     ?? profile?.price ?? 0,
    change:        quote?.change    ?? 0,
    changePct:     quote?.changePct ?? 0,
    volume:        quote?.volume    ?? profile?.volAvg ?? 0,
    avgVolume:     profile?.volAvg  ?? 0,
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

    nextEarningsDate: earnings?.date || null,

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

fundamentalsRoutes.get('/financials/:ticker',   (c) => c.json(NOT_IMPLEMENTED))
fundamentalsRoutes.get('/ratios/:ticker',       (c) => c.json(NOT_IMPLEMENTED))
fundamentalsRoutes.get('/peers/:ticker',        (c) => c.json(NOT_IMPLEMENTED))
fundamentalsRoutes.get('/estimates/:ticker',    (c) => c.json(NOT_IMPLEMENTED))
fundamentalsRoutes.get('/grades/:ticker',       (c) => c.json(NOT_IMPLEMENTED))
fundamentalsRoutes.post('/screener',            (c) => c.json(NOT_IMPLEMENTED))
fundamentalsRoutes.get('/earnings-calendar',    (c) => c.json(NOT_IMPLEMENTED))
fundamentalsRoutes.get('/dividends/:ticker',    (c) => c.json(NOT_IMPLEMENTED))
