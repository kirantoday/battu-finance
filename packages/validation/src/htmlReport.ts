import type { TickerRunSummary, ValidationResult, ValidationStatus } from './validator'

interface ReportInput {
  generatedAt: string
  apiUrl:      string
  apiHealthy:  boolean
  summaries:   TickerRunSummary[]
}

const COLOR = {
  bg:        '#0A0E1A',
  surface:   '#111827',
  border:    '#1F2937',
  text:      '#E8E8E8',
  muted:     '#6B7280',
  accent:    '#2E86DE',
  pass:      '#10B981',
  fail:      '#EF4444',
  warn:      '#F59E0B',
  skip:      '#6B7280',
  missing:   '#9CA3AF',
}

const STATUS_COLOR: Record<ValidationStatus, string> = {
  PASS:             COLOR.pass,
  FAIL:             COLOR.fail,
  WARNING:          COLOR.warn,
  SKIP:             COLOR.skip,
  ERROR:            COLOR.fail,
  MISSING_ENDPOINT: COLOR.missing,
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' :
    c === '<' ? '&lt;'  :
    c === '>' ? '&gt;'  :
    c === '"' ? '&quot;' :
                '&#39;'
  )
}

function fmtVal(v: number | null): string {
  if (v === null) return '—'
  if (Math.abs(v) >= 1e3 || Math.abs(v) < 0.01 && v !== 0) {
    return v.toLocaleString('en-US', { maximumFractionDigits: 4 })
  }
  return v.toLocaleString('en-US', { maximumFractionDigits: 4 })
}

function fmtPct(v: number | null): string {
  if (v === null) return '—'
  return (v * 100).toFixed(2) + '%'
}

function statusBadge(status: ValidationStatus): string {
  return `<span style="
    display:inline-block;padding:1px 8px;border-radius:3px;
    background:${STATUS_COLOR[status]};color:${COLOR.bg};
    font-size:10px;font-weight:600;letter-spacing:1px;
  ">${status}</span>`
}

function countStatuses(results: ValidationResult[]): Record<ValidationStatus, number> {
  const c: Record<ValidationStatus, number> = {
    PASS: 0, FAIL: 0, WARNING: 0, SKIP: 0, ERROR: 0, MISSING_ENDPOINT: 0,
  }
  for (const r of results) c[r.status]++
  return c
}

function tickerSummaryRow(s: TickerRunSummary): string {
  const c = countStatuses(s.results)
  const counted = s.results.length - c.SKIP - c.MISSING_ENDPOINT
  const passPct = counted > 0 ? ((c.PASS / counted) * 100).toFixed(0) : '—'
  return `
    <tr>
      <td style="padding:6px 12px;font-weight:600;color:${COLOR.accent};font-family:monospace">${s.ticker}</td>
      <td style="padding:6px 12px;color:${COLOR.pass}">${c.PASS}</td>
      <td style="padding:6px 12px;color:${COLOR.fail}">${c.FAIL}</td>
      <td style="padding:6px 12px;color:${COLOR.warn}">${c.WARNING}</td>
      <td style="padding:6px 12px;color:${COLOR.skip}">${c.SKIP}</td>
      <td style="padding:6px 12px;color:${COLOR.fail}">${c.ERROR}</td>
      <td style="padding:6px 12px;color:${COLOR.missing}">${c.MISSING_ENDPOINT}</td>
      <td style="padding:6px 12px;color:${COLOR.text};text-align:right">${passPct}%</td>
    </tr>
  `
}

