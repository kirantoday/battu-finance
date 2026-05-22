import type { LEGALData } from '@battu/shared'

interface Props { data: LEGALData }

export function LEGALSources({ data }: Props) {
  const links: Array<{ label: string; url: string }> = []
  if (data.source10kUrl)   links.push({ label: '10-K Annual Report',     url: data.source10kUrl })
  if (data.sourceS3Url)    links.push({ label: 'S-3 Shelf Registration', url: data.sourceS3Url })
  if (data.sourceProxyUrl) links.push({ label: 'DEF 14A Proxy',          url: data.sourceProxyUrl })

  if (!links.length && !data.missingFields.length) return null

  return (
    <div style={{ padding: '12px 16px' }}>
      {links.length > 0 && (
        <>
          <div style={{
            color:         'var(--battu-muted)',
            fontSize:      '9px',
            letterSpacing: '2px',
            marginBottom:  '6px',
          }}>
            SOURCE FILINGS
          </div>
          {links.map(({ label, url }) => (
            <div key={url} style={{ marginBottom: '4px' }}>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color:          'var(--battu-accent)',
                  fontSize:       '9px',
                  textDecoration: 'none',
                  fontFamily:     'JetBrains Mono, monospace',
                }}
              >
                → {label}
              </a>
            </div>
          ))}
        </>
      )}

      {data.missingFields.length > 0 && (
        <div style={{
          marginTop: '10px',
          color:     'var(--battu-muted)',
          fontSize:  '9px',
        }}>
          ⚠ Some fields unavailable: {data.missingFields.join(', ')}
        </div>
      )}
    </div>
  )
}
