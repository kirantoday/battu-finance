// Financial Modeling Prep API client.
// Reference: https://site.financialmodelingprep.com/developer/docs

export interface FMPProfile {
  symbol: string
  price: number
  beta: number
  // Stable API field names
  marketCap?: number
  averageVolume?: number
  lastDividend?: number
  change?: number
  changePercentage?: number
  exchangeFullName?: string
  // Legacy v3 field names (kept optional for safety if anyone points back at v3)
  mktCap?: number
  volAvg?: number
  lastDiv?: number
  changes?: number
  exchangeShortName?: string

  range: string
  companyName: string
  currency: string
  cik: string
  isin: string
  cusip: string
  exchange: string
  industry: string
  website: string
  description: string
  ceo: string
  sector: string
  country: string
  fullTimeEmployees: string
  // Stable API also surfaces these snapshot fields
  pe?: number
  eps?: number
  sharesOutstanding?: number
  phone: string
  address: string
  city: string
  state: string
  zip: string
  dcfDiff: number
  dcf: number
  image: string
  ipoDate: string
  defaultImage: boolean
  isEtf: boolean
  isActivelyTrading: boolean
  isAdr: boolean
  isFund: boolean
}

export interface FMPIncomeStatement {
  date: string
  symbol: string
  reportedCurrency: string
  cik: string
  fillingDate: string
  acceptedDate: string
  calendarYear: string
  period: string
  revenue: number
  costOfRevenue: number
  grossProfit: number
  grossProfitRatio: number
  researchAndDevelopmentExpenses: number
  generalAndAdministrativeExpenses: number
  sellingAndMarketingExpenses: number
  sellingGeneralAndAdministrativeExpenses: number
  otherExpenses: number
  operatingExpenses: number
  costAndExpenses: number
  interestIncome: number
  interestExpense: number
  depreciationAndAmortization: number
  ebitda: number
  ebitdaratio: number
  operatingIncome: number
  operatingIncomeRatio: number
  totalOtherIncomeExpensesNet: number
  incomeBeforeTax: number
  incomeBeforeTaxRatio: number
  incomeTaxExpense: number
  netIncome: number
  netIncomeRatio: number
  eps: number
  epsdiluted: number     // v3 spelling
  epsDiluted?: number    // stable spelling (camelCase)
  weightedAverageShsOut: number
  weightedAverageShsOutDil: number
  link: string
  finalLink: string
}

export interface FMPBalanceSheet {
  date: string
  symbol: string
  reportedCurrency: string
  cik: string
  fillingDate: string
  acceptedDate: string
  calendarYear: string
  period: string
  cashAndCashEquivalents: number
  shortTermInvestments: number
  cashAndShortTermInvestments: number
  netReceivables: number
  inventory: number
  otherCurrentAssets: number
  totalCurrentAssets: number
  propertyPlantEquipmentNet: number
  goodwill: number
  intangibleAssets: number
  goodwillAndIntangibleAssets: number
  longTermInvestments: number
  taxAssets: number
  otherNonCurrentAssets: number
  totalNonCurrentAssets: number
  otherAssets: number
  totalAssets: number
  accountPayables: number
  shortTermDebt: number
  taxPayables: number
  deferredRevenue: number
  otherCurrentLiabilities: number
  totalCurrentLiabilities: number
  longTermDebt: number
  deferredRevenueNonCurrent: number
  deferredTaxLiabilitiesNonCurrent: number
  otherNonCurrentLiabilities: number
  totalNonCurrentLiabilities: number
  otherLiabilities: number
  capitalLeaseObligations: number
  totalLiabilities: number
  preferredStock: number
  commonStock: number
  retainedEarnings: number
  accumulatedOtherComprehensiveIncomeLoss: number
  othertotalStockholdersEquity: number
  totalStockholdersEquity: number
  totalEquity: number
  totalLiabilitiesAndStockholdersEquity: number
  minorityInterest: number
  totalLiabilitiesAndTotalEquity: number
  totalInvestments: number
  totalDebt: number
  netDebt: number
  link: string
  finalLink: string
}

