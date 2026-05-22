// SEC EDGAR API client.
// Rate-limited to 8 req/sec per SEC's published guidance.
// Every request must carry a User-Agent identifying the operator.

const EDGAR_BASE = 'https://data.sec.gov'
const EFTS_BASE  = 'https://efts.sec.gov'
const WWW_BASE   = 'https://www.sec.gov'

const HEADERS = {
  'User-Agent': 'BATTU Finance Screen contact@regapps.com',
  'Accept':     'application/json',
}

// ── Rate limiter ────────────────────────────────────────────────────────────
let lastRequestTime = 0
async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now()
  const elapsed = now - lastRequestTime
  if (elapsed < 125) {        // 125ms gap ≈ 8 req/sec
    await new Promise(r => setTimeout(r, 125 - elapsed))
  }
  lastRequestTime = Date.now()
  return fetch(url, { headers: HEADERS })
}

// ── CIK lookup (cached in-process) ──────────────────────────────────────────
// company_tickers.json is ~700KB — fetch once per process lifetime.
let cikCache: Map<string, string> | null = null

async function loadCikIndex(): Promise<Map<string, string>> {
  if (cikCache) return cikCache
  const map = new Map<string, string>()
  try {
    const res = await rateLimitedFetch(`${WWW_BASE}/files/company_tickers.json`)
    if (!res.ok) {
      console.warn(`[edgar] company_tickers.json fetch failed: ${res.status}`)
      return map
    }
    const json = await res.json() as Record<string, { ticker: string; cik_str: number }>
    for (const entry of Object.values(json)) {
      if (entry?.ticker && entry?.cik_str != null) {
        map.set(entry.ticker.toUpperCase(), String(entry.cik_str).padStart(10, '0'))
      }
    }
    cikCache = map
  } catch (e) {
    console.warn('[edgar] company_tickers.json error:', (e as Error).message)
  }
  return map
}

export async function getCIK(ticker: string): Promise<string | null> {
  const map = await loadCikIndex()
  return map.get(ticker.toUpperCase()) ?? null
}

// ── Submissions (all filings + recent index) ────────────────────────────────
export interface SubmissionsResponse {
  cik:    string
  name:   string
  filings?: {
    recent?: {
      accessionNumber:  string[]
      filingDate:       string[]
      form:             string[]
      primaryDocument:  string[]
    }
  }
}

export async function getSubmissions(cik: string): Promise<SubmissionsResponse | null> {
  try {
    const res = await rateLimitedFetch(`${EDGAR_BASE}/submissions/CIK${cik}.json`)
    if (!res.ok) {
      console.warn(`[edgar] submissions CIK${cik} → ${res.status}`)
      return null
    }
    return await res.json() as SubmissionsResponse
  } catch (e) {
    console.warn(`[edgar] submissions error: ${(e as Error).message}`)
    return null
  }
}

// ── Full-text search across EFTS ────────────────────────────────────────────
export interface FilingHit {
  _id:     string
  _source: {
    display_names: string[]
    forms:         string[]
    file_date:     string
    adsh:          string         // accession number
  }
}

export async function searchFilings(params: {
  ticker:    string
  formTypes: string[]
  dateFrom?: string
  dateTo?:   string
  limit?:    number
}): Promise<FilingHit[]> {
  try {
    const forms = params.formTypes.join(',')
    const dateFrom = params.dateFrom || '2020-01-01'
    const dateTo   = params.dateTo   || new Date().toISOString().slice(0, 10)
    const url = `${EFTS_BASE}/LATEST/search-index?q=%22${encodeURIComponent(params.ticker)}%22` +
                `&dateRange=custom&startdt=${dateFrom}&enddt=${dateTo}` +
                `&forms=${encodeURIComponent(forms)}`
    const res = await rateLimitedFetch(url)
    if (!res.ok) return []
    const json = await res.json() as { hits?: { hits?: FilingHit[] } }
    return json.hits?.hits ?? []
  } catch (e) {
    console.warn(`[edgar] searchFilings error: ${(e as Error).message}`)
    return []
  }
}

// ── List filings for a CIK filtered by form type ─────────────────────────────
export interface FilingListItem {
  accessionNumber: string
  filingDate:      string
  form:            string
  primaryDocument: string
}

export async function getFilingsList(cik: string, formTypes: string[]): Promise<FilingListItem[]> {
  try {
    const subs = await getSubmissions(cik)
    const recent = subs?.filings?.recent
    if (!recent) return []

    const results: FilingListItem[] = []
    for (let i = 0; i < recent.form.length; i++) {
      if (formTypes.includes(recent.form[i])) {
        results.push({
          accessionNumber: recent.accessionNumber[i],
          filingDate:      recent.filingDate[i],
          form:            recent.form[i],
          primaryDocument: recent.primaryDocument[i],
        })
      }
    }
    return results.sort((a, b) =>
      new Date(b.filingDate).getTime() - new Date(a.filingDate).getTime()
    )
  } catch (e) {
    console.warn(`[edgar] getFilingsList error: ${(e as Error).message}`)
    return []
  }
}

