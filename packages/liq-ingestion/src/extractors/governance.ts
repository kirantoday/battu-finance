// Counsel + auditor + litigation → battu.company_governance.

import Anthropic from '@anthropic-ai/sdk'
import { pgSql } from '@battu/db'
import { hybridSearch } from '../vector-store'

let _client: Anthropic | null = null
function anthropicClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')
    _client = new Anthropic({ apiKey })
  }
  return _client
}

async function claudeHaikuExtract<T>(prompt: string): Promise<T | null> {
  try {
    const res = await anthropicClient().messages.create({
      model:      'claude-haiku-4-5',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    })
    const text  = res.content[0]?.type === 'text' ? res.content[0].text : ''
    const clean = text.replace(/```json|```/g, '').trim()
    const match = clean.match(/\{[\s\S]*\}/)
    return JSON.parse(match ? match[0] : clean) as T
  } catch {
    return null
  }
}

export async function extractAndStoreGovernance(
  ticker: string,
  cik:    string,
): Promise<void> {
  console.log(`  [governance] Extracting for ${ticker}...`)
  const missing: string[] = []

  // Pull 4 RAG queries in parallel — they all hit the same indexes
  const [counselChunks, auditorChunks, litigationChunks, goingConcernChunks] =
    await Promise.all([
      // Counsel: include common firm names so BM25 matches even when the chunk
      // doesn't use generic terms like "legal counsel"
      hybridSearch(
        ticker, 'S-3',
        'legal counsel law firm LLP attorneys opinion validity Ropes Gray Sullivan Cromwell Davis Polk Skadden Wachtell Cooley Latham Watkins',
        8,
      ).catch(() => []),
      // Auditor: include Big-4 firm names because BIIB's 10-K may use the
      // long form "independent registered public accounting firm" without the
      // shorter word "auditor".
      hybridSearch(
        ticker, '10-K',
        'independent registered public accounting firm auditor report opinion PricewaterhouseCoopers Deloitte KPMG Ernst Young PCAOB',
        8,
      ).catch(() => []),
      hybridSearch(ticker, '10-K', 'legal proceedings lawsuits pending claims material litigation contingencies',  5).catch(() => []),
      hybridSearch(ticker, '10-K', 'going concern substantial doubt ability to continue operations', 3).catch(() => []),
    ])

  // ── Counsel ──
  let counselPrimary: string | null = null
  let counselSpecial: string | null = null
  if (counselChunks.length > 0) {
    const ctx = counselChunks.map(c => c.chunkText).join('\n\n').slice(0, 4000)
    const r = await claudeHaikuExtract<{ counselPrimary: string | null; counselSpecial: string | null }>(
      `Extract legal counsel from this S-3 filing for ${ticker}.
Return ONLY JSON: {"counselPrimary":string|null,"counselSpecial":string|null}
Text: ${ctx}`,
    )
    counselPrimary = r?.counselPrimary ?? null
    counselSpecial = r?.counselSpecial ?? null
  }

  // ── Auditor + going concern ──
  let auditorName:        string | null = null
  let auditorSince:       string | null = null
  let auditOpinionClean   = true
  let hasGoingConcern     = false

  if (auditorChunks.length > 0) {
    const ctx = auditorChunks.map(c => c.chunkText).join('\n\n').slice(0, 4000)
    const r = await claudeHaikuExtract<{
      auditorName:  string | null
      auditorSince: string | null
      opinionClean: boolean
    }>(
      `Extract auditor details from this 10-K for ${ticker}.
Return ONLY JSON: {"auditorName":string|null,"auditorSince":string|null,"opinionClean":boolean}
Text: ${ctx}`,
    )
    auditorName       = r?.auditorName ?? null
    auditorSince      = r?.auditorSince ?? null
    auditOpinionClean = r?.opinionClean !== false
  }

  if (goingConcernChunks.length > 0) {
    const ctx   = goingConcernChunks.map(c => c.chunkText).join('\n\n').toLowerCase()
    hasGoingConcern =
         ctx.includes('going concern')
      && (ctx.includes('substantial doubt') || ctx.includes('raise substantial'))
  }

  // ── Litigation ──
  let litigationCount:   number | null = null
  let litigationSummary: string | null = null
  let secInvestigation   = false

  if (litigationChunks.length > 0) {
    const ctx = litigationChunks.map(c => c.chunkText).join('\n\n').slice(0, 4000)
    const r = await claudeHaikuExtract<{
      count:            number | null
      summary:          string | null
      secInvestigation: boolean
    }>(
      `Extract litigation summary from this 10-K for ${ticker}.
Return ONLY JSON: {"count":number|null,"summary":string|null,"secInvestigation":boolean}
Text: ${ctx}`,
    )
    litigationCount   = r?.count ?? null
    litigationSummary = r?.summary ?? null
    secInvestigation  = r?.secInvestigation ?? false
  }

  const dataQuality =
       missing.length === 0 ? 'full'
    :  missing.length <= 2  ? 'partial'
    :  'minimal'

  await pgSql`
    INSERT INTO battu.company_governance
      (ticker, cik, extracted_at,
       counsel_primary, counsel_special,
       auditor_name, auditor_since, audit_opinion_clean, has_going_concern,
       litigation_count, litigation_summary, sec_investigation,
       data_quality, missing_fields)
    VALUES
      (${ticker}, ${cik}, NOW(),
       ${counselPrimary}, ${counselSpecial},
       ${auditorName}, ${auditorSince}, ${auditOpinionClean}, ${hasGoingConcern},
       ${litigationCount}, ${litigationSummary}, ${secInvestigation},
       ${dataQuality}, ${missing})
    ON CONFLICT (ticker) DO UPDATE SET
      extracted_at        = NOW(),
      counsel_primary     = EXCLUDED.counsel_primary,
      counsel_special     = EXCLUDED.counsel_special,
      auditor_name        = EXCLUDED.auditor_name,
      auditor_since       = EXCLUDED.auditor_since,
      audit_opinion_clean = EXCLUDED.audit_opinion_clean,
      has_going_concern   = EXCLUDED.has_going_concern,
      litigation_count    = EXCLUDED.litigation_count,
      litigation_summary  = EXCLUDED.litigation_summary,
      sec_investigation   = EXCLUDED.sec_investigation,
      data_quality        = EXCLUDED.data_quality,
      missing_fields      = EXCLUDED.missing_fields
  `

  console.log(
    `  [governance] ✓ ${ticker} — counsel:${counselPrimary ?? '—'} ` +
    `auditor:${auditorName ?? '—'} goingConcern:${hasGoingConcern}`
  )
}
