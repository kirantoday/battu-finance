export type CategoryFilter = 'all' | 'earnings' | 'analyst' | 'ma' | 'macro' | 'general'

interface Props {
  category:         CategoryFilter
  onCategoryChange: (c: CategoryFilter) => void
  counts:           Record<CategoryFilter, number>
}

const CATEGORIES: Array<{ key: CategoryFilter; label: string; color: string }> = [
  { key: 'all',      label: 'ALL',      color: 'var(--battu-accent)'   },
  { key: 'earnings', label: 'EARNINGS', color: 'var(--battu-warning)'  },
  { key: 'analyst',  label: 'ANALYST',  color: '#4A9EFF'               },
  { key: 'ma',       label: 'M&A',      color: 'var(--battu-positive)' },
  { key: 'macro',    label: 'MACRO',    color: '#9B59B6'               },
  { key: 'general',  label: 'GENERAL',  color: 'var(--battu-muted)'    },
]

export function NIFilters({ category, onCategoryChange, counts }: Props) {
  return (
    <div style={{
      display:      'flex',
      alignItems:   'center',
      gap:          '4px',
      padding:      '6px 16px',
      borderBottom: '1px solid var(--battu-border)',
      background:   'var(--battu-header-bg)',
      flexWrap:     'wrap',
    }}>
      {CATEGORIES.map(({ key, label, color }) => {
        const isActive = category === key
        const count    = counts[key]
        // Hide non-ALL filters with zero matches (keeps the rail compact)
        if (count === 0 && key !== 'all') return null

        return (
          <button
            key={key}
            onClick={() => onCategoryChange(key)}
            style={{
              background:    isActive ? color : 'transparent',
              border:        `1px solid ${isActive ? color : 'var(--battu-border)'}`,
              color:         isActive ? 'var(--battu-bg)' : color,
              fontFamily:    'JetBrains Mono, monospace',
              fontSize:      '9px',
              letterSpacing: '1px',
              padding:       '3px 8px',
              cursor:        'pointer',
              borderRadius:  '2px',
              fontWeight:    isActive ? 'bold' : 'normal',
            }}
          >
            {label} {count > 0 ? `(${count})` : ''}
          </button>
        )
      })}
    </div>
  )
}