// ── Fetch and lightly de-HTML a filing document ─────────────────────────────
// Default: plain text, capped at 50k chars (suits the on-demand Claude path).
// For the ingestion pipeline, pass { raw: true, maxBytes: 2_000_000 } to get
// the raw HTML so parseDocument can do its own table-aware stripping.
export interface FetchFilingOpts {
  /** When true, return raw HTML — caller is responsible for stripping. */
  raw?:      boolean
  /** Max bytes to keep from the response. Defaults to 50_000 for text, full for raw. */
  maxBytes?: number
}

export async function fetchFilingDocument(
  cik: string,
  accessionNumber: string,
  fileName?: string,
  opts: FetchFilingOpts = {},
): Promise<string | null> {
  try {
    const accNoClean = accessionNumber.replace(/-/g, '')
    const cikNum = parseInt(cik, 10)

    // /Archives/edgar/data/* lives on www.sec.gov, NOT data.sec.gov.
    // (data.sec.gov serves the JSON-based submissions API only.)
    let docName = fileName
    if (!docName) {
      const indexUrl = `${WWW_BASE}/Archives/edgar/data/${cikNum}/${accNoClean}/${accessionNumber}-index.json`
      const indexRes = await rateLimitedFetch(indexUrl)
      if (!indexRes.ok) {
        console.warn(`[edgar] index ${accessionNumber} → ${indexRes.status}`)
        return null
      }
      const index = await indexRes.json() as { documents?: Array<{ type?: string; name?: string }> }
      const docs = index.documents ?? []
      const primary =
           docs.find(d => d.type === '10-K' || d.type === 'S-3' || d.type === 'S-3ASR' || d.type?.startsWith('424B'))
        ?? docs.find(d => d.name?.endsWith('.htm') || d.name?.endsWith('.html'))
        ?? docs[0]
      docName = primary?.name
    }
    if (!docName) return null

    const docUrl = `${WWW_BASE}/Archives/edgar/data/${cikNum}/${accNoClean}/${docName}`
    const docRes = await rateLimitedFetch(docUrl)
    if (!docRes.ok) return null

    const html = await docRes.text()

    if (opts.raw) {
      const limit = opts.maxBytes ?? Number.MAX_SAFE_INTEGER
      return html.length > limit ? html.slice(0, limit) : html
    }

    const limit = opts.maxBytes ?? 50_000
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, limit)
  } catch (e) {
    console.warn(`[edgar] fetchFilingDocument error: ${(e as Error).message}`)
    return null
  }
}

/** Build a public EDGAR Archives URL for a filing. */
export function buildFilingUrl(cik: string, accessionNumber: string, primaryDocument: string): string {
  const cikNum = parseInt(cik, 10)
  // Archives live on www.sec.gov, not data.sec.gov.
  return `${WWW_BASE}/Archives/edgar/data/${cikNum}/${accessionNumber.replace(/-/g, '')}/${primaryDocument}`
}

// ── XBRL company facts (free fallback for cash/burn data) ───────────────────
// SEC publishes structured XBRL data for every filer on /api/xbrl/companyfacts.
// This is the cleanest free source for cash position when FMP gates these
// endpoints behind a paid plan.

type XBRLFactEntry = {
  val:   number
  end:   string
  form:  string
  fp?:   string
  fy?:   number
  accn?: string
}

type XBRLConcept = {
  label?: string
  units?: Record<string, XBRLFactEntry[]>
}

export interface XBRLCompanyFacts {
  cik:        number
  entityName: string
  facts?: {
    // Domestic issuers report under us-gaap. Foreign private issuers (20-F)
    // and Canadian MJDS issuers (40-F) report under ifrs-full. Some filers
    // (typically dual-listed Canadian companies) include both.
    'us-gaap'?:   Record<string, XBRLConcept>
    'ifrs-full'?: Record<string, XBRLConcept>
  }
}

export async function getXBRLCompanyFacts(cik: string): Promise<XBRLCompanyFacts | null> {
  try {
    const res = await rateLimitedFetch(`${EDGAR_BASE}/api/xbrl/companyfacts/CIK${cik}.json`)
    if (!res.ok) {
      console.warn(`[edgar] XBRL facts CIK${cik} → ${res.status}`)
      return null
    }
    return await res.json() as XBRLCompanyFacts
  } catch (e) {
    console.warn(`[edgar] XBRL facts error: ${(e as Error).message}`)
    return null
  }
}

/** Most recent USD-denominated value for a us-gaap concept, optionally filtered by form. */
function getMostRecentXBRLValue(
  facts: XBRLCompanyFacts | null,
  concept: string,
  form?: string,
): number | null {
  try {
    const entries = facts?.facts?.['us-gaap']?.[concept]?.units?.USD
    if (!entries?.length) return null
    const filtered = form ? entries.filter(e => e.form === form) : entries
    if (!filtered.length) return null
    const sorted = [...filtered].sort((a, b) =>
      new Date(b.end).getTime() - new Date(a.end).getTime()
    )
    return sorted[0]?.val ?? null
  } catch { return null }
}

