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

type Row = { label: string; value: string; color: string; bold?: boolean }

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

const renderRow = ({ label, value, color, bold }: Row) => (
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
)

export function LIQShelfSection({ data }: Props) {
  // No shelf found at all
  if (!data.hasShelf) {
    const likelyEligible = data.cashAndEquivB != null && data.cashAndEquivB > 0.075
    return (
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--battu-border)' }}>
        {sectionHeader('SHELF REGISTRATION')}
        <div style={{ color: 'var(--battu-muted)', fontSize: '10px', padding: '4px 0', lineHeight: '1.7' }}>
          No active shelf registration found on EDGAR.<br />
          {likelyEligible
            ? <span style={{ color: 'var(--battu-positive)' }}>● Likely S-3 eligible (estimated float &gt; $75M threshold)</span>
            : <span style={{ color: 'var(--battu-warning)' }}>● S-3 eligibility unclear — verify public float size</span>}
        </div>
      </div>
    )
  }

  // S-3ASR — Well-Known Seasoned Issuer automatic shelf (no dollar cap by design)
  const isWKSI = data.hasShelf && data.shelfTotalB === null

  const sectionLabel =
       data.isATMProgram ? 'SHELF REGISTRATION · ATM PROGRAM'
    :  isWKSI            ? 'SHELF REGISTRATION · WKSI AUTOMATIC (S-3ASR)'
    :  'SHELF REGISTRATION'

  if (isWKSI) {
    const filedYear = data.shelfFilingDate ? new Date(data.shelfFilingDate).getFullYear() : null
    const expiresLabel = data.shelfExpiryDate
      ? fmtDate(data.shelfExpiryDate)
      : (filedYear != null ? `~${filedYear + 3} (3yr from filing)` : '—')

    const rows: Row[] = [
      { label: 'S-3ASR Filed',     value: fmtDate(data.shelfFilingDate), color: 'var(--battu-value-color)' },
      { label: 'Shelf Capacity',   value: 'UNLIMITED (WKSI)',            color: 'var(--battu-positive)', bold: true },
      { label: '424B Drawdowns',   value: 'N/A · WKSI',                  color: 'var(--battu-muted)' },
      { label: 'REMAINING SHELF',  value: 'UNLIMITED',                   color: 'var(--battu-positive)', bold: true },
      { label: 'Expires',          value: expiresLabel,                  color: 'var(--battu-value-color)' },
    ]

    return (
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--battu-border)' }}>
        {sectionHeader(sectionLabel)}
        <div style={{ maxWidth: '600px' }}>
          {rows.map(renderRow)}
          <div style={{
            marginTop:  '8px',
            padding:    '6px 10px',
            background: 'var(--battu-surface)',
            border:     '1px solid var(--battu-border)',
            color:      'var(--battu-muted)',
            fontSize:   '9px',
            lineHeight: '1.6',
          }}>
            Well-Known Seasoned Issuer — automatic shelf registration with no dollar
            cap. Company may issue any amount of securities at any time without
            prior SEC review or dollar limit.
          </div>
        </div>
      </div>
    )
  }

  // Standard S-3 with explicit dollar cap
  const rows: Row[] = [
    { label: 'S-3 Filed',          value: fmtDate(data.shelfFilingDate), color: 'var(--battu-value-color)' },
    { label: 'Total Shelf Amount', value: fmtB(data.shelfTotalB),        color: 'var(--battu-value-color)' },
    { label: '424B Drawdowns YTD', value: fmtB(data.shelfDrawdownsB),    color: 'var(--battu-negative)' },
    {
      label: 'REMAINING SHELF',
      value: fmtB(data.shelfRemainingB),
      color: (data.shelfRemainingB ?? 0) > 0 ? 'var(--battu-positive)' : 'var(--battu-negative)',
      bold:  true,
    },
    { label: 'Expires',            value: fmtDate(data.shelfExpiryDate), color: 'var(--battu-value-color)' },
  ]

  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--battu-border)' }}>
      {sectionHeader(sectionLabel)}
      <div style={{ maxWidth: '600px' }}>
        {rows.map(renderRow)}
      </div>
    </div>
  )
}
