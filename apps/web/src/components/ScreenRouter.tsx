import { useTerminal } from '@/store/terminal'

export function ScreenRouter() {
  const currentScreen = useTerminal((s) => s.currentScreen)
  const currentParams = useTerminal((s) => s.currentParams)

  if (!currentScreen) {
    return <WelcomeScreen />
  }

  // Each screen will be imported here as it is built.
  // For now all return a stub.
  return (
    <div className="flex-1 p-6 font-mono text-battu-text">
      <div className="text-battu-accent text-lg mb-2">{currentScreen}</div>
      <div className="text-battu-muted text-sm">
        Ticker: {currentParams.ticker || '—'}
        {currentParams.timeframe && ` · Timeframe: ${currentParams.timeframe}`}
      </div>
      <div className="mt-8 text-battu-muted text-xs border border-battu-border rounded p-4">
        Screen not yet implemented. Run the appropriate Claude Code session to build this screen.
      </div>
    </div>
  )
}

function WelcomeScreen() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
      <div className="text-battu-accent font-mono text-4xl font-bold mb-2">BATTU</div>
      <div className="text-battu-muted font-mono text-sm mb-8">Finance Screen</div>
      <div className="text-battu-muted font-mono text-xs max-w-md">
        Type a command to begin.<br />
        <span className="text-battu-text">DES AAPL</span> ·
        <span className="text-battu-text"> GP MSFT</span> ·
        <span className="text-battu-text"> FA NVDA</span> ·
        <span className="text-battu-text"> LIQ BIIB</span><br /><br />
        Press <span className="text-battu-warning">Ctrl+K</span> for all commands.
      </div>
    </div>
  )
}
