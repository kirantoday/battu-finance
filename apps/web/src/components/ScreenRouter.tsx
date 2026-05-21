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
    <div
      className="flex-1"
      style={{
        background: 'var(--battu-screen-bg)',
        color: 'var(--battu-text)',
        padding: '24px',
        fontFamily: 'JetBrains Mono, monospace',
      }}
    >
      <div
        style={{
          color: 'var(--battu-title-color)',
          fontSize: '13px',
          letterSpacing: '2px',
          marginBottom: '8px',
          textShadow: 'var(--battu-glow)',
        }}
      >
        {currentScreen}
      </div>
      <div style={{ color: 'var(--battu-muted)', fontSize: '11px' }}>
        Ticker: {currentParams.ticker || '—'}
        {currentParams.timeframe && ` · Timeframe: ${currentParams.timeframe}`}
      </div>
      <div
        style={{
          border: '1px solid var(--battu-border)',
          color: 'var(--battu-muted)',
          padding: '16px',
          marginTop: '24px',
          fontSize: '10px',
          letterSpacing: '1px',
        }}
      >
        Screen not yet implemented. Run the appropriate Claude Code session to build this screen.
      </div>
    </div>
  )
}

function WelcomeScreen() {
  return (
    <div
      className="flex-1 flex flex-col items-center justify-center text-center"
      style={{ padding: '32px', fontFamily: 'JetBrains Mono, monospace' }}
    >
      <div
        className="glow-text"
        style={{
          color: 'var(--battu-accent)',
          fontSize: '40px',
          fontWeight: 'bold',
          letterSpacing: '8px',
          marginBottom: '8px',
        }}
      >
        BATTU
      </div>
      <div
        style={{
          color: 'var(--battu-muted)',
          fontSize: '11px',
          letterSpacing: '2px',
          marginBottom: '32px',
        }}
      >
        FINANCE SCREEN
      </div>
      <div
        style={{
          color: 'var(--battu-muted)',
          fontSize: '11px',
          maxWidth: '28rem',
          lineHeight: '1.8',
        }}
      >
        Type a command to begin.<br />
        <span style={{ color: 'var(--battu-accent)' }}>DES AAPL</span>
        <span style={{ color: 'var(--battu-muted)' }}> · </span>
        <span style={{ color: 'var(--battu-accent)' }}>GP MSFT</span>
        <span style={{ color: 'var(--battu-muted)' }}> · </span>
        <span style={{ color: 'var(--battu-accent)' }}>FA NVDA</span>
        <span style={{ color: 'var(--battu-muted)' }}> · </span>
        <span style={{ color: 'var(--battu-accent)' }}>LIQ BIIB</span>
        <br /><br />
        Press <span style={{ color: 'var(--battu-warning)' }}>Ctrl+K</span> for all commands
        {' · '}
        <span style={{ color: 'var(--battu-warning)' }}>Ctrl+T</span> to change theme.
      </div>
    </div>
  )
}
