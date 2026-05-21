import { YahooFinanceClient } from './yahoo'
import { MassiveClient }      from './massive'
import type { MarketProvider, MarketProviderName } from '@battu/shared'

/**
 * Single switch point for the market data provider. Flip MARKET_PROVIDER
 * in `.env.local` to swap implementations — no code changes needed.
 */
export function createMarketProvider(): MarketProvider {
  const provider = (process.env.MARKET_PROVIDER || 'yahoo') as MarketProviderName

  switch (provider) {
    case 'massive':
      console.log('[market] Provider: Massive/Polygon (production)')
      return new MassiveClient(process.env.POLYGON_API_KEY || '')

    case 'yahoo':
    default:
      console.log('[market] Provider: Yahoo Finance (development)')
      return new YahooFinanceClient()
  }
}

// Singleton — created once at module load, reused across all requests
export const marketProvider: MarketProvider = createMarketProvider()
