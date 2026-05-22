// Cash + credit-facility extraction → battu.company_financials.
// Cash from EDGAR XBRL (free); credit facility from RAG-retrieved 10-K chunks.

import Anthropic from '@anthropic-ai/sdk'
import { pgSql } from '@battu/db'
import { hybridSearch } from '../vector-store'
import { getXBRLCashData } from '@battu/edgar'

let _client: Anthropic | null = null
function anthropicClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')
    _client = new Anthropic({ apiKey })
  }
  return _client
}

interface CreditFacilityResult {
  hasCreditFacility: boolean
  facilityType:      string | null
  facilityTotal:     number | null   // dollars
  facilityDrawn:     number | null
  facilityUndrawn:   number | null
  facilityLender:    string | null
  facilityRate:      string | null
  facilityExpiry:    string | null
  facilitySecured:   boolean | null
  facilityCovenants: string | null
}

async function extractCreditFacilityFromChunks(
  chunks: Array<{ chunkText: string; section: string }>,
  ticker: string,
): Promise<CreditFacilityResult | null> {
  if (chunks.length === 0) return null

  // The lender name typically lives near "Administrative Agent" or "Credit
  // Agreement, dated" in the exhibits list. These markers may be in the
  // MIDDLE of a 16K chunk — past the truncation if we just join + slice.
  // Pre-extract the ±2K window around the first marker hit per chunk so the
  // critical text always lands in the Claude prompt.
  function lenderWindow(text: string): string {
    const lower = text.toLowerCase()
    for (const marker of ['administrative agent', 'credit agreement, dated']) {
      const i = lower.indexOf(marker)
      if (i >= 0) {
        const start = Math.max(0, i - 1000)
        const end   = Math.min(text.length, i + 2000)
        return text.slice(start, end)
      }
    }
    return text.slice(0, 3000)
  }

  const windows = chunks.map(c => lenderWindow(c.chunkText))
  const context = windows.join('\n\n---\n\n').slice(0, 12000)

  const res = await anthropicClient().messages.create({
    model:      'claude-sonnet-4-5',
    max_tokens: 800,
    messages: [{
      role:    'user',
      content: `Extract credit facility details for ${ticker} from these 10-K excerpts.
Return ONLY valid JSON, no other text:
{
  "hasCreditFacility": boolean,
  "facilityType": "<string: e.g. 'Senior unsecured revolving credit facility'>" | null,
  "facilityTotal":   "<number in DOLLARS, e.g. 1500000000 for $1.5B>" | null,
  "facilityDrawn":   "<number in DOLLARS>" | null,
  "facilityUndrawn": "<number in DOLLARS>" | null,
  "facilityLender":  "<The bank or financial institution name (e.g. Bank of America, JPMorgan Chase, Wells Fargo, Citibank, Goldman Sachs, Morgan Stanley). Look for 'Administrative Agent' or 'as agent' — the bank named as Administrative Agent IS the lender>" | null,
  "facilityRate":    "<string: e.g. 'SOFR + 1.5%'>" | null,
  "facilityExpiry":  "YYYY-MM-DD" | null,
  "facilitySecured": boolean | null,
  "facilityCovenants": "<short description>" | null
}

IMPORTANT lender-extraction rules:
- The lender is typically named as "Administrative Agent" in credit agreements.
- Example: "Bank of America, N.A., as Administrative Agent" means facilityLender = "Bank of America".
- "JPMorgan Chase Bank, N.A., as administrative agent" means facilityLender = "JPMorgan Chase".
- If multiple banks are listed as a syndicate, return the Administrative Agent (the lead bank).
- Strip "N.A.", "LLC", and similar suffixes — return just the bank name.

If no credit facility found, set hasCreditFacility: false and all others null.

Excerpts:
${context}`,
    }],
  })

  try {
    const text  = res.content[0]?.type === 'text' ? res.content[0].text : ''
    const clean = text.replace(/```json|```/g, '').trim()
    const match = clean.match(/\{[\s\S]*\}/)
    return JSON.parse(match ? match[0] : clean) as CreditFacilityResult
  } catch {
    return null
  }
}

