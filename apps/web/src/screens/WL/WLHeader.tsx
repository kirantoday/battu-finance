interface Props {
  watchlistName: string
  lastUpdate:    Date | null
  onRefresh:     () => void
}

export function WLHeader({ watchlistName, lastUpdate, onRefresh }: Props) {
  const secsAgo = lastUpdate
    ? Math.max(0, Math.round((Date.now() - lastUpdate.getTime()) / 1000))
    : null

  return (
    <div style={{
      padding:        '10px 16px',
      borderBottom:   '1px solid var(--battu-border)',
      background:     'var(--battu-header-bg)',
      display:        'flex',
      justifyContent: 'space-between',
      alignItems:     'center',
      gap:            '12px',
    }}>
      <div>
        <div style={{ color: 'var(--battu-muted)', fontSize: '10px', letterSpacing: '2px', marginBottom: '3px' }}>
          WL — LIVE WATCHLIST
        </div>
        <div style={{ color: 'var(--battu-title-color)', fontSize: '13px', fontWeight: 'bold', letterSpacing: '1px' }}>
          {watchlistName}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        {secsAgo !== null && (
          <span style={{ color: 'var(--battu-muted)', fontSize: '9px' }}>
            ↺ updated {secsAgo}s ago
          </span>
        )}
        <button
          onClick={onRefresh}
          style={{
            background:   'transparent',
            border:       '1px solid var(--battu-border)',
            color:        'var(--battu-accent)',
            fontFamily:   'JetBrains Mono, monospace',
            fontSize:     '10px',
            padding:      '2px 8px',
            cursor:       'pointer',
            borderRadius: '2px',
          }}
        >
          ↺ REFRESH
        </button>
        <span style={{ color: 'var(--battu-muted)', fontSize: '9px' }}>
          Polls every 10s
        </span>
      </div>
    </div>
  )
}
