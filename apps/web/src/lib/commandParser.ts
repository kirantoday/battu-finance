import type { ParsedCommand, ScreenCommand } from '@battu/shared'

const VALID_SCREENS: ScreenCommand[] = [
  'DES','GP','GIP','HP','QR','FA','EE','ANR','RV','EQS',
  'CN','NI','N','TOP','LIQ','OWN','SECF','ECO','MOV','MOST',
  'W','GPC','COMP','SCTR','DVD','EVTS','ERN','WL','PORT',
]
const TIMEFRAMES = ['1D','1W','1M','3M','1Y','5Y','10Y']

export function parseCommand(input: string, activeTicker: string | null): ParsedCommand | null {
  const raw = input.trim()
  if (!raw) return null

  // /ask natural language query
  if (raw.toLowerCase().startsWith('/ask ')) {
    return { screen: 'ASK', query: raw.slice(5).trim(), raw }
  }

  const parts = raw.toUpperCase().split(/\s+/)
  const cmd = parts[0] as ScreenCommand

  if (!VALID_SCREENS.includes(cmd)) return null

  // GPC takes multiple tickers: GPC AAPL MSFT GOOG
  if (cmd === 'GPC') {
    const tickers = parts.slice(1).filter(p => !TIMEFRAMES.includes(p))
    return { screen: 'GPC', tickers: tickers.length ? tickers : undefined, raw }
  }

  // All other commands: optional ticker, optional timeframe
  const ticker = parts.find((p, i) => i > 0 && !TIMEFRAMES.includes(p)) || activeTicker || undefined
  const timeframe = parts.find(p => TIMEFRAMES.includes(p))

  return {
    screen: cmd,
    ticker: ticker?.toUpperCase(),
    timeframe,
    raw,
  }
}
