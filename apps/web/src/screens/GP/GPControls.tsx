interface Props {
  timeframe:         string
  chartType:         'candle' | 'line'
  onTimeframeChange: (tf: string) => void
  onChartTypeChange: (type: 'candle' | 'line') => void
}

const TIMEFRAMES = ['1D', '1W', '1M', '3M', '6M', '1Y', '5Y']

const btnBase: React.CSSProperties = {
  background:    'transparent',
  border:        '1px solid var(--battu-border)',
  fontFamily:    'JetBrains Mono, monospace',
  fontSize:      '10px',
  letterSpacing: '1px',
  padding:       '3px 8px',
  cursor:        'pointer',
  borderRadius:  '2px',
  transition:    'all 0.15s',
}

const activeStyle: React.CSSProperties = {
  ...btnBase,
  background: 'var(--battu-accent)',
  color:      'var(--battu-bg)',
  border:     '1px solid var(--battu-accent)',
  fontWeight: 'bold',
}

const inactiveStyle: React.CSSProperties = {
  ...btnBase,
  color: 'var(--battu-muted)',
}

export function GPControls({ timeframe, chartType, onTimeframeChange, onChartTypeChange }: Props) {
  return (
    <div style={{
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'space-between',
      padding:        '6px 12px',
      borderBottom:   '1px solid var(--battu-border)',
      background:     'var(--battu-header-bg)',
    }}>
      <div style={{ display: 'flex', gap: '4px' }}>
        {TIMEFRAMES.map(tf => (
          <button
            key={tf}
            onClick={() => onTimeframeChange(tf)}
            style={timeframe === tf ? activeStyle : inactiveStyle}
          >
            {tf}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '4px' }}>
        {(['candle', 'line'] as const).map(type => (
          <button
            key={type}
            onClick={() => onChartTypeChange(type)}
            style={chartType === type ? activeStyle : inactiveStyle}
            title={type === 'candle' ? 'Candlestick' : 'Line chart'}
          >
            {type === 'candle' ? '▥ CANDLE' : '∿ LINE'}
          </button>
        ))}
      </div>
    </div>
  )
}