function detailTable(s: TickerRunSummary): string {
  const rows = s.results.map((r) => `
    <tr>
      <td style="padding:5px 10px;font-family:monospace;color:${COLOR.text}">${escapeHtml(r.field)}</td>
      <td style="padding:5px 10px;font-family:monospace;color:${COLOR.text};text-align:right">${fmtVal(r.groundTruth)}</td>
      <td style="padding:5px 10px;font-family:monospace;color:${COLOR.text};text-align:right">${fmtVal(r.battuValue)}</td>
      <td style="padding:5px 10px;font-family:monospace;color:${COLOR.muted};text-align:right">${fmtPct(r.deviation)}</td>
      <td style="padding:5px 10px;font-family:monospace;color:${COLOR.muted};text-align:right">${fmtPct(r.tolerance)}</td>
      <td style="padding:5px 10px;font-family:monospace;color:${COLOR.muted}">${escapeHtml(r.band)}</td>
      <td style="padding:5px 10px;font-family:monospace;color:${COLOR.muted}">${escapeHtml(r.source)}</td>
      <td style="padding:5px 10px">${statusBadge(r.status)}</td>
    </tr>
    ${r.notes ? `<tr><td colspan="8" style="padding:0 10px 8px 10px;color:${COLOR.muted};font-size:11px;font-style:italic">↳ ${escapeHtml(r.notes)}</td></tr>` : ''}
  `).join('')

  return `
    <details open style="margin:16px 0;border:1px solid ${COLOR.border};border-radius:4px;background:${COLOR.surface}">
      <summary style="cursor:pointer;padding:10px 16px;background:${COLOR.bg};color:${COLOR.accent};font-family:monospace;font-weight:600;letter-spacing:2px">
        ${escapeHtml(s.ticker)}
      </summary>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead>
          <tr style="background:${COLOR.bg};color:${COLOR.muted};text-align:left">
            <th style="padding:6px 10px;font-weight:500">Field</th>
            <th style="padding:6px 10px;font-weight:500;text-align:right">Ground Truth</th>
            <th style="padding:6px 10px;font-weight:500;text-align:right">BATTU</th>
            <th style="padding:6px 10px;font-weight:500;text-align:right">Deviation</th>
            <th style="padding:6px 10px;font-weight:500;text-align:right">Tolerance</th>
            <th style="padding:6px 10px;font-weight:500">Band</th>
            <th style="padding:6px 10px;font-weight:500">Source</th>
            <th style="padding:6px 10px;font-weight:500">Status</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </details>
  `
}

export function renderHtmlReport(input: ReportInput): string {
  const allResults = input.summaries.flatMap(s => s.results)
  const totalCounted = allResults.filter(r => r.status !== 'SKIP' && r.status !== 'MISSING_ENDPOINT').length
  const totalPass = allResults.filter(r => r.status === 'PASS').length
  const totalFail = allResults.filter(r => r.status === 'FAIL').length
  const totalWarn = allResults.filter(r => r.status === 'WARNING').length
  const totalSkip = allResults.filter(r => r.status === 'SKIP').length
  const totalErr  = allResults.filter(r => r.status === 'ERROR').length
  const totalMiss = allResults.filter(r => r.status === 'MISSING_ENDPOINT').length
  const passRate  = totalCounted > 0 ? ((totalPass / totalCounted) * 100).toFixed(1) : '0.0'

  const overall: ValidationStatus =
    !input.apiHealthy ? 'ERROR'
    : totalFail > 0   ? 'FAIL'
    : totalCounted === 0 ? 'MISSING_ENDPOINT'
    : 'PASS'

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1.0" />
<title>BATTU — Data Validation Report</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 32px;
    background: ${COLOR.bg}; color: ${COLOR.text};
    font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
  }
  h1, h2 { margin: 0; font-weight: 600; }
  h1 { color: ${COLOR.accent}; letter-spacing: 4px; font-size: 16px; }
  h2 { color: ${COLOR.text}; letter-spacing: 2px; font-size: 13px; margin: 24px 0 12px 0; }
  .card { background: ${COLOR.surface}; border: 1px solid ${COLOR.border}; border-radius: 4px; padding: 20px; }
  .row { display: flex; gap: 16px; flex-wrap: wrap; }
  .kv { display: flex; flex-direction: column; gap: 4px; }
  .kv .k { color: ${COLOR.muted}; font-size: 10px; letter-spacing: 2px; }
  .kv .v { color: ${COLOR.text}; font-size: 14px; }
  table { border-collapse: collapse; }
  th, td { border-bottom: 1px solid ${COLOR.border}; }
</style>
</head>
<body>

<h1>BATTU FINANCE SCREEN — DATA VALIDATION REPORT</h1>
<div style="color:${COLOR.muted};font-size:11px;margin:6px 0 28px 0;letter-spacing:1px">
  Generated ${escapeHtml(input.generatedAt)} · API: ${escapeHtml(input.apiUrl)}
