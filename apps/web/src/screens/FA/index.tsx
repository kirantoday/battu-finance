import { useEffect, useState } from 'react'
import { useTerminal } from '@/store/terminal'
import type { FAData } from '@battu/shared'
import { FATable }    from './FATable'
import { FAControls } from './FAControls'
import { FAHeader }   from './FAHeader'
import { FALoading }  from './FALoading'
import { FAError }    from './FAError'

type FAPeriod = 'annual' | 'quarter'

export function FAScreen() {
  const currentParams = useTerminal((s) => s.currentParams)
  const activeTicker  = useTerminal((s) => s.activeTicker)
  const ticker = (currentParams.ticker || activeTicker || '').toUpperCase()

  const [period,  setPeriod]  = useState<FAPeriod>('annual')
  const [data,    setData]    = useState<FAData | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    if (!ticker) return
    let aborted = false

    setLoading(true)
    setError(null)
    setData(null)

    fetch(`/api/v1/fundamentals/financials/${ticker}?period=${period}&limit=5`)
      .then(async (r) => {
        const body = await r.json().catch(() => ({ error: 'Bad JSON from API' }))
        if (aborted) return
        if (!r.ok || body?.error || !body?.data) {
          setError(body?.error || `HTTP ${r.status}`)
        } else {
          setData(body.data as FAData)
        }
      })
      .catch((e) => {
        if (!aborted) setError(e?.message || 'Failed to load financial data')
      })
      .finally(() => {
        if (!aborted) setLoading(false)
      })

    return () => { aborted = true }
  }, [ticker, period])

  if (!ticker) {
    return (
      <div style={{ padding: '24px', fontFamily: 'JetBrains Mono, monospace', color: 'var(--battu-muted)' }}>
        Type a ticker: <span style={{ color: 'var(--battu-accent)' }}>FA AAPL</span>
      </div>
    )
  }
  if (loading) return <FALoading ticker={ticker} />
  if (error || !data) return <FAError ticker={ticker} message={error ?? 'No data returned'} />

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ background: 'var(--battu-screen-bg)', fontFamily: 'JetBrains Mono, monospace' }}
    >
      <FAHeader  ticker={ticker} data={data} />
      <FAControls period={period} onPeriodChange={setPeriod} />
      <FATable   data={data} />
    </div>
  )
}
