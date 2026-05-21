import type { FAData } from '@battu/shared'

interface Props { ticker: string; data: FAData }

export function FAHeader({ ticker, data }: Props) {
  return (
    <div style={{
      padding:      '10px 16px',
      borderBottom: '1px solid var(--battu-border)',
      background:   'var(--battu-header-bg)',
    }}>
      <div style={{ color: 'var(--battu-muted)', fontSize: '10px', letterSpacing: '2px', marginBottom: '4px' }}>
        FA — FINANCIAL ANALYSIS
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ color: 'var(--battu-title-color)', fontSize: '14px', fontWeight: 'bold', letterSpacing: '1px' }}>
          {ticker}
        </span>
        <span style={{ color: 'var(--battu-muted)', fontSize: '10px' }}>
          {data.currency} · All figures in billions unless noted · {data.period === 'annual' ? 'Annual' : 'Quarterly'}
        </span>
      </div>
    </div>
  )
}
