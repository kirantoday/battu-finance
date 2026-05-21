import { useState } from 'react'

interface Props { onAdd: (ticker: string) => void | Promise<void> }

export function WLAddTicker({ onAdd }: Props) {
  const [value,   setValue]   = useState('')
  const [loading, setLoading] = useState(false)

  const handleAdd = async () => {
    const ticker = value.trim().toUpperCase()
    if (!ticker || loading) return
    setLoading(true)
    try {
      await onAdd(ticker)
      setValue('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      display:      'flex',
      alignItems:   'center',
      gap:          '8px',
      padding:      '8px 16px',
      borderBottom: '1px solid var(--battu-border)',
      background:   'var(--battu-header-bg)',
    }}>
      <span style={{ color: 'var(--battu-muted)', fontSize: '9px', letterSpacing: '1px' }}>
        ADD:
      </span>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value.toUpperCase())}
        onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
        placeholder="Enter ticker (e.g. TSLA)"
        maxLength={10}
        style={{
          background:   'var(--battu-surface)',
          border:       '1px solid var(--battu-border)',
          color:        'var(--battu-text)',
          fontFamily:   'JetBrains Mono, monospace',
          fontSize:     '11px',
          padding:      '4px 8px',
          width:        '160px',
          outline:      'none',
          caretColor:   'var(--battu-cursor)',
        }}
      />
      <button
        onClick={handleAdd}
        disabled={loading || !value.trim()}
        style={{
          background:    value.trim() ? 'var(--battu-accent)' : 'transparent',
          border:        '1px solid var(--battu-border)',
          color:         value.trim() ? 'var(--battu-bg)' : 'var(--battu-muted)',
          fontFamily:    'JetBrains Mono, monospace',
          fontSize:      '10px',
          padding:       '4px 12px',
          cursor:        value.trim() && !loading ? 'pointer' : 'default',
          borderRadius:  '2px',
          letterSpacing: '1px',
        }}
      >
        {loading ? '...' : '+ ADD'}
      </button>
      <span style={{ color: 'var(--battu-muted)', fontSize: '9px' }}>
        or press Enter
      </span>
    </div>
  )
}
