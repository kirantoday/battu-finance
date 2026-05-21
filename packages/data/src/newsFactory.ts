import { NewsApiClient }  from './newsapi'
import { BenzingaClient } from './benzinga'
import type { NewsProvider, NewsProviderName } from '@battu/shared'

/**
 * Single switch point for the news provider. Change `NEWS_PROVIDER` in
 * `.env.local` to swap implementations — no code changes needed.
 */
export function createNewsProvider(): NewsProvider {
  const provider = (process.env.NEWS_PROVIDER || 'newsapi') as NewsProviderName

  switch (provider) {
    case 'benzinga':
      console.log('[news] Provider: Benzinga (production)')
      return new BenzingaClient(process.env.BENZINGA_API_KEY || '')

    case 'newsapi':
    default:
      console.log('[news] Provider: NewsAPI (development)')
      return new NewsApiClient(process.env.NEWSAPI_KEY || '')
  }
}

// Singleton — created once at module load, reused across all requests
export const newsProvider: NewsProvider = createNewsProvider()
