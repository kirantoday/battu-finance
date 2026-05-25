import { useEffect, useState } from 'react'
import { useTerminal } from '@/store/terminal'
import { parseCommand } from '@/lib/commandParser'
import type { DESProfile } from '@battu/shared'
import { DESHeader }    from './DESHeader'
import { DESStats }     from './DESStats'
import { DESCompany }   from './DESCompany'
import { DESQuickNav }  from './DESQuickNav'
import { DESLoading }   from './DESLoading'
import { DESError }     from './DESError'

export function DESScreen() {
  const currentParams = useTerminal((s) => s.currentParams)
  const activeTicker  = useTerminal((s) => s.activeTicker)
  const navigate      = useTerminal((s) => s.navigate)
  const pushToHistory = useTerminal((s) => s.pushToHistory)

  const ticker = (currentParams.ticker || activeTicker || '').toUpperCase()

  const [profile, setProfile] = useState<DESProfile | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    if (!ticker) return
    let aborted = false

    setLoading(true)
    setError(null)
    setProfile(null)

    fetch(`/api/v1/fundamentals/profile/${encodeURIComponent(ticker)}`)
      .then(async (r) => {
        const body = await r.json().catch(() => ({ error: 'Bad JSON from API' }))
        if (aborted) return
        if (!r.ok || body?.error || !body?.data) {
          setError(body?.error || `HTTP ${r.status}`)
        } else {
          setProfile(body.data as DESProfile)
        }
      })
      .catch((e) => {
        if (!aborted) setError(e?.message || 'Failed to load — is the API server running?')
      })
      .finally(() => {
        if (!aborted) setLoading(false)
      })

    return () => { aborted = true }
  }, [ticker])

  if (!ticker) {
    return (
      <div className="p-6" style={{ color: 'var(--battu-muted)', fontFamily: 'monospace' }}>
        Type a ticker: <span style={{ color: 'var(--battu-accent)' }}>DES AAPL</span>
      </div>
    )
  }
  if (loading) return <DESLoading ticker={ticker} />
  if (error || !profile) return <DESError ticker={ticker} message={error ?? 'No data returned'} />

  return (
    <div
      className="flex flex-col h-full overflow-auto"
      style={{ background: 'var(--battu-screen-bg)', fontFamily: 'monospace' }}
    >
      <DESHeader  profile={profile} />
      <DESStats   profile={profile} />
      <DESCompany profile={profile} />
      <DESQuickNav
        ticker={ticker}
        onNavigate={(cmd) => {
          const parsed = parseCommand(cmd, ticker)
          if (parsed) {
            pushToHistory(cmd.toUpperCase())
            navigate(parsed)
          }
        }}
      />
    </div>
  )
}
