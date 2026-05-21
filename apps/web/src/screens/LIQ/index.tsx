import { useEffect, useState, useRef } from 'react'
import { useTerminal } from '@/store/terminal'
import type { LIQData } from '@battu/shared'
import { LIQHeader }        from './LIQHeader'
import { LIQCashSection }   from './LIQCashSection'
import { LIQShelfSection }  from './LIQShelfSection'
import { LIQCreditSection } from './LIQCreditSection'
import { LIQSources }       from './LIQSources'
import { LIQComputing }     from './LIQComputing'
import { LIQError }         from './LIQError'

const STEPS = [
  'Fetching balance sheet...',
  'Resolving SEC CIK...',
  'Searching for shelf registration (S-3)...',
  'Extracting shelf amount...',
  'Calculating ATM drawdowns...',
  'Searching 10-K for credit facility...',
  'Extracting credit terms...',
  'Computing total liquidity...',
]

export function LIQScreen() {
  const currentParams = useTerminal((s) => s.currentParams)
  const activeTicker  = useTerminal((s) => s.activeTicker)
  const ticker = (currentParams.ticker || activeTicker || '').toUpperCase()

  const [data,    setData]    = useState<LIQData | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error,   setError]   = useState<string | null>(null)
  const [cached,  setCached]  = useState<boolean>(false)
  const [stale,   setStale]   = useState<boolean>(false)
  const [step,    setStep]    = useState<string>(STEPS[0])

  const stepIndex   = useRef(0)
  const stepTimer   = useRef<ReturnType<typeof setInterval> | null>(null)

  const startStepProgress = () => {
    if (stepTimer.current) clearInterval(stepTimer.current)
    stepIndex.current = 0
    setStep(STEPS[0])
    // Advance the visible step every ~2s while waiting for the server.
    // This is a UX-only progress hint — the server doesn't stream actual progress.
    stepTimer.current = setInterval(() => {
      stepIndex.current = Math.min(stepIndex.current + 1, STEPS.length - 1)
      setStep(STEPS[stepIndex.current])
    }, 2000)
  }
  const stopStepProgress = () => {
    if (stepTimer.current) { clearInterval(stepTimer.current); stepTimer.current = null }
  }

  const loadLIQ = (force: boolean) => {
    setLoading(true)
    setError(null)
    setData(null)
    startStepProgress()

    const url    = force ? `/api/v1/liq/${ticker}/refresh` : `/api/v1/liq/${ticker}`
    const opts   = force ? { method: 'POST' } : undefined

    fetch(url, opts)
      .then(async (r) => {
        const body = await r.json().catch(() => ({ error: 'Bad JSON from API' }))
        if (!r.ok || body?.error || !body?.data) {
          setError(body?.error || `HTTP ${r.status}`)
        } else {
          setData(body.data as LIQData)
          setCached(!!body.cached)
          setStale(!!body.stale)
        }
      })
      .catch((e) => setError((e as Error)?.message || 'Failed to compute LIQ data'))
      .finally(() => {
        stopStepProgress()
        setLoading(false)
      })
  }

  useEffect(() => {
    if (!ticker) return
    loadLIQ(false)
    return stopStepProgress
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker])

  if (!ticker) {
    return (
      <div style={{ padding: '24px', fontFamily: 'JetBrains Mono, monospace', color: 'var(--battu-muted)' }}>
        Type a ticker: <span style={{ color: 'var(--battu-accent)' }}>LIQ BIIB</span>
      </div>
    )
  }
  if (loading) return <LIQComputing ticker={ticker} step={step} />
  if (error || !data) return <LIQError ticker={ticker} message={error ?? 'No data returned'} />

  return (
    <div
      className="flex flex-col h-full overflow-auto"
      style={{ background: 'var(--battu-screen-bg)', fontFamily: 'JetBrains Mono, monospace' }}
    >
      <LIQHeader
        ticker={ticker}
        data={data}
        cached={cached}
        stale={stale}
        onRefresh={() => loadLIQ(true)}
      />
      <LIQCashSection    data={data} />
      <LIQShelfSection   data={data} />
      <LIQCreditSection  data={data} />
      <LIQSources        data={data} />
    </div>
  )
}
