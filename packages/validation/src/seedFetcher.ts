import path from 'node:path'
import fs from 'node:fs/promises'
import dotenv from 'dotenv'
import chalk from 'chalk'

// Load env from the monorepo root, not from packages/validation (where pnpm --filter sets cwd).
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') })
dotenv.config({ path: path.resolve(__dirname, '../../../.env'), override: false })

import { TICKERS, type Ticker, type GroundTruthField, type ToleranceBand } from './groundTruth'

// ── Data sources ─────────────────────────────────────────────────────────────
// Yahoo's quoteSummary endpoint started returning 401 in 2025. We now use:
//   1. FMP /profile           — market cap, price, beta, shares, P/E, EPS, sector
//   2. FMP /ratios-ttm        — TTM margins, P/E, P/S, P/B
//   3. FMP /income-statement  — revenue, grossProfit, operatingIncome, netIncome
//   4. Yahoo v8 /chart        — current price sanity check (still works without auth)
//
// FMP's free demo key (`apikey=demo`) returns full data for AAPL and a
// rotating subset of large-caps. Tickers it doesn't cover come back 401 or
// with a paywall message; we treat both as a no-op and leave fields null.

const FMP_BASE      = 'https://financialmodelingprep.com/api/v3'
const FMP_KEY       = process.env.FMP_API_KEY || 'demo'
const YAHOO_CHART   = 'https://query1.finance.yahoo.com/v8/finance/chart'

const FETCH_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (compatible; BATTU-Validator/1.0)',
  'Accept':     'application/json',
}

interface FmpProfile {
  symbol?:            string
  price?:             number
  beta?:              number
  volAvg?:            number
  mktCap?:            number
  lastDiv?:           number
  changes?:           number
  pe?:                number
  eps?:               number
  sharesOutstanding?: number
  sector?:            string
  industry?:          string
  isEtf?:             boolean
}

interface FmpRatiosTtm {
  peRatioTTM?:                number
  pegRatioTTM?:               number
  priceToSalesRatioTTM?:      number
  priceToBookRatioTTM?:       number
  grossProfitMarginTTM?:      number
  operatingProfitMarginTTM?:  number
  netProfitMarginTTM?:        number
  dividendYielTTM?:           number   // FMP literally ships this typo
  dividendYieldTTM?:          number   // fallback in case they fix it
}

interface FmpIncome {
  symbol?:           string
  revenue?:          number
  grossProfit?:      number
  operatingIncome?:  number
  netIncome?:        number
}

interface YahooChartMeta {
  regularMarketPrice?:    number
  previousClose?:         number
  chartPreviousClose?:    number
  currency?:              string
}

interface YahooChart {
  chart?: {
    result?: Array<{ meta?: YahooChartMeta }> | null
    error?:  { code?: string; description?: string } | null
  }
}

interface CombinedData {
  profile: FmpProfile | null
  ratios:  FmpRatiosTtm | null
  income:  FmpIncome | null
  yahoo:   YahooChartMeta | null
  /** Per-source HTTP statuses for diagnostics. */
  statuses: Record<'profile' | 'ratios' | 'income' | 'yahoo', number | 'err'>
}

interface FetchedJson<T> {
  body:   T | null
  status: number | 'err'
}

async function getJson<T>(url: string): Promise<FetchedJson<T>> {
  try {
    const res = await fetch(url, { headers: FETCH_HEADERS })
    if (!res.ok) return { body: null, status: res.status }
    const body = (await res.json()) as T
    return { body, status: res.status }
  } catch {
    return { body: null, status: 'err' }
  }
}

