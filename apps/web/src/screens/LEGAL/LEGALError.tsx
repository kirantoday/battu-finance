export function LEGALError({ ticker, message }: { ticker: string; message: string }) {
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
      <div style={{
        color:        'var(--battu-negative)',
        fontSize:     '11px',
        marginBottom: '8px',
      }}>
        ✗ {ticker} — {message}
      </div>
      <div style={{
        color:      'var(--battu-muted)',
        fontSize:   '10px',
        lineHeight: '1.6',
      }}>
        Run ingestion first: pnpm ingest:liq --ticker={ticker}<br />
        Then try: LEGAL BIIB · LEGAL MRNA · LEGAL AAPL
      </div>
    </div>
  )
}
