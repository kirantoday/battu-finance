import type { Config } from 'tailwindcss'
import { THEME } from '@battu/shared'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'battu-bg':       THEME.bg,
        'battu-surface':  THEME.surface,
        'battu-border':   THEME.border,
        'battu-text':     THEME.text,
        'battu-muted':    THEME.muted,
        'battu-accent':   THEME.accent,
        'battu-positive': THEME.positive,
        'battu-negative': THEME.negative,
        'battu-warning':  THEME.warning,
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config
