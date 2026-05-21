import type { LIQData } from '@battu/shared'

interface Props { data: LIQData }

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
          display:        'flex',
          justifyContent: 'space-between',
          alignItems:     'center',
          padding:        '10px 14px',
          marginBottom:   '12px',
          border:         '1px solid var(--battu-accent)',
          background:     'var(--battu-surface)',
        }}>
          <span style={{ color: 'var(--battu-accent)', fontSize: '10px', letterSpacing: '2px', fontWeight: 'bold' }}>
            TOTAL LIQUIDITY
          </span>
          <span style={{ color: 'var(--battu-accent)', fontSize: '18px', fontWeight: 'bold', fontFamily: 'JetBrains Mono, monospace' }}>
            ${totalB.toFixed(3)}B
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
