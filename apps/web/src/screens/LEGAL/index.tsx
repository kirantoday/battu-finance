import { useEffect, useState } from 'react'
import { useTerminal } from '@/store/terminal'
import type { LEGALData } from '@battu/shared'
import { LEGALHeader }     from './LEGALHeader'
import { LEGALCounsel }    from './LEGALCounsel'
import { LEGALAudit }      from './LEGALAudit'
import { LEGALLitigation } from './LEGALLitigation'
import { LEGALSources }    from './LEGALSources'
import { LEGALLoading }    from './LEGALLoading'
import { LEGALError }      from './LEGALError'

export function LEGALScreen() {
  const currentParams = useTerminal((s) => s.currentParams)
  const activeTicker  = useTerminal((s) => s.activeTicker)
  const ticker = (currentParams.ticker || activeTicker || '').toUpperCase()

  const [data,    setData]    = useState<LEGALData | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    if (!ticker) return
    setLoading(true)
    setError(null)
    setData(null)

    fetch(`/api/v1/legal/${ticker}`)
      .then(async (r) => {
        const body = await r.json().catch(() => ({ error: 'Bad JSON from API' }))
        if (!r.ok || body?.error || !body?.data) {
          setError(body?.error || `HTTP ${r.status}`)
        } else {
          setData(body.data as LEGALData)
        }
      })
      .catch((e) => setError((e as Error)?.message || 'Failed to load legal data'))
      .finally(() => setLoading(false))
  }, [ticker])

  if (!ticker) {
    return (
      <div style={{ padding: '24px', fontFamily: 'JetBrains Mono, monospace', color: 'var(--battu-muted)' }}>
        Type a ticker: <span style={{ color: 'var(--battu-accent)' }}>LEGAL BIIB</span>
      </div>
    )
  }
  if (loading)         return <LEGALLoading ticker={ticker} />
  if (error || !data)  return <LEGALError   ticker={ticker} message={error ?? 'No data returned'} />

  return (
    <div
      className="flex flex-col h-full overflow-auto"
      style={{ background: 'var(--battu-screen-bg)', fontFamily: 'JetBrains Mono, monospace' }}
    >
      <LEGALHeader     ticker={ticker} data={data} />
      <LEGALCounsel    data={data} />
      <LEGALAudit      data={data} />
      <LEGALLitigation data={data} />
      <LEGALSources    data={data} />
    </div>
  )
}
