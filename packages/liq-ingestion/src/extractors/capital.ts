// Shelf + ATM + 424B drawdowns → battu.company_capital.

import Anthropic from '@anthropic-ai/sdk'
import { pgSql } from '@battu/db'
import { hybridSearch } from '../vector-store'
import {
  getFilingsList,
  fetchFilingDocument,
  buildFilingUrl,
  extract424BAmount,
} from '@battu/edgar'

let _client: Anthropic | null = null
function anthropicClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')
    _client = new Anthropic({ apiKey })
  }
  return _client
}

async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxRetries = 3
): Promise<T | null> {
  const delays = [30000, 60000, 120000]  // 30s, 60s, 120s
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err: any) {
      const status = err?.status || err?.response?.status
      if (status === 400 || status === 401 || status === 403) {
        console.error(`  [retry] ${label} — fatal error ${status}, not retrying`)
        return null
      }
      if (attempt < maxRetries) {
        const wait = delays[attempt]
        console.log(`  [retry] ${label} — attempt ${attempt + 1}/${maxRetries}, waiting ${wait/1000}s (status: ${status || err?.message})`)
        await new Promise(r => setTimeout(r, wait))
      } else {
        console.error(`  [retry] ${label} — all ${maxRetries} retries exhausted`)
        return null
      }
    }
  }
  return null
}

