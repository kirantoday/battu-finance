import type { LIQData } from '@battu/shared'

interface Props { data: LIQData }

function fmtB(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return `${v < 0 ? '-' : ''}$${Math.abs(v).toFixed(3)}B`
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  const parsed = new Date(d)
  if (Number.isNaN(parsed.valueOf())) return '—'
  return parsed.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

export function LIQCreditSection({ data }: Props) {
  const sectionHeader = (label: string, subtitle?: string) => (
    <div style={{
      color:         'var(--battu-accent)',
      fontSize:      '9px',
      letterSpacing: '2px',
      marginBottom:  '8px',
      borderLeft:    '3px solid var(--battu-accent)',
      paddingLeft:   '8px',
      fontWeight:    'bold',
    }}>
      {label}
      {subtitle && (
        <span style={{ color: 'var(--battu-muted)', marginLeft: '8px', textTransform: 'none', fontWeight: 'normal' }}>
          · {subtitle}
        </span>
      )}
    </div>
  )

  if (!data.hasCreditFacility) {
    return (
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--battu-border)' }}>
        {sectionHeader('CREDIT FACILITY (ROFL)')}
        <div style={{ color: 'var(--battu-muted)', fontSize: '10px', padding: '4px 0' }}>
          No revolving credit facility found in latest 10-K.
        </div>
      </div>
    )
  }

  const rows: Array<{ label: string; value: string; bold?: boolean; color?: string }> = [
    { label: 'Lender',              value: data.creditLender || '—' },
    { label: 'Total Facility',      value: fmtB(data.creditTotalB) },
    { label: 'Drawn',               value: fmtB(data.creditDrawnB) },
    {
      label: 'UNDRAWN (AVAILABLE)',
      value: fmtB(data.creditUndrawnB),
      bold:  true,
      color: 'var(--battu-positive)',
    },
    { label: 'Expires',             value: fmtDate(data.creditExpiryDate) },
    { label: 'Interest Rate',       value: data.creditInterestRate || '—' },
  ]

  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--battu-border)' }}>
      {sectionHeader('CREDIT FACILITY (ROFL)', data.creditFacilityType || undefined)}
      <div style={{ maxWidth: '600px' }}>
        {rows.map(({ label, value, bold, color }) => (
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
            <span style={{
              color:      color || 'var(--battu-value-color)',
              fontSize:   '11px',
              fontWeight: bold ? 'bold' : 'normal',
              fontFamily: 'JetBrains Mono, monospace',
            }}>
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
