import {
  GROUND_TRUTH, HP_REFERENCE_DATE, TOLERANCE,
  type GroundTruthField, type GroundTruthRecord, type Ticker,
} from './groundTruth'
import {
  fetchAll, type AllBattuResponses, type FetchResult,
} from './battuApiClient'

export type ValidationStatus =
  | 'PASS'
  | 'FAIL'
  | 'SKIP'
  | 'ERROR'
  | 'MISSING_ENDPOINT'
  | 'WARNING' // for price-drift fields that exceed tolerance but are expected

export interface ValidationResult {
  ticker:       string
  field:        string
  groundTruth:  number | null
  battuValue:   number | null
  deviation:    number | null   // decimal — 0.023 = 2.3%
  tolerance:    number
  status:       ValidationStatus
  band:         string
  source:       string
  verifiedAt:   string
  notes?:       string
}

/**
 * Pull a numeric field out of a FetchResult, returning:
 *   - the number, OR
 *   - { missing: true }  if the upstream call failed with MISSING_ENDPOINT, OR
 *   - { error: msg }     if the upstream call failed with ERROR, OR
 *   - { null: true }     if the response was OK but the field is absent
 */
type PickResult =
  | { kind: 'value'; value: number }
  | { kind: 'missing' }
  | { kind: 'error'; message: string }
  | { kind: 'null' }

function pickNumber<T>(res: FetchResult<T>, getter: (data: T) => number | undefined | null): PickResult {
  if (!res.ok) {
    return res.kind === 'MISSING_ENDPOINT'
      ? { kind: 'missing' }
      : { kind: 'error', message: res.message }
  }
  const v = getter(res.data)
  if (v === undefined || v === null || Number.isNaN(v)) return { kind: 'null' }
  return { kind: 'value', value: v }
}

export function compareField(
  ticker: string,
  field: string,
  groundTruth: GroundTruthField,
  pick: PickResult,
): ValidationResult {
  const tolerance = TOLERANCE[groundTruth.band]
  const base: Omit<ValidationResult, 'status' | 'deviation' | 'battuValue'> = {
    ticker,
    field,
    groundTruth: groundTruth.value,
    tolerance,
    band:        groundTruth.band,
    source:      groundTruth.source,
    verifiedAt:  groundTruth.verifiedAt,
    notes:       groundTruth.notes,
  }

  // Field not applicable for this ticker
  if (groundTruth.value === null) {
    return { ...base, status: 'SKIP', battuValue: null, deviation: null }
  }

  // Upstream issues
  if (pick.kind === 'missing') {
    return { ...base, status: 'MISSING_ENDPOINT', battuValue: null, deviation: null }
  }
  if (pick.kind === 'error') {
    return { ...base, status: 'ERROR', battuValue: null, deviation: null, notes: pick.message }
  }
  if (pick.kind === 'null') {
    return { ...base, status: 'ERROR', battuValue: null, deviation: null, notes: 'BATTU returned null for this field' }
  }

  const battuValue = pick.value
  const gt = groundTruth.value
  const deviation = gt === 0 ? Math.abs(battuValue) : Math.abs(battuValue - gt) / Math.abs(gt)

  // Price drift is expected — flag but don't hard-fail
  if (groundTruth.band === 'price' && deviation > tolerance) {
    return { ...base, status: 'WARNING', battuValue, deviation }
  }

  const status: ValidationStatus = deviation <= tolerance ? 'PASS' : 'FAIL'
  return { ...base, status, battuValue, deviation }
}

/**
 * The mapping from ground-truth field names to:
 *   (a) which API response holds it
 *   (b) how to extract the numeric value from that response,
 *       converting units where necessary (e.g. raw → billions).
 */
type FieldKey = keyof Omit<GroundTruthRecord, 'ticker'>

