import type { DESProfile } from '@battu/shared'

interface Props { profile: DESProfile }

function formatVolume(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`
  return v.toString()
}

function fmt(v: number | null, decimals = 2): string {
  return v == null ? '—' : v.toFixed(decimals)
}

function fmtB(v: number): string {
  if (v >= 1000) return `$${(v / 1000).toFixed(2)}T`
  if (v >= 1)    return `$${v.toFixed(2)}B`
  if (v > 0)     return `$${(v * 1000).toFixed(0)}M`
  return '—'
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  const parsed = new Date(d)
  if (Number.isNaN(parsed.valueOf())) return '—'
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function DESStats({ profile }: Props) {
  const rows: Array<[{ label: string; value: string }, { label: string; value: string }]> = [
    [
      { label: 'MARKET CAP',      value: fmtB(profile.marketCapB) },
      { label: 'P/E RATIO (TTM)', value: profile.peRatioTTM != null ? `${fmt(profile.peRatioTTM)}x` : '—' },
    ],
    [
      { label: '52W HIGH',        value: profile.week52High ? `$${profile.week52High.toFixed(2)}` : '—' },
      { label: 'EPS (TTM)',       value: profile.epsTTM != null ? `$${fmt(profile.epsTTM)}` : '—' },
    ],
    [
      { label: '52W LOW',         value: profile.week52Low ? `$${profile.week52Low.toFixed(2)}` : '—' },
      { label: 'DIV YIELD',       value: profile.dividendYield != null ? `${(profile.dividendYield * 100).toFixed(2)}%` : '—' },
    ],
    [
      { label: 'SHARES OUT',      value: profile.sharesOutB > 0 ? `${profile.sharesOutB.toFixed(2)}B` : '—' },
      { label: 'BETA',            value: fmt(profile.beta) },
    ],
    [
      { label: 'AVG VOLUME',      value: profile.avgVolume > 0 ? formatVolume(profile.avgVolume) : '—' },
      { label: 'NEXT EARNINGS',   value: fmtDate(profile.nextEarningsDate) },
    ],
    [
      { label: 'EV/EBITDA',       value: profile.evEbitda != null ? `${fmt(profile.evEbitda)}x` : '—' },
      { label: 'P/B RATIO',       value: profile.pbRatio  != null ? `${fmt(profile.pbRatio)}x`  : '—' },
    ],
  ]

  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--battu-border)' }}>
      <div style={{ color: 'var(--battu-muted)', fontSize: '9px', letterSpacing: '2px', marginBottom: '8px' }}>
        KEY STATISTICS
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'var(--battu-border)' }}>
        {rows.map((row, ri) => (
          row.map((cell, ci) => (
            <div
              key={`${ri}-${ci}`}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '5px 10px',
                background: ri % 2 === 0 ? 'var(--battu-surface)' : 'var(--battu-bg)',
              }}
            >
              <span style={{ color: 'var(--battu-muted)', fontSize: '9px', letterSpacing: '1px' }}>
                {cell.label}
              </span>
              <span style={{ color: 'var(--battu-value-color)', fontSize: '12px', fontWeight: 'bold' }}>
                {cell.value}
              </span>
            </div>
          ))
        ))}
      </div>
    </div>
  )
}
