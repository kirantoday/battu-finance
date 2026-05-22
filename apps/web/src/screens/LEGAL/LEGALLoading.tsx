export function LEGALLoading({ ticker }: { ticker: string }) {
  return (
    <div style={{ padding: '24px 16px', fontFamily: 'JetBrains Mono, monospace' }}>
      <div style={{
        color:         'var(--battu-muted)',
        fontSize:      '10px',
        letterSpacing: '2px',
        marginBottom:  '8px',
      }}>
        LEGAL — LEGAL &amp; GOVERNANCE INTELLIGENCE
      </div>
      {[200, 160, 220, 140, 180].map((w, i) => (
        <div key={i} style={{
          height:         '12px',
          marginBottom:   '8px',
          width:          `${w}px`,
          background:     'var(--battu-border)',
          borderRadius:   '2px',
          animation:      'pulse 1.5s ease-in-out infinite',
          animationDelay: `${i * 0.1}s`,
        }} />
      ))}
      <div style={{ color: 'var(--battu-muted)', fontSize: '10px', marginTop: '12px' }}>
        Loading {ticker} legal data...
      </div>
    </div>
  )
}
