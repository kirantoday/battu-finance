// Per-ticker ingestion: resolve CIK → download filings → parse → chunk → embed
// → store → run 3 extractors.

import { getCIK, getFilingsList, fetchFilingDocument } from '@battu/edgar'
import { parseDocument } from './doc-parser'
import { chunkSections } from './chunker'
import { embedDocuments } from './embedder'
import {
  storeChunks,
  updateFilingIndex,
  isFilingProcessed,
} from './vector-store'
import { extractAndStoreFinancials } from './extractors/financials'
import { extractAndStoreCapital }    from './extractors/capital'
import { extractAndStoreGovernance } from './extractors/governance'

export interface PipelineResult {
  ticker:  string
  success: boolean
  error?:  string
  chunks:  number
}

const FILING_TYPE_QUERIES: Array<{ label: string; forms: string[] }> = [
  { label: '10-K', forms: ['10-K'] },
  // S-3 query also picks up S-3/A and S-3ASR — the actual form filed is stored.
  { label: 'S-3',  forms: ['S-3', 'S-3/A', 'S-3ASR'] },
]

export async function processTicker(ticker: string): Promise<PipelineResult> {
  console.log(`\n[pipeline] Processing ${ticker}...`)

  try {
    const cik = await getCIK(ticker)
    if (!cik) {
      return { ticker, success: false, error: 'CIK not found', chunks: 0 }
    }
    console.log(`  CIK: ${cik}`)

    let totalChunks = 0

    for (const { label, forms } of FILING_TYPE_QUERIES) {
      const filings = await getFilingsList(cik, forms)
      if (filings.length === 0) {
        console.log(`  No ${label} found`)
        continue
      }

      const latest = filings[0]
      const ft     = latest.form  // actual form (e.g. 'S-3ASR' rather than the query alias 'S-3')

      if (await isFilingProcessed(ticker, ft, latest.accessionNumber)) {
        console.log(`  ${ft} already processed — skipping`)
        continue
      }

      console.log(`  Processing ${ft} filed ${latest.filingDate}...`)
      await updateFilingIndex(
        ticker, cik, ft, latest.filingDate, latest.accessionNumber,
        'processing', 0,
      )

      try {
        // For ingestion we want the FULL document HTML (preserves table markers).
        // The on-demand LIQ path uses the default 50K text mode.
        const html = await fetchFilingDocument(cik, latest.accessionNumber, latest.primaryDocument, {
          raw:      true,
          maxBytes: 2_000_000,
        })
        if (!html) {
          await updateFilingIndex(
            ticker, cik, ft, latest.filingDate, latest.accessionNumber,
            'error', 0, 'Download failed',
          )
          continue
        }

        const sections = parseDocument(html, ft)
        const chunks   = chunkSections(sections)
        console.log(`  Parsed ${sections.length} sections → ${chunks.length} chunks`)

        if (chunks.length === 0) {
          await updateFilingIndex(
            ticker, cik, ft, latest.filingDate, latest.accessionNumber,
            'error', 0, 'No chunks parsed',
          )
          continue
        }

        const texts      = chunks.map(c => c.text)
        const embeddings = await embedDocuments(texts)

        await storeChunks(
          ticker, cik, ft, latest.filingDate, latest.accessionNumber,
          chunks, embeddings,
        )
        await updateFilingIndex(
          ticker, cik, ft, latest.filingDate, latest.accessionNumber,
          'done', chunks.length,
        )

        totalChunks += chunks.length
        console.log(`  ✓ ${ft}: ${chunks.length} chunks stored`)
      } catch (err) {
        await updateFilingIndex(
          ticker, cik, ft, latest.filingDate, latest.accessionNumber,
          'error', 0, String((err as Error)?.message ?? err),
        )
        console.error(`  ✗ ${ft} failed:`, err)
      }
    }

    // Now that chunks are stored, run all three extractors in parallel.
    console.log(`  Running extractions...`)
    await Promise.allSettled([
      extractAndStoreFinancials(ticker, cik),
      extractAndStoreCapital(ticker, cik),
      extractAndStoreGovernance(ticker, cik),
    ])

    console.log(`[pipeline] ✓ ${ticker} complete (${totalChunks} chunks)`)
    return { ticker, success: true, chunks: totalChunks }
  } catch (err) {
    console.error(`[pipeline] ✗ ${ticker} failed:`, err)
    return { ticker, success: false, error: String((err as Error)?.message ?? err), chunks: 0 }
  }
}

export async function processBatch(
  tickers:     string[],
  concurrency: number = 3,
): Promise<PipelineResult[]> {
  const results: PipelineResult[] = []
  const queue = [...tickers]

  while (queue.length > 0) {
    const batch        = queue.splice(0, concurrency)
    const batchResults = await Promise.all(batch.map(t => processTicker(t)))
    results.push(...batchResults)
    if (queue.length > 0) await new Promise(r => setTimeout(r, 500))
  }

  return results
}
