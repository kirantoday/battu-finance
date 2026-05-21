import path from 'node:path'
import fs from 'node:fs/promises'
import dotenv from 'dotenv'
import chalk from 'chalk'

// Load env from the monorepo root, not from packages/validation (where pnpm --filter sets cwd).
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') })
dotenv.config({ path: path.resolve(__dirname, '../../../.env'), override: false })

import { validateAll, type TickerRunSummary, type ValidationResult, type ValidationStatus } from './validator'
import { ping } from './battuApiClient'
import { renderHtmlReport } from './htmlReport'

const FLAGS = {
  report: process.argv.includes('--report'),
}

const PROJECT_ROOT = path.resolve(__dirname, '..')

function timestamp(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
         `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function fileTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)
}

function checkRequiredEnv() {
  // BATTU_API_URL is optional (defaults to localhost). Polygon/FMP keys aren't
  // required by the validator itself — they're used by the API — but we warn
  // if they're absent so the user isn't surprised by all-error results.
  const optional = ['POLYGON_API_KEY', 'FMP_API_KEY', 'BENZINGA_API_KEY']
  const missing = optional.filter((k) => !process.env[k])
  if (missing.length > 0) {
    console.log(chalk.yellow(`⚠ Missing env vars (the API needs these to return real data): ${missing.join(', ')}`))
  }
}

const STATUS_GLYPH: Record<ValidationStatus, string> = {
  PASS:             '✓',
  FAIL:             '✗',
  WARNING:          '⚠',
  SKIP:             '·',
  ERROR:            '!',
  MISSING_ENDPOINT: '∅',
}

function statusColored(status: ValidationStatus, text: string): string {
  switch (status) {
    case 'PASS':              return chalk.green(text)
    case 'FAIL':              return chalk.red(text)
    case 'WARNING':           return chalk.yellow(text)
    case 'SKIP':              return chalk.gray(text)
    case 'ERROR':             return chalk.red.bold(text)
    case 'MISSING_ENDPOINT':  return chalk.gray.dim(text)
  }
}

function bar(pass: number, total: number, width = 20): string {
  if (total === 0) return ' '.repeat(width)
  const filled = Math.round((pass / total) * width)
  return chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(width - filled))
}

function printTickerLine(s: TickerRunSummary) {
  const c = countByStatus(s.results)
  const counted = s.results.length - c.SKIP - c.MISSING_ENDPOINT
  const pct = counted > 0 ? ((c.PASS / counted) * 100).toFixed(0) : ' —'
  const line = `  ${chalk.cyan(s.ticker.padEnd(6))} ${bar(c.PASS, counted)}  ` +
               `${chalk.green(String(c.PASS).padStart(2))}/${String(counted).padEnd(2)} PASS  ` +
               `${chalk.red(String(c.FAIL).padStart(2))} FAIL  ` +
               `${chalk.yellow(String(c.WARNING).padStart(2))} WARN  ` +
               `${chalk.gray(String(c.SKIP).padStart(2))} SKIP  ` +
               `${chalk.gray.dim(String(c.MISSING_ENDPOINT).padStart(2))} MISS  ` +
               `${chalk.dim(pct + '%')}`
  console.log(line)
}

function countByStatus(rs: ValidationResult[]): Record<ValidationStatus, number> {
  const c: Record<ValidationStatus, number> = {
    PASS: 0, FAIL: 0, WARNING: 0, SKIP: 0, ERROR: 0, MISSING_ENDPOINT: 0,
  }
  for (const r of rs) c[r.status]++
  return c
}

function printFailures(all: ValidationResult[]) {
  const fails = all.filter(r => r.status === 'FAIL')
  if (fails.length === 0) return
  console.log()
  console.log(chalk.red.bold('  ✗ FAILURES:'))
  for (const r of fails) {
    const gt = r.groundTruth?.toFixed(4) ?? '—'
    const bv = r.battuValue?.toFixed(4) ?? '—'
    const dev = r.deviation !== null ? (r.deviation * 100).toFixed(1) + '%' : '—'
    const tol = (r.tolerance * 100).toFixed(1) + '%'
    console.log(`  ${chalk.cyan(r.ticker.padEnd(6))} ${chalk.white(r.field.padEnd(24))} ` +
                `BATTU: ${chalk.red(bv.padStart(10))}  TRUTH: ${chalk.green(gt.padStart(10))}  ` +
                `dev ${chalk.red(dev.padStart(7))}  tol ${chalk.gray(tol)}`)
    if (r.notes) console.log(`         ${chalk.gray.dim('↳ ' + r.notes)}`)
  }
}

function printWarnings(all: ValidationResult[]) {
  const warns = all.filter(r => r.status === 'WARNING')
  if (warns.length === 0) return
  console.log()
  console.log(chalk.yellow('  ⚠ WARNINGS (price drift — expected):'))
  for (const r of warns) {
    const gt = r.groundTruth?.toFixed(2) ?? '—'
    const bv = r.battuValue?.toFixed(2) ?? '—'
    const dev = r.deviation !== null ? (r.deviation * 100).toFixed(1) + '%' : '—'
    console.log(`  ${chalk.cyan(r.ticker.padEnd(6))} ${chalk.white(r.field.padEnd(24))} ` +
                `BATTU: ${bv.padStart(8)}  TRUTH: ${gt.padStart(8)}  dev ${chalk.yellow(dev)}`)
  }
}

function printErrors(all: ValidationResult[]) {
  const errs = all.filter(r => r.status === 'ERROR')
  if (errs.length === 0) return
  console.log()
  console.log(chalk.red('  ! ERRORS:'))
  for (const r of errs) {
    console.log(`  ${chalk.cyan(r.ticker.padEnd(6))} ${chalk.white(r.field.padEnd(24))} ${chalk.red(r.notes ?? '(no detail)')}`)
  }
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true })
}

async function main() {
  console.log()
  console.log(chalk.cyan('════════════════════════════════════════════════════════'))
  console.log(chalk.cyan('  BATTU Data Validation Report'))
  console.log(chalk.cyan(`  Run at: ${timestamp()}`))
  console.log(chalk.cyan('════════════════════════════════════════════════════════'))
  console.log()

  checkRequiredEnv()

  // Health probe
  const health = await ping()
  if (health.up) {
    console.log(chalk.green(`✓ API up — ${health.message}`))
  } else {
    console.log(chalk.red(`✗ API down — ${health.message}`))
    console.log(chalk.gray('  Continuing anyway — every field will report MISSING_ENDPOINT or ERROR.'))
  }
  console.log()

  // Run validations with live progress
  const summaries = await validateAll(undefined, (ticker, done, total) => {
    process.stdout.write(`\r  validating ${chalk.cyan(ticker)}... ${chalk.gray(`(${done}/${total})`)} ${STATUS_GLYPH.PASS}`)
  })
  process.stdout.write('\r' + ' '.repeat(60) + '\r') // clear progress line
  console.log()

  // Per-ticker summary
  for (const s of summaries) printTickerLine(s)

  // Aggregate
  const allResults = summaries.flatMap(s => s.results)
  const counts = countByStatus(allResults)
  const counted = allResults.length - counts.SKIP - counts.MISSING_ENDPOINT
  const passRate = counted > 0 ? ((counts.PASS / counted) * 100).toFixed(1) : '—'

  console.log()
  console.log(chalk.cyan('  ─────────────────────────────────────────────────────'))
  console.log(`  ${chalk.bold('TOTAL')}   ${chalk.green(counts.PASS)}/${counted} fields PASS  (${passRate}%)`)
  console.log(`          ${chalk.red(counts.FAIL)} FAIL  |  ${chalk.yellow(counts.WARNING)} WARN  |  ` +
              `${chalk.gray(counts.SKIP)} SKIP  |  ${chalk.red.bold(counts.ERROR)} ERROR  |  ` +
              `${chalk.gray.dim(counts.MISSING_ENDPOINT)} MISSING`)

  printFailures(allResults)
  printWarnings(allResults)
  printErrors(allResults)

  console.log()
  console.log(chalk.cyan('════════════════════════════════════════════════════════'))

  // Reports
  const reportsDir = path.join(PROJECT_ROOT, 'reports')
  if (FLAGS.report) {
    await ensureDir(reportsDir)

    const jsonPath = path.join(reportsDir, `validation-${fileTimestamp()}.json`)
    await fs.writeFile(jsonPath, JSON.stringify({
      generatedAt: new Date().toISOString(),
      apiUrl:      process.env.BATTU_API_URL || 'http://localhost:3000',
      apiHealthy:  health.up,
      summaries,
    }, null, 2), 'utf8')
    console.log(chalk.gray(`  JSON: ${path.relative(process.cwd(), jsonPath)}`))

    const html = renderHtmlReport({
      generatedAt: timestamp(),
      apiUrl:      process.env.BATTU_API_URL || 'http://localhost:3000',
      apiHealthy:  health.up,
      summaries,
    })
    const htmlPath = path.join(reportsDir, 'latest.html')
    await fs.writeFile(htmlPath, html, 'utf8')
    console.log(chalk.gray(`  HTML: ${path.relative(process.cwd(), htmlPath)}`))
    console.log()
  }

  // Exit code — non-zero only on hard FAIL or ERROR, so missing endpoints don't break CI early on
  process.exitCode = counts.FAIL > 0 || counts.ERROR > 0 ? 1 : 0
}

main().catch((err) => {
  console.error(chalk.red('Runner crashed:'), err)
  process.exit(2)
})
