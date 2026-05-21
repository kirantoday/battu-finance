export function FALoading({ ticker }: { ticker: string }) {
  return (
    <div style={{ padding: '24px 16px', fontFamily: 'JetBrains Mono, monospace' }}>
      <div style={{ color: 'var(--battu-muted)', fontSize: '10px', letterSpacing: '2px', marginBottom: '16px' }}>
        FA — FINANCIAL ANALYSIS
      </div>
      {[200, 150, 180, 160, 140, 170, 130, 190].map((w, i) => (
        <div
          key={i}
          style={{
            height:       '14px',
            marginBottom: '6px',
            width:        `${w}px`,
            maxWidth:     '100%',
            background:   'var(--battu-border)',
            borderRadius: '2px',
            animation:    'pulse 1.5s ease-in-out infinite',
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
      <div style={{ color: 'var(--battu-muted)', fontSize: '10px', marginTop: '12px' }}>
        Loading {ticker} financials...
      </div>
    </div>
  )
}
