interface Props {
  period:         'annual' | 'quarter'
  onPeriodChange: (p: 'annual' | 'quarter') => void
}

const btnBase: React.CSSProperties = {
  fontFamily:    'JetBrains Mono, monospace',
  fontSize:      '10px',
  letterSpacing: '1px',
  padding:       '3px 12px',
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
  background: 'transparent',
  color:      'var(--battu-muted)',
  border:     '1px solid var(--battu-border)',
  fontWeight: 'normal',
}

export function FAControls({ period, onPeriodChange }: Props) {
  return (
    <div style={{
      display:      'flex',
      alignItems:   'center',
      gap:          '8px',
      padding:      '8px 16px',
      borderBottom: '1px solid var(--battu-border)',
      background:   'var(--battu-header-bg)',
    }}>
      <span style={{ color: 'var(--battu-muted)', fontSize: '9px', letterSpacing: '1px', marginRight: '4px' }}>
        PERIOD:
      </span>
      <button
        style={period === 'annual' ? activeStyle : inactiveStyle}
        onClick={() => onPeriodChange('annual')}
      >
        ANNUAL
      </button>
      <button
        style={period === 'quarter' ? activeStyle : inactiveStyle}
        onClick={() => onPeriodChange('quarter')}
      >
        QUARTERLY
      </button>
    </div>
  )
}
