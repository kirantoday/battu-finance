import { useRef, useEffect } from 'react'
import { useTerminal } from '@/store/terminal'
import { parseCommand } from '@/lib/commandParser'

export function CommandBar() {
  const inputRef = useRef<HTMLInputElement>(null)
  const commandInput      = useTerminal((s) => s.commandInput)
  const setCommandInput   = useTerminal((s) => s.setCommandInput)
  const activeTicker      = useTerminal((s) => s.activeTicker)
  const navigate          = useTerminal((s) => s.navigate)
  const pushToHistory     = useTerminal((s) => s.pushToHistory)
  const navigateHistory   = useTerminal((s) => s.navigateHistory)
  const setPaletteOpen    = useTerminal((s) => s.setPaletteOpen)

  // Ctrl+K focuses command bar from anywhere
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        inputRef.current?.focus()
        setPaletteOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setPaletteOpen])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      const parsed = parseCommand(commandInput, activeTicker)
      if (parsed) {
        pushToHistory(commandInput.trim().toUpperCase())
        navigate(parsed)
        setCommandInput('')
      }
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCommandInput(navigateHistory('up'))
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCommandInput(navigateHistory('down'))
    }
    if (e.key === 'Escape') {
      setCommandInput('')
      inputRef.current?.blur()
    }
    // Ctrl+T = theme modal (handled at App.tsx via window keydown — no-op here)
  }

  return (
    <div
      className="flex items-center gap-3 px-4 py-2"
      style={{
        background: 'var(--battu-cmd-bg)',
        borderBottom: '1px solid var(--battu-border)',
      }}
    >
      {/* Active ticker indicator */}
      {activeTicker && (
        <span
          className="font-bold min-w-[60px]"
          style={{
            color: 'var(--battu-accent)',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '13px',
          }}
        >
          {activeTicker}
        </span>
      )}

      {/* Command prompt */}
      <span
        style={{
          color: 'var(--battu-accent)',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '13px',
        }}
      >
        ›
      </span>

      {/* Input */}
      <input
        ref={inputRef}
        value={commandInput}
        onChange={(e) => setCommandInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a command — DES AAPL · GP · FA · LIQ · /ask · Ctrl+K for all commands"
        style={{
          background: 'transparent',
          color: 'var(--battu-text)',
          caretColor: 'var(--battu-cursor)',
          outline: 'none',
          flex: 1,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '13px',
          border: 'none',
        }}
        autoComplete="off"
        spellCheck={false}
      />

      {/* Hint */}
      <span
        className="hidden md:block"
        style={{
          color: 'var(--battu-muted)',
          fontSize: '10px',
          fontFamily: 'JetBrains Mono, monospace',
        }}
      >
        Ctrl+K
      </span>
    </div>
  )
}
