// Claude-powered extraction of LIQ-relevant numbers from SEC filings.
//   Haiku for cheap/structured pulls (S-3 amount, 424B drawdowns).
//   Sonnet for the credit-facility extraction (richer prose, more fields).

import Anthropic from '@anthropic-ai/sdk'

let _client: Anthropic | null = null
function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')
    _client = new Anthropic({ apiKey })
  }
  return _client
}

const HAIKU  = 'claude-haiku-4-5'
const SONNET = 'claude-sonnet-4-5'

function parseJsonResponse(text: string): unknown {
  const clean = text.replace(/```json|```/g, '').trim()
  // Try direct parse, then fall back to extracting the first {...} block
  try { return JSON.parse(clean) } catch { /* fall through */ }
  const match = clean.match(/\{[\s\S]*\}/)
  if (!match) throw new Error(`No JSON found in response: ${text.slice(0, 200)}`)
  return JSON.parse(match[0])
}

// ── Extract shelf registration amount from an S-3 ───────────────────────────
export interface ShelfExtraction {
  totalAmount: number | null   // dollars
  atmProgram:  boolean
  expiryDate:  string | null
  rawText:     string
}

export async function extractShelfAmount(
  filingText: string,
  ticker: string,
): Promise<ShelfExtraction | null> {
  try {
    const excerpt = filingText.slice(0, 15_000)
    const response = await getClient().messages.create({
      model:      HAIKU,
      max_tokens: 500,
      messages: [{
        role:    'user',
        content: `Extract shelf registration details from this SEC S-3 filing for ${ticker}.

Find:
1. Total aggregate offering amount (the maximum dollar amount registered)
2. Whether this includes an ATM (at-the-market) program
3. Expiry date if mentioned (S-3s are valid for 3 years from effectiveness)

Respond ONLY in JSON format, no other text:
{
  "totalAmountDollars": <number or null>,
  "isATM": <true or false>,
  "expiryDate": "<YYYY-MM-DD or null>",
  "confidence": "<high|medium|low>"
}

Filing text:
${excerpt}`,
      }],
    })
    const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
    const parsed = parseJsonResponse(text) as {
      totalAmountDollars?: number | null
      isATM?:              boolean
      expiryDate?:         string | null
    }
    return {
      totalAmount: parsed.totalAmountDollars ?? null,
      atmProgram:  parsed.isATM ?? false,
      expiryDate:  parsed.expiryDate ?? null,
      rawText:     excerpt.slice(0, 500),
    }
  } catch (e) {
    console.warn(`[liqExtractor] extractShelfAmount error: ${(e as Error).message}`)
    return null
  }
}

// ── Extract amount from a 424B prospectus supplement ─────────────────────────
export async function extract424BAmount(filingText: string): Promise<number | null> {
  try {
    const excerpt = filingText.slice(0, 8_000)
    const response = await getClient().messages.create({
      model:      HAIKU,
      max_tokens: 200,
      messages: [{
        role:    'user',
        content: `Extract the aggregate offering amount from this 424B SEC filing.
This is a prospectus supplement. Find the total dollar amount being offered/sold.

Respond ONLY with a JSON object, no other text:
{"amountDollars": <number or null>}

Filing text:
${excerpt}`,
      }],
    })
    const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
    const parsed = parseJsonResponse(text) as { amountDollars?: number | null }
    return parsed.amountDollars ?? null
  } catch (e) {
    console.warn(`[liqExtractor] extract424BAmount error: ${(e as Error).message}`)
    return null
  }
}

// ── Extract credit facility details from 10-K ───────────────────────────────
export interface CreditFacilityExtraction {
  facilityType:   string | null
  totalAmount:    number | null
  drawnAmount:    number | null
  undrawnAmount:  number | null
  expiryDate:     string | null
  lenderName:     string | null
  interestRate:   string | null
}

export async function extractCreditFacility(
  filingText: string,
  ticker: string,
): Promise<CreditFacilityExtraction | null> {
  try {
    // Search for credit facility section to maximize signal-to-noise
    const lower = filingText.toLowerCase()
    const cfIndex = lower.indexOf('credit facility')
    const rfIndex = lower.indexOf('revolving credit')
    let startIdx = 0
    if (cfIndex > 0 || rfIndex > 0) {
      const candidates = [cfIndex, rfIndex].filter(i => i > 0).map(i => Math.max(0, i - 200))
      startIdx = Math.min(...candidates)
    }
    // Clamp so we have at least 8k of context available
    if (startIdx > filingText.length - 8_000) {
      startIdx = Math.max(0, filingText.length - 8_000)
    }
    const excerpt = filingText.slice(startIdx, startIdx + 8_000)

    const response = await getClient().messages.create({
      model:      SONNET,
      max_tokens: 600,
      messages: [{
        role:    'user',
        content: `Extract credit facility (revolving credit / line of credit / ROFL) details
from this 10-K filing section for ${ticker}.

Find:
1. Type of facility (revolving credit, term loan, etc.)
2. Total facility amount
3. Amount currently drawn/outstanding
4. Available/undrawn amount
5. Expiry/maturity date
6. Lender name (bank or syndicate lead)
7. Interest rate or spread (e.g. SOFR + 1.5%)

Respond ONLY in JSON format, no other text:
{
  "facilityType": "<string or null>",
  "totalAmountDollars": <number or null>,
  "drawnAmountDollars": <number or null>,
  "undrawnAmountDollars": <number or null>,
  "expiryDate": "<YYYY-MM-DD or null>",
  "lenderName": "<string or null>",
  "interestRate": "<string or null>",
  "confidence": "<high|medium|low>"
}

If no credit facility found, return all null values.

Filing excerpt:
${excerpt}`,
      }],
    })
    const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
    const parsed = parseJsonResponse(text) as {
      facilityType?:        string | null
      totalAmountDollars?:  number | null
      drawnAmountDollars?:  number | null
      undrawnAmountDollars?: number | null
      expiryDate?:          string | null
      lenderName?:          string | null
      interestRate?:        string | null
    }
    return {
      facilityType:  parsed.facilityType  ?? null,
      totalAmount:   parsed.totalAmountDollars  ?? null,
      drawnAmount:   parsed.drawnAmountDollars  ?? null,
      undrawnAmount: parsed.undrawnAmountDollars ?? null,
      expiryDate:    parsed.expiryDate    ?? null,
      lenderName:    parsed.lenderName    ?? null,
      interestRate:  parsed.interestRate  ?? null,
    }
  } catch (e) {
    console.warn(`[liqExtractor] extractCreditFacility error: ${(e as Error).message}`)
    return null
  }
}