export interface FMPCashFlow {
  date: string
  symbol: string
  reportedCurrency: string
  cik: string
  fillingDate: string
  acceptedDate: string
  calendarYear: string
  period: string
  netIncome: number
  depreciationAndAmortization: number
  deferredIncomeTax: number
  stockBasedCompensation: number
  changeInWorkingCapital: number
  accountsReceivables: number
  inventory: number
  accountsPayables: number
  otherWorkingCapital: number
  otherNonCashItems: number
  netCashProvidedByOperatingActivities: number
  investmentsInPropertyPlantAndEquipment: number
  acquisitionsNet: number
  purchasesOfInvestments: number
  salesMaturitiesOfInvestments: number
  otherInvestingActivites: number
  netCashUsedForInvestingActivites: number
  debtRepayment: number
  commonStockIssued: number
  commonStockRepurchased: number
  dividendsPaid: number             // v3 — sum of all dividend types
  commonDividendsPaid?: number      // stable — common stock dividends (typically negative)
  netDividendsPaid?: number         // stable — common + preferred
  preferredDividendsPaid?: number   // stable — preferred only
  otherFinancingActivites: number
  netCashUsedProvidedByFinancingActivities: number
  effectOfForexChangesOnCash: number
  netChangeInCash: number
  cashAtEndOfPeriod: number
  cashAtBeginningOfPeriod: number
  operatingCashFlow: number
  capitalExpenditure: number
  freeCashFlow: number
  link: string
  finalLink: string
}

export interface FMPRatios {
  symbol: string
  date: string
  calendarYear: string
  period: string
  currentRatio: number
  quickRatio: number
  cashRatio: number
  daysOfSalesOutstanding: number
  daysOfInventoryOutstanding: number
  operatingCycle: number
  daysOfPayablesOutstanding: number
  cashConversionCycle: number
  grossProfitMargin: number
  operatingProfitMargin: number
  pretaxProfitMargin: number
  netProfitMargin: number
  effectiveTaxRate: number
  returnOnAssets: number
  returnOnEquity: number
  returnOnCapitalEmployed: number
  ebitPerRevenue: number
  debtRatio: number
  debtEquityRatio: number
  longTermDebtToCapitalization: number
  totalDebtToCapitalization: number
  interestCoverage: number
  cashFlowToDebtRatio: number
  companyEquityMultiplier: number
  receivablesTurnover: number
  payablesTurnover: number
  inventoryTurnover: number
  fixedAssetTurnover: number
  assetTurnover: number
  operatingCashFlowPerShare: number
  freeCashFlowPerShare: number
  cashPerShare: number
  payoutRatio: number
  priceToBookRatio: number
  priceToSalesRatio: number
  priceEarningsRatio: number
  priceToFreeCashFlowsRatio: number
  priceToOperatingCashFlowsRatio: number
  priceCashFlowRatio: number
  priceEarningsToGrowthRatio: number
  priceSalesRatio: number
  dividendYield: number
  enterpriseValueMultiple: number
  priceFairValue: number
}

export interface FMPEstimates {
  symbol: string
  date: string
  // Stable API names
  revenueLow?:      number
  revenueHigh?:     number
  revenueAvg?:      number
  ebitdaLow?:       number
  ebitdaHigh?:      number
  ebitdaAvg?:       number
  ebitLow?:         number
  ebitHigh?:        number
  ebitAvg?:         number
  netIncomeLow?:    number
  netIncomeHigh?:   number
  netIncomeAvg?:    number
  sgaExpenseLow?:   number
  sgaExpenseHigh?:  number
  sgaExpenseAvg?:   number
  epsAvg?:          number
  epsHigh?:         number
  epsLow?:          number
  // Legacy v3 names (fallbacks)
  estimatedRevenueLow?:    number
  estimatedRevenueHigh?:   number
  estimatedRevenueAvg?:    number
  estimatedEbitdaAvg?:     number
  estimatedNetIncomeAvg?:  number
  estimatedEpsAvg?:        number
  estimatedEpsHigh?:       number
  estimatedEpsLow?:        number
  numberAnalystEstimatedRevenue?: number
  numberAnalystsEstimatedEps?:    number
}

export interface FMPGrade {
  symbol: string
  date: string
  gradingCompany: string
  previousGrade: string
  newGrade: string
}

export interface FMPPriceTarget {
  symbol: string
  targetHigh: number
  targetLow: number
  targetConsensus: number
  targetMedian: number
}

