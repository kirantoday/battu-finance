import type { LEGALData } from '@battu/shared'

interface Props { data: LEGALData }

export function LEGALAudit({ data }: Props) {
  const opinionColor = data.auditOpinionClean
    ? 'var(--battu-positive)'
    : 'var(--battu-negative)'
  const opinionLabel = data.auditOpinionClean
    ? '● CLEAN (Unqualified)'
    : '● QUALIFIED — Review Required'

  const gcColor = data.hasGoingConcern
    ? 'var(--battu-negative)'
    : 'var(--battu-positive)'
  const gcLabel = data.hasGoingConcern
    ? '● GOING CONCERN DISCLOSED'
    : '● NONE'

  const rows = [
    { label: 'Auditor',       value: data.auditorName,  color: 'var(--battu-value-color)', bold: false },
    { label: 'Auditor Since', value: data.auditorSince, color: 'var(--battu-muted)',       bold: false },
    { label: 'Audit Opinion', value: opinionLabel,      color: opinionColor,               bold: true  },
    { label: 'Going Concern', value: gcLabel,           color: gcColor,                    bold: true  },
  ]

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
        AUDIT &amp; GOVERNANCE
      </div>
      <div style={{ maxWidth: '600px' }}>
        {rows.map(({ label, value, color, bold }) => (
          <div key={label} style={{
            display:             'grid',
            gridTemplateColumns: '200px 1fr',
            gap:                 '16px',
            padding:             '5px 0',
            borderBottom:        '1px solid var(--battu-divider)',
          }}>
            <span style={{ color: 'var(--battu-text)', fontSize: '10px' }}>{label}</span>
            <span style={{
              color,
              fontSize:   '10px',
              fontWeight: bold ? 'bold' : 'normal',
              fontFamily: 'JetBrains Mono, monospace',
            }}>
              {value || '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
