// SEC ticker universe — fetch + cache the company_tickers.json catalog.

export interface TickerInfo {
  ticker: string
  cik:    string
  name:   string
}

// Curated tiers for targeted ingestion. `biotech` and `sp500` are populated
// later from the full universe (filtered by sector / market cap).
export const TIERS: Record<string, string[]> = {
  demo:    ['BIIB', 'MRNA', 'SAGE', 'ADUR', 'PBM', 'TORO', 'STI', 'TRT', 'AAPL', 'MSFT'],
  biotech: [],
  sp500:   [],
}

let _cachedUniverse: TickerInfo[] | null = null

export async function fetchTickerUniverse(): Promise<TickerInfo[]> {
  if (_cachedUniverse) return _cachedUniverse

  const res = await fetch('https://www.sec.gov/files/company_tickers.json', {
    headers: { 'User-Agent': 'BATTU Finance Screen contact@regapps.com' },
  })
  if (!res.ok) {
    throw new Error(`SEC ticker fetch failed: ${res.status}`)
  }
  const json = await res.json() as Record<string, { cik_str: number; ticker: string; title: string }>

  _cachedUniverse = Object.values(json).map(e => ({
    ticker: e.ticker.toUpperCase(),
    cik:    String(e.cik_str).padStart(10, '0'),
    name:   e.title,
  }))
  return _cachedUniverse
}

export async function getTickerInfo(ticker: string): Promise<TickerInfo | null> {
  const universe = await fetchTickerUniverse()
  return universe.find(t => t.ticker === ticker.toUpperCase()) ?? null
}

export async function getTierTickers(tier: string): Promise<TickerInfo[]> {
  const universe = await fetchTickerUniverse()
  if (tier === 'demo') {
    return TIERS.demo
      .map(t => universe.find(u => u.ticker === t))
      .filter((u): u is TickerInfo => !!u)
  }
  // Other tiers — return full universe so the pipeline can filter further.
  return universe
}