export interface FMPScreenerParams {
  marketCapMoreThan?: number
  marketCapLowerThan?: number
  sector?: string
  industry?: string
  country?: string
  exchange?: string
  priceMoreThan?: number
  priceLowerThan?: number
  betaMoreThan?: number
  betaLowerThan?: number
  volumeMoreThan?: number
  volumeLowerThan?: number
  dividendMoreThan?: number
  dividendLowerThan?: number
  isEtf?: boolean
  isFund?: boolean
  isActivelyTrading?: boolean
  limit?: number
}

export interface FMPScreenerResult {
  symbol: string
  companyName: string
  marketCap: number
  sector: string
  industry: string
  beta: number
  price: number
  lastAnnualDividend: number
  volume: number
  exchange: string
  exchangeShortName: string
  country: string
  isEtf: boolean
  isFund: boolean
  isActivelyTrading: boolean
}

export interface FMPEarningsEvent {
  date: string
  symbol: string
  eps: number | null
  epsEstimated: number | null
  time: string
  revenue: number | null
  revenueEstimated: number | null
  fiscalDateEnding: string
  updatedFromDate: string
}

export interface FMPDividend {
  date: string
  label: string
  adjDividend: number
  dividend: number
  recordDate: string
  paymentDate: string
  declarationDate: string
}

export interface FMPRatiosTTM {
  // Stable API names
  priceToEarningsRatioTTM?:           number
  priceToBookRatioTTM?:               number
  priceToSalesRatioTTM?:              number
  dividendYieldTTM?:                  number
  dividendPerShareTTM?:               number
  grossProfitMarginTTM?:              number
  operatingProfitMarginTTM?:          number
  netProfitMarginTTM?:                number
  pretaxProfitMarginTTM?:             number
  ebitdaMarginTTM?:                   number
  ebitMarginTTM?:                     number
  netIncomePerShareTTM?:              number
  enterpriseValueMultipleTTM?:        number
  enterpriseValueTTM?:                number
  // Legacy v3 names (kept as fallbacks)
  peRatioTTM?:                        number
  priceEarningsRatioTTM?:             number
  pegRatioTTM?:                       number
  payoutRatioTTM?:                    number
  currentRatioTTM?:                   number
  quickRatioTTM?:                     number
  cashRatioTTM?:                      number
  returnOnAssetsTTM?:                 number
  returnOnEquityTTM?:                 number
  debtRatioTTM?:                      number
  debtEquityRatioTTM?:                number
  dividendYielTTM?:                   number   // FMP v3 typo
  epsTTM?:                            number
}

export interface FMPKeyMetricsTTM {
  revenuePerShareTTM?:           number
  netIncomePerShareTTM?:         number
  operatingCashFlowPerShareTTM?: number
  freeCashFlowPerShareTTM?:      number
  cashPerShareTTM?:              number
  bookValuePerShareTTM?:         number
  tangibleBookValuePerShareTTM?: number
  shareholdersEquityPerShareTTM?: number
  marketCapTTM?:                 number
  enterpriseValueTTM?:           number
  peRatioTTM?:                   number
  priceToSalesRatioTTM?:         number
  pocfratioTTM?:                 number
  pfcfRatioTTM?:                 number
  pbRatioTTM?:                   number
  ptbRatioTTM?:                  number
  evToSalesTTM?:                 number
  enterpriseValueOverEBITDATTM?: number
  evToOperatingCashFlowTTM?:     number
  evToFreeCashFlowTTM?:          number
  earningsYieldTTM?:             number
  freeCashFlowYieldTTM?:         number
  debtToEquityTTM?:              number
  debtToAssetsTTM?:              number
  netDebtToEBITDATTM?:           number
  currentRatioTTM?:              number
  interestCoverageTTM?:          number
  // FMP exposes EV/EBITDA TTM under multiple field names depending on plan
  evToEbitdaTTM?:                number
  evToEBITDATTM?:                number  // stable API name (capital BITDA)
}

export class FMPClient {
  constructor(private apiKey: string, private baseUrl: string) {}

