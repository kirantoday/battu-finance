// LIQ ingestion CLI.
// Usage:
//   pnpm ingest:liq --ticker=BIIB
//   pnpm ingest:liq --tier=demo

// IMPORTANT: load env BEFORE any module that touches process.env at import time
// (db client, Anthropic, postgres connection). Side-effect import.
import './loadEnv'

import { processBatch }   from './pipeline'
import type { ExtractorName, ProcessOptions } from './pipeline'
import { getTierTickers } from './ticker-universe'

function parseArg(flag: string): string | undefined {
  const arg = process.argv.find(a => a.startsWith(`--${flag}=`))
  return arg?.split('=')[1]
}

const VALID_EXTRACTORS: ExtractorName[] = ['financials', 'capital', 'governance']

async function main() {
  const ticker       = parseArg('ticker')
  const tier         = parseArg('tier') ?? 'demo'
  const extractOnly  = parseArg('extract-only')

  if (extractOnly && !VALID_EXTRACTORS.includes(extractOnly as ExtractorName)) {
    console.error(`Invalid --extract-only=${extractOnly}. Must be one of: ${VALID_EXTRACTORS.join(', ')}`)
    process.exit(1)
  }
  const opts: ProcessOptions = extractOnly
    ? { extractOnly: extractOnly as ExtractorName }
    : {}

  let tickers: string[] = []

  if (ticker) {
    tickers = [ticker.toUpperCase()]
    console.log(`\nIngesting single ticker: ${tickers[0]}${extractOnly ? ` (extract-only: ${extractOnly})` : ''}`)
  } else {
    const universe = await getTierTickers(tier)
    tickers = universe.map(t => t.ticker)
    console.log(`\nIngesting tier: ${tier} (${tickers.length} tickers)${extractOnly ? ` — extract-only: ${extractOnly}` : ''}`)
  }

  const start   = Date.now()
  const results = await processBatch(tickers, 3, opts)
  const elapsed = ((Date.now() - start) / 1000).toFixed(1)

  const succeeded = results.filter(r => r.success).length
  const failed    = results.filter(r => !r.success).length
  const chunks    = results.reduce((sum, r) => sum + r.chunks, 0)

  console.log(`\n${'═'.repeat(50)}`)
  console.log(`  INGESTION COMPLETE`)
  console.log(`  Time:    ${elapsed}s`)
  console.log(`  Success: ${succeeded}/${tickers.length}`)
  console.log(`  Failed:  ${failed}`)
  console.log(`  Chunks:  ${chunks} total`)
  if (failed > 0) {
    console.log(`\n  Failed tickers:`)
    for (const r of results.filter(r => !r.success)) {
      console.log(`    ✗ ${r.ticker}: ${r.error}`)
    }
  }
  console.log(`${'═'.repeat(50)}\n`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(err => { console.error(err); process.exit(1) })
