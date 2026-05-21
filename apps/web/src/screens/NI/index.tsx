import { useEffect, useState, useCallback } from 'react'
import { useTerminal } from '@/store/terminal'
import type { NewsArticle } from '@battu/shared'
import { NIHeader }      from './NIHeader'
import { NIFilters, type CategoryFilter } from './NIFilters'
import { NIArticleList } from './NIArticleList'
import { NILoading }     from './NILoading'
import { NIError }       from './NIError'

interface NewsResponse {
  data?:     NewsArticle[]
  error?:    string | null
  provider?: string
  cached?:   boolean
  count?:    number
}

export function NIScreen() {
  const currentScreen = useTerminal((s) => s.currentScreen)
  const currentParams = useTerminal((s) => s.currentParams)
  const activeTicker  = useTerminal((s) => s.activeTicker)

  const ticker = (currentParams.ticker || activeTicker || '').toUpperCase()
  // N and TOP commands → market-wide headlines; everything else (NI, CN) → ticker-specific.
  // If no ticker is set for NI/CN we also fall back to headlines.
  const isHeadlines = currentScreen === 'N' || currentScreen === 'TOP' || !ticker

  const [articles,  setArticles]  = useState<NewsArticle[]>([])
  const [filtered,  setFiltered]  = useState<NewsArticle[]>([])
  const [category,  setCategory]  = useState<CategoryFilter>('all')
  const [loading,   setLoading]   = useState<boolean>(false)
  const [error,     setError]     = useState<string | null>(null)
  const [provider,  setProvider]  = useState<string>('')
  const [cached,    setCached]    = useState<boolean>(false)
  const [lastFetch, setLastFetch] = useState<Date | null>(null)

  const fetchNews = useCallback(async () => {
    setLoading(true)
    setError(null)

    const primaryUrl = isHeadlines
      ? '/api/v1/news/headlines/top?limit=30'
      : `/api/v1/news/${ticker}?limit=30`

    try {
      const res = await fetch(primaryUrl)
      const body = await res.json() as NewsResponse

      let finalArticles = body.data ?? []
      let finalProvider = body.provider ?? ''
      let finalCached   = !!body.cached

      // NewsAPI ticker-symbol search often returns nothing — fall back to a
      // company-keyword search using the ticker as the query.
      if (!isHeadlines && finalArticles.length === 0 && !body.error) {
        const fb = await fetch(`/api/v1/news/search?q=${encodeURIComponent(ticker)}&limit=20`)
        const fbBody = await fb.json() as NewsResponse
        finalArticles = fbBody.data ?? []
        finalProvider = fbBody.provider ?? finalProvider
        finalCached   = !!fbBody.cached
      }

      if (body.error && finalArticles.length === 0) {
        setError(body.error)
        setArticles([])
        return
      }

      setArticles(finalArticles)
      setProvider(finalProvider)
      setCached(finalCached)
      setLastFetch(new Date())
    } catch (e) {
      setError((e as Error)?.message || 'Failed to load news')
      setArticles([])
    } finally {
      setLoading(false)
    }
  }, [ticker, isHeadlines])

  useEffect(() => { fetchNews() }, [fetchNews])

  useEffect(() => {
    if (category === 'all') setFiltered(articles)
    else setFiltered(articles.filter(a => a.category === category))
  }, [articles, category])

  const title = isHeadlines ? 'MARKET HEADLINES' : `${ticker} — NEWS FEED`

  if (loading) return <NILoading title={title} />
  if (error && articles.length === 0) return <NIError title={title} message={error} />

  const counts: Record<CategoryFilter, number> = {
    all:      articles.length,
    earnings: articles.filter(a => a.category === 'earnings').length,
    analyst:  articles.filter(a => a.category === 'analyst').length,
    ma:       articles.filter(a => a.category === 'ma').length,
    macro:    articles.filter(a => a.category === 'macro').length,
    general:  articles.filter(a => a.category === 'general').length,
  }

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ background: 'var(--battu-screen-bg)', fontFamily: 'JetBrains Mono, monospace' }}
    >
      <NIHeader
        title={title}
        count={filtered.length}
        provider={provider}
        lastFetch={lastFetch}
        cached={cached}
        onRefresh={fetchNews}
      />
      <NIFilters
        category={category}
        onCategoryChange={setCategory}
        counts={counts}
      />
      <NIArticleList articles={filtered} />
    </div>
  )
}
