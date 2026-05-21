// LIQ computation orchestrator.
// Combines FMP structured cash/burn data with EDGAR S-3/424B/10-K filings
// extracted via Claude. Called on-demand by the API route OR in batch by the
// session 6B ingestion pipeline.

import type { LIQData, LIQProgress } from '@battu/shared'
import { getCIK, getFilingsList, fetchFilingDocument, buildFilingUrl } from './client'
import { extractShelfAmount, extract424BAmount, extractCreditFacility } from './liqExtractor'

// Re-export so existing @battu/edgar consumers continue to work.
export type { LIQData, LIQProgress }

/** Minimal FMP client surface — keeps this package decoupled from @battu/data. */
export interface LiqFmpClient {
  getBalanceSheet(ticker: string, period: 'annual' | 'quarter', limit?: number): Promise<any[]>
  getCashFlow(ticker: string, period: 'annual' | 'quarter', limit?: number): Promise<any[]>
}

export async function computeLIQ(
  ticker: string,
  fmpClient: LiqFmpClient,
  onProgress?: (p: LIQProgress) => void,
): Promise<LIQData> {
  const progress = (step: string, done = false, error?: string) => {
    onProgress?.({ step, done, error })
    console.log(`[LIQ ${ticker}] ${step}${error ? ` ERROR: ${error}` : ''}`)
  }

  const missing: string[] = []
  const sources: LIQData['sources'] = {}

  // ── Step 1: FMP balance sheet + cash flow ─────────────────────────────────
  progress('Fetching balance sheet data...')
  let cashB: number | null    = null
  let investB: number | null  = null
  let burnB: number | null    = null

  // Try quarter first (freshest), fall back to annual if FMP plan rejects it.
  const tryFmp = async (
    call:     () => Promise<any[]>,
    fallback: () => Promise<any[]>,
  ): Promise<any[] | null> => {
    try { return await call() } catch (e1) {
      console.warn(`[LIQ ${ticker}] quarter fetch failed, trying annual: ${(e1 as Error).message}`)
      try { return await fallback() } catch (e2) {
        console.warn(`[LIQ ${ticker}] annual fetch also failed: ${(e2 as Error).message}`)
        return null
      }
    }
  }

  try {
    const [bsArr, cfArr] = await Promise.all([
      tryFmp(
        () => fmpClient.getBalanceSheet(ticker, 'quarter', 1),
        () => fmpClient.getBalanceSheet(ticker, 'annual',  1),
      ),
      tryFmp(
        () => fmpClient.getCashFlow(ticker, 'quarter', 1),
        () => fmpClient.getCashFlow(ticker, 'annual',  1),
      ),
    ])
    const bs = bsArr?.[0]
    const cf = cfArr?.[0]

    if (bs) {
      const cashAndSt = bs.cashAndShortTermInvestments ?? null
      const cashOnly  = bs.cashAndCashEquivalents ?? null
      const stOnly    = bs.shortTermInvestments ?? null
      cashB   = cashAndSt != null ? cashAndSt / 1e9 : cashOnly != null ? cashOnly / 1e9 : null
      investB = stOnly != null ? stOnly / 1e9 : null
    } else {
      missing.push('cashAndEquiv')
    }

    if (cf) {
      const ocf   = cf.operatingCashFlow ?? cf.netCashProvidedByOperatingActivities ?? null
      const capex = cf.capitalExpenditure ?? cf.capitalExpenditures ?? null
      if (ocf != null && ocf < 0) {
        // Quarterly burn = |negative OCF| + |capex|
        burnB = (Math.abs(ocf) + Math.abs(capex ?? 0)) / 1e9
      } else if (ocf != null && capex != null && Math.abs(capex) > ocf) {
        // Profitable on OCF but capex exceeds — net cash outflow scenario
        burnB = (Math.abs(capex) - ocf) / 1e9
      } else {
        burnB = null  // profitable, runway not meaningful
      }
    } else {
      missing.push('quarterlyBurn')
    }
  } catch (err) {
    progress('Balance sheet data', false, (err as Error).message)
    missing.push('cashAndEquiv', 'quarterlyBurn')
  }

  const cashRunwayQtrs =
    cashB != null && burnB != null && burnB > 0 ? cashB / burnB : null

  // ── Step 2: CIK ───────────────────────────────────────────────────────────
  progress('Resolving SEC CIK...')
  const cik = await getCIK(ticker)
  if (!cik) {
    progress('CIK resolution', false, 'Not found in EDGAR ticker index')
    missing.push('shelf', 'creditFacility')
    return finalize(ticker, { cashB, investB, burnB, cashRunwayQtrs, missing, sources })
  }

  // ── Step 3: Locate the most recent S-3 ────────────────────────────────────
  progress('Searching for shelf registration (S-3)...')
  const shelfFilings = await getFilingsList(cik, ['S-3', 'S-3/A', 'S-3ASR'])

  let hasShelf        = false
  let shelfTotalB:     number | null = null
  let shelfRemainingB: number | null = null
  let shelfDrawdownsB: number | null = null
  let shelfFilingDate: string | null = null
  let shelfExpiryDate: string | null = null
  let isATM           = false

  if (shelfFilings.length > 0) {
    const s3 = shelfFilings[0]
    hasShelf        = true
    shelfFilingDate = s3.filingDate
    sources.shelfFiling = buildFilingUrl(cik, s3.accessionNumber, s3.primaryDocument)

    progress('Extracting shelf registration amount...')
    const s3Text = await fetchFilingDocument(cik, s3.accessionNumber, s3.primaryDocument)
    if (s3Text) {
      const extracted = await extractShelfAmount(s3Text, ticker)
      if (extracted) {
        shelfTotalB     = extracted.totalAmount != null ? extracted.totalAmount / 1e9 : null
        shelfExpiryDate = extracted.expiryDate
        isATM           = extracted.atmProgram
      }
    }

    // ── Step 4: 424B drawdowns since S-3 ────────────────────────────────────
    if (shelfTotalB != null) {
      progress('Calculating ATM drawdowns (424B filings)...')
      const allDrawdowns = await getFilingsList(cik, ['424B3', '424B5', '424B4', '424B2'])
      const sinceShelf = allDrawdowns.filter(d =>
        new Date(d.filingDate) >= new Date(shelfFilingDate!)
      )

      sources.drawdowns = []
      let totalDrawnB = 0
      for (const d of sinceShelf.slice(0, 20)) {
        const dText = await fetchFilingDocument(cik, d.accessionNumber, d.primaryDocument)
        if (!dText) continue
        const amount = await extract424BAmount(dText)
        if (amount && amount > 0) {
          totalDrawnB += amount / 1e9
          sources.drawdowns.push(buildFilingUrl(cik, d.accessionNumber, d.primaryDocument))
        }
      }
      shelfDrawdownsB = totalDrawnB
      shelfRemainingB = Math.max(0, shelfTotalB - totalDrawnB)
    }
  } else {
    progress('No S-3 found — skipping shelf')
    missing.push('shelf')
  }

  // ── Step 5: 10-K → credit facility ────────────────────────────────────────
  progress('Searching for credit facility (10-K)...')
  const annuals = await getFilingsList(cik, ['10-K'])

  let hasCF          = false
  let cfType:        string | null = null
  let cfTotal:       number | null = null
  let cfDrawn:       number | null = null
  let cfUndrawn:     number | null = null
  let cfExpiry:      string | null = null
  let cfLender:      string | null = null
  let cfRate:        string | null = null

  if (annuals.length > 0) {
    const tk = annuals[0]
    sources.creditFiling = buildFilingUrl(cik, tk.accessionNumber, tk.primaryDocument)

    progress('Extracting credit facility terms...')
    const tkText = await fetchFilingDocument(cik, tk.accessionNumber, tk.primaryDocument)
    if (tkText) {
      const cf = await extractCreditFacility(tkText, ticker)
      if (cf && cf.totalAmount) {
        hasCF      = true
        cfType     = cf.facilityType
        cfTotal    = cf.totalAmount    != null ? cf.totalAmount    / 1e9 : null
        cfDrawn    = cf.drawnAmount    != null ? cf.drawnAmount    / 1e9 : null
        cfUndrawn  = cf.undrawnAmount  != null ? cf.undrawnAmount  / 1e9 :
                     (cfTotal != null && cfDrawn != null ? cfTotal - cfDrawn : null)
        cfExpiry   = cf.expiryDate
        cfLender   = cf.lenderName
        cfRate     = cf.interestRate
      }
    }
  } else {
    missing.push('creditFacility')
  }

  // ── Step 6: Total liquidity ───────────────────────────────────────────────
  progress('Computing total liquidity...')
  const totalLiqParts = [cashB, investB, cfUndrawn, shelfRemainingB].filter(v => v != null) as number[]
  const totalLiqB = totalLiqParts.length > 0 ? totalLiqParts.reduce((s, v) => s + v, 0) : null

  progress('Complete', true)

  return finalize(ticker, {
    cashB, investB, burnB, cashRunwayQtrs,
    hasShelf, shelfTotalB, shelfDrawdownsB, shelfRemainingB,
    shelfFilingDate, shelfExpiryDate, isATM,
    hasCF, cfType, cfTotal, cfDrawn, cfUndrawn,
    cfExpiry, cfLender, cfRate,
    totalLiqB,
    missing, sources,
  })
}