const FIELD_EXTRACTORS: Record<FieldKey, (data: AllBattuResponses) => PickResult> = {
  // DES
  marketCapB:           (d) => pickNumber(d.des, x => x.marketCap !== undefined ? x.marketCap / 1e9 : undefined),
  sharesOutstandingM:   (d) => pickNumber(d.des, x => x.sharesOutstanding !== undefined ? x.sharesOutstanding / 1e6 : undefined),
  peRatioTTM:           (d) => pickNumber(d.des, x => x.peRatio),
  epsTTM:               (d) => pickNumber(d.des, x => x.eps),
  dividendYield:        (d) => pickNumber(d.des, x => x.dividendYield),
  beta:                 (d) => pickNumber(d.des, x => x.beta),
  // FA
  revenueB:             (d) => pickNumber(d.fa,  x => x.revenue !== undefined ? x.revenue / 1e9 : undefined),
  grossMargin:          (d) => pickNumber(d.fa,  x => x.grossMargin),
  operatingMargin:      (d) => pickNumber(d.fa,  x => x.operatingMargin),
  netMargin:            (d) => pickNumber(d.fa,  x => x.netMargin),
  totalDebtB:           (d) => pickNumber(d.fa,  x => x.totalDebt !== undefined ? x.totalDebt / 1e9 : undefined),
  cashAndEquivB:        (d) => pickNumber(d.fa,  x => x.cash !== undefined ? x.cash / 1e9 : undefined),
  // EE
  epsEstimateNTM:       (d) => pickNumber(d.ee,  x => x.epsEstimateNTM),
  revenueEstimateNTMB:  (d) => pickNumber(d.ee,  x => x.revenueEstimateNTM !== undefined ? x.revenueEstimateNTM / 1e9 : undefined),
  // ANR
  analystConsensus:     (d) => pickNumber(d.anr, x => x.consensusRating),
  priceTargetConsensus: (d) => pickNumber(d.anr, x => x.priceTarget),
  // HP
  closePrice1YrAgo:     (d) => pickNumber(d.hp,  x => x.close),
  // LIQ
  liqCashRunwayQtrs:    (d) => pickNumber(d.liq, x => x.cashRunwayQtrs),
  liqTotalLiquidityB:   (d) => pickNumber(d.liq, x => x.totalLiquidityB),
}

export function validateTicker(
  record: GroundTruthRecord,
  battu:  AllBattuResponses,
): ValidationResult[] {
  const out: ValidationResult[] = []
  for (const field of Object.keys(FIELD_EXTRACTORS) as FieldKey[]) {
    const gt = record[field]
    const pick = FIELD_EXTRACTORS[field](battu)
    out.push(compareField(record.ticker, field, gt, pick))
  }
  return out
}

export interface TickerRunSummary {
  ticker:   string
  results:  ValidationResult[]
  apiUp:    boolean   // whether at least one endpoint succeeded
  fetchErr: string | null
}

export async function validateAll(
  truth: Record<string, GroundTruthRecord> = GROUND_TRUTH,
  onProgress?: (ticker: string, done: number, total: number) => void,
): Promise<TickerRunSummary[]> {
  const entries = Object.entries(truth) as [Ticker, GroundTruthRecord][]
  const summaries: TickerRunSummary[] = []
  let done = 0
  for (const [ticker, record] of entries) {
    let battu: AllBattuResponses
    let fetchErr: string | null = null
    try {
      battu = await fetchAll(ticker, HP_REFERENCE_DATE)
    } catch (e) {
      fetchErr = (e as Error).message
      // Build a fully-errored response bundle so we still emit results
      const errored: FetchResult<never> = { ok: false, kind: 'ERROR', message: fetchErr }
      battu = { des: errored, fa: errored, ee: errored, anr: errored, hp: errored, liq: errored, price: errored } as AllBattuResponses
    }
    const results = validateTicker(record, battu)
    const apiUp = Object.values(battu).some(r => r.ok)
    summaries.push({ ticker, results, apiUp, fetchErr })
    done++
    onProgress?.(ticker, done, entries.length)
  }
  return summaries
}
