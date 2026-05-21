export function NILoading({ title }: { title: string }) {
  return (
    <div style={{ padding: '24px 16px', fontFamily: 'JetBrains Mono, monospace' }}>
      <div style={{ color: 'var(--battu-muted)', fontSize: '10px', letterSpacing: '2px', marginBottom: '8px' }}>
        NI — NEWS & INFORMATION
      </div>
      <div style={{ color: 'var(--battu-title-color)', fontSize: '13px', fontWeight: 'bold', marginBottom: '16px' }}>
        {title}
      </div>
      {[280, 240, 320, 200, 260, 300, 220].map((w, i) => (
        <div
          key={i}
          style={{
            height:       '12px',
            marginBottom: '10px',
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
        Fetching news...
      </div>
    </div>
  )
}