  private async get<T>(path: string, params: Record<string, string | number | boolean> = {}): Promise<T> {
    const url = new URL(this.baseUrl + path)
    url.searchParams.set('apikey', this.apiKey)
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, String(v))
    }
    const res = await fetch(url.toString())
    if (!res.ok) {
      throw new Error(`FMP ${path} failed: ${res.status} ${res.statusText}`)
    }
    const body = await res.json()
    // FMP returns its "no auth / no plan" errors as HTTP 200 with a JSON
    // envelope { "Error Message": "..." }. Surface that as a real error so
    // Promise.allSettled in callers can treat it as a rejected source.
    if (body && typeof body === 'object' && !Array.isArray(body) && 'Error Message' in body) {
      throw new Error(`FMP ${path}: ${(body as { 'Error Message': string })['Error Message']}`)
    }
    return body as T
  }

  async getProfile(ticker: string): Promise<FMPProfile> {
    const res = await this.get<FMPProfile[]>(`/profile`, { symbol: ticker.toUpperCase() })
    return res?.[0]
  }

  async getIncomeStatement(
    ticker: string,
    period: 'annual' | 'quarter' = 'annual',
    limit = 10
  ): Promise<FMPIncomeStatement[]> {
    return this.get<FMPIncomeStatement[]>(
      `/income-statement`, { symbol: ticker.toUpperCase(), period, limit }
    )
  }

  async getBalanceSheet(
    ticker: string,
    period: 'annual' | 'quarter' = 'annual',
    limit = 10
  ): Promise<FMPBalanceSheet[]> {
    return this.get<FMPBalanceSheet[]>(
      `/balance-sheet-statement`, { symbol: ticker.toUpperCase(), period, limit }
    )
  }

  async getCashFlow(
    ticker: string,
    period: 'annual' | 'quarter' = 'annual',
    limit = 10
  ): Promise<FMPCashFlow[]> {
    return this.get<FMPCashFlow[]>(
      `/cash-flow-statement`, { symbol: ticker.toUpperCase(), period, limit }
    )
  }

  async getRatios(ticker: string): Promise<FMPRatios> {
    const res = await this.get<FMPRatios[]>(`/ratios`, { symbol: ticker.toUpperCase() })
    return res?.[0]
  }

  async getRatiosTTM(ticker: string): Promise<FMPRatiosTTM | null> {
    const res = await this.get<FMPRatiosTTM[]>(`/ratios-ttm`, { symbol: ticker.toUpperCase() })
    return res?.[0] ?? null
  }

  async getKeyMetricsTTM(ticker: string): Promise<FMPKeyMetricsTTM | null> {
    const res = await this.get<FMPKeyMetricsTTM[]>(`/key-metrics-ttm`, { symbol: ticker.toUpperCase() })
    return res?.[0] ?? null
  }

  async getPeers(ticker: string): Promise<string[]> {
    const res = await this.get<{ symbol: string; peersList?: string[] }[]>(
      `/stock-peers`, { symbol: ticker.toUpperCase() }
    )
    return res?.[0]?.peersList ?? []
  }

  async getAnalystEstimates(
    ticker: string,
    opts?: { period?: 'annual' | 'quarter'; limit?: number },
  ): Promise<FMPEstimates[]> {
    // Stable requires `period`. Returns the full array so callers can pick a
    // specific entry (e.g. the nearest future fiscal year-end).
    const res = await this.get<FMPEstimates[]>(`/analyst-estimates`, {
      symbol: ticker.toUpperCase(),
      period: opts?.period ?? 'annual',
      limit:  opts?.limit  ?? 1,
    })
    return res ?? []
  }

  async getGrades(ticker: string): Promise<FMPGrade[]> {
    // The stable API renamed /grade/{ticker} → /analyst-recommendation?symbol=
    return this.get<FMPGrade[]>(`/analyst-recommendation`, { symbol: ticker.toUpperCase() })
  }

  async getPriceTargetConsensus(ticker: string): Promise<FMPPriceTarget> {
    const res = await this.get<FMPPriceTarget[]>(
      `/price-target-consensus`, { symbol: ticker.toUpperCase() }
    )
    return res?.[0]
  }

  async getScreener(params: FMPScreenerParams): Promise<FMPScreenerResult[]> {
    const stringParams: Record<string, string | number | boolean> = {}
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) stringParams[k] = v
    }
    return this.get<FMPScreenerResult[]>(`/company-screener`, stringParams)
  }

  async getEarningsCalendar(from: string, to: string): Promise<FMPEarningsEvent[]> {
    return this.get<FMPEarningsEvent[]>(`/earnings-calendar`, { from, to })
  }

  async getDividends(ticker: string): Promise<FMPDividend[]> {
    return this.get<FMPDividend[]>(`/dividends`, { symbol: ticker.toUpperCase() })
  }
}
