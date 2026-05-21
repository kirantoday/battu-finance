import { create } from 'zustand'
import type { ParsedCommand, ScreenCommand, ThemeName } from '@battu/shared'
import { THEMES, DEFAULT_THEME } from '@battu/shared'

function applyThemeToDom(themeName: ThemeName) {
  const tokens = THEMES[themeName].tokens
  const root = document.documentElement
  Object.entries(tokens).forEach(([key, value]) => {
    // Convert camelCase to kebab-case for CSS variables
    const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase()
    root.style.setProperty(`--battu-${cssKey}`, value)
  })
}

// Apply saved theme immediately on module load
const savedTheme = (localStorage.getItem('battu-theme') as ThemeName) || DEFAULT_THEME
applyThemeToDom(savedTheme)

interface TerminalStore {
  // Active ticker — persists across screen changes
  activeTicker: string | null
  setActiveTicker: (ticker: string) => void

  // Current screen
  currentScreen: ScreenCommand | null
  currentParams: Record<string, string>
  navigate: (command: ParsedCommand) => void

  // Command bar
  commandInput: string
  setCommandInput: (value: string) => void
  commandHistory: string[]
  historyIndex: number
  pushToHistory: (cmd: string) => void
  navigateHistory: (direction: 'up' | 'down') => string

  // Command palette
  paletteOpen: boolean
  setPaletteOpen: (open: boolean) => void

  // Theme
  theme: ThemeName
  setTheme: (theme: ThemeName) => void

  // Live prices from WebSocket
  prices: Record<string, {
    price: number
    change: number
    changePct: number
    direction: 'up' | 'down' | 'flat'
    flashAt: number  // timestamp for CSS flash animation
  }>
  updatePrice: (ticker: string, price: number, prev: number) => void
}

export const useTerminal = create<TerminalStore>((set, get) => ({
  activeTicker: null,
  setActiveTicker: (ticker) => set({ activeTicker: ticker.toUpperCase() }),

  currentScreen: null,
  currentParams: {},
  navigate: (command) => {
    const ticker = command.ticker || get().activeTicker
    if (ticker) set({ activeTicker: ticker })
    set({
      currentScreen: command.screen,
      currentParams: {
        ticker: ticker || '',
        timeframe: command.timeframe || '3M',
        query: command.query || '',
      }
    })
  },

  commandInput: '',
  setCommandInput: (value) => set({ commandInput: value }),
  commandHistory: [],
  historyIndex: -1,
  pushToHistory: (cmd) => set((s) => ({
    commandHistory: [cmd, ...s.commandHistory].slice(0, 50),
    historyIndex: -1,
  })),
  navigateHistory: (direction) => {
    const { commandHistory, historyIndex } = get()
    const newIndex = direction === 'up'
      ? Math.min(historyIndex + 1, commandHistory.length - 1)
      : Math.max(historyIndex - 1, -1)
    set({ historyIndex: newIndex })
    return newIndex === -1 ? '' : commandHistory[newIndex]
  },

  paletteOpen: false,
  setPaletteOpen: (open) => set({ paletteOpen: open }),

  theme: savedTheme,
  setTheme: (theme) => {
    localStorage.setItem('battu-theme', theme)
    applyThemeToDom(theme)
    set({ theme })
  },

  prices: {},
  updatePrice: (ticker, price, prev) => set((s) => ({
    prices: {
      ...s.prices,
      [ticker]: {
        price,
        change: price - prev,
        changePct: ((price - prev) / prev) * 100,
        direction: price > prev ? 'up' : price < prev ? 'down' : 'flat',
        flashAt: Date.now(),
      }
    }
  })),
}))
