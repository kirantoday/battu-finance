interface Props {
  title:     string
  count:     number
  provider:  string
  lastFetch: Date | null
  cached:    boolean
  onRefresh: () => void
}

export function NIHeader({ title, count, provider, lastFetch, cached, onRefresh }: Props) {
  const timeAgo = lastFetch
    ? `${Math.max(0, Math.round((Date.now() - lastFetch.getTime()) / 60000))}m ago`
    : ''

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
          NI — NEWS & INFORMATION
        </div>
        <div style={{ color: 'var(--battu-title-color)', fontSize: '13px', fontWeight: 'bold', letterSpacing: '1px' }}>
          {title}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--battu-muted)', fontSize: '10px' }}>
          {count} article{count === 1 ? '' : 's'}
        </span>

        {provider && (
          <span style={{
            color:         'var(--battu-bg)',
            background:    'var(--battu-muted)',
            fontSize:      '8px',
            letterSpacing: '1px',
            padding:       '2px 6px',
            borderRadius:  '2px',
          }}>
            {provider.toUpperCase()}
          </span>
        )}

        {cached && (
          <span style={{ color: 'var(--battu-muted)', fontSize: '9px', fontStyle: 'italic' }}>
            cached
          </span>
        )}

        {timeAgo && (
          <span style={{ color: 'var(--battu-muted)', fontSize: '9px' }}>
            {timeAgo}
          </span>
        )}

        <button
          onClick={onRefresh}
          title="Refresh news"
          style={{
            background:    'transparent',
            border:        '1px solid var(--battu-border)',
            color:         'var(--battu-accent)',
            fontFamily:    'JetBrains Mono, monospace',
            fontSize:      '10px',
            padding:       '2px 8px',
            cursor:        'pointer',
            borderRadius:  '2px',
          }}
        >
          ↺ REFRESH
        </button>
      </div>
    </div>
  )
}
