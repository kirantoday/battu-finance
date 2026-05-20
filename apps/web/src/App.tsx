import { useEffect, useState } from 'react'
import { CommandBar } from '@/components/CommandBar'
import { ScreenRouter } from '@/components/ScreenRouter'

export default function App() {
  const [now, setNow] = useState(() => new Date().toLocaleTimeString())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date().toLocaleTimeString()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div
      className="h-screen flex flex-col bg-battu-bg text-battu-text overflow-hidden"
      style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}
    >
      {/* Top bar — active ticker + product name */}
      <div className="flex items-center justify-between px-4 py-1
                      bg-battu-bg border-b border-battu-border text-xs text-battu-muted">
        <span className="text-battu-accent font-bold tracking-widest">BATTU</span>
        <span>Finance Screen</span>
        <span>{now}</span>
      </div>

      {/* Command bar */}
      <CommandBar />

      {/* Screen content */}
      <div className="flex-1 overflow-auto">
        <ScreenRouter />
      </div>
    </div>
  )
}
