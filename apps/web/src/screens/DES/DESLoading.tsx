export function DESLoading({ ticker }: { ticker: string }) {
  return (
    <div style={{ padding: '24px 16px', fontFamily: 'monospace' }}>
      <div style={{ color: 'var(--battu-muted)', fontSize: '10px', letterSpacing: '2px', marginBottom: '16px' }}>
        DES — SECURITY DESCRIPTION
      </div>
      {[120, 80, 200, 160, 140, 180].map((w, i) => (
        <div
          key={i}
          style={{
            height: '12px',
            marginBottom: '10px',
            width: `${w}px`,
            maxWidth: '100%',
            background: 'var(--battu-border)',
            borderRadius: '2px',
            opacity: 0.6,
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        />
      ))}
      <div style={{ color: 'var(--battu-muted)', fontSize: '10px', marginTop: '16px' }}>
        Loading {ticker}...
      </div>
    </div>
  )
}
