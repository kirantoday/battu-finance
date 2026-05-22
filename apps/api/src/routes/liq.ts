import { Hono } from 'hono'
import { pgSql } from '@battu/db'
import type { LIQData } from '@battu/shared'

export const liqRoutes = new Hono()

/**
 * GET /api/v1/liq/:ticker
 * Reads from the three pre-extracted tables populated by `pnpm ingest:liq`.
 * Sub-50ms target — no Claude/EDGAR calls at query time.
 */
liqRoutes.get('/:ticker', async (c) => {
  const ticker = c.req.param('ticker').toUpperCase()

  try {
    const [fins, caps] = await Promise.all([
      pgSql`SELECT * FROM battu.company_financials WHERE ticker = ${ticker} LIMIT 1`,
      pgSql`SELECT * FROM battu.company_capital    WHERE ticker = ${ticker} LIMIT 1`,
    ])

    const fin = fins[0] as Record<string, unknown> | undefined
    const cap = caps[0] as Record<string, unknown> | undefined

    if (!fin && !cap) {
      return c.json({
        data:           null,
        error:          `${ticker} not yet ingested. Run: pnpm ingest:liq --ticker=${ticker}`,
        cached:         false,
        needsIngestion: true,
      }, 404)
    }

    const num = (v: unknown): number | null => {
      if (v === null || v === undefined) return null
      const n = Number(v)
      return Number.isFinite(n) ? n : null
    }
    const str  = (v: unknown): string | null => (v == null ? null : String(v))
    const bool = (v: unknown): boolean        => v === true || v === 't' || v === 'true'
    const dateStr = (v: unknown): string | null => {
      if (!v) return null
      if (v instanceof Date) return v.toISOString().slice(0, 10)
      return String(v).slice(0, 10)
    }

    const extractedAt =
         (fin?.extracted_at instanceof Date && fin.extracted_at.toISOString())
      || (cap?.extracted_at instanceof Date && cap.extracted_at.toISOString())
      || str(fin?.extracted_at)
      || str(cap?.extracted_at)
      || new Date().toISOString()

    const drawdowns = Array.isArray(cap?.source_drawdowns) ? cap!.source_drawdowns as string[] : []

    const data: LIQData = {
      ticker,
      computedAt:          extractedAt,

      // Cash position
      cashAndEquivB:       num(fin?.cash_and_equiv),
      shortTermInvestB:    num(fin?.short_term_invest),
      quarterlyBurnB:      num(fin?.operating_cf_quarterly),
      cashRunwayQtrs:      num(fin?.cash_runway_qtrs),

      // Shelf
      hasShelf:            bool(cap?.has_shelf),
      shelfTotalB:         num(cap?.shelf_total),
      shelfDrawdownsB:     num(cap?.drawdown_total),
      shelfRemainingB:     num(cap?.shelf_remaining),
      shelfFilingDate:     dateStr(cap?.shelf_filing_date),
      shelfExpiryDate:     dateStr(cap?.shelf_expiry_date),
      isATMProgram:        bool(cap?.has_atm),

      // Credit facility
      hasCreditFacility:   bool(fin?.has_credit_facility),
      creditFacilityType:  str(fin?.facility_type),
      creditTotalB:        num(fin?.facility_total),
      creditDrawnB:        num(fin?.facility_drawn),
      creditUndrawnB:      num(fin?.facility_undrawn),
      creditExpiryDate:    dateStr(fin?.facility_expiry),
      creditLender:        str(fin?.facility_lender),
      creditInterestRate:  str(fin?.facility_rate),

      totalLiquidityB:     num(fin?.total_liquidity),

      sources: {
        balanceSheet: str(fin?.source_xbrl_url) ?? undefined,
        creditFiling: str(fin?.source_10k_url)  ?? undefined,
        shelfFiling:  str(cap?.source_s3_url)   ?? undefined,
        drawdowns,
      },

      dataQuality:
        ((str(fin?.data_quality) ?? str(cap?.data_quality) ?? 'partial') as LIQData['dataQuality']),
      missingFields: [
        ...((fin?.missing_fields as string[] | undefined) ?? []),
        ...((cap?.missing_fields as string[] | undefined) ?? []),
      ],
    }

    return c.json({ data, error: null, cached: true, computedAt: data.computedAt })
  } catch (err) {
    console.error('[liq] read error:', err)
    return c.json({ data: null, error: 'Database error' }, 500)
  }
})

/**
 * POST /api/v1/liq/:ticker/refresh — refresh now goes through the CLI ingestion job.
 */
liqRoutes.post('/:ticker/refresh', async (c) => {
  const ticker = c.req.param('ticker').toUpperCase()
  return c.json({
    data:    null,
    error:   null,
    message: `To refresh ${ticker}, run: pnpm ingest:liq --ticker=${ticker}`,
    command: `pnpm ingest:liq --ticker=${ticker}`,
  })
})
