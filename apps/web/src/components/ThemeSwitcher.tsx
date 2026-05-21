import { useTerminal } from '@/store/terminal'
import { THEMES } from '@battu/shared'
import type { ThemeName } from '@battu/shared'

const THEME_SHORT: Record<ThemeName, string> = {
  amber:    'AMB',
  ice:      'ICE',
  phosphor: 'PHO',
}

export function ThemeSwitcher() {
  const theme    = useTerminal((s) => s.theme)
  const setTheme = useTerminal((s) => s.setTheme)

  return (
    <div className="flex items-center gap-1">
      {(Object.keys(THEMES) as ThemeName[]).map((t) => (
        <button
          key={t}
          onClick={() => setTheme(t)}
          title={THEMES[t].label}
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '9px',
            letterSpacing: '1px',
            padding: '2px 6px',
            background: 'transparent',
            color: theme === t
              ? THEMES[t].tokens.accent
              : THEMES[theme].tokens.muted,
            border: `1px solid ${theme === t
              ? THEMES[t].tokens.accent
              : THEMES[theme].tokens.border}`,
            borderRadius: '2px',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          {THEME_SHORT[t]}
        </button>
      ))}
    </div>
  )
}
