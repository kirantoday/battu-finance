export function DESError({ ticker, message }: { ticker: string; message: string }) {
  return (
    <div style={{ padding: '24px 16px', fontFamily: 'monospace' }}>
      <div style={{ color: 'var(--battu-muted)', fontSize: '10px', letterSpacing: '2px', marginBottom: '12px' }}>
        DES — SECURITY DESCRIPTION
      </div>
      <div style={{ color: 'var(--battu-negative)', fontSize: '12px', marginBottom: '8px' }}>
        ✗ {ticker} — {message}
      </div>
      <div style={{ color: 'var(--battu-muted)', fontSize: '10px' }}>
        Check ticker symbol or API connection.
      </div>
    </div>
  )
}
