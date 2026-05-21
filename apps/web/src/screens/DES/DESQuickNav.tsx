interface Props {
  ticker: string
  onNavigate: (cmd: string) => void
}

const NAV_BUTTONS = [
  { cmd: 'GP',   label: 'GP',   title: 'Price Chart'        },
  { cmd: 'FA',   label: 'FA',   title: 'Financial Analysis' },
  { cmd: 'EE',   label: 'EE',   title: 'Earnings Estimates' },
  { cmd: 'ANR',  label: 'ANR',  title: 'Analyst Ratings'    },
  { cmd: 'OWN',  label: 'OWN',  title: '13F Ownership'      },
  { cmd: 'NI',   label: 'NI',   title: 'News Feed'          },
  { cmd: 'LIQ',  label: 'LIQ',  title: 'Cash Runway'        },
  { cmd: 'SECF', label: 'SECF', title: 'SEC Filings'        },
  { cmd: 'RV',   label: 'RV',   title: 'Relative Valuation' },
  { cmd: 'GPC',  label: 'GPC',  title: 'Compare to Peers'   },
]

export function DESQuickNav({ ticker, onNavigate }: Props) {
  return (
    <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--battu-border)' }}>
      <div style={{ color: 'var(--battu-muted)', fontSize: '9px', letterSpacing: '2px', marginBottom: '8px' }}>
        QUICK NAVIGATION
      </div>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {NAV_BUTTONS.map(({ cmd, label, title }) => (
          <button
            key={cmd}
            title={`${cmd} — ${title}`}
            onClick={() => onNavigate(`${cmd} ${ticker}`)}
            style={{
              background: 'transparent',
              border: '1px solid var(--battu-border)',
              color: 'var(--battu-accent)',
              fontFamily: 'monospace',
              fontSize: '10px',
              letterSpacing: '1px',
              padding: '3px 10px',
              cursor: 'pointer',
              borderRadius: '2px',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget
              el.style.background = 'var(--battu-accent)'
              el.style.color      = 'var(--battu-bg)'
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget
              el.style.background = 'transparent'
              el.style.color      = 'var(--battu-accent)'
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
