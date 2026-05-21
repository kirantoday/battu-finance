import type { NewsProviderName } from '@battu/shared'

/** Centralized config + soft-warning validator. */
export function getDataConfig() {
  const newsProvider = (process.env.NEWS_PROVIDER || 'newsapi') as NewsProviderName

  if (newsProvider === 'benzinga' && !process.env.BENZINGA_API_KEY) {
    console.warn('[config] NEWS_PROVIDER=benzinga but BENZINGA_API_KEY not set')
  }
  if (newsProvider === 'newsapi' && !process.env.NEWSAPI_KEY) {
    console.warn('[config] NEWS_PROVIDER=newsapi but NEWSAPI_KEY not set')
  }

  return {
    polygon:      { apiKey: process.env.POLYGON_API_KEY || '' },
    fmp:          { apiKey: process.env.FMP_API_KEY || 'demo', baseUrl: 'https://financialmodelingprep.com/stable' },
    newsProvider,
    edgar:        { baseUrl: 'https://data.sec.gov', eftsUrl: 'https://efts.sec.gov' },
  }
}
