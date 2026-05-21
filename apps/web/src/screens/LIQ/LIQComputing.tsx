interface Props { ticker: string; step: string }

export function LIQComputing({ ticker, step }: Props) {
  return (
    <div style={{ padding: '32px 24px', fontFamily: 'JetBrains Mono, monospace' }}>
      <div style={{ color: 'var(--battu-muted)', fontSize: '10px', letterSpacing: '2px', marginBottom: '8px' }}>
        LIQ — LIQUIDITY ANALYSIS
      </div>
      <div style={{ color: 'var(--battu-title-color)', fontSize: '14px', fontWeight: 'bold', marginBottom: '24px' }}>
        {ticker}
      </div>

      <div style={{
        border:     '1px solid var(--battu-border)',
        padding:    '16px 20px',
        background: 'var(--battu-surface)',
        maxWidth:   '520px',
      }}>
        <div style={{ color: 'var(--battu-muted)', fontSize: '9px', letterSpacing: '2px', marginBottom: '12px' }}>
          COMPUTING — FIRST LOAD (5–15 SECONDS)
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width:        '10px',
            height:       '10px',
            borderRadius: '50%',
            background:   'var(--battu-accent)',
            animation:    'pulse 1s ease-in-out infinite',
            flexShrink:   0,
          }} />
          <span style={{ color: 'var(--battu-accent)', fontSize: '10px' }}>
            {step}
          </span>
        </div>

        <div style={{ marginTop: '16px', color: 'var(--battu-muted)', fontSize: '9px', lineHeight: '1.6' }}>
          Fetching SEC filings and extracting data with AI.<br />
          Results will be cached — future loads are instant.
        </div>
      </div>
    </div>
  )
}