async function fetchAllSources(ticker: string): Promise<CombinedData> {
  const [profileRes, ratiosRes, incomeRes, yahooRes] = await Promise.all([
    getJson<FmpProfile[]>(`${FMP_BASE}/profile/${encodeURIComponent(ticker)}?apikey=${FMP_KEY}`),
    getJson<FmpRatiosTtm[]>(`${FMP_BASE}/ratios-ttm/${encodeURIComponent(ticker)}?apikey=${FMP_KEY}`),
    getJson<FmpIncome[]>(`${FMP_BASE}/income-statement/${encodeURIComponent(ticker)}?limit=1&apikey=${FMP_KEY}`),
    getJson<YahooChart>(`${YAHOO_CHART}/${encodeURIComponent(ticker)}?interval=1d&range=1d`),
  ])

  return {
    profile: profileRes.body?.[0] ?? null,
    ratios:  ratiosRes.body?.[0]  ?? null,
    income:  incomeRes.body?.[0]  ?? null,
    yahoo:   yahooRes.body?.chart?.result?.[0]?.meta ?? null,
    statuses: {
      profile: profileRes.status,
      ratios:  ratiosRes.status,
      income:  incomeRes.status,
      yahoo:   yahooRes.status,
    },
  }
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

// ── Mapping CombinedData → ground-truth fields ──────────────────────────────

const TODAY = new Date().toISOString().slice(0, 10)
const SEED_SOURCE = 'fmp-seed'
const SEED_NOTES = 'AUTO-SEEDED — manually verify before using as ground truth'

function field(value: number | null | undefined, band: ToleranceBand, notes?: string): GroundTruthField {
  const v = value === undefined ? null : value
  return {
    value: v,
    band,
    source: SEED_SOURCE,
    verifiedAt: TODAY,
    notes: notes ?? SEED_NOTES,
  }
}

function nullField(band: ToleranceBand, notes: string): GroundTruthField {
  return { value: null, band, source: SEED_SOURCE, verifiedAt: TODAY, notes }
}

function div(n: number | undefined | null, d: number): number | undefined {
  return n === undefined || n === null ? undefined : n / d
}

interface SeedRow {
  ticker: string
  fields: Record<string, GroundTruthField>
  ok: boolean
  missingFields: string[]
  fmpPrice: number | null
  yahooPrice: number | null
  statuses: CombinedData['statuses']
}

function fetchedFor(ticker: string, c: CombinedData): SeedRow {
  // If every source failed, return a placeholder row but still mark statuses
  if (!c.profile && !c.ratios && !c.income && !c.yahoo) {
    return {
      ticker, ok: false, missingFields: ['ALL'],
      fields: buildPlaceholderFields(),
      fmpPrice: null, yahooPrice: null, statuses: c.statuses,
    }
  }

  const p = c.profile
  const r = c.ratios
  const i = c.income

  // Derived margins from income statement (fallback if ratios-ttm absent)
  const revenue = i?.revenue
  const gmFromIS = revenue && i?.grossProfit     != null ? i.grossProfit     / revenue : undefined
  const omFromIS = revenue && i?.operatingIncome != null ? i.operatingIncome / revenue : undefined
  const nmFromIS = revenue && i?.netIncome       != null ? i.netIncome       / revenue : undefined

  // Prefer TTM ratios where available — they're more current
  const grossMargin     = r?.grossProfitMarginTTM     ?? gmFromIS
  const operatingMargin = r?.operatingProfitMarginTTM ?? omFromIS
  const netMargin       = r?.netProfitMarginTTM       ?? nmFromIS

  // Dividend yield: prefer TTM ratio; fall back to lastDiv / price
  const divYield =
       r?.dividendYielTTM
    ?? r?.dividendYieldTTM
    ?? (p?.lastDiv != null && p?.price != null && p.price > 0 ? p.lastDiv / p.price : undefined)

  // Shares outstanding: prefer profile field; fall back to mktCap / price
  const sharesOut =
       p?.sharesOutstanding
    ?? (p?.mktCap != null && p?.price != null && p.price > 0 ? p.mktCap / p.price : undefined)

  // P/E: prefer TTM ratio over snapshot P/E from profile
  const peRatio = r?.peRatioTTM ?? p?.pe

  const fields: Record<string, GroundTruthField> = {
    // DES
    marketCapB:           field(div(p?.mktCap, 1e9),       'ratio'),
    sharesOutstandingM:   field(div(sharesOut, 1e6),       'financial'),
    peRatioTTM:           field(peRatio,                   'ratio'),
    epsTTM:               field(p?.eps,                    'financial'),
    dividendYield:        field(divYield,                  'ratio'),
    beta:                 field(p?.beta,                   'ratio'),
    // FA
    revenueB:             field(div(revenue, 1e9),         'financial'),
    grossMargin:          field(grossMargin,               'financial'),
    operatingMargin:      field(operatingMargin,           'financial'),
    netMargin:            field(netMargin,                 'financial'),
    totalDebtB:           nullField('financial', 'Requires FMP /balance-sheet-statement (paywalled on demo key) — fill manually'),
    cashAndEquivB:        nullField('financial', 'Requires FMP /balance-sheet-statement (paywalled on demo key) — fill manually'),
    // EE — not available on FMP free tier
    epsEstimateNTM:       nullField('estimate',  'EE estimates not in FMP free tier — fill manually from Yahoo Analysis tab'),
    revenueEstimateNTMB:  nullField('estimate',  'EE estimates not in FMP free tier — fill manually from Yahoo Analysis tab'),
    // ANR — not available on FMP free tier
    analystConsensus:     nullField('estimate',  'Ratings not in FMP free tier — fill manually from Yahoo Analysis tab'),
    priceTargetConsensus: nullField('estimate',  'Ratings not in FMP free tier — fill manually from Yahoo Analysis tab'),
    // HP — historical close not fetched in seed
    closePrice1YrAgo:     nullField('price',     'Historical OHLCV not fetched in seed — fill manually from Yahoo HP tab'),
    // LIQ — SEC filings only
    liqCashRunwayQtrs:    nullField('liq',       'LIQ requires SEC filings (10-Q, S-3, 424B) — not derivable from price/profile APIs'),
    liqTotalLiquidityB:   nullField('liq',       'LIQ requires SEC filings (10-Q, S-3, 424B) — not derivable from price/profile APIs'),
  }

  // "fillable" = the fields we *expect* the seed to populate. Everything else
  // is expected to be null and shouldn't count as a miss.
  const fillable = [
    'marketCapB','sharesOutstandingM','peRatioTTM','epsTTM','dividendYield','beta',
    'revenueB','grossMargin','operatingMargin','netMargin',
  ]
  const missingFields = fillable.filter(k => fields[k].value === null)

  return {
    ticker,
    ok: true,
    missingFields,
    fields,
    fmpPrice:   p?.price ?? null,
    yahooPrice: c.yahoo?.regularMarketPrice ?? null,
    statuses:   c.statuses,
  }
}

function buildPlaceholderFields(): Record<string, GroundTruthField> {
  const all: Record<string, ToleranceBand> = {
    marketCapB: 'ratio', sharesOutstandingM: 'financial',
    peRatioTTM: 'ratio', epsTTM: 'financial',
    dividendYield: 'ratio', beta: 'ratio',
    revenueB: 'financial', grossMargin: 'financial',
    operatingMargin: 'financial', netMargin: 'financial',
    totalDebtB: 'financial', cashAndEquivB: 'financial',
    epsEstimateNTM: 'estimate', revenueEstimateNTMB: 'estimate',
    analystConsensus: 'estimate', priceTargetConsensus: 'estimate',
    closePrice1YrAgo: 'price',
    liqCashRunwayQtrs: 'liq', liqTotalLiquidityB: 'liq',
  }
  const out: Record<string, GroundTruthField> = {}
  for (const [k, band] of Object.entries(all)) {
    out[k] = nullField(band, 'All sources failed — fill manually')
  }
  return out
}

// ── Serialize ground-truth records to source code ───────────────────────────

function fmt(v: number | null): string {
  if (v === null) return 'null'
  // Keep numeric formatting compact but readable
  if (Math.abs(v) >= 1) return v.toFixed(2)
  return v.toFixed(6).replace(/0+$/, '').replace(/\.$/, '')
}

function escapeNotes(s: string): string {
  return s.replace(/'/g, "\\'")
}

function renderField(name: string, f: GroundTruthField): string {
  const pad = name.padEnd(22)
  const valStr = (f.value === null ? 'null' : fmt(f.value)).padStart(8)
  const band   = `'${f.band}'`.padEnd(13)
  const src    = `'${f.source}'`.padEnd(15)
  const date   = `'${f.verifiedAt}'`
  const notes  = f.notes ? `, '${escapeNotes(f.notes)}'` : ''
  return `    ${pad}: gt(${valStr}, ${band}, ${src}, ${date}${notes}),`
}

function renderRecord(row: SeedRow): string {
  const fieldOrder = [
    'marketCapB', 'sharesOutstandingM', 'peRatioTTM', 'epsTTM', 'dividendYield', 'beta',
    'revenueB', 'grossMargin', 'operatingMargin', 'netMargin', 'totalDebtB', 'cashAndEquivB',
    'epsEstimateNTM', 'revenueEstimateNTMB',
    'analystConsensus', 'priceTargetConsensus',
    'closePrice1YrAgo',
    'liqCashRunwayQtrs', 'liqTotalLiquidityB',
  ]
  const lines = fieldOrder.map(k => renderField(k, row.fields[k]))
  return `  ${row.ticker}: {\n    ticker: '${row.ticker}',\n${lines.join('\n')}\n  },`
}

function renderGroundTruthBlock(rows: SeedRow[]): string {
  const inner = rows.map(renderRecord).join('\n')
  return `// Auto-generated by seedFetcher. Anything between START and END markers will be
// overwritten on the next \`pnpm seed:groundtruth\` run.
export const GROUND_TRUTH: Record<Ticker, GroundTruthRecord> = {
${inner}
}`
}

const MARKER_START = '// ── GROUND_TRUTH START ──'
const MARKER_END   = '// ── GROUND_TRUTH END ──'

async function rewriteGroundTruth(rows: SeedRow[]) {
  const filePath = path.resolve(__dirname, 'groundTruth.ts')
  const current = await fs.readFile(filePath, 'utf8')
  const startIdx = current.indexOf(MARKER_START)
  const endIdx   = current.indexOf(MARKER_END)
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    throw new Error(`Markers not found in ${filePath} — cannot safely rewrite`)
  }
  const before = current.slice(0, startIdx + MARKER_START.length)
  const after  = current.slice(endIdx)
  const block  = '\n' + renderGroundTruthBlock(rows) + '\n'
  const next   = before + block + after
  await fs.writeFile(filePath, next, 'utf8')
  return filePath
}

// ── Main ────────────────────────────────────────────────────────────────────

function fmtStatus(s: number | 'err'): string {
  if (s === 'err') return chalk.red('err')
  if (s >= 200 && s < 300) return chalk.green(String(s))
  if (s === 401 || s === 403) return chalk.yellow(String(s))   // paywall / not in demo
  return chalk.red(String(s))
}

function fmtPrice(p: number | null): string {
  return p === null ? '—' : `$${p.toFixed(2)}`
}

async function main() {
  console.log()
  console.log(chalk.cyan('════════════════════════════════════════════════════════'))
  console.log(chalk.cyan('  BATTU Ground-Truth Seeder — FMP free + Yahoo v8 chart'))
  console.log(chalk.cyan('════════════════════════════════════════════════════════'))
  console.log()
  console.log(chalk.yellow('⚠  These values are auto-seeded from free public APIs.'))
  console.log(chalk.yellow('   Manually verify against Bloomberg or Koyfin before client demos.'))
  console.log(chalk.yellow('   Fields NOT seeded by this run (fill manually):'))
  console.log(chalk.yellow('     EE   (analyst estimates)      — Yahoo Analysis tab'))
  console.log(chalk.yellow('     ANR  (ratings + price target) — Yahoo Analysis tab'))
  console.log(chalk.yellow('     HP   (closePrice1YrAgo)       — Yahoo HP tab'))
  console.log(chalk.yellow('     LIQ  (cash runway)            — SEC EDGAR 10-Q / S-3 / 424B'))
  console.log(chalk.yellow('     FA   (totalDebt, cash)        — FMP balance-sheet (paywalled on demo)'))
  console.log()

  const rows: SeedRow[] = []
  for (const ticker of TICKERS as readonly Ticker[]) {
    process.stdout.write(`  ${chalk.cyan(ticker.padEnd(6))} fetching... `)
    const c = await fetchAllSources(ticker)
    const row = fetchedFor(ticker, c)
    rows.push(row)

    const status = `prof:${fmtStatus(row.statuses.profile)} rat:${fmtStatus(row.statuses.ratios)} inc:${fmtStatus(row.statuses.income)} yah:${fmtStatus(row.statuses.yahoo)}`
    const prices = `FMP ${fmtPrice(row.fmpPrice)} / YAHOO ${fmtPrice(row.yahooPrice)}`
    if (row.ok && row.missingFields.length === 0) {
      console.log(`${chalk.green('✓')}  ${status}  ${chalk.gray(prices)}`)
    } else if (row.ok) {
      console.log(`${chalk.yellow('✓')}  ${status}  ${chalk.gray(prices)}  ${chalk.yellow('missing: ' + row.missingFields.join(','))}`)
    } else {
      console.log(`${chalk.red('✗')}  ${status}  ${chalk.gray(prices)}`)
    }

    // Sanity-check warning if FMP and Yahoo disagree on price by > 2%
    if (row.fmpPrice != null && row.yahooPrice != null && row.fmpPrice > 0) {
      const dev = Math.abs(row.fmpPrice - row.yahooPrice) / row.fmpPrice
      if (dev > 0.02) {
        console.log(chalk.red(`         price drift ${(dev * 100).toFixed(1)}% between FMP and Yahoo — investigate`))
      }
    }

    // Polite rate limiting — FMP demo key is throttled
    await sleep(350)
  }

  // Summary table
  console.log()
  console.log(chalk.cyan('  Summary'))
  console.log(chalk.gray('  ──────────────────────────────────────'))
  for (const r of rows) {
    const filled = Object.values(r.fields).filter(f => f.value !== null).length
    const total  = Object.values(r.fields).length
    const pct = ((filled / total) * 100).toFixed(0)
    const colored = r.ok
      ? (r.missingFields.length === 0 ? chalk.green(`${filled}/${total}`) : chalk.yellow(`${filled}/${total}`))
      : chalk.red(`${filled}/${total}`)
    console.log(`  ${chalk.cyan(r.ticker.padEnd(6))} ${colored}  (${pct}%)`)
  }

  const filePath = await rewriteGroundTruth(rows)
  console.log()
  console.log(chalk.green(`  ✓ Wrote ${path.relative(process.cwd(), filePath)}`))
  console.log()
  console.log(chalk.gray('  Next steps:'))
  console.log(chalk.gray('    1. Open groundTruth.ts and manually verify EE / ANR fields'))
  console.log(chalk.gray('    2. Fill HP closePrice1YrAgo by hand from Yahoo HP tab'))
  console.log(chalk.gray('    3. Fill LIQ fields (BIIB, MRNA) from SEC filings'))
  console.log(chalk.gray('    4. For tickers showing prof:401 — FMP demo only covers a rotating subset.'))
  console.log(chalk.gray('       Either fill manually or switch to a paid FMP_API_KEY in .env.local.'))
  console.log(chalk.gray('    5. Run: pnpm validate'))
  console.log()
}

main().catch((err) => {
  console.error(chalk.red('Seed fetcher crashed:'), err)
  process.exit(2)
})
