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
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-battu-surface border-b border-battu-border">
      {/* Active ticker indicator */}
      {activeTicker && (
        <span className="text-battu-accent font-mono text-sm font-bold min-w-[60px]">
          {activeTicker}
        </span>
      )}

      {/* Command prompt */}
      <span className="text-battu-warning font-mono text-sm">›</span>

      {/* Input */}
      <input
        ref={inputRef}
        value={commandInput}
        onChange={(e) => setCommandInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a command — DES AAPL · GP · FA · LIQ · /ask · Ctrl+K for all commands"
        className="flex-1 bg-transparent font-mono text-sm text-battu-text
                   placeholder:text-battu-muted outline-none caret-battu-warning"
        autoComplete="off"
        spellCheck={false}
      />

      {/* Hint */}
      <span className="text-battu-muted text-xs font-mono hidden md:block">
        Ctrl+K
      </span>
    </div>
  )
}
