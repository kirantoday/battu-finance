export function WLLoading() {
  return (
    <div style={{ padding: '24px 16px', fontFamily: 'JetBrains Mono, monospace' }}>
      <div style={{ color: 'var(--battu-muted)', fontSize: '10px', letterSpacing: '2px', marginBottom: '8px' }}>
        WL — LIVE WATCHLIST
      </div>
      {[120, 200, 180, 160].map((w, i) => (
        <div
          key={i}
          style={{
            height:         '14px',
            marginBottom:   '8px',
            width:          `${w}px`,
            background:     'var(--battu-border)',
            borderRadius:   '2px',
            animation:      'pulse 1.5s ease-in-out infinite',
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
      <div style={{ color: 'var(--battu-muted)', fontSize: '10px', marginTop: '12px' }}>
        Loading watchlist...
      </div>
    </div>
  )
}
