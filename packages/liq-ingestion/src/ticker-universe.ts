// SEC ticker universe — fetch + cache the company_tickers.json catalog.

export interface TickerInfo {
  ticker: string
  cik:    string
  name:   string
}

// Curated tiers for targeted ingestion. `biotech`, `sp500` and `russell3000`
// are resolved in getTierTickers() — from a hardcoded constituent list
// (sp500 / biotech) or fetched live from EDGAR (russell3000).
export const TIERS: Record<string, string[]> = {
  demo:    ['BIIB', 'MRNA', 'SAGE', 'ADUR', 'PBM', 'TORO', 'STI', 'TRT', 'AAPL', 'MSFT'],
  biotech: [],
  sp500:   [],
}

// Current S&P 500 constituents. Resolved against the SEC ticker universe in
// getTierTickers() so each entry carries a CIK before the pipeline runs.
const SP500_TICKERS = [
  'MMM','AOS','ABT','ABBV','ACN','ADBE','AMD','AES','AFL','A','APD','ABNB',
  'AKAM','ALB','ARE','ALGN','ALLE','LNT','ALL','GOOGL','GOOG','MO','AMZN',
  'AMCR','AEE','AAL','AEP','AXP','AIG','AMT','AWK','AMP','AME','AMGN',
  'APH','ADI','ANSS','AON','APA','AAPL','AMAT','APTV','ACGL','ADM','ANET',
  'AJG','AIZ','T','ATO','ADSK','ADP','AZO','AVB','AVY','AXON','BKR','BALL',
  'BAC','BK','BBWI','BAX','BDX','BBY','BIO','TECH','BIIB','BLK','BX','BA',
  'BKNG','BWA','BSX','BMY','AVGO','BR','BRO','BF.B','BLDR','BG','CDNS',
  'CZR','CPT','CPB','COF','CAH','KMX','CCL','CARR','CTLT','CAT','CBOE',
  'CBRE','CDW','CE','CNC','CNP','CF','CHRW','CRL','SCHW','CHTR','CVX',
  'CMG','CB','CHD','CI','CINF','CTAS','CSCO','C','CFG','CLX','CME','CMS',
  'KO','CTSH','CL','CMCSA','CAG','COP','ED','STZ','CEG','COO','CPRT',
  'GLW','CTVA','CSGP','COST','CTRA','CPAY','CCI','CSX','CMI','CVS','DHI',
  'DHR','DRI','DVA','DAY','DECK','DE','DAL','DVN','DXCM','FANG','DLR',
  'DFS','DG','DLTR','D','DPZ','DOV','DOW','DHR','DTE','DUK','DD','EMN',
  'ETN','EBAY','ECL','EIX','EW','EA','ELV','EMR','ENPH','ETR','EOG',
  'EPAM','EQT','EFX','EQIX','EQR','ESS','EL','ETSY','EG','EVRG','ES',
  'EXC','EXPE','EXPD','EXR','XOM','FFIV','FDS','FICO','FAST','FRT','FDX',
  'FIS','FITB','FSLR','FE','FI','FMC','F','FTNT','FTV','FOXA','FOX','BEN',
  'FCX','GRMN','IT','GE','GEHC','GEV','GEN','GNRC','GD','GIS','GM','GPC',
  'GILD','GS','HAL','HIG','HAS','HCA','DOC','HSIC','HSY','HES','HPE','HLT',
  'HOLX','HD','HON','HRL','HST','HWM','HPQ','HUBB','HUM','HBAN','HII',
  'IBM','IEX','IDXX','ITW','INCY','IR','PODD','INTC','ICE','IFF','IP',
  'IPG','INTU','ISRG','IVZ','INVH','IQV','IRM','JBHT','JBL','JKHY','J',
  'JNJ','JCI','JPM','JNPR','K','KVUE','KDP','KEY','KEYS','KMB','KIM',
  'KMI','KLAC','KHC','KR','LHX','LH','LRCX','LW','LVS','LDOS','LEN',
  'LLY','LIN','LYV','LKQ','LMT','L','LOW','LULU','LYB','MTB','MRO','MPC',
  'MKTX','MAR','MMC','MLM','MAS','MA','MTCH','MKC','MCD','MCK','MDT',
  'MRK','META','MET','MTD','MGM','MCHP','MU','MSFT','MAA','MRNA','MHK',
  'MOH','TAP','MDLZ','MPWR','MNST','MCO','MS','MOS','MSI','MSCI','NDAQ',
  'NTAP','NFLX','NEM','NWSA','NWS','NEE','NKE','NI','NDSN','NSC','NTRS',
  'NOC','NCLH','NRG','NUE','NVDA','NVR','NXPI','ORLY','OXY','ODFL','OMC',
  'ON','OKE','ORCL','OTIS','PCAR','PKG','PLTR','PH','PAYX','PAYC','PYPL',
  'PNR','PEP','PFE','PCG','PM','PSX','PNW','PXD','PNC','POOL','PPG','PPL',
  'PFG','PG','PGR','PLD','PRU','PEG','PTCT','PTC','PSA','PHM','QRVO',
  'PWR','QCOM','DGX','RL','RJF','RTX','O','REG','REGN','RF','RSG','RMD',
  'RVTY','ROK','ROL','ROP','ROST','RCL','SPGI','CRM','SBAC','SLB','STX',
  'SRE','NOW','SHW','SPG','SWKS','SJM','SW','SNA','SOLV','SO','LUV','SWK',
  'SBUX','STT','STLD','STE','SYK','SMCI','SYF','SNPS','SYY','TMUS','TROW',
  'TTWO','TPR','TRGP','TGT','TEL','TDY','TFX','TER','TSLA','TXN','TXT',
  'TMO','TJX','TSCO','TT','TDG','TRV','TRMB','TFC','TYL','TSN','USB',
  'UBER','UDR','ULTA','UNP','UAL','UPS','URI','UNH','UHS','VLO','VTR',
  'VLTO','VRSN','VRSK','VZ','VRTX','VTRS','VICI','V','VMC','WRB','GWW',
  'WAB','WBA','WMT','DIS','WBD','WM','WAT','WEC','WFC','WELL','WST','WDC',
  'WRK','WY','WHR','WMB','WTW','WYNN','XEL','XYL','YUM','ZBRA','ZBH','ZTS',
]

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
      .filter(Boolean) as TickerInfo[]
  }

  if (tier === 'sp500') {
    return SP500_TICKERS
      .map(t => universe.find(u => u.ticker === t))
      .filter(Boolean) as TickerInfo[]
  }

  if (tier === 'russell3000') {
    // Fetch from EDGAR exchange listing
    const res = await fetch(
      'https://www.sec.gov/files/company_tickers_exchange.json',
      { headers: { 'User-Agent': 'BATTU Finance contact@regapps.com' } }
    )
    const json = await res.json() as { data: any[] }
    const validExchanges = ['NYSE', 'Nasdaq', 'NYSE MKT', 'NYSE Arca', 'CBOE']
    return (json.data as any[])
      .filter(row => validExchanges.includes(row[3]))
      .map(row => ({
        ticker: String(row[2]).toUpperCase(),
        cik:    String(row[0]).padStart(10, '0'),
        name:   String(row[1]),
      }))
      .slice(0, 3500) // cap at 3500
  }

  if (tier === 'biotech') {
    const BIOTECH_SICS = ['2836','2835','2830','8731','2833','2834']
    // Use the SEC full-text to get biotech tickers
    // For now use known biotech universe from S&P 500 + common biotechs
    const BIOTECH_TICKERS = [
      'ABBV','ABT','AMGN','AZN','BIIB','BMY','GILD','JNJ','LLY','MRK',
      'PFE','REGN','VRTX','ALNY','ALXN','BMRN','EXAS','FATE','HALO',
      'IDXX','ILMN','INCY','IONS','JAZZ','LGND','MDGL','MRNA','NBIX',
      'NTLA','NUVL','PRGO','RARE','RVMD','SAGE','SNDX','SRPT','TGTX',
      'VCEL','XNCR','ACAD','ACMR','ADUR','AGEN','ALKS','ARWR','AVXL',
      'BEAM','BHVN','BLUE','BNTX','CLDX','CRSP','DVAX','EDIT','ETNB',
      'FHTX','FOLD','GMAB','HRMY','IOVA','JANX','KPTI','KROS','KYMR',
      'LBPH','MGNX','MRUS','NKTR','NTRA','OCGN','ORIC','PBM','PRME',
      'PTGX','QURE','RAPT','RCKT','RXRX','SEER','SMMT','STI','TORO',
      'TRT','URGN','VERA','WINT','YMAB','ZNTL','ACCD','ACHL','AGEN',
      'AGIO','AKBA','AKRO','ALLO','ALVO','AMAB','AMBP','AMPH','AMRX',
      'ANAB','ANDE','APLS','APLT','APRE','ARAV','ARDX','ARQT','ARVN',
      'ASND','ATEC','ATHENEX','ATRC','ATRI','AUPH','AVDL','AVEO','AVGR',
      'AVIR','AXSM','AZEK','BCAB','BCDA','BCYC','BDTX','BGNE','BPMC',
      'BSGM','BTAI','BYND','CBAY','CCCC','CDMO','CGEN','CGON','CHRS',
      'CLBS','CLOQ','CMPS','COGT','CPIX','CRNX','CRTX','CTMX','DARE',
      'DCGO','DCPH','DERM','DFTB','DMAC','DNLI','DOCU','DOVA','DVAX',
      'DYAI','EGRX','ELOX','ELVN','EPZM','ETNB','EVAX','EVFM','EVGO'
    ]
    return BIOTECH_TICKERS
      .map(t => universe.find(u => u.ticker === t))
      .filter(Boolean) as TickerInfo[]
  }

  // Default — return full universe
  return universe
}
