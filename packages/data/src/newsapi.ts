// NewsAPI (newsapi.org) — development news provider.
// Reference: https://newsapi.org/docs/endpoints
//
// Free tier limits:
//   - 100 requests / day
//   - CORS-blocked in browsers → must run server-side only
//   - Articles delayed ~15 minutes
//
// Never expose this client to the frontend. All calls go through the Hono API.

import type { NewsProvider, NewsArticle } from '@battu/shared'

interface NewsApiArticle {
  source:      { id: string | null; name: string }
  author:      string | null
  title:       string
  description: string | null
  url:         string
  urlToImage:  string | null
  publishedAt: string
  content:     string | null
}

interface NewsApiResponse {
  status:       'ok' | 'error'
  totalResults?: number
  articles?:    NewsApiArticle[]
  code?:        string
  message?:     string
}

const BASE_URL = 'https://newsapi.org/v2'

/** Cheap deterministic id from a URL (avoids picking up extra deps). */
function hashUrl(url: string): string {
  let h = 0
  for (let i = 0; i < url.length; i++) {
    h = (h * 31 + url.charCodeAt(i)) | 0
  }
  return 'na_' + (h >>> 0).toString(36)
}

function detectCategory(headline: string): NewsArticle['category'] {
  const h = headline.toLowerCase()
  // earnings cues — quarterly reports, prints, surprises, guidance
  if (/\b(eps|earnings|revenue|beat|miss|guidance|q[1-4]|quarterly)\b/.test(h)) return 'earnings'
  // analyst cues — rating changes, target moves, coverage initiations
  if (/\b(upgrade|downgrade|price target|initiated|outperform|overweight|underweight|reiterates?)\b/.test(h)) return 'analyst'
  // M&A cues — deals, takeovers, acquisitions
  if (/\b(merger|acquisition|takeover|deal|buyout|acquired|acquires|to acquire)\b/.test(h)) return 'ma'
  // macro cues — central banks, inflation prints, jobs reports
  if (/\b(fed|federal reserve|cpi|gdp|inflation|payrolls|interest rate|rate hike|rate cut)\b/.test(h)) return 'macro'
  return 'general'
}

function mapArticle(a: NewsApiArticle, tickers: string[]): NewsArticle {
  return {
    id:          hashUrl(a.url),
    publishedAt: a.publishedAt,
    headline:    a.title,
    summary:     a.description,
    url:         a.url,
    source:      a.source?.name ?? 'NewsAPI',
    author:      a.author,
    tickers,
    category:    detectCategory(a.title),
  }
}

export class NewsApiClient implements NewsProvider {
  readonly providerName = 'newsapi' as const

  constructor(private apiKey: string) {}

  private async get(path: string, params: Record<string, string | number>): Promise<NewsApiResponse | null> {
    if (!this.apiKey) {
      console.warn('[newsapi] NEWSAPI_KEY not set — returning empty results')
      return null
    }
    const url = new URL(BASE_URL + path)
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v))
    try {
      const res = await fetch(url.toString(), {
        headers: { 'X-Api-Key': this.apiKey },
      })
      if (res.status === 429) {
        console.warn('[newsapi] rate-limited (429) — returning empty results')
        return null
      }
      if (!res.ok) {
        console.warn(`[newsapi] HTTP ${res.status} on ${path} — returning empty results`)
        return null
      }
      const body = (await res.json()) as NewsApiResponse
      if (body.status === 'error') {
        console.warn(`[newsapi] error ${body.code}: ${body.message} — returning empty results`)
        return null
      }
      return body
    } catch (e) {
      console.warn(`[newsapi] fetch error: ${(e as Error).message} — returning empty results`)
      return null
    }
  }

  async getTickerNews(ticker: string, options?: { limit?: number; from?: string }): Promise<NewsArticle[]> {
    const params: Record<string, string | number> = {
      q:        ticker.toUpperCase(),
      language: 'en',
      sortBy:   'publishedAt',
      pageSize: options?.limit ?? 20,
    }
    if (options?.from) params.from = options.from
    const body = await this.get('/everything', params)
    if (!body?.articles) return []
    return body.articles.map(a => mapArticle(a, [ticker.toUpperCase()]))
  }

  async getTopHeadlines(options?: { limit?: number }): Promise<NewsArticle[]> {
    const body = await this.get('/top-headlines', {
      category: 'business',
      language: 'en',
      pageSize: options?.limit ?? 20,
    })
    if (!body?.articles) return []
    return body.articles.map(a => mapArticle(a, []))
  }

  async search(query: string, options?: { limit?: number; from?: string }): Promise<NewsArticle[]> {
    const params: Record<string, string | number> = {
      q:        query,
      language: 'en',
      sortBy:   'relevancy',
      pageSize: options?.limit ?? 20,
    }
    if (options?.from) params.from = options.from
    const body = await this.get('/everything', params)
    if (!body?.articles) return []
    return body.articles.map(a => mapArticle(a, []))
  }
}
