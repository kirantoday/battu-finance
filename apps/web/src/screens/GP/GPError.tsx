export function GPError({ ticker, message }: { ticker: string; message: string }) {
  return (
    <div style={{ padding: '24px 16px', fontFamily: 'JetBrains Mono, monospace' }}>
      <div style={{ color: 'var(--battu-muted)', fontSize: '10px', letterSpacing: '2px', marginBottom: '12px' }}>
        GP — PRICE CHART
      </div>
      <div style={{ color: 'var(--battu-negative)', fontSize: '12px', marginBottom: '8px' }}>
        ✗ {ticker} — {message}
      </div>
      <div style={{ color: 'var(--battu-muted)', fontSize: '10px' }}>
        Try: GP AAPL · GP MSFT · GP NVDA
      </div>
    </div>
  )
}
