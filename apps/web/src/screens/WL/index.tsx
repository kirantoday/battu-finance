import { useEffect, useState, useCallback, useRef } from 'react'
import { useTerminal } from '@/store/terminal'
import type { MarketQuote } from '@battu/shared'
import { WLHeader }    from './WLHeader'
import { WLTable }     from './WLTable'
import { WLAddTicker } from './WLAddTicker'
import { WLLoading }   from './WLLoading'
import { WLError }     from './WLError'

interface Watchlist {
  id:      string
  name:    string
  tickers: string[]
}

const POLL_INTERVAL_MS = 10_000

export function WLScreen() {
  const navigate      = useTerminal((s) => s.navigate)
  const pushToHistory = useTerminal((s) => s.pushToHistory)

  const [watchlist,  setWatchlist]  = useState<Watchlist | null>(null)
  const [quotes,     setQuotes]     = useState<MarketQuote[]>([])
  const [loading,    setLoading]    = useState<boolean>(true)
  const [error,      setError]      = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [flashing,   setFlashing]   = useState<Record<string, 'up' | 'down' | null>>({})

  // Refs that should not trigger re-renders
  const prevPrices = useRef<Record<string, number>>({})
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Fetch the watchlist row (auto-creates default if user has none)
  const loadWatchlist = useCallback(async (): Promise<Watchlist | null> => {
    try {
      const res  = await fetch('/api/v1/user/watchlist')
      const json = await res.json()
      if (json?.data?.[0]) {
        setWatchlist(json.data[0])
        return json.data[0] as Watchlist
      }
      setError(json?.error || 'No watchlist returned')
    } catch (e) {
      setError((e as Error)?.message || 'Failed to load watchlist')
    }
    return null
  }, [])

  // ── Fetch quotes + diff against previous prices to drive flash anim
  const fetchQuotes = useCallback(async (tickers: string[]) => {
    if (tickers.length === 0) {
      setQuotes([])
      return
    }
    try {
      const res  = await fetch(`/api/v1/market/quotes?tickers=${tickers.join(',')}`)
      const json = await res.json()
      const incoming: MarketQuote[] = Array.isArray(json?.data) ? json.data : []

      const newFlashing: Record<string, 'up' | 'down' | null> = {}
      for (const q of incoming) {
        const prev = prevPrices.current[q.ticker]
        if (prev !== undefined && prev !== q.price) {
          newFlashing[q.ticker] = q.price > prev ? 'up' : 'down'
        }
        prevPrices.current[q.ticker] = q.price
      }

      setQuotes(incoming)
      setLastUpdate(new Date())

      if (Object.keys(newFlashing).length > 0) {
        setFlashing(newFlashing)
        if (flashTimer.current) clearTimeout(flashTimer.current)
        flashTimer.current = setTimeout(() => setFlashing({}), 600)
      }
    } catch (e) {
      console.error('[WL] fetchQuotes error:', e)
    }
  }, [])

  // ── Initial load
  useEffect(() => {
    let aborted = false
    setLoading(true)
    setError(null)

    loadWatchlist().then((wl) => {
      if (aborted) return
      if (wl?.tickers?.length) {
        fetchQuotes(wl.tickers).finally(() => { if (!aborted) setLoading(false) })
      } else {
        setLoading(false)
      }
    })

    return () => { aborted = true }
  }, [loadWatchlist, fetchQuotes])

  // ── Poll every 10s whenever the ticker set changes
  // Key on the joined string so the effect resets when add/remove changes the list.
  const tickerKey = watchlist?.tickers.join(',') ?? ''
  useEffect(() => {
    if (!watchlist?.tickers?.length) return
    const id = setInterval(() => { void fetchQuotes(watchlist.tickers) }, POLL_INTERVAL_MS)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickerKey, fetchQuotes])

  // ── Cleanup pending flash timer on unmount
  useEffect(() => () => {
    if (flashTimer.current) clearTimeout(flashTimer.current)
  }, [])

  // ── Add / remove ticker handlers
  const addTicker = async (ticker: string) => {
    if (!watchlist) return
    try {
      const res  = await fetch(`/api/v1/user/watchlist/${watchlist.id}/tickers`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ticker }),
      })
      const json = await res.json()
      if (json?.data) {
        setWatchlist(json.data)
        void fetchQuotes(json.data.tickers)
      }
    } catch (e) {
      console.error('[WL] addTicker error:', e)
    }
  }

  const removeTicker = async (ticker: string) => {
    if (!watchlist) return
    try {
      const res  = await fetch(`/api/v1/user/watchlist/${watchlist.id}/tickers/${encodeURIComponent(ticker)}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (json?.data) {
        setWatchlist(json.data)
        setQuotes((prev) => prev.filter((q) => q.ticker !== ticker))
        delete prevPrices.current[ticker]
      }
    } catch (e) {
      console.error('[WL] removeTicker error:', e)
    }
  }

  const onTickerClick = (ticker: string) => {
    pushToHistory(`DES ${ticker}`)
    navigate({ screen: 'DES', ticker, raw: `DES ${ticker}` })
  }

  if (loading) return <WLLoading />
  if (error)   return <WLError message={error} />

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ background: 'var(--battu-screen-bg)', fontFamily: 'JetBrains Mono, monospace' }}
    >
      <WLHeader
        watchlistName={watchlist?.name || 'My Watchlist'}
        lastUpdate={lastUpdate}
        onRefresh={() => watchlist && void fetchQuotes(watchlist.tickers)}
      />
      <WLAddTicker onAdd={addTicker} />
      <WLTable
        quotes={quotes}
        flashing={flashing}
        onTickerClick={onTickerClick}
        onRemove={removeTicker}
      />
    </div>
  )
}
