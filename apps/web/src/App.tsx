import { useState, useEffect } from 'react'
import { CommandBar }        from '@/components/CommandBar'
import { ScreenRouter }      from '@/components/ScreenRouter'
import { ThemeSwitcher }     from '@/components/ThemeSwitcher'
import { ThemePreviewModal } from '@/components/ThemePreviewModal'
import { useTerminal }       from '@/store/terminal'

export default function App() {
  const activeTicker = useTerminal((s) => s.activeTicker)
  const [time, setTime] = useState(() => new Date().toLocaleTimeString())
  const [themeModalOpen, setThemeModalOpen] = useState(false)

  useEffect(() => {
    const id = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000)
    return () => clearInterval(id)
  }, [])

  // Ctrl+T opens theme modal; Esc closes it
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 't' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setThemeModalOpen(true)
      }
      if (e.key === 'Escape') setThemeModalOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{ background: 'var(--battu-bg)', color: 'var(--battu-text)' }}
    >
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-4 py-1 text-xs"
        style={{
          background: 'var(--battu-header-bg)',
          borderBottom: '1px solid var(--battu-border)',
          fontFamily: 'JetBrains Mono, monospace',
        }}
      >
        {/* Left — brand */}
        <div className="flex items-center gap-3">
          <span
            className="font-bold tracking-widest glow-text"
            style={{ color: 'var(--battu-accent)', fontSize: '11px', letterSpacing: '4px' }}
          >
            BATTU
          </span>
          <span style={{ color: 'var(--battu-muted)', fontSize: '9px', letterSpacing: '2px' }}>
            FINANCE SCREEN
          </span>
        </div>

        {/* Center — active ticker */}
        {activeTicker && (
          <span
            className="font-bold"
            style={{ color: 'var(--battu-accent)', fontSize: '11px', letterSpacing: '2px' }}
          >
            {activeTicker}
          </span>
        )}

        {/* Right — theme switcher + time */}
        <div className="flex items-center gap-4">
          <ThemeSwitcher />
          <button
            onClick={() => setThemeModalOpen(true)}
            title="Theme Preview (Ctrl+T)"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--battu-muted)',
              fontSize: '9px',
              fontFamily: 'monospace',
              letterSpacing: '1px',
              cursor: 'pointer',
              padding: '2px 4px',
            }}
          >
            THEME
          </button>
          <span style={{ color: 'var(--battu-muted)', fontSize: '9px' }}>
            {time}
          </span>
        </div>
      </div>

      {/* Command bar */}
      <CommandBar />

      {/* Screen content */}
      <div
        className="flex-1 overflow-auto"
        style={{ background: 'var(--battu-screen-bg)' }}
      >
        <ScreenRouter />
      </div>

      {/* Theme modal */}
      <ThemePreviewModal
        open={themeModalOpen}
        onClose={() => setThemeModalOpen(false)}
      />
    </div>
  )
}
