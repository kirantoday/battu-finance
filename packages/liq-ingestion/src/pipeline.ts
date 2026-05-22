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
  // Annual report — covers all three issuer types:
  //   10-K  — US domestic issuers
  //   20-F  — foreign private issuers (e.g. Greek shipping, EU tech)
  //   40-F  — Canadian issuers under the Multi-Jurisdictional Disclosure System (MJDS)
  { label: '10-K', forms: ['10-K', '20-F', '40-F'] },
  // Shelf registrations:
  //   S-3   — US domestic shelf
  //   F-3   — foreign private issuer shelf
  //   F-10  — Canadian MJDS shelf
  { label: 'S-3',  forms: ['S-3', 'S-3/A', 'S-3ASR', 'F-3', 'F-3/A', 'F-3ASR', 'F-10', 'F-10/A'] },
]

export type ExtractorName = 'financials' | 'capital' | 'governance'

export interface ProcessOptions {
  /**
   * When set, skip download/parse/chunk/embed entirely and re-run only the
   * named extractor against chunks already stored in battu.doc_chunks.
   * Use this to backfill new extractor logic without paying SEC + Voyage
   * round-trips again.
   */
  extractOnly?: ExtractorName
}

export async function processTicker(
  ticker: string,
  opts:   ProcessOptions = {},
): Promise<PipelineResult> {
  console.log(`\n[pipeline] Processing ${ticker}${opts.extractOnly ? ` (extract-only: ${opts.extractOnly})` : ''}...`)

  try {
    const cik = await getCIK(ticker)
    if (!cik) {
      return { ticker, success: false, error: 'CIK not found', chunks: 0 }
    }
    console.log(`  CIK: ${cik}`)

    // Fast path: extractor-only re-run. Skip all download/chunk/embed work
    // and just re-execute the named extractor against existing chunks.
    if (opts.extractOnly) {
      const fn =
          opts.extractOnly === 'financials' ? extractAndStoreFinancials
        : opts.extractOnly === 'capital'    ? extractAndStoreCapital
        : extractAndStoreGovernance
      try {
        await fn(ticker, cik)
        console.log(`[pipeline] ✓ ${ticker} ${opts.extractOnly} re-extracted`)
        return { ticker, success: true, chunks: 0 }
      } catch (err) {
        console.error(`[pipeline] ✗ ${ticker} ${opts.extractOnly} extractor failed:`, err)
        return { ticker, success: false, error: String((err as Error)?.message ?? err), chunks: 0 }
      }
    }

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
    const settled = await Promise.allSettled([
      extractAndStoreFinancials(ticker, cik),
      extractAndStoreCapital(ticker, cik),
      extractAndStoreGovernance(ticker, cik),
    ])
    const labels = ['financials', 'capital', 'governance']
    settled.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.warn(`  [${labels[i]}] ✗ ${ticker} extractor crashed: ${(r.reason as Error)?.message ?? r.reason}`)
      }
    })

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
  opts:        ProcessOptions = {},
): Promise<PipelineResult[]> {
  const results: PipelineResult[] = []
  const queue = [...tickers]

  while (queue.length > 0) {
    const batch        = queue.splice(0, concurrency)
    const batchResults = await Promise.all(batch.map(t => processTicker(t, opts)))
    results.push(...batchResults)
    if (queue.length > 0) await new Promise(r => setTimeout(r, 500))
  }

  return results
}
