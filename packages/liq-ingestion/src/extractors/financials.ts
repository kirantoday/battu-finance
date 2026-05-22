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

async function claudeHaikuJson<T>(prompt: string): Promise<T | null> {
  try {
    const res = await anthropicClient().messages.create({
      model:      'claude-haiku-4-5',
      max_tokens: 500,
      messages:   [{ role: 'user', content: prompt }],
    })
    const text  = res.content[0]?.type === 'text' ? res.content[0].text : ''
    const clean = text.replace(/```json|```/g, '').trim()
    const match = clean.match(/\{[\s\S]*\}/)
    return JSON.parse(match ? match[0] : clean) as T
  } catch {
    return null
  }
}

/**
 * Pass 1 — lender focused. Uses ±2K windows around "administrative agent" /
 * "credit agreement, dated" markers so the lender mention (often deep in a
 * 16K-char chunk's exhibits list) always lands in Claude's prompt.
 */
async function extractLenderInfo(
  chunks: Array<{ chunkText: string; section: string }>,
  ticker: string,
): Promise<Pick<CreditFacilityResult, 'hasCreditFacility' | 'facilityLender' | 'facilityType' | 'facilityTotal'> | null> {
  if (chunks.length === 0) return null

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

  const context = chunks
    .map(c => lenderWindow(c.chunkText))
    .join('\n\n---\n\n')
    .slice(0, 12000)

  return claudeHaikuJson<{
    hasCreditFacility: boolean
    facilityLender:    string | null
    facilityType:      string | null
    facilityTotal:     number | null
  }>(
    `Extract LENDER info for ${ticker}'s primary revolving credit facility from these 10-K excerpts.
Return ONLY valid JSON, no other text:
{
  "hasCreditFacility": boolean,
  "facilityLender":    "<bank name, e.g. 'Bank of America'>" | null,
  "facilityType":      "<string, e.g. 'Senior unsecured revolving credit facility'>" | null,
  "facilityTotal":     "<number in DOLLARS, e.g. 1500000000 for $1.5B>" | null
}

LENDER-EXTRACTION RULES:
- The lender is typically named as "Administrative Agent" in credit agreements.
- "Bank of America, N.A., as Administrative Agent"  → facilityLender: "Bank of America".
- "JPMorgan Chase Bank, N.A., as administrative agent" → facilityLender: "JPMorgan Chase".
- If multiple agreements exist, return the LENDER for the MOST RECENT one (later date wins).
- Strip "N.A.", "LLC", "Bank" suffixes — return just the firm name.

If no credit facility found, set hasCreditFacility: false and others null.

Excerpts:
${context}`,
  )
}

/**
 * Pass 2 — terms focused. Uses the raw chunk text (no lender-window prefilter)
 * so MD&A and Notes to Financial Statements language about maturity, undrawn
 * capacity, security, and covenants stays in context.
 */
async function extractTermsInfo(
  chunks: Array<{ chunkText: string; section: string }>,
  ticker: string,
): Promise<Pick<CreditFacilityResult,
  'facilityDrawn' | 'facilityUndrawn' | 'facilityExpiry' | 'facilitySecured' | 'facilityRate' | 'facilityCovenants'
> | null> {
  if (chunks.length === 0) return null

  const context = chunks.map(c => c.chunkText).join('\n\n---\n\n').slice(0, 8000)

  return claudeHaikuJson<{
    facilityDrawn:      number | null
    facilityUndrawn:    number | null
    facilityExpiry:     string | null
    facilitySecured:    boolean | null
    facilityRate:       string | null
    facilityCovenants:  string | null
  }>(
    `Extract TERMS of ${ticker}'s primary revolving credit facility from these 10-K excerpts.
Return ONLY valid JSON, no other text:
{
  "facilityDrawn":     "<number in DOLLARS — current balance outstanding>" | null,
  "facilityUndrawn":   "<number in DOLLARS — available capacity>" | null,
  "facilityExpiry":    "YYYY-MM-DD" | null,
  "facilitySecured":   boolean | null,
  "facilityRate":      "<string, e.g. 'SOFR + 1.25%'>" | null,
  "facilityCovenants": "<one-sentence description>" | null
}

NOTES:
- If the filing says "no amounts were outstanding" or "no borrowings", facilityDrawn = 0 and facilityUndrawn = full facility size.
- For expiry, use the maturity date stated in the Credit Agreement.
- "Unsecured" → facilitySecured: false. "Secured" → true.

Excerpts:
${context}`,
  )
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

  // ── Credit facility via RAG — TWO PASSES ──
  // Pass 1 retrieves chunks that name the lender (BoA / JPM / etc) and the
  // facility size. Pass 2 retrieves chunks about maturity, undrawn capacity,
  // covenants. Lender-window prefiltering compresses pass-1 context around
  // "administrative agent" so the bank name always lands in the prompt; pass-2
  // uses the raw chunk text so terms language isn't accidentally truncated.
  let cf: CreditFacilityResult | null = null
  try {
    const [lenderChunks, termsChunks] = await Promise.all([
      hybridSearch(
        ticker, '10-K',
        'revolving credit facility administrative agent bank lender Bank of America JPMorgan Chase Wells Fargo Citibank Goldman Sachs Morgan Stanley',
        8,
      ),
      hybridSearch(
        ticker, '10-K',
        'undrawn available maturity expiry date covenant SOFR interest rate secured unsecured outstanding borrowings',
        8,
      ),
    ])

    const [lenderInfo, termsInfo] = await Promise.all([
      extractLenderInfo(lenderChunks, ticker),
      extractTermsInfo(termsChunks,  ticker),
    ])

    if (lenderInfo || termsInfo) {
      const drawn   = termsInfo?.facilityDrawn   ?? null
      const undrawn = termsInfo?.facilityUndrawn ?? null
      // If pass 1 missed the headline total, derive it from drawn + undrawn
      // (works when the filing reports both, which is the common case).
      const derivedTotal =
           lenderInfo?.facilityTotal
        ?? (drawn != null && undrawn != null ? drawn + undrawn : null)

      cf = {
        hasCreditFacility: lenderInfo?.hasCreditFacility ?? (termsInfo != null),
        facilityLender:    lenderInfo?.facilityLender   ?? null,
        facilityType:      lenderInfo?.facilityType     ?? null,
        facilityTotal:     derivedTotal,
        facilityDrawn:     drawn,
        facilityUndrawn:   undrawn,
        facilityExpiry:    termsInfo?.facilityExpiry    ?? null,
        facilitySecured:   termsInfo?.facilitySecured   ?? null,
        facilityRate:      termsInfo?.facilityRate      ?? null,
        facilityCovenants: termsInfo?.facilityCovenants ?? null,
      }
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
