export function LIQError({ ticker, message }: { ticker: string; message: string }) {
  return (
    <div style={{ padding: '24px 16px', fontFamily: 'JetBrains Mono, monospace' }}>
      <div style={{ color: 'var(--battu-muted)', fontSize: '10px', letterSpacing: '2px', marginBottom: '8px' }}>
        LIQ — LIQUIDITY ANALYSIS
      </div>
      <div style={{ color: 'var(--battu-negative)', fontSize: '11px', marginBottom: '8px' }}>
        ✗ {ticker} — {message}
      </div>
      <div style={{ color: 'var(--battu-muted)', fontSize: '10px', lineHeight: '1.6' }}>
        LIQ requires EDGAR filing access and AI extraction.<br />
        Try: LIQ BIIB · LIQ MRNA · LIQ AAPL
      </div>
    </div>
  )
}
