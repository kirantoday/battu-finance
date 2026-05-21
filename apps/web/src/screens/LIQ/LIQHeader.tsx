import type { LIQData } from '@battu/shared'

interface Props {
  ticker:    string
  data:      LIQData
  cached:    boolean
  stale:     boolean
  onRefresh: () => void
}

export function LIQHeader({ ticker, data, cached, stale, onRefresh }: Props) {
  const qualityColor =
       data.dataQuality === 'full'    ? 'var(--battu-positive)'
    :  data.dataQuality === 'partial' ? 'var(--battu-warning)'
    :  'var(--battu-negative)'

  const computedDate = new Date(data.computedAt).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  return (
    <div style={{
      padding:      '10px 16px',
      borderBottom: '1px solid var(--battu-border)',
      background:   'var(--battu-header-bg)',
    }}>
      <div style={{ color: 'var(--battu-muted)', fontSize: '10px', letterSpacing: '2px', marginBottom: '3px' }}>
        LIQ — LIQUIDITY ANALYSIS
      </div>
      <div style={{
        display:        'flex',
        justifyContent: 'space-between',
        alignItems:     'center',
        flexWrap:       'wrap',
        gap:            '16px',
        maxWidth:       '600px',
      }}>
        <div style={{ color: 'var(--battu-title-color)', fontSize: '14px', fontWeight: 'bold' }}>
          {ticker}
          <span style={{ color: qualityColor, fontSize: '9px', marginLeft: '10px', letterSpacing: '1px' }}>
            ● {data.dataQuality.toUpperCase()} DATA
          </span>
          {stale && (
            <span style={{ color: 'var(--battu-warning)', fontSize: '9px', marginLeft: '8px' }}>
              ⚠ DATA MAY BE STALE
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ color: 'var(--battu-muted)', fontSize: '9px' }}>
            {cached ? `Cached · ${computedDate}` : `Computed ${computedDate}`}
          </span>
          <button
            onClick={onRefresh}
            style={{
              background:   'transparent',
              border:       '1px solid var(--battu-border)',
              color:        'var(--battu-accent)',
              fontFamily:   'JetBrains Mono, monospace',
              fontSize:     '9px',
              padding:      '2px 8px',
              cursor:       'pointer',
              borderRadius: '2px',
            }}
          >
            ↺ REFRESH
          </button>
        </div>
      </div>
    </div>
  )
}
