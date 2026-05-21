import type { OHLCVBar } from '@battu/shared'

interface Props { bar: OHLCVBar | null }

function fmt(n: number, decimals = 2): string {
  return Number.isFinite(n) ? n.toFixed(decimals) : '—'
}

function fmtVol(v: number): string {
  if (!Number.isFinite(v)) return '—'
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`
  return String(v)
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

export function GPFooter({ bar }: Props) {
  if (!bar) {
    return (
      <div style={{
        padding:    '5px 12px',
        borderTop:  '1px solid var(--battu-border)',
        background: 'var(--battu-header-bg)',
        color:      'var(--battu-muted)',
        fontSize:   '10px',
        fontFamily: 'JetBrains Mono, monospace',
      }}>
        Hover over chart to see OHLCV data
      </div>
    )
  }

  const isUp = bar.close >= bar.open
  const changeColor = isUp ? 'var(--battu-positive)' : 'var(--battu-negative)'
  const changePct = bar.open > 0 ? ((bar.close - bar.open) / bar.open) * 100 : 0

  const fields = [
    { label: 'DATE', value: fmtDate(bar.timestamp),                          color: 'var(--battu-muted)' },
    { label: 'O',    value: `$${fmt(bar.open)}`,                             color: 'var(--battu-value-color)' },
    { label: 'H',    value: `$${fmt(bar.high)}`,                             color: 'var(--battu-positive)' },
    { label: 'L',    value: `$${fmt(bar.low)}`,                              color: 'var(--battu-negative)' },
    { label: 'C',    value: `$${fmt(bar.close)}`,                            color: changeColor },
    { label: 'CHG',  value: `${isUp ? '+' : ''}${changePct.toFixed(2)}%`,    color: changeColor },
    { label: 'VOL',  value: fmtVol(bar.volume),                              color: 'var(--battu-value-color)' },
  ]

  return (
    <div style={{
      display:    'flex',
      alignItems: 'center',
      gap:        '20px',
      padding:    '5px 12px',
      borderTop:  '1px solid var(--battu-border)',
      background: 'var(--battu-header-bg)',
      fontFamily: 'JetBrains Mono, monospace',
      fontSize:   '10px',
      flexWrap:   'wrap',
    }}>
      {fields.map(({ label, value, color }) => (
        <span key={label}>
          <span style={{ color: 'var(--battu-muted)', marginRight: '4px' }}>{label}:</span>
          <span style={{ color, fontWeight: 'bold' }}>{value}</span>
        </span>
      ))}
    </div>
  )
}
