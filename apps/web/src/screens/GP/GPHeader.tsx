import type { MarketQuote } from '@battu/shared'

interface Props {
  ticker:    string
  quote:     MarketQuote | null
  timeframe: string
}

/** Bloomberg-style timeframe label — makes the interval explicit to the user. */
const TIMEFRAME_LABELS: Record<string, string> = {
  '1D':  'INTRADAY (5min)',
  '1W':  '5 DAY (30min)',
  '1M':  '1 MONTH (daily)',
  '3M':  '3 MONTH (daily)',
  '6M':  '6 MONTH (daily)',
  '1Y':  '1 YEAR (daily)',
  '5Y':  '5 YEAR (weekly)',
  '10Y': '10 YEAR (monthly)',
}

export function GPHeader({ ticker, quote, timeframe }: Props) {
  const tfLabel = TIMEFRAME_LABELS[timeframe] ?? timeframe
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
          {ticker} · {tfLabel}
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