export async function extractAndStoreCapital(
  ticker: string,
  cik:    string,
): Promise<void> {
  console.log(`  [capital] Extracting for ${ticker}...`)
  const missing: string[] = []

  // ── Locate latest shelf — covers US (S-3), foreign (F-3), and Canadian MJDS (F-10) ──
  const shelfFilings = await getFilingsList(cik, [
    'S-3', 'S-3/A', 'S-3ASR',
    'F-3', 'F-3/A', 'F-3ASR',
    'F-10', 'F-10/A',
  ])

  let hasShelf        = false
  let isWksi          = false
  let shelfTotal:      number | null = null
  let shelfFilingDate: string | null = null
  let shelfExpiryDate: string | null = null
  let shelfSecurities: string | null = null
  let hasAtm          = false
  const atmTotal:      number | null = null
  let atmAgent:       string | null = null
  let sourceS3:       string | null = null

  if (shelfFilings.length > 0) {
    const latest    = shelfFilings[0]
    hasShelf        = true
    isWksi          = latest.form === 'S-3ASR' || latest.form === 'F-3ASR'
    shelfFilingDate = latest.filingDate
    sourceS3        = buildFilingUrl(cik, latest.accessionNumber, latest.primaryDocument)

    // Standard S-3s have a dollar cap to extract; S-3ASRs (WKSI) don't.
    if (!isWksi) {
      const chunks = await hybridSearch(
        ticker,
        'S-3',
        'aggregate offering amount maximum total registration shelf securities',
        5,
      )
      if (chunks.length > 0) {
        const context = chunks.map(c => c.chunkText).join('\n\n').slice(0, 6000)
        // withRetry returns null on API failure (after backoff) rather than
        // throwing, so the EDGAR-derived fields (has_shelf, is_wksi, dates,
        // source URL) stay intact and the row still gets inserted.
        const res = await withRetry(
          () => anthropicClient().messages.create({
            model:      'claude-haiku-4-5',
            max_tokens: 400,
            messages: [{
              role:    'user',
              content: `Extract shelf registration details from this S-3 for ${ticker}.
Return ONLY JSON:
{"totalAmountDollars":number|null,"isATM":boolean,"atmAgent":string|null,"securitiesType":string|null,"expiryDate":"YYYY-MM-DD"|null}
Text: ${context}`,
            }],
          }),
          `${ticker} shelf registration extraction`,
        )
        if (res) {
          try {
            const t = res.content[0]?.type === 'text' ? res.content[0].text : ''
            const clean = t.replace(/```json|```/g, '').trim()
            const match = clean.match(/\{[\s\S]*\}/)
            const p = JSON.parse(match ? match[0] : clean) as {
              totalAmountDollars: number | null
              isATM:              boolean
              atmAgent:           string | null
              securitiesType:     string | null
              expiryDate:         string | null
            }
            shelfTotal      = p.totalAmountDollars != null ? p.totalAmountDollars / 1e9 : null
            hasAtm          = !!p.isATM
            atmAgent        = p.atmAgent
            shelfSecurities = p.securitiesType
            shelfExpiryDate = p.expiryDate
          } catch {
            // JSON parse failure — leave shelf-detail nulls
          }
        } else {
          console.warn(`  [capital] Shelf-amount Claude call failed for ${ticker} — storing EDGAR metadata only`)
        }
      }
    }

    // Default 3-year expiry from filing if not extracted explicitly
    if (!shelfExpiryDate && shelfFilingDate) {
      const d = new Date(shelfFilingDate)
      d.setFullYear(d.getFullYear() + 3)
      shelfExpiryDate = d.toISOString().slice(0, 10)
    }
  }

  // ── 424B drawdowns since the S-3 ──
  let drawdownTotal       = 0
  let drawdownCount       = 0
  let drawdownLastDate:    string | null = null
  let drawdownLastAmount:  number | null = null
  const drawdownUrls: string[] = []

  if (hasShelf && shelfFilingDate) {
    const all     = await getFilingsList(cik, ['424B3', '424B5', '424B4', '424B2'])
    const relevant = all
      .filter(d => new Date(d.filingDate) >= new Date(shelfFilingDate!))
      .slice(0, 30)

    for (const d of relevant) {
      const text = await fetchFilingDocument(cik, d.accessionNumber, d.primaryDocument)
      if (!text) continue
      const amount = await extract424BAmount(text)
      if (amount && amount > 0) {
        drawdownTotal      += amount / 1e9
        drawdownCount++
        drawdownLastDate    = d.filingDate
        drawdownLastAmount  = amount / 1e9
        drawdownUrls.push(buildFilingUrl(cik, d.accessionNumber, d.primaryDocument))
      }
    }
  }

  const shelfRemaining =
    shelfTotal != null && !isWksi ? Math.max(0, shelfTotal - drawdownTotal) : null

  const dataQuality =
       missing.length === 0 ? 'full'
    :  missing.length <= 1  ? 'partial'
    :  'minimal'

  await pgSql`
    INSERT INTO battu.company_capital
      (ticker, cik, extracted_at, has_shelf, is_wksi, shelf_total,
       shelf_filing_date, shelf_expiry_date, shelf_securities_type,
       has_atm, atm_total_amount, atm_agent,
       drawdown_total, drawdown_count, drawdown_last_date, drawdown_last_amount,
       shelf_remaining, source_s3_url, source_drawdowns,
       data_quality, missing_fields)
    VALUES
      (${ticker}, ${cik}, NOW(), ${hasShelf}, ${isWksi},
       ${shelfTotal}, ${shelfFilingDate}, ${shelfExpiryDate}, ${shelfSecurities},
       ${hasAtm}, ${atmTotal}, ${atmAgent},
       ${drawdownTotal || null}, ${drawdownCount || null},
       ${drawdownLastDate}, ${drawdownLastAmount},
       ${shelfRemaining}, ${sourceS3}, ${drawdownUrls},
       ${dataQuality}, ${missing})
    ON CONFLICT (ticker) DO UPDATE SET
      extracted_at          = NOW(),
      has_shelf             = EXCLUDED.has_shelf,
      is_wksi               = EXCLUDED.is_wksi,
      shelf_total           = EXCLUDED.shelf_total,
      shelf_filing_date     = EXCLUDED.shelf_filing_date,
      shelf_expiry_date     = EXCLUDED.shelf_expiry_date,
      shelf_securities_type = EXCLUDED.shelf_securities_type,
      has_atm               = EXCLUDED.has_atm,
      atm_total_amount      = EXCLUDED.atm_total_amount,
      atm_agent             = EXCLUDED.atm_agent,
      drawdown_total        = EXCLUDED.drawdown_total,
      drawdown_count        = EXCLUDED.drawdown_count,
      drawdown_last_date    = EXCLUDED.drawdown_last_date,
      drawdown_last_amount  = EXCLUDED.drawdown_last_amount,
      shelf_remaining       = EXCLUDED.shelf_remaining,
      source_s3_url         = EXCLUDED.source_s3_url,
      source_drawdowns      = EXCLUDED.source_drawdowns,
      data_quality          = EXCLUDED.data_quality,
      missing_fields        = EXCLUDED.missing_fields
  `

  console.log(
    `  [capital] ✓ ${ticker} — shelf:${hasShelf} wksi:${isWksi} drawdowns:${drawdownCount}`
  )
}
