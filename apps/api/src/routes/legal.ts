import { Hono } from 'hono'
import { pgSql } from '@battu/db'
import type { LEGALData } from '@battu/shared'

export const legalRoutes = new Hono()

/**
 * GET /api/v1/legal/:ticker
 * Reads from battu.company_governance — populated by `pnpm ingest:liq`.
 * Sub-50ms target — no Claude/EDGAR calls at query time.
 */
legalRoutes.get('/:ticker', async (c) => {
  const ticker = decodeURIComponent(c.req.param('ticker')).toUpperCase()

  try {
    const rows = await pgSql`
      SELECT * FROM battu.company_governance
      WHERE ticker = ${ticker}
      LIMIT 1
    `
    const row = rows[0] as Record<string, unknown> | undefined

    if (!row) {
      return c.json({
        data:           null,
        error:          `${ticker} not yet ingested. Run: pnpm ingest:liq --ticker=${ticker}`,
        cached:         false,
        needsIngestion: true,
      }, 404)
    }

    const str  = (v: unknown): string | null => (v == null ? null : String(v))
    const num  = (v: unknown): number | null => {
      if (v == null) return null
      const n = Number(v)
      return Number.isFinite(n) ? n : null
    }
    // `extracted_at` is a timestamp — `audit_opinion_clean` defaults true.
    const bool = (v: unknown, fallback = false): boolean =>
      v == null ? fallback
        : (v === true || v === 't' || v === 'true')
    const dateStr = (v: unknown): string | null => {
      if (!v) return null
      if (v instanceof Date) return v.toISOString().slice(0, 10)
      return String(v).slice(0, 10)
    }
    const isoStr = (v: unknown): string | null => {
      if (!v) return null
      if (v instanceof Date) return v.toISOString()
      // postgres-js returns timestamptz as 'YYYY-MM-DD HH:MM:SS.sss+TZ' which
      // isn't ISO-compliant: needs 'T' separator AND a colon in the offset
      // ('+00' alone fails in strict parsers like Safari). Normalise before
      // routing through new Date() so the browser gets a portable ISO string.
      const normalised = String(v)
        .replace(' ', 'T')
        .replace(/([+-]\d{2})$/, '$1:00')
      const d = new Date(normalised)
      return Number.isNaN(d.valueOf()) ? String(v) : d.toISOString()
    }

    const data: LEGALData = {
      ticker,
      extractedAt:           isoStr(row.extracted_at),

      counselPrimary:        str(row.counsel_primary),
      counselSpecial:        str(row.counsel_special),

      auditorName:           str(row.auditor_name),
      auditorSince:          str(row.auditor_since),
      // Default true — extractor only flips this when the audit report
      // contains "adverse", "qualified", or "disclaimer of opinion".
      auditOpinionClean:     bool(row.audit_opinion_clean, true),
      hasGoingConcern:       bool(row.has_going_concern),

      litigationCount:       num(row.litigation_count),
      litigationSummary:     str(row.litigation_summary),
      secInvestigation:      bool(row.sec_investigation),
      regulatoryProceedings: str(row.regulatory_proceedings),

      fdaStatus:             str(row.fda_status),
      fdaLastAction:         str(row.fda_last_action),
      fdaLastDate:           dateStr(row.fda_last_date),

      insiderNet90d:         str(row.insider_net_90d),
      insiderLastDate:       dateStr(row.insider_last_date),
      ceoActivity90d:        str(row.ceo_activity_90d),

      source10kUrl:          str(row.source_10k_url),
      sourceS3Url:           str(row.source_s3_url),
      sourceProxyUrl:        str(row.source_proxy_url),

      dataQuality:           ((str(row.data_quality) ?? 'partial') as LEGALData['dataQuality']),
      missingFields:         Array.isArray(row.missing_fields) ? row.missing_fields as string[] : [],
    }

    return c.json({ data, error: null, cached: true })
  } catch (err) {
    console.error('[legal] read error:', err)
    return c.json({ data: null, error: 'Database error' }, 500)
  }
})
