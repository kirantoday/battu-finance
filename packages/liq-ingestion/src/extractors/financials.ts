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
 *
 * filingType is the actual annual-report form we pulled chunks from
 * (10-K / 20-F / 40-F). Including it in the prompt removes the "10-K" bias
 * that made Claude skip facilities in foreign issuer filings.
 */
async function extractLenderInfo(
  chunks:     Array<{ chunkText: string; section: string }>,
  ticker:     string,
  filingType: string,
): Promise<Pick<CreditFacilityResult, 'hasCreditFacility' | 'facilityLender' | 'facilityType' | 'facilityTotal'> | null> {
  if (chunks.length === 0) return null

  function lenderWindow(text: string): string {
    const lower = text.toLowerCase()
    // Markers in priority order:
    //   - US corporate idiom (10-K)
    //   - IFRS / European bank-facility idiom (20-F / 40-F)
    //   - Maritime / shipping idiom (20-F filers like TORO, where credit
    //     agreements are syndicated and use "facility agent" instead of
    //     "administrative agent", plus named shipping lenders).
    const markers = [
      'administrative agent',
      'credit agreement, dated',
      'banking facilities',
      'banking facility',
      'overdraft facility',
      // Maritime / shipping idioms
      'facility agent',
      'credit facility agent',
      'syndicate of banks',
      'mandated lead arranger',
      'term loan facility',
      'shipping credit',
      'senior secured',
      'agent bank',
      // Major shipping lenders by name — when the agreement names them
      // directly in prose the ±2K window centres on the bank itself.
      'dnb',
      'abn amro',
      'nordea',
      'credit agricole',
      'hamburg commercial',
      'piraeus bank',
    ]
    for (const marker of markers) {
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
    `Extract LENDER info for ${ticker}'s primary credit facility from these ${filingType} annual report excerpts.

NOTE: This may be a US domestic (10-K) filing OR a foreign private issuer
filing (20-F / 40-F). Credit facilities are sometimes named differently:
- Revolving credit facility / revolving credit agreement (US 10-K)
- Term loan facility, credit agreement (US 10-K)
- Bank facility / banking facilities (common in IFRS / 20-F / 40-F)
- Overdraft facility (common in foreign filings)
- Loan facility, secured loan, working capital facility
Extract from any of these regardless of filing type.

Return ONLY valid JSON, no other text:
{
  "hasCreditFacility": boolean,
  "facilityLender":    "<bank name, e.g. 'Bank of America' or 'HSBC'>" | null,
  "facilityType":      "<string, e.g. 'Senior unsecured revolving credit facility' or 'Bank facility'>" | null,
  "facilityTotal":     "<number in DOLLARS, e.g. 60000000 for $60M, 1500000000 for $1.5B>" | null
}

LENDER-EXTRACTION RULES:
- The lender is typically named as "Administrative Agent" in US credit agreements.
- "Bank of America, N.A., as Administrative Agent"  → facilityLender: "Bank of America".
- "JPMorgan Chase Bank, N.A., as administrative agent" → facilityLender: "JPMorgan Chase".
- In 20-F/40-F filings the lender may simply be named: "facility with HSBC Bank"
  or "loan agreement with Alpha Bank S.A." — extract that bank name.
- If multiple agreements exist, return the LENDER for the MOST RECENT one (later date wins).
- Strip "N.A.", "LLC", "Bank" suffixes — return just the firm name.
- If amounts are in another currency (CAD, EUR, etc.), still return the number
  as stated (do not convert) and prefix the currency in facilityType.

IMPORTANT FOR SHIPPING / MARITIME COMPANIES (20-F filers like tanker, dry-bulk,
container, LNG operators):
- Maritime credit facilities use "facility agent" or "credit facility agent"
  instead of "administrative agent". Treat these as equivalent.
- Shipping loans are typically syndicated — phrases like "syndicate of banks"
  or "mandated lead arranger" indicate multiple lenders. When this is the
  case, return the LEAD ARRANGER or FACILITY AGENT as facilityLender.
- Major shipping lenders include: DNB Bank, ABN AMRO, Nordea, Credit Agricole,
  Hamburg Commercial Bank, Piraeus Bank, ING, Citi, Société Générale.
  When any of these are named in a credit agreement context, that is the lender.
- Shipping facilities are often described as "term loan facility" or
  "senior secured term loan" — capture the amount stated.

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
  chunks:     Array<{ chunkText: string; section: string }>,
  ticker:     string,
  filingType: string,
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
    `Extract TERMS of ${ticker}'s primary credit facility from these ${filingType} annual report excerpts.
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

  // Detect which annual-report form this ticker actually filed. The RAG
  // family-mapping in vector-store accepts '10-K' as a logical key and
  // expands to 20-F / 40-F under the hood, but the Claude prompt + log lines
  // benefit from naming the real filing type so foreign-issuer language is
  // recognised correctly.
  const annualForms  = ['10-K', '10-K/A', '20-F', '20-F/A', '40-F', '40-F/A']
  const annualRows   = await pgSql`
    SELECT DISTINCT filing_type FROM battu.doc_chunks
    WHERE ticker = ${ticker}
      AND filing_type = ANY(${annualForms})
    LIMIT 1
  ` as unknown as Array<{ filing_type: string }>
  const annualFilingType = annualRows[0]?.filing_type ?? '10-K'

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
      // Logical key '10-K' is expanded to 10-K / 20-F / 40-F by filingTypeFamily
      // in vector-store, so a single search covers domestic + foreign issuers.
      // Query includes IFRS-flavoured terms ("banking facility", "overdraft")
      // alongside US bank names so the BM25 leg fires for either filer type.
      hybridSearch(
        ticker, '10-K',
        'revolving credit facility administrative agent bank lender banking facility overdraft facility loan agreement Bank of America JPMorgan Chase Wells Fargo Citibank HSBC Barclays Deutsche Bank',
        8,
      ),
      hybridSearch(
        ticker, '10-K',
        'undrawn available maturity expiry date covenant SOFR LIBOR EURIBOR interest rate secured unsecured outstanding borrowings drawn',
        8,
      ),
    ])

    const [lenderInfo, termsInfo] = await Promise.all([
      extractLenderInfo(lenderChunks, ticker, annualFilingType),
      extractTermsInfo(termsChunks,   ticker, annualFilingType),
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
