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

  // Detect the actual annual filing type so prompts don't say "10-K" when the
  // chunks came from a 20-F or 40-F. The hybridSearch family-mapping handles
  // the corpus side, but Claude needs the right vocabulary in the prompt.
  const annualForms  = ['10-K', '10-K/A', '20-F', '20-F/A', '40-F', '40-F/A']
  const annualRows   = await pgSql`
    SELECT DISTINCT filing_type FROM battu.doc_chunks
    WHERE ticker = ${ticker}
      AND filing_type = ANY(${annualForms})
    LIMIT 1
  ` as unknown as Array<{ filing_type: string }>
  const annualFilingType = annualRows[0]?.filing_type ?? '10-K'

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
      // Auditor: 10-K's auditor report often only shows a PCAOB ID, with the
      // actual firm name appearing in the S-3 / F-3 "EXPERTS" section
      // ("incorporated in reliance on the report of [Firm], independent
      // registered public accounting firm"). Search both filing types.
      // filingTypeFamily expands '10-K' to also cover 20-F/40-F, and 'S-3'
      // to also cover F-3/F-10 for foreign issuers.
      Promise.all([
        hybridSearch(
          ticker, '10-K',
          'independent registered public accounting firm auditor report opinion PricewaterhouseCoopers Deloitte KPMG Ernst Young Grant Thornton BDO PCAOB',
          8,
        ).catch(() => []),
        hybridSearch(
          ticker, 'S-3',
          'experts auditor independent registered public accounting firm PricewaterhouseCoopers Deloitte KPMG Ernst Young Grant Thornton BDO',
          5,
        ).catch(() => []),
        // S-3/F-3 first — the EXPERTS section reliably names the auditor
        // ("incorporated in reliance on the report of [Firm]"). The 10-K /
        // 20-F / 40-F auditor report often shows only a PCAOB ID after
        // HTML stripping.
      ]).then(([annual, shelf]) => [...shelf, ...annual]),
      hybridSearch(ticker, '10-K', 'legal proceedings lawsuits pending claims material litigation contingencies',  5).catch(() => []),
      hybridSearch(ticker, '10-K', 'going concern substantial doubt ability to continue operations', 3).catch(() => []),
    ])

  // ── Counsel ──
  let counselPrimary: string | null = null
  let counselSpecial: string | null = null
  if (counselChunks.length > 0) {
    const ctx = counselChunks.map(c => c.chunkText).join('\n\n').slice(0, 4000)
    const r = await claudeHaikuExtract<{ counselPrimary: string | null; counselSpecial: string | null }>(
      `Extract legal counsel from this shelf-registration filing for ${ticker}.

This may be a US S-3 / S-3ASR (domestic issuer) or a foreign-issuer shelf
(F-3 / F-3ASR / F-10). In foreign filings the counsel section may name a
local firm (e.g. Stikeman Elliott for Canadian issuers, Norton Rose Fulbright,
Linklaters) in addition to or instead of a US firm.

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

  // Fallback: if the standard query returned nothing useful, search for any
  // chunk that mentions a major auditing firm by name. This catches cases
  // where Item 8 wasn't detected and the auditor signature block landed in a
  // mis-labeled chunk.
  let effectiveAuditorChunks = auditorChunks
  if (effectiveAuditorChunks.length === 0) {
    effectiveAuditorChunks = await hybridSearch(
      ticker, '10-K',
      'PricewaterhouseCoopers Deloitte KPMG Ernst Young Grant Thornton BDO',
      8,
    ).catch(() => [])
  }

  if (effectiveAuditorChunks.length > 0) {
    // 8K char window — needs enough room for multiple chunks since the actual
    // PwC mention can be deep inside the S-3 EXPERTS chunk.
    const ctx = effectiveAuditorChunks.map(c => c.chunkText).join('\n\n').slice(0, 8000)
    const r = await claudeHaikuExtract<{
      auditorName:  string | null
      auditorSince: string | null
      opinionClean: boolean
    }>(
      `Extract the company's independent auditor from this ${annualFilingType} annual report excerpt for ${ticker}.

This may be a US 10-K, a foreign private issuer 20-F, or a Canadian MJDS
40-F. In all three the auditor is a major accounting firm: PricewaterhouseCoopers
(PwC), Deloitte, KPMG, Ernst & Young (EY), Grant Thornton, or BDO. Foreign
issuers sometimes use local firms (De Visser Gray, MNP, Raymond Chabot Grant
Thornton, etc.) — extract whatever firm name appears.

Look for phrases like "signed by [firm]" or "/s/ [firm name]" at the end of
the audit report. If you see "PCAOB ID No." it's near the auditor signature.

Return ONLY JSON: {"auditorName":string|null,"auditorSince":string|null,"opinionClean":boolean}
- Strip "LLP", "LLC", "P.C." suffixes — return e.g. "PricewaterhouseCoopers" not "PricewaterhouseCoopers LLP".
- opinionClean is true unless the report uses words like "adverse", "qualified", or "disclaimer of opinion".

Text:
${ctx}`,
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
      `Extract litigation summary from this ${annualFilingType} annual report for ${ticker}.
Filing may be a US 10-K or foreign issuer 20-F / 40-F — legal proceedings
language is similar across all three.
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

  // Mirror source URLs from the sibling extractors so the LEGAL screen can
  // link out to the underlying filings. The governance extractor doesn't
  // download those documents itself — it works from RAG chunks — so the URLs
  // are sourced from the rows the financials + capital extractors just wrote.
  const finRow = await pgSql`
    SELECT source_10k_url FROM battu.company_financials
    WHERE ticker = ${ticker} LIMIT 1
  ` as unknown as Array<{ source_10k_url: string | null }>
  const capRow = await pgSql`
    SELECT source_s3_url FROM battu.company_capital
    WHERE ticker = ${ticker} LIMIT 1
  ` as unknown as Array<{ source_s3_url: string | null }>
  let source10kUrl: string | null = finRow[0]?.source_10k_url ?? null
  const sourceS3Url: string | null = capRow[0]?.source_s3_url ?? null

  // The financials extractor doesn't currently write source_10k_url — fall back
  // to constructing the EDGAR filing-index URL from filing_index, which
  // tracks the accession we ingested chunks from. This covers 10-K plus the
  // foreign-issuer equivalents (20-F / 40-F and their amendment variants).
  if (!source10kUrl) {
    const annualForms = ['10-K', '10-K/A', '20-F', '20-F/A', '40-F', '40-F/A']
    const annualRows  = await pgSql`
      SELECT cik, accession_no
      FROM   battu.filing_index
      WHERE  ticker      = ${ticker}
        AND  filing_type = ANY(${annualForms})
        AND  status      = 'done'
      ORDER  BY filing_date DESC
      LIMIT 1
    ` as unknown as Array<{ cik: string; accession_no: string }>
    if (annualRows[0]) {
      const cikNum     = parseInt(annualRows[0].cik, 10)
      const accNoClean = annualRows[0].accession_no.replace(/-/g, '')
      source10kUrl = `https://www.sec.gov/Archives/edgar/data/${cikNum}/${accNoClean}/${annualRows[0].accession_no}-index.htm`
    }
  }

  await pgSql`
    INSERT INTO battu.company_governance
      (ticker, cik, extracted_at,
       counsel_primary, counsel_special,
       auditor_name, auditor_since, audit_opinion_clean, has_going_concern,
       litigation_count, litigation_summary, sec_investigation,
       source_10k_url, source_s3_url,
       data_quality, missing_fields)
    VALUES
      (${ticker}, ${cik}, NOW(),
       ${counselPrimary}, ${counselSpecial},
       ${auditorName}, ${auditorSince}, ${auditOpinionClean}, ${hasGoingConcern},
       ${litigationCount}, ${litigationSummary}, ${secInvestigation},
       ${source10kUrl}, ${sourceS3Url},
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
      source_10k_url      = EXCLUDED.source_10k_url,
      source_s3_url       = EXCLUDED.source_s3_url,
      data_quality        = EXCLUDED.data_quality,
      missing_fields      = EXCLUDED.missing_fields
  `

  console.log(
    `  [governance] ✓ ${ticker} — counsel:${counselPrimary ?? '—'} ` +
    `auditor:${auditorName ?? '—'} goingConcern:${hasGoingConcern}`
  )
}
