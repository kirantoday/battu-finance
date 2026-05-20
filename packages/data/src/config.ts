// Validated env config — throws at startup if anything missing
export function getDataConfig() {
  const required = ['POLYGON_API_KEY', 'FMP_API_KEY', 'BENZINGA_API_KEY']
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required env var: ${key}`)
    }
  }
  return {
    polygon:  { apiKey: process.env.POLYGON_API_KEY! },
    fmp:      { apiKey: process.env.FMP_API_KEY!, baseUrl: 'https://financialmodelingprep.com/api/v3' },
    benzinga: { apiKey: process.env.BENZINGA_API_KEY!, baseUrl: 'https://api.benzinga.com/api/v2' },
    edgar:    { baseUrl: 'https://data.sec.gov', eftsUrl: 'https://efts.sec.gov' },
  }
}
