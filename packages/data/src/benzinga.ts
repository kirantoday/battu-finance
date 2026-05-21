// Benzinga (api.benzinga.com) — production news provider.
// Reference: https://docs.benzinga.com/benzinga-apis/newsfeed-v2/get-news
//
// Paid tier ($99/mo at benzinga.com/apis):
//   - Real-time, financial-specific feed
//   - Native ticker tagging on every article
//   - Earnings + analyst rating alerts faster than the wires in many cases

import type { NewsProvider, NewsArticle } from '@battu/shared'

const BASE_URL = 'https://api.benzinga.com/api/v2'

export interface BenzingaNewsItem {
  id:        number | string
  author:    string | null
  created:   string         // ISO datetime
  updated:   string         // ISO datetime
  title:     string
  teaser:    string | null
  body:      string | null
  url:       string
  image?:    Array<{ size?: string; url: string }> | null
  channels?: Array<{ name: string }> | null
  stocks?:   Array<{ name: string }> | null
  tags?:     Array<{ name: string }> | null
}

function mapCategory(channels: BenzingaNewsItem['channels']): NewsArticle['category'] {
  const names = (channels ?? []).map(c => c.name.toLowerCase())
  if (names.some(n => n === 'earnings'))                            return 'earnings'
  if (names.some(n => n === 'analyst-ratings' || n === 'analyst ratings')) return 'analyst'
  if (names.some(n => n === 'ma' || n.includes('m&a')))             return 'ma'
  if (names.some(n => /\b(macro|economy|fed)\b/.test(n)))           return 'macro'
  return 'general'
}

function mapArticle(item: BenzingaNewsItem): NewsArticle {
  const tickers = (item.stocks ?? []).map(s => s.name.toUpperCase())
  return {
    id:          'bz_' + String(item.id),
    publishedAt: item.created,
    headline:    item.title,
    summary:     item.teaser ?? null,
    url:         item.url,
    source:      'Benzinga',
    author:      item.author,
    tickers,
    category:    mapCategory(item.channels),
  }
}

export class BenzingaClient implements NewsProvider {
  readonly providerName = 'benzinga' as const

  constructor(private apiKey: string) {}

  private async getNews(params: Record<string, string | number>): Promise<BenzingaNewsItem[]> {
    if (!this.apiKey) {
      console.warn('[benzinga] Benzinga provider selected but BENZINGA_API_KEY not set — returning empty news')
      return []
    }
    const url = new URL(BASE_URL + '/news')
    url.searchParams.set('token',  this.apiKey)
    url.searchParams.set('displayOutput', 'full')
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v))

    try {
      const res = await fetch(url.toString(), {
        headers: { Accept: 'application/json' },
      })
      if (res.status === 429) {
        console.warn('[benzinga] rate-limited (429) — returning empty results')
        return []
      }
      if (!res.ok) {
        console.warn(`[benzinga] HTTP ${res.status} on /news — returning empty results`)
        return []
      }
      const body = (await res.json()) as BenzingaNewsItem[] | { error?: string }
      if (Array.isArray(body)) return body
      console.warn(`[benzinga] unexpected response shape — returning empty results`)
      return []
    } catch (e) {
      console.warn(`[benzinga] fetch error: ${(e as Error).message} — returning empty results`)
      return []
    }
  }

  async getTickerNews(ticker: string, options?: { limit?: number; from?: string }): Promise<NewsArticle[]> {
    const params: Record<string, string | number> = {
      tickers:  ticker.toUpperCase(),
      pageSize: options?.limit ?? 20,
    }
    if (options?.from) params.dateFrom = options.from
    const items = await this.getNews(params)
    return items.map(mapArticle)
  }

  async getTopHeadlines(options?: { limit?: number }): Promise<NewsArticle[]> {
    const items = await this.getNews({ pageSize: options?.limit ?? 20 })
    return items.map(mapArticle)
  }

  async search(query: string, options?: { limit?: number; from?: string }): Promise<NewsArticle[]> {
    const params: Record<string, string | number> = {
      q:        query,
      pageSize: options?.limit ?? 20,
    }
    if (options?.from) params.dateFrom = options.from
    const items = await this.getNews(params)
    return items.map(mapArticle)
  }
}
