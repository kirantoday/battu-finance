import type { LEGALData } from '@battu/shared'

interface Props { ticker: string; data: LEGALData }

export function LEGALHeader({ ticker, data }: Props) {
  const qualityColor =
       data.dataQuality === 'full'    ? 'var(--battu-positive)'
    :  data.dataQuality === 'partial' ? 'var(--battu-warning)'
    :                                   'var(--battu-negative)'

  const extractedDate = data.extractedAt
    ? new Date(data.extractedAt).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      })
    : null

  return (
    <div style={{
      padding:        '10px 16px',
      borderBottom:   '1px solid var(--battu-border)',
      background:     'var(--battu-header-bg)',
      display:        'flex',
      justifyContent: 'space-between',
      alignItems:     'center',
    }}>
      <div>
        <div style={{
          color:         'var(--battu-muted)',
          fontSize:      '10px',
          letterSpacing: '2px',
          marginBottom:  '3px',
        }}>
          LEGAL — LEGAL &amp; GOVERNANCE INTELLIGENCE
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{
            color:      'var(--battu-title-color)',
            fontSize:   '14px',
            fontWeight: 'bold',
            textShadow: 'var(--battu-glow)',
          }}>
            {ticker}
          </span>
          <span style={{ color: qualityColor, fontSize: '9px', letterSpacing: '1px' }}>
            ● {data.dataQuality.toUpperCase()} DATA
          </span>
          {data.hasGoingConcern && (
            <span style={{
              color:         'var(--battu-bg)',
              background:    'var(--battu-negative)',
              fontSize:      '9px',
              letterSpacing: '1px',
              padding:       '2px 6px',
              borderRadius:  '2px',
              fontWeight:    'bold',
            }}>
              ⚠ GOING CONCERN
            </span>
          )}
          {data.secInvestigation && (
            <span style={{
              color:         'var(--battu-bg)',
              background:    'var(--battu-warning)',
              fontSize:      '9px',
              letterSpacing: '1px',
              padding:       '2px 6px',
              borderRadius:  '2px',
              fontWeight:    'bold',
            }}>
              ⚠ SEC INVESTIGATION
            </span>
          )}
        </div>
      </div>
      {extractedDate && (
        <span style={{ color: 'var(--battu-muted)', fontSize: '9px' }}>
          Cached · {extractedDate}
        </span>
      )}
    </div>
  )
}
