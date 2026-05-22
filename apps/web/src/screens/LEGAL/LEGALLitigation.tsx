import type { LEGALData } from '@battu/shared'

interface Props { data: LEGALData }

const ROW_STYLE: React.CSSProperties = {
  display:             'grid',
  gridTemplateColumns: '200px 1fr',
  gap:                 '16px',
  padding:             '5px 0',
  borderBottom:        '1px solid var(--battu-divider)',
}

export function LEGALLitigation({ data }: Props) {
  const hasLitigation = (data.litigationCount ?? 0) > 0
  const hasSEC        = data.secInvestigation
  const hasFDA        = Boolean(data.fdaStatus || data.fdaLastAction || data.fdaLastDate)

  const countColor = hasLitigation
    ? 'var(--battu-warning)'
    : 'var(--battu-positive)'

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
        LITIGATION &amp; REGULATORY
      </div>
      <div style={{ maxWidth: '600px' }}>

        {/* Active Proceedings count */}
        <div style={ROW_STYLE}>
          <span style={{ color: 'var(--battu-text)', fontSize: '10px' }}>Active Proceedings</span>
          <span style={{
            color:      countColor,
            fontSize:   '10px',
            fontWeight: 'bold',
            fontFamily: 'JetBrains Mono, monospace',
          }}>
            {data.litigationCount != null ? `${data.litigationCount} disclosed` : '—'}
          </span>
        </div>

        {/* Litigation summary */}
        {data.litigationSummary && (
          <div style={{ padding: '8px 0', borderBottom: '1px solid var(--battu-divider)' }}>
            <div style={{ color: 'var(--battu-muted)', fontSize: '9px', marginBottom: '4px', letterSpacing: '1px' }}>
              SUMMARY
            </div>
            <div style={{
              color:      'var(--battu-muted)',
              fontSize:   '9px',
              lineHeight: '1.6',
              maxWidth:   '500px',
            }}>
              {data.litigationSummary}
            </div>
          </div>
        )}

        {/* SEC Investigation */}
        <div style={ROW_STYLE}>
          <span style={{ color: 'var(--battu-text)', fontSize: '10px' }}>SEC Investigation</span>
          <span style={{
            color:      hasSEC ? 'var(--battu-negative)' : 'var(--battu-positive)',
            fontSize:   '10px',
            fontWeight: 'bold',
            fontFamily: 'JetBrains Mono, monospace',
          }}>
            {hasSEC ? '● DISCLOSED' : '● None disclosed'}
          </span>
        </div>

        {/* Regulatory proceedings (free-text) */}
        {data.regulatoryProceedings && (
          <div style={ROW_STYLE}>
            <span style={{ color: 'var(--battu-text)', fontSize: '10px' }}>Regulatory</span>
            <span style={{
              color:      'var(--battu-muted)',
              fontSize:   '10px',
              fontFamily: 'JetBrains Mono, monospace',
            }}>
              {data.regulatoryProceedings}
            </span>
          </div>
        )}

        {/* FDA status — biotech only */}
        {hasFDA && (
          <>
            <div style={{
              color:         'var(--battu-accent)',
              fontSize:      '9px',
              letterSpacing: '2px',
              margin:        '10px 0 6px',
              borderLeft:    '3px solid var(--battu-accent)',
              paddingLeft:   '8px',
            }}>
              FDA / REGULATORY STATUS
            </div>
            {[
              { label: 'FDA Status',  value: data.fdaStatus     },
              { label: 'Last Action', value: data.fdaLastAction },
              { label: 'Last Date',   value: data.fdaLastDate   },
            ].map(({ label, value }) => value && (
              <div key={label} style={ROW_STYLE}>
                <span style={{ color: 'var(--battu-text)', fontSize: '10px' }}>{label}</span>
                <span style={{
                  color:      'var(--battu-value-color)',
                  fontSize:   '10px',
                  fontFamily: 'JetBrains Mono, monospace',
                }}>
                  {value}
                </span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
