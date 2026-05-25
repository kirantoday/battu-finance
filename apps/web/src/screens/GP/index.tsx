import { useEffect, useState } from 'react'
import { useTerminal } from '@/store/terminal'
import type { OHLCVBar, MarketQuote } from '@battu/shared'
import { GPChart }    from './GPChart'
import { GPControls } from './GPControls'
import { GPHeader }   from './GPHeader'
import { GPFooter }   from './GPFooter'
import { GPLoading }  from './GPLoading'
import { GPError }    from './GPError'

type ChartType = 'candle' | 'line'

export function GPScreen() {
  const currentParams = useTerminal((s) => s.currentParams)
  const activeTicker  = useTerminal((s) => s.activeTicker)

  const ticker = (currentParams.ticker || activeTicker || '').toUpperCase()
  const tfFromParams = currentParams.timeframe

  const [timeframe,  setTimeframe]  = useState<string>(tfFromParams || '3M')
  const [chartType,  setChartType]  = useState<ChartType>('candle')
  const [bars,       setBars]       = useState<OHLCVBar[]>([])
  const [quote,      setQuote]      = useState<MarketQuote | null>(null)
  const [loading,    setLoading]    = useState<boolean>(false)
  const [error,      setError]      = useState<string | null>(null)
  const [hoveredBar, setHoveredBar] = useState<OHLCVBar | null>(null)

  // Sync local timeframe when the URL/store changes (e.g. user types "GP AAPL 1Y")
  useEffect(() => {
    if (tfFromParams && tfFromParams !== timeframe) {
      setTimeframe(tfFromParams)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tfFromParams])

  // Fetch bars + quote when ticker or timeframe changes
  useEffect(() => {
    if (!ticker) return
    let aborted = false

    setLoading(true)
    setError(null)
    setHoveredBar(null)

    Promise.all([
      fetch(`/api/v1/market/bars/${encodeURIComponent(ticker)}?timeframe=${timeframe}`).then(r => r.json()),
      fetch(`/api/v1/market/price/${encodeURIComponent(ticker)}`).then(r => r.json()),
    ])
      .then(([barsRes, quoteRes]) => {
        if (aborted) return
        if (barsRes?.error || !Array.isArray(barsRes?.data) || barsRes.data.length === 0) {
          setError(barsRes?.error || 'No chart data available')
        } else {
          setBars(barsRes.data as OHLCVBar[])
        }
        if (quoteRes?.data) {
          setQuote(quoteRes.data as MarketQuote)
        }
      })
      .catch((e) => {
        if (!aborted) setError(e?.message || 'Failed to load chart data')
      })
      .finally(() => {
        if (!aborted) setLoading(false)
      })

    return () => { aborted = true }
  }, [ticker, timeframe])

  if (!ticker) {
    return (
      <div style={{ padding: '24px', fontFamily: 'JetBrains Mono, monospace', color: 'var(--battu-muted)' }}>
        Type a ticker: <span style={{ color: 'var(--battu-accent)' }}>GP AAPL</span>
      </div>
    )
  }
  if (loading) return <GPLoading ticker={ticker} timeframe={timeframe} />
  if (error)   return <GPError   ticker={ticker} message={error} />

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: 'var(--battu-screen-bg)', fontFamily: 'JetBrains Mono, monospace' }}
    >
      <GPHeader ticker={ticker} quote={quote} timeframe={timeframe} />
      <GPControls
        timeframe={timeframe}
        chartType={chartType}
        onTimeframeChange={setTimeframe}
        onChartTypeChange={setChartType}
      />
      <div className="flex-1" style={{ minHeight: 0 }}>
        <GPChart
          bars={bars}
          chartType={chartType}
          ticker={ticker}
          onBarHover={setHoveredBar}
        />
      </div>
      <GPFooter bar={hoveredBar ?? bars[bars.length - 1] ?? null} />
    </div>
  )
}
