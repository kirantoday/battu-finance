// Benzinga News API client.
// Reference: https://docs.benzinga.com/benzinga-apis/newsfeed-v2/get-news

export interface BenzingaNewsItem {
  id: string
  author: string
  created: string
  updated: string
  headline: string
  teaser: string
  body: string
  url: string
  stocks: { name: string; ticker?: string }[]
  categories: string
  tags: string[]
}

export interface BenzingaNewsParams {
  tickers?: string
  pageSize?: number
  page?: number
  dateFrom?: string
  dateTo?: string
  categories?: string
}

export class BenzingaClient {
  constructor(private apiKey: string, private baseUrl: string) {}

  async getNews(params: BenzingaNewsParams = {}): Promise<BenzingaNewsItem[]> {
    const url = new URL(this.baseUrl + '/news')
    url.searchParams.set('token', this.apiKey)
    url.searchParams.set('displayOutput', 'full')

    if (params.tickers)    url.searchParams.set('tickers', params.tickers)
    if (params.pageSize)   url.searchParams.set('pageSize', String(params.pageSize))
    if (params.page)       url.searchParams.set('page', String(params.page))
    if (params.dateFrom)   url.searchParams.set('dateFrom', params.dateFrom)
    if (params.dateTo)     url.searchParams.set('dateTo', params.dateTo)
    if (params.categories) url.searchParams.set('channels', params.categories)

    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) {
      throw new Error(`Benzinga /news failed: ${res.status} ${res.statusText}`)
    }
    return res.json() as Promise<BenzingaNewsItem[]>
  }
}
