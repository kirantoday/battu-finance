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
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function LIQShelfSection({ data }: Props) {
  const sectionHeader = (label: string) => (
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
    </div>
  )

  if (!data.hasShelf) {
    const likelyEligible = data.cashAndEquivB != null && data.cashAndEquivB > 0.075
    return (
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--battu-border)' }}>
        {sectionHeader('SHELF REGISTRATION')}
        <div style={{ color: 'var(--battu-muted)', fontSize: '10px', padding: '4px 0', lineHeight: '1.5' }}>
          No active shelf registration found on EDGAR.<br />
          {likelyEligible
            ? <span style={{ color: 'var(--battu-positive)' }}>● Likely S-3 eligible (estimated float &gt; $75M threshold)</span>
            : <span style={{ color: 'var(--battu-warning)' }}>● S-3 eligibility unclear — check float size</span>}
        </div>
      </div>
    )
  }

  const rows: Array<{ label: string; value: string; bold?: boolean; color?: string }> = [
    { label: 'S-3 Filed',           value: fmtDate(data.shelfFilingDate) },
    { label: 'Total Shelf Amount',  value: fmtB(data.shelfTotalB) },
    { label: '424B Drawdowns YTD',  value: fmtB(data.shelfDrawdownsB) },
    {
      label: 'REMAINING SHELF',
      value: fmtB(data.shelfRemainingB),
      bold:  true,
      color: (data.shelfRemainingB ?? 0) > 0 ? 'var(--battu-positive)' : 'var(--battu-negative)',
    },
    { label: 'Expires',             value: fmtDate(data.shelfExpiryDate) },
  ]

  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--battu-border)' }}>
      {sectionHeader(`SHELF REGISTRATION${data.isATMProgram ? ' · ATM PROGRAM' : ''}`)}
      {rows.map(({ label, value, bold, color }) => (
        <div key={label} style={{
          display:        'flex',
          justifyContent: 'space-between',
          padding:        '4px 0',
          borderBottom:   '1px solid var(--battu-divider)',
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
  )
}
