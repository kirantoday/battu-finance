export function GPLoading({ ticker, timeframe }: { ticker: string; timeframe: string }) {
  return (
    <div style={{ padding: '24px 16px', fontFamily: 'JetBrains Mono, monospace' }}>
      <div style={{ color: 'var(--battu-muted)', fontSize: '10px', letterSpacing: '2px', marginBottom: '16px' }}>
        GP — PRICE CHART
      </div>
      <div style={{ color: 'var(--battu-muted)', fontSize: '10px' }}>
        Loading {ticker} {timeframe} chart...
      </div>
      <div style={{
        marginTop:      '16px',
        height:         '300px',
        background:     'var(--battu-surface)',
        border:         '1px solid var(--battu-border)',
        borderRadius:   '2px',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        animation:      'pulse 1.5s ease-in-out infinite',
      }}>
        <span style={{ color: 'var(--battu-border)', fontSize: '24px' }}>▥</span>
      </div>
    </div>
  )
}
