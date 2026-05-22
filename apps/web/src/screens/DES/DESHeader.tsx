import type { DESProfile } from '@battu/shared'

interface Props { profile: DESProfile }

function formatVolume(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`
  return v.toString()
}

export function DESHeader({ profile }: Props) {
  const pos = profile.changePct >= 0
  const arrow = pos ? '▲' : '▼'
  const changeColor = pos ? 'var(--battu-positive)' : 'var(--battu-negative)'
  const dollarSign = profile.currency === 'USD' ? '$' : ''
  const rangeSpan = profile.week52High - profile.week52Low
  const rangePos = rangeSpan > 0
    ? Math.max(0, Math.min(100, ((profile.price - profile.week52Low) / rangeSpan) * 100))
    : 0

  return (
    <div style={{
      borderBottom: '1px solid var(--battu-border)',
      padding: '12px 16px',
      background: 'var(--battu-header-bg)',
    }}>
      <div style={{ color: 'var(--battu-muted)', fontSize: '10px', letterSpacing: '2px', marginBottom: '6px' }}>
        DES — SECURITY DESCRIPTION
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <span style={{ color: 'var(--battu-title-color)', fontSize: '16px', fontWeight: 'bold', letterSpacing: '1px' }}>
            {profile.name.toUpperCase()}
          </span>
          <span style={{ color: 'var(--battu-muted)', fontSize: '11px', marginLeft: '12px' }}>
            {profile.ticker} · {profile.exchange} · {profile.currency}
          </span>
          {profile.isin && (
            <span style={{ color: 'var(--battu-muted)', fontSize: '10px', marginLeft: '8px' }}>
              ISIN: {profile.isin}
            </span>
          )}
        </div>

        {profile.cik && (
          <a
            href={profile.secFilingsUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--battu-accent)', fontSize: '10px', textDecoration: 'none' }}
          >
            SEC CIK: {profile.cik} →
          </a>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginTop: '8px' }}>
        <span style={{
          color:              pos ? 'var(--battu-positive)' : 'var(--battu-negative)',
          fontSize:           '42px',
          fontWeight:         '800',
          letterSpacing:      '-1px',
          lineHeight:         '1',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {dollarSign}{profile.price.toFixed(2)}
        </span>
        <span style={{ color: changeColor, fontSize: '16px', fontWeight: '600' }}>
          {arrow} {Math.abs(profile.change).toFixed(2)} ({pos ? '+' : ''}{profile.changePct.toFixed(2)}%)
        </span>
        <span style={{ color: 'var(--battu-muted)', fontSize: '11px', marginLeft: 'auto' }}>
          Vol: {formatVolume(profile.volume)} · Avg: {formatVolume(profile.avgVolume)}
        </span>
      </div>

      <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: 'var(--battu-muted)', fontSize: '9px' }}>
          52W {dollarSign}{profile.week52Low.toFixed(2)}
        </span>
        <div style={{
          flex: 1, height: '3px', background: 'var(--battu-border)',
          borderRadius: '2px', position: 'relative', maxWidth: '200px',
        }}>
          <div style={{
            position: 'absolute', left: 0,
            width: `${rangePos}%`,
            height: '100%', background: 'var(--battu-accent)', borderRadius: '2px',
          }} />
        </div>
        <span style={{ color: 'var(--battu-muted)', fontSize: '9px' }}>
          {dollarSign}{profile.week52High.toFixed(2)}
        </span>
      </div>
    </div>
  )
}
