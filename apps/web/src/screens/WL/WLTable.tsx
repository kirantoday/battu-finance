import type { MarketQuote } from '@battu/shared'

interface Props {
  quotes:        MarketQuote[]
  flashing:      Record<string, 'up' | 'down' | null>
  onTickerClick: (ticker: string) => void
  onRemove:      (ticker: string) => void
}

function fmtPrice(p: number): string {
  return Number.isFinite(p) ? `$${p.toFixed(2)}` : '—'
}

function fmtChange(c: number): string {
  if (!Number.isFinite(c)) return '—'
  return `${c >= 0 ? '▲' : '▼'} ${Math.abs(c).toFixed(2)}`
}

function fmtPct(p: number): string {
  if (!Number.isFinite(p)) return '—'
  return `${p >= 0 ? '+' : ''}${p.toFixed(2)}%`
}

function fmtVol(v: number): string {
  if (!Number.isFinite(v)) return '—'
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`
  return v.toString()
}

const headerStyle: React.CSSProperties = {
  padding:       '6px 12px',
  color:         'var(--battu-muted)',
  fontSize:      '9px',
  letterSpacing: '1px',
  textAlign:     'right',
  fontWeight:    'normal',
  borderBottom:  '1px solid var(--battu-border)',
  background:    'var(--battu-surface)',
}

export function WLTable({ quotes, flashing, onTickerClick, onRemove }: Props) {
  if (quotes.length === 0) {
    return (
      <div style={{ padding: '24px', color: 'var(--battu-muted)', fontSize: '11px' }}>
        No tickers in watchlist. Type a ticker above and press Enter to add.
      </div>
    )
  }

  return (
    <div style={{ overflowY: 'auto', flex: 1 }}>
      <table style={{
        width:          '100%',
        borderCollapse: 'collapse',
        fontFamily:     'JetBrains Mono, monospace',
        fontSize:       '11px',
      }}>
        <thead>
          <tr>
            <th style={{ ...headerStyle, textAlign: 'left', width: '80px' }}>TICKER</th>
            <th style={{ ...headerStyle, textAlign: 'left' }}>NAME</th>
            <th style={{ ...headerStyle, width: '100px' }}>PRICE</th>
            <th style={{ ...headerStyle, width: '100px' }}>CHG</th>
            <th style={{ ...headerStyle, width: '90px' }}>CHG%</th>
            <th style={{ ...headerStyle, width: '90px' }}>VOL</th>
            <th style={{ ...headerStyle, width: '40px' }} />
          </tr>
        </thead>
        <tbody>
          {quotes.map((q, i) => {
            const isPos    = q.changePct >= 0
            const color    = isPos ? 'var(--battu-positive)' : 'var(--battu-negative)'
            const flashDir = flashing[q.ticker]
            const flashCls = flashDir === 'up' ? 'flash-up' : flashDir === 'down' ? 'flash-down' : ''
            const isEven   = i % 2 === 0
            const restBg   = isEven ? 'var(--battu-bg)' : 'var(--battu-surface)'

            return (
              <tr
                key={q.ticker}
                className={flashCls}
                onClick={() => onTickerClick(q.ticker)}
                style={{
                  cursor:       'pointer',
                  background:   restBg,
                  borderBottom: '1px solid var(--battu-border)',
                  transition:   'background 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--battu-surface)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = restBg }}
              >
                <td style={{
                  padding:       '8px 12px',
                  color:         'var(--battu-accent)',
                  fontWeight:    'bold',
                  fontSize:      '12px',
                  letterSpacing: '1px',
                }}>
                  {q.ticker}
                </td>

                <td style={{
                  padding:      '8px 12px',
                  color:        'var(--battu-text)',
                  fontSize:     '10px',
                  maxWidth:     '240px',
                  overflow:     'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace:   'nowrap',
                }}>
                  {q.name}
                </td>

                <td style={{
                  padding:    '8px 12px',
                  color:      'var(--battu-text)',
                  fontWeight: 'bold',
                  textAlign:  'right',
                  fontSize:   '12px',
                }}>
                  {fmtPrice(q.price)}
                </td>

                <td style={{ padding: '8px 12px', color, textAlign: 'right', fontSize: '11px' }}>
                  {fmtChange(q.change)}
                </td>

                <td style={{
                  padding:    '8px 12px',
                  color,
                  textAlign:  'right',
                  fontWeight: 'bold',
                  fontSize:   '11px',
                }}>
                  {fmtPct(q.changePct)}
                </td>

                <td style={{
                  padding:   '8px 12px',
                  color:     'var(--battu-muted)',
                  textAlign: 'right',
                  fontSize:  '10px',
                }}>
                  {fmtVol(q.volume)}
                </td>

                <td style={{ padding: '8px 8px', textAlign: 'center' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); onRemove(q.ticker) }}
                    title={`Remove ${q.ticker}`}
                    style={{
                      background:   'transparent',
                      border:       'none',
                      color:        'var(--battu-muted)',
                      cursor:       'pointer',
                      fontSize:     '12px',
                      padding:      '2px 4px',
                      borderRadius: '2px',
                      lineHeight:   1,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--battu-negative)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--battu-muted)' }}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div style={{
        padding:    '8px 16px',
        color:      'var(--battu-muted)',
        fontSize:   '9px',
        borderTop:  '1px solid var(--battu-border)',
        background: 'var(--battu-header-bg)',
      }}>
        Click any row → DES screen · ✕ to remove · Prices update every 10 seconds
      </div>
    </div>
  )
}
