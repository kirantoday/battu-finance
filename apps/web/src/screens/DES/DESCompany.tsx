import { useState } from 'react'
import type { DESProfile } from '@battu/shared'

interface Props { profile: DESProfile }

export function DESCompany({ profile }: Props) {
  const [expanded, setExpanded] = useState(false)
  const desc = profile.description || ''
  const shortDesc = desc.length > 300 ? desc.slice(0, 300) + '...' : desc

  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--battu-border)' }}>
      <div style={{ color: 'var(--battu-muted)', fontSize: '9px', letterSpacing: '2px', marginBottom: '8px' }}>
        COMPANY
      </div>

      <div style={{
        display: 'flex', gap: '24px', marginBottom: '10px',
        fontSize: '10px', flexWrap: 'wrap', alignItems: 'baseline',
      }}>
        {[
          { label: 'SECTOR',    value: profile.sector },
          { label: 'INDUSTRY',  value: profile.industry },
          { label: 'CEO',       value: profile.ceo },
          { label: 'EMPLOYEES', value: profile.employees != null ? profile.employees.toLocaleString() : '—' },
          { label: 'COUNTRY',   value: profile.country },
        ].map(({ label, value }) => (
          <div key={label}>
            <span style={{ color: 'var(--battu-label-color)', fontSize: '9px' }}>{label}: </span>
            <span style={{ color: 'var(--battu-value-color)' }}>{value || '—'}</span>
          </div>
        ))}
        {profile.website && (
          <a
            href={profile.website}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--battu-accent)', fontSize: '9px', textDecoration: 'none' }}
          >
            {profile.website.replace(/^https?:\/\//, '')} →
          </a>
        )}
      </div>

      {desc && (
        <div>
          <p style={{ color: 'var(--battu-muted)', fontSize: '10px', lineHeight: '1.6', margin: 0 }}>
            {expanded ? desc : shortDesc}
          </p>
          {desc.length > 300 && (
            <button
              onClick={() => setExpanded(!expanded)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--battu-accent)', fontSize: '9px', padding: '4px 0',
                fontFamily: 'monospace', letterSpacing: '1px',
              }}
            >
              {expanded ? '[Show less]' : '[Show more]'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
