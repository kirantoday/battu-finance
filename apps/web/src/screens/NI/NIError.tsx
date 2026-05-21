export function NIError({ title, message }: { title: string; message: string }) {
  return (
    <div style={{ padding: '24px 16px', fontFamily: 'JetBrains Mono, monospace' }}>
      <div style={{ color: 'var(--battu-muted)', fontSize: '10px', letterSpacing: '2px', marginBottom: '8px' }}>
        NI — NEWS & INFORMATION
      </div>
      <div style={{ color: 'var(--battu-title-color)', fontSize: '13px', fontWeight: 'bold', marginBottom: '12px' }}>
        {title}
      </div>
      <div style={{ color: 'var(--battu-negative)', fontSize: '11px', marginBottom: '8px' }}>
        ✗ {message}
      </div>
      <div style={{ color: 'var(--battu-muted)', fontSize: '10px', lineHeight: '1.5' }}>
        NewsAPI free tier: 100 requests/day · Articles ~15min delayed<br />
        Try: NI AAPL · NI MSFT · N (market headlines)
      </div>
    </div>
  )
}
