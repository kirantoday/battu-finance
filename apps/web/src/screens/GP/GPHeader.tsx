import type { MarketQuote } from '@battu/shared'

interface Props {
  ticker:    string
  quote:     MarketQuote | null
  timeframe: string
}

export function GPHeader({ ticker, quote, timeframe }: Props) {
  const pos         = (quote?.changePct ?? 0) >= 0
  const arrow       = pos ? '▲' : '▼'
  const changeColor = pos ? 'var(--battu-positive)' : 'var(--battu-negative)'

  return (
    <div style={{
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'space-between',
      padding:        '8px 12px',
      borderBottom:   '1px solid var(--battu-border)',
      background:     'var(--battu-header-bg)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ color: 'var(--battu-muted)', fontSize: '10px', letterSpacing: '2px' }}>
          GP
        </span>
        <span style={{ color: 'var(--battu-title-color)', fontSize: '13px', fontWeight: 'bold', letterSpacing: '1px' }}>
          {(quote?.name || ticker).toUpperCase()}
        </span>
        <span style={{ color: 'var(--battu-muted)', fontSize: '10px' }}>
          {ticker} · {timeframe}
        </span>
      </div>

      {quote && (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span style={{ color: 'var(--battu-text)', fontSize: '16px', fontWeight: 'bold' }}>
            ${quote.price.toFixed(2)}
          </span>
          <span style={{ color: changeColor, fontSize: '12px' }}>
            {arrow} {Math.abs(quote.change).toFixed(2)} ({pos ? '+' : ''}{quote.changePct.toFixed(2)}%)
          </span>
        </div>
      )}
    </div>
  )
}