// ── Finalize: build LIQData with computed dataQuality ───────────────────────
interface IntermediateLIQ {
  cashB:           number | null
  investB:         number | null
  burnB:           number | null
  cashRunwayQtrs:  number | null
  hasShelf?:       boolean
  shelfTotalB?:    number | null
  shelfDrawdownsB?:number | null
  shelfRemainingB?:number | null
  shelfFilingDate?:string | null
  shelfExpiryDate?:string | null
  isATM?:          boolean
  hasCF?:          boolean
  cfType?:         string | null
  cfTotal?:        number | null
  cfDrawn?:        number | null
  cfUndrawn?:      number | null
  cfExpiry?:       string | null
  cfLender?:       string | null
  cfRate?:         string | null
  totalLiqB?:      number | null
  missing:         string[]
  sources:         LIQData['sources']
}

function finalize(ticker: string, d: IntermediateLIQ): LIQData {
  const missing = d.missing
  const quality: LIQData['dataQuality'] =
    missing.length === 0 ? 'full' :
    missing.length <= 2  ? 'partial' :
                           'minimal'

  return {
    ticker,
    computedAt:          new Date().toISOString(),
    cashAndEquivB:       d.cashB ?? null,
    shortTermInvestB:    d.investB ?? null,
    quarterlyBurnB:      d.burnB ?? null,
    cashRunwayQtrs:      d.cashRunwayQtrs ?? null,
    hasShelf:            d.hasShelf ?? false,
    shelfTotalB:         d.shelfTotalB ?? null,
    shelfDrawdownsB:     d.shelfDrawdownsB ?? null,
    shelfRemainingB:     d.shelfRemainingB ?? null,
    shelfFilingDate:     d.shelfFilingDate ?? null,
    shelfExpiryDate:     d.shelfExpiryDate ?? null,
    isATMProgram:        d.isATM ?? false,
    hasCreditFacility:   d.hasCF ?? false,
    creditFacilityType:  d.cfType ?? null,
    creditTotalB:        d.cfTotal ?? null,
    creditDrawnB:        d.cfDrawn ?? null,
    creditUndrawnB:      d.cfUndrawn ?? null,
    creditExpiryDate:    d.cfExpiry ?? null,
    creditLender:        d.cfLender ?? null,
    creditInterestRate:  d.cfRate ?? null,
    totalLiquidityB:     d.totalLiqB ?? null,
    sources:             d.sources,
    dataQuality:         quality,
    missingFields:       missing,
  }
}
