// Per-ticker ingestion: resolve CIK → download filings → parse → chunk → embed
// → store → run 3 extractors.

import { writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { pgSql } from '@battu/db'
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
  ticker:   string
  success:  boolean
  error?:   string
  chunks:   number
  skipped?: boolean
}

// A ticker whose three extractor tables were all written within this window is
// considered fresh — we skip re-running the Claude extractors for it. This is
// what makes a re-run of a large tier (e.g. sp500 = 500 × 3 = 1,500 calls)
// resume cheaply instead of re-extracting everything. Bypass with --force.
const EXTRACTOR_CACHE_DAYS = 30

// Cross-platform progress file. os.tmpdir() resolves to:
//   Windows:        C:\Users\{user}\AppData\Local\Temp\battu_ingestion_progress.json
//   Linux/Railway:  /tmp/battu_ingestion_progress.json
const PROGRESS_FILE = join(tmpdir(), 'battu_ingestion_progress.json')

async function isAlreadyExtracted(ticker: string): Promise<boolean> {
  const [fin, cap, gov] = await Promise.all([
    pgSql`SELECT extracted_at FROM battu.company_financials
          WHERE ticker = ${ticker}
            AND extracted_at > NOW() - make_interval(days => ${EXTRACTOR_CACHE_DAYS})
          LIMIT 1`,
    pgSql`SELECT extracted_at FROM battu.company_capital
          WHERE ticker = ${ticker}
            AND extracted_at > NOW() - make_interval(days => ${EXTRACTOR_CACHE_DAYS})
          LIMIT 1`,
    pgSql`SELECT extracted_at FROM battu.company_governance
          WHERE ticker = ${ticker}
            AND extracted_at > NOW() - make_interval(days => ${EXTRACTOR_CACHE_DAYS})
          LIMIT 1`,
  ])
  return fin.length > 0 && cap.length > 0 && gov.length > 0
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
  /**
   * Bypass the isAlreadyExtracted() resume check and re-extract every ticker
   * even if its three tables already hold fresh data (--force on the CLI).
   */
  force?: boolean
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

    // Resume check: if all three extractor tables already hold fresh data,
    // skip the whole ticker — no SEC round-trips and, crucially, no Claude
    // extractor calls. --force (opts.force) and --extract-only both bypass
    // this: extract-only is itself an explicit re-extraction request.
    if (!opts.force && !opts.extractOnly && await isAlreadyExtracted(ticker)) {
      console.log(`  [skip] ${ticker} — all tables extracted within ${EXTRACTOR_CACHE_DAYS} days`)
      return { ticker, success: true, chunks: 0, skipped: true }
    }

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
  const startTime = Date.now()

  console.log(`[pipeline] Progress file: ${PROGRESS_FILE}`)

  // Rolling worker pool — each worker pulls the next ticker from the shared
  // queue the moment it finishes its current one. A slow Claude call only
  // blocks the single worker waiting on it; the other workers keep draining
  // the queue. This holds throughput at ~`concurrency` tickers in flight even
  // when one stalls, unlike a Promise.all batch where the slowest ticker gates
  // the whole batch.
  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const ticker = queue.shift()
      if (!ticker) break
      const result = await processTicker(ticker, opts)
      results.push(result)

      // Progress reporting every 10 completed (and on the final ticker).
      if (results.length % 10 === 0 || queue.length === 0) {
        const elapsed   = Date.now() - startTime
        const perTicker = elapsed / results.length
        const remaining = queue.length
        const etaMins   = Math.round((remaining * perTicker) / 60000)
        const pct       = ((results.length / tickers.length) * 100).toFixed(1)
        const last      = result.ticker

        const progress = {
          total:       tickers.length,
          completed:   results.length,
          remaining:   queue.length,
          succeeded:   results.filter(r => r.success).length,
          failed:      results.filter(r => !r.success).length,
          skipped:     results.filter(r => r.skipped).length,
          pct:         `${pct}%`,
          eta_minutes: etaMins,
          elapsed_min: Math.round(elapsed / 60000),
          started:     new Date(startTime).toISOString(),
          last_ticker: last,
          updated:     new Date().toISOString(),
        }

        try {
          writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2))
        } catch {}

        console.log(
          `\n  ── ${results.length}/${tickers.length} (${pct}%) ` +
          `· ETA: ${etaMins}min · Last: ${last} ` +
          `· ✓${progress.succeeded} ✗${progress.failed} ↷${progress.skipped} ──\n`
        )
      }
    }
  }

  // Launch N workers — they all pull from the same queue.
  await Promise.all(
    Array.from({ length: concurrency }, () => worker())
  )

  return results
}
