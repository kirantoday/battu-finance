import { FMPClient } from './fmp'

/** Singleton FMP client — instantiated lazily from env at first import. */
export const fmpClient = new FMPClient(
  process.env.FMP_API_KEY || 'demo',
  'https://financialmodelingprep.com/stable',
)

export { PolygonClient } from './polygon'
export type { PolygonBar, PolygonSnapshot, AggsOptions } from './polygon'
export { FMPClient } from './fmp'
export type {
  FMPProfile, FMPIncomeStatement, FMPBalanceSheet, FMPCashFlow,
  FMPRatios, FMPRatiosTTM, FMPKeyMetricsTTM, FMPEstimates, FMPGrade, FMPPriceTarget,
  FMPScreenerParams, FMPScreenerResult, FMPEarningsEvent, FMPDividend,
} from './fmp'
export { NewsApiClient } from './newsapi'
export { BenzingaClient } from './benzinga'
export type { BenzingaNewsItem } from './benzinga'
export { createNewsProvider, newsProvider } from './newsFactory'
export { YahooFinanceClient } from './yahoo'
export { MassiveClient } from './massive'
export { createMarketProvider, marketProvider } from './marketFactory'
export { getDataConfig } from './config'
