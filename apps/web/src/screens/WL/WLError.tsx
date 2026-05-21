export function WLError({ message }: { message: string }) {
  return (
    <div style={{ padding: '24px 16px', fontFamily: 'JetBrains Mono, monospace' }}>
      <div style={{ color: 'var(--battu-muted)', fontSize: '10px', letterSpacing: '2px', marginBottom: '12px' }}>
        WL — LIVE WATCHLIST
      </div>
      <div style={{ color: 'var(--battu-negative)', fontSize: '11px', marginBottom: '8px' }}>
        ✗ {message}
      </div>
      <div style={{ color: 'var(--battu-muted)', fontSize: '10px' }}>
        Check API server and database connection.
      </div>
    </div>
  )
}