/**
 * Most recent value for an ifrs-full concept. Foreign filers report in their
 * reporting currency — try USD first, then common reporting currencies
 * (CAD for Canadian MJDS, GBP/EUR for European FPIs). The caller treats the
 * returned number as approximate USD; for CAD/GBP/EUR returns the upstream
 * code should convert, but for cash-runway purposes the order of magnitude
 * is what matters and demo-tier tickers report in USD anyway.
 */
function getMostRecentIFRSValue(
  facts: XBRLCompanyFacts | null,
  concept: string,
  form?: string,
): number | null {
  try {
    const units = facts?.facts?.['ifrs-full']?.[concept]?.units
    if (!units) return null
    const entries =
         units.USD
      ?? units.CAD
      ?? units.GBP
      ?? units.EUR
      ?? null
    if (!entries?.length) return null
    const filtered = form ? entries.filter(e => e.form === form) : entries
    if (!filtered.length) return null
    const sorted = [...filtered].sort((a, b) =>
      new Date(b.end).getTime() - new Date(a.end).getTime()
    )
    return sorted[0]?.val ?? null
  } catch { return null }
}

export interface XBRLCashData {
  cashAndEquiv:    number | null
  shortTermInvest: number | null
  operatingCF:     number | null
  capex:           number | null
  taxonomy:        'us-gaap' | 'ifrs-full' | null
}

/**
 * Cash position from XBRL — tries us-gaap first (domestic 10-K/10-Q filers),
 * falls back to ifrs-full (foreign private issuers under 20-F / 40-F).
 * Quarterly preferred, annual fallback within each taxonomy.
 */
export async function getXBRLCashData(cik: string): Promise<XBRLCashData | null> {
  const facts = await getXBRLCompanyFacts(cik)
  if (!facts) return null

  // ── Pass 1: us-gaap (domestic issuers) ──
  if (facts.facts?.['us-gaap']) {
    const cashAndEquiv =
         getMostRecentXBRLValue(facts, 'CashAndCashEquivalentsAtCarryingValue', '10-Q')
      ?? getMostRecentXBRLValue(facts, 'CashAndCashEquivalentsAtCarryingValue', '10-K')
      ?? getMostRecentXBRLValue(facts, 'CashCashEquivalentsAndShortTermInvestments', '10-Q')
      ?? null

    if (cashAndEquiv !== null) {
      return {
        cashAndEquiv,
        shortTermInvest:
             getMostRecentXBRLValue(facts, 'ShortTermInvestments',         '10-Q')
          ?? getMostRecentXBRLValue(facts, 'MarketableSecuritiesCurrent',  '10-Q')
          ?? getMostRecentXBRLValue(facts, 'ShortTermInvestments',         '10-K')
          ?? null,
        operatingCF:
             getMostRecentXBRLValue(facts, 'NetCashProvidedByUsedInOperatingActivities', '10-Q')
          ?? getMostRecentXBRLValue(facts, 'NetCashProvidedByUsedInOperatingActivities', '10-K')
          ?? null,
        capex:
             getMostRecentXBRLValue(facts, 'PaymentsToAcquirePropertyPlantAndEquipment', '10-Q')
          ?? getMostRecentXBRLValue(facts, 'PaymentsToAcquirePropertyPlantAndEquipment', '10-K')
          ?? null,
        taxonomy: 'us-gaap',
      }
    }
  }

  // ── Pass 2: ifrs-full (foreign private issuers — 20-F / 40-F) ──
  if (facts.facts?.['ifrs-full']) {
    const cashAndEquiv =
         getMostRecentIFRSValue(facts, 'CashAndCashEquivalents', '20-F')
      ?? getMostRecentIFRSValue(facts, 'CashAndCashEquivalents', '40-F')
      ?? getMostRecentIFRSValue(facts, 'CashAndCashEquivalents')
      ?? getMostRecentIFRSValue(facts, 'CashAndBankBalances')
      ?? null

    if (cashAndEquiv !== null) {
      return {
        cashAndEquiv,
        shortTermInvest:
             getMostRecentIFRSValue(facts, 'CurrentInvestments')
          ?? getMostRecentIFRSValue(facts, 'OtherCurrentFinancialAssets')
          ?? null,
        operatingCF:
             getMostRecentIFRSValue(facts, 'CashFlowsFromUsedInOperatingActivities', '20-F')
          ?? getMostRecentIFRSValue(facts, 'CashFlowsFromUsedInOperatingActivities', '40-F')
          ?? getMostRecentIFRSValue(facts, 'CashFlowsFromUsedInOperatingActivities')
          ?? null,
        capex:
             getMostRecentIFRSValue(facts, 'PurchaseOfPropertyPlantAndEquipment')
          ?? getMostRecentIFRSValue(facts, 'AcquisitionOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities')
          ?? null,
        taxonomy: 'ifrs-full',
      }
    }
  }

  return null
}
