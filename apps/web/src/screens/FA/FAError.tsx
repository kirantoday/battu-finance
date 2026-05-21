export function FAError({ ticker, message }: { ticker: string; message: string }) {
  return (
    <div style={{ padding: '24px 16px', fontFamily: 'JetBrains Mono, monospace' }}>
      <div style={{ color: 'var(--battu-muted)', fontSize: '10px', letterSpacing: '2px', marginBottom: '12px' }}>
        FA — FINANCIAL ANALYSIS
      </div>
      <div style={{ color: 'var(--battu-negative)', fontSize: '12px', marginBottom: '8px' }}>
        ✗ {ticker} — {message}
      </div>
      <div style={{ color: 'var(--battu-muted)', fontSize: '10px' }}>
        Try: FA AAPL · FA MSFT · FA NVDA
      </div>
    </div>
  )
}
