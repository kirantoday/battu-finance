import type { LEGALData } from '@battu/shared'

interface Props { data: LEGALData }

function Row({ label, value, highlight }: {
  label:      string
  value:      string | null
  highlight?: boolean
}) {
  return (
    <div style={{
      display:             'grid',
      gridTemplateColumns: '200px 1fr',
      gap:                 '16px',
      padding:             '5px 0',
      borderBottom:        '1px solid var(--battu-divider)',
    }}>
      <span style={{ color: 'var(--battu-text)', fontSize: '10px' }}>{label}</span>
      <span style={{
        color:      highlight ? 'var(--battu-accent)' : 'var(--battu-value-color)',
        fontSize:   '10px',
        fontWeight: highlight ? 'bold' : 'normal',
        fontFamily: 'JetBrains Mono, monospace',
      }}>
        {value || '—'}
      </span>
    </div>
  )
}

export function LEGALCounsel({ data }: Props) {
  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--battu-border)' }}>
      <div style={{
        color:         'var(--battu-accent)',
        fontSize:      '9px',
        letterSpacing: '2px',
        marginBottom:  '10px',
        borderLeft:    '3px solid var(--battu-accent)',
        paddingLeft:   '8px',
      }}>
        LEGAL COUNSEL
      </div>
      <div style={{ maxWidth: '600px' }}>
        <Row label="Primary Counsel" value={data.counselPrimary} highlight />
        <Row label="Special Counsel" value={data.counselSpecial} />
      </div>
    </div>
  )
}
