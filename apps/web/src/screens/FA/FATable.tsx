import type { FAData, FAStatement } from '@battu/shared'

interface Props { data: FAData }

function fmtB(v: number | null, decimals = 1): string {
  if (v == null || !Number.isFinite(v)) return '—'
  const b = v / 1e9
  if (Math.abs(b) >= 1000) {
    const t = b / 1000
    return `${v < 0 ? '-' : ''}$${Math.abs(t).toFixed(decimals)}T`
  }
  return `${v < 0 ? '-' : ''}$${Math.abs(b).toFixed(decimals)}B`
}

function fmtPct(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return `${(v * 100).toFixed(1)}%`
}

function fmtEPS(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return `$${v.toFixed(2)}`
}

function yoyText(current: number | null, prior: number | null): string {
  if (current == null || prior == null || prior === 0) return ''
  const g = ((current - prior) / Math.abs(prior)) * 100
  const sign = g >= 0 ? '▲' : '▼'
  return `${sign}${Math.abs(g).toFixed(1)}%`
}

function yoyColor(current: number | null, prior: number | null): string {
  if (current == null || prior == null || prior === 0) return 'var(--battu-muted)'
  return current >= prior ? 'var(--battu-positive)' : 'var(--battu-negative)'
}

interface RowDef {
  label:      string
  key:        keyof FAStatement
  format:     (v: number | null) => string
  isSection?: boolean
  isMargin?:  boolean
  indent?:    boolean
}

const ROWS: RowDef[] = [
  { label: 'INCOME STATEMENT',     key: 'revenue',            format: fmtB,   isSection: true },
  { label: 'Revenue',              key: 'revenue',            format: fmtB },
  { label: 'Gross Profit',         key: 'grossProfit',        format: fmtB },
  { label: 'Gross Margin',         key: 'grossMargin',        format: fmtPct, isMargin: true, indent: true },
  { label: 'Operating Income',     key: 'operatingIncome',    format: fmtB },
  { label: 'Operating Margin',     key: 'operatingMargin',    format: fmtPct, isMargin: true, indent: true },
  { label: 'Net Income',           key: 'netIncome',          format: fmtB },
  { label: 'Net Margin',           key: 'netMargin',          format: fmtPct, isMargin: true, indent: true },
  { label: 'EPS (Diluted)',        key: 'epsDiluted',         format: fmtEPS },

  { label: 'BALANCE SHEET',        key: 'totalAssets',        format: fmtB,   isSection: true },
  { label: 'Total Assets',         key: 'totalAssets',        format: fmtB },
  { label: 'Total Debt',           key: 'totalDebt',          format: fmtB },
  { label: 'Cash & Investments',   key: 'cashAndEquiv',       format: fmtB },
  { label: 'Shareholders Equity',  key: 'shareholdersEquity', format: fmtB },

  { label: 'CASH FLOW',            key: 'operatingCF',        format: fmtB,   isSection: true },
  { label: 'Operating Cash Flow',  key: 'operatingCF',        format: fmtB },
  { label: 'Capital Expenditures', key: 'capex',              format: fmtB },
  { label: 'Free Cash Flow',       key: 'freeCashFlow',       format: fmtB },
  { label: 'Dividends Paid',       key: 'dividendsPaid',      format: fmtB },
]

export function FATable({ data }: Props) {
  const stmts = data.statements
  const periodCols = stmts.length

  return (
    <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1 }}>
      <table style={{
        width:          '100%',
        borderCollapse: 'collapse',
        fontFamily:     'JetBrains Mono, monospace',
        fontSize:       '11px',
        minWidth:       '600px',
      }}>
        <thead>
          <tr style={{ background: 'var(--battu-surface)' }}>
            <th style={{
              textAlign:    'left',
              padding:      '8px 16px',
              color:        'var(--battu-muted)',
              fontSize:     '9px',
              letterSpacing: '2px',
              fontWeight:   'normal',
              borderBottom: '1px solid var(--battu-border)',
              width:        '220px',
              position:     'sticky',
              left:         0,
              background:   'var(--battu-surface)',
              zIndex:       2,
            }}>
              METRIC
            </th>
            {stmts.map((s, i) => (
              <th key={i} style={{
                textAlign:    'right',
                padding:      '8px 16px',
                color:        i === 0 ? 'var(--battu-accent)' : 'var(--battu-muted)',
                fontSize:     '10px',
                letterSpacing: '1px',
                fontWeight:   i === 0 ? 'bold' : 'normal',
                borderBottom: '1px solid var(--battu-border)',
                minWidth:     '110px',
              }}>
                {s.period}
              </th>
            ))}
            <th style={{
              textAlign:    'right',
              padding:      '8px 16px',
              color:        'var(--battu-muted)',
              fontSize:     '9px',
              letterSpacing: '1px',
              fontWeight:   'normal',
              borderBottom: '1px solid var(--battu-border)',
              minWidth:     '80px',
            }}>
              YoY
            </th>
          </tr>
        </thead>

        <tbody>
          {ROWS.map((row, ri) => {
            if (row.isSection) {
              return (
                <tr key={ri}>
                  <td
                    colSpan={periodCols + 2}
                    style={{
                      padding:       '10px 16px 4px 12px',
                      color:         'var(--battu-accent)',
                      fontSize:      '9px',
                      letterSpacing: '3px',
                      fontWeight:    600,
                      background:    'var(--battu-header-bg)',
                      borderTop:     ri > 0 ? '1px solid var(--battu-border)' : 'none',
                      borderLeft:    '3px solid var(--battu-accent)',
                      position:      'sticky',
                      left:          0,
                    }}
                  >
                    {row.label}
                  </td>
                </tr>
              )
            }

            const isEvenRow = ri % 2 === 0
            const bg = isEvenRow ? 'var(--battu-bg)' : 'var(--battu-surface)'

            return (
              <tr key={ri} style={{ background: bg }}>
                <td style={{
                  padding:      '5px 16px',
                  paddingLeft:  row.indent ? '28px' : '16px',
                  color:        row.isMargin ? 'var(--battu-muted)' : 'var(--battu-text)',
                  fontStyle:    row.isMargin ? 'italic' : 'normal',
                  fontSize:     '10px',
                  position:     'sticky',
                  left:         0,
                  background:   bg,
                  borderRight:  '1px solid var(--battu-border)',
                  zIndex:       1,
                }}>
                  {row.label}
                </td>

                {stmts.map((s, si) => {
                  const val = s[row.key] as number | null
                  const isNeg = val != null && val < 0
                  return (
                    <td key={si} style={{
                      textAlign:  'right',
                      padding:    '5px 16px',
                      color:      row.isMargin
                        ? 'var(--battu-muted)'
                        : isNeg
                          ? 'var(--battu-negative)'
                          : 'var(--battu-value-color)',
                      fontSize:   '10px',
                      fontWeight: si === 0 ? 'bold' : 'normal',
                      borderLeft: si === 0 ? '1px solid var(--battu-border)' : undefined,
                    }}>
                      {row.format(val)}
                    </td>
                  )
                })}

                <td style={{
                  textAlign: 'right',
                  padding:   '5px 16px',
                  fontSize:  '10px',
                }}>
                  {!row.isMargin && stmts.length >= 2 ? (
                    <span style={{
                      color: yoyColor(
                        stmts[0][row.key] as number | null,
                        stmts[1][row.key] as number | null,
                      ),
                    }}>
                      {yoyText(
                        stmts[0][row.key] as number | null,
                        stmts[1][row.key] as number | null,
                      )}
                    </span>
                  ) : null}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
