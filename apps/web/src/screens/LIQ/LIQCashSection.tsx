import type { LIQData } from '@battu/shared'

interface Props { data: LIQData }

function fmtB(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return `${v < 0 ? '-' : ''}$${Math.abs(v).toFixed(3)}B`
}

function fmtQtrs(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—'
  const yrs = (v / 4).toFixed(1)
  return `${v.toFixed(1)} qtrs  (${yrs} years)`
}

export function LIQCashSection({ data }: Props) {
  const runwayColor =
       data.cashRunwayQtrs == null ? 'var(--battu-muted)'
    :  data.cashRunwayQtrs < 4     ? 'var(--battu-negative)'
    :  data.cashRunwayQtrs < 8     ? 'var(--battu-warning)'
    :  'var(--battu-positive)'

  const rows: Array<{ label: string; value: string; color: string; bold?: boolean }> = [
    { label: 'Cash & Equivalents',     value: fmtB(data.cashAndEquivB),     color: 'var(--battu-value-color)' },
    { label: 'Short-term Investments', value: fmtB(data.shortTermInvestB),  color: 'var(--battu-value-color)' },
    { label: 'Quarterly Cash Burn',    value: fmtB(data.quarterlyBurnB),    color: 'var(--battu-negative)' },
    { label: 'CASH RUNWAY',            value: fmtQtrs(data.cashRunwayQtrs), color: runwayColor, bold: true },
  ]

  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--battu-border)' }}>
      <div style={{
        color:         'var(--battu-accent)',
        fontSize:      '9px',
        letterSpacing: '2px',
        marginBottom:  '8px',
        borderLeft:    '3px solid var(--battu-accent)',
        paddingLeft:   '8px',
        fontWeight:    'bold',
      }}>
        CASH POSITION
      </div>
      <div style={{ maxWidth: '600px' }}>
        {rows.map(({ label, value, color, bold }) => (
          <div key={label} style={{
            display:             'grid',
            gridTemplateColumns: '240px 1fr',
            gap:                 '16px',
            padding:             '4px 0',
            borderBottom:        '1px solid var(--battu-divider)',
          }}>
            <span style={{ color: 'var(--battu-text)', fontSize: '10px', fontWeight: bold ? 'bold' : 'normal' }}>
              {label}
            </span>
            <span style={{ color, fontSize: '11px', fontWeight: bold ? 'bold' : 'normal', fontFamily: 'JetBrains Mono, monospace' }}>
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