</div>

<div class="card">
  <div class="row" style="justify-content:space-between;align-items:center">
    <div class="row" style="gap:32px">
      <div class="kv"><span class="k">PASS RATE</span><span class="v" style="font-size:32px;color:${overall === 'PASS' ? COLOR.pass : overall === 'FAIL' ? COLOR.fail : COLOR.warn}">${passRate}%</span></div>
      <div class="kv"><span class="k">PASS</span><span class="v" style="color:${COLOR.pass}">${totalPass}</span></div>
      <div class="kv"><span class="k">FAIL</span><span class="v" style="color:${COLOR.fail}">${totalFail}</span></div>
      <div class="kv"><span class="k">WARNING</span><span class="v" style="color:${COLOR.warn}">${totalWarn}</span></div>
      <div class="kv"><span class="k">SKIP</span><span class="v" style="color:${COLOR.skip}">${totalSkip}</span></div>
      <div class="kv"><span class="k">ERROR</span><span class="v" style="color:${COLOR.fail}">${totalErr}</span></div>
      <div class="kv"><span class="k">MISSING ENDPOINT</span><span class="v" style="color:${COLOR.missing}">${totalMiss}</span></div>
    </div>
    <div>${statusBadge(overall)}</div>
  </div>
  ${!input.apiHealthy ? `<div style="margin-top:16px;padding:10px 12px;background:${COLOR.fail};color:${COLOR.bg};border-radius:3px;font-size:12px">API health check failed — all field values may be MISSING_ENDPOINT or ERROR.</div>` : ''}
</div>

<h2>TICKER SUMMARY</h2>
<div class="card">
  <table style="width:100%;font-size:12px">
    <thead>
      <tr style="color:${COLOR.muted};text-align:left;letter-spacing:1px">
        <th style="padding:6px 12px;font-weight:500">Ticker</th>
        <th style="padding:6px 12px;font-weight:500">Pass</th>
        <th style="padding:6px 12px;font-weight:500">Fail</th>
        <th style="padding:6px 12px;font-weight:500">Warn</th>
        <th style="padding:6px 12px;font-weight:500">Skip</th>
        <th style="padding:6px 12px;font-weight:500">Error</th>
        <th style="padding:6px 12px;font-weight:500">Missing</th>
        <th style="padding:6px 12px;font-weight:500;text-align:right">Pass %</th>
      </tr>
    </thead>
    <tbody>
      ${input.summaries.map(tickerSummaryRow).join('')}
    </tbody>
  </table>
</div>

<h2>DETAILED RESULTS</h2>
${input.summaries.map(detailTable).join('')}

<h2>FIELDS REQUIRING MANUAL BLOOMBERG VERIFICATION</h2>
<div class="card" style="font-size:12px;color:${COLOR.muted};line-height:1.7">
  <p style="margin:0 0 12px 0"><strong style="color:${COLOR.accent}">EE — Earnings Estimates</strong><br/>
  FMP shows consensus only. Bloomberg shows individual named analysts and is typically minutes-fresh; FMP can lag 2–6 hours. Verify against a Bloomberg lab terminal for fields where attribution matters.</p>

  <p style="margin:0 0 12px 0"><strong style="color:${COLOR.accent}">ANR — Analyst Ratings</strong><br/>
  FMP shows firm-level grades. Bloomberg shows the underlying named analyst. Tolerance will usually PASS — the gap is attribution, not value.</p>

  <p style="margin:0"><strong style="color:${COLOR.accent}">LIQ — Cash Runway</strong><br/>
  BATTU-unique screen with no Bloomberg equivalent. Verify by hand against the source 10-Q balance sheet + latest S-3 cover + sum of 424B drawdowns. If BATTU matches your manual calculation, it is correct by definition.</p>
</div>

<div style="margin-top:32px;color:${COLOR.muted};font-size:10px;letter-spacing:1px;text-align:center">
  Regapps Inc. · BATTU Finance Screen · Validation Suite
</div>

</body>
</html>`
}