export async function extractAndStoreFinancials(
  ticker: string,
  cik:    string,
): Promise<void> {
  console.log(`  [financials] Extracting for ${ticker}...`)
  const missing: string[] = []

  // ── XBRL cash data ──
  let cashAndEquiv:         number | null = null
  let shortTermInvest:      number | null = null
  let operatingCfQuarterly: number | null = null
  let capexQuarterly:       number | null = null
  let cashRunwayQtrs:       number | null = null
  const sourceXbrlUrl = `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`

  try {
    const xbrl = await getXBRLCashData(cik)
    if (xbrl) {
      cashAndEquiv    = xbrl.cashAndEquiv    != null ? xbrl.cashAndEquiv    / 1e9 : null
      shortTermInvest = xbrl.shortTermInvest != null ? xbrl.shortTermInvest / 1e9 : null

      if (xbrl.operatingCF != null && xbrl.operatingCF < 0) {
        operatingCfQuarterly = Math.abs(xbrl.operatingCF) / 1e9
        capexQuarterly       = xbrl.capex != null ? Math.abs(xbrl.capex) / 1e9 : null
        cashRunwayQtrs       =
          cashAndEquiv != null && operatingCfQuarterly > 0
            ? cashAndEquiv / operatingCfQuarterly
            : null
      }
    } else {
      missing.push('cash_data')
    }
  } catch {
    missing.push('cash_data')
  }

  // ── Credit facility via RAG ──
  let cf: CreditFacilityResult | null = null
  try {
    // Query includes "Administrative Agent" + common syndicate-lead bank names
    // so BM25 fires on the chunk that names the lender, not just the abstract
    // credit-facility prose.
    const chunks = await hybridSearch(
      ticker,
      '10-K',
      'revolving credit facility administrative agent bank lender SOFR maturity undrawn available line of credit Bank of America JPMorgan Chase Wells Fargo Citibank Goldman Sachs Morgan Stanley',
      8,
    )
    if (chunks.length > 0) {
      cf = await extractCreditFacilityFromChunks(chunks, ticker)
    }
  } catch (e) {
    console.log(`  [financials] Credit facility extraction failed: ${(e as Error).message}`)
    missing.push('credit_facility')
  }

  // ── Total liquidity ──
  const undrawnB = cf?.facilityUndrawn != null ? cf.facilityUndrawn / 1e9 : null
  const parts: Array<number | null> = [cashAndEquiv, shortTermInvest, undrawnB]
  const present = parts.filter((p): p is number => p != null)
  const totalLiquidity = present.length > 0 ? present.reduce((s, v) => s + v, 0) : null

  const dataQuality =
       missing.length === 0 ? 'full'
    :  missing.length <= 2  ? 'partial'
    :  'minimal'

  await pgSql`
    INSERT INTO battu.company_financials
      (ticker, cik, extracted_at, cash_and_equiv, short_term_invest,
       operating_cf_quarterly, capex_quarterly, cash_runway_qtrs,
       has_credit_facility, facility_type, facility_total, facility_drawn,
       facility_undrawn, facility_lender, facility_rate, facility_expiry,
       facility_secured, facility_covenants, total_liquidity,
       source_xbrl_url, data_quality, missing_fields)
    VALUES
      (${ticker}, ${cik}, NOW(),
       ${cashAndEquiv}, ${shortTermInvest},
       ${operatingCfQuarterly}, ${capexQuarterly}, ${cashRunwayQtrs},
       ${cf?.hasCreditFacility ?? false},
       ${cf?.facilityType ?? null},
       ${cf?.facilityTotal   != null ? cf.facilityTotal   / 1e9 : null},
       ${cf?.facilityDrawn   != null ? cf.facilityDrawn   / 1e9 : null},
       ${cf?.facilityUndrawn != null ? cf.facilityUndrawn / 1e9 : null},
       ${cf?.facilityLender ?? null}, ${cf?.facilityRate ?? null},
       ${cf?.facilityExpiry ?? null}, ${cf?.facilitySecured ?? null},
       ${cf?.facilityCovenants ?? null}, ${totalLiquidity},
       ${sourceXbrlUrl}, ${dataQuality}, ${missing})
    ON CONFLICT (ticker) DO UPDATE SET
      extracted_at            = NOW(),
      cash_and_equiv          = EXCLUDED.cash_and_equiv,
      short_term_invest       = EXCLUDED.short_term_invest,
      operating_cf_quarterly  = EXCLUDED.operating_cf_quarterly,
      capex_quarterly         = EXCLUDED.capex_quarterly,
      cash_runway_qtrs        = EXCLUDED.cash_runway_qtrs,
      has_credit_facility     = EXCLUDED.has_credit_facility,
      facility_type           = EXCLUDED.facility_type,
      facility_total          = EXCLUDED.facility_total,
      facility_drawn          = EXCLUDED.facility_drawn,
      facility_undrawn        = EXCLUDED.facility_undrawn,
      facility_lender         = EXCLUDED.facility_lender,
      facility_rate           = EXCLUDED.facility_rate,
      facility_expiry         = EXCLUDED.facility_expiry,
      facility_secured        = EXCLUDED.facility_secured,
      facility_covenants      = EXCLUDED.facility_covenants,
      total_liquidity         = EXCLUDED.total_liquidity,
      data_quality            = EXCLUDED.data_quality,
      missing_fields          = EXCLUDED.missing_fields
  `

  console.log(
    `  [financials] ✓ ${ticker} — cash:${cashAndEquiv?.toFixed(3) ?? '—'}B ` +
    `credit:${cf?.hasCreditFacility ? (cf.facilityLender ?? 'yes') : 'none'}`
  )
}
