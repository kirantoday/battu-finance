import type { LIQData } from '@battu/shared'

interface Props { data: LIQData }

function fmtB(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—'
  const sign = v < 0 ? '-' : ''
  const abs  = Math.abs(v)
  // Values are stored in billions. Show $X.XXXB at or above $1B; under that,
  // promote to millions ($XX.XM) so a $60M facility doesn't read as $0.060B.
  if (abs >= 1) return `${sign}$${abs.toFixed(3)}B`
  return `${sign}$${(abs * 1000).toFixed(1)}M`
}

export function LIQSources({ data }: Props) {
  const sources = data.sources || {}
  const links: Array<{ label: string; url: string }> = []
  if (sources.balanceSheet) links.push({ label: 'Balance Sheet',                url: sources.balanceSheet })
  if (sources.shelfFiling)  links.push({ label: 'S-3 Shelf Registration',       url: sources.shelfFiling })
  if (sources.creditFiling) links.push({ label: '10-K Annual Report',           url: sources.creditFiling })
  if (sources.drawdowns?.length) {
    sources.drawdowns.slice(0, 3).forEach((url, i) =>
      links.push({ label: `424B Drawdown ${i + 1}`, url })
    )
  }

  const totalB = data.totalLiquidityB

  return (
    <div style={{ padding: '12px 16px' }}>
      {totalB != null && (
        <div style={{
          display:             'grid',
          gridTemplateColumns: '240px 1fr',
          gap:                 '16px',
          alignItems:          'center',
          padding:             '10px 14px',
          marginBottom:        '12px',
          border:              '1px solid var(--battu-accent)',
          background:          'var(--battu-surface)',
          maxWidth:            '600px',
        }}>
          <span style={{ color: 'var(--battu-accent)', fontSize: '10px', letterSpacing: '2px', fontWeight: 'bold' }}>
            TOTAL LIQUIDITY
          </span>
          <span style={{ color: 'var(--battu-accent)', fontSize: '18px', fontWeight: 'bold', fontFamily: 'JetBrains Mono, monospace' }}>
            {fmtB(totalB)}
          </span>
        </div>
      )}

      {links.length > 0 && (
        <div>
          <div style={{ color: 'var(--battu-muted)', fontSize: '9px', letterSpacing: '2px', marginBottom: '6px' }}>
            SOURCE FILINGS
          </div>
          {links.map(({ label, url }) => (
            <div key={url} style={{ marginBottom: '3px' }}>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color:          'var(--battu-accent)',
                  fontSize:       '9px',
                  textDecoration: 'none',
                  fontFamily:     'JetBrains Mono, monospace',
                }}
              >
                → {label}
              </a>
            </div>
          ))}
        </div>
      )}

      {data.missingFields.length > 0 && (
        <div style={{ marginTop: '10px', color: 'var(--battu-muted)', fontSize: '9px' }}>
          ⚠ Some fields unavailable: {data.missingFields.join(', ')}
        </div>
      )}
    </div>
  )
}
