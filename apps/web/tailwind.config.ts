import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'battu-bg':        'var(--battu-bg)',
        'battu-surface':   'var(--battu-surface)',
        'battu-border':    'var(--battu-border)',
        'battu-text':      'var(--battu-text)',
        'battu-muted':     'var(--battu-muted)',
        'battu-accent':    'var(--battu-accent)',
        'battu-positive':  'var(--battu-positive)',
        'battu-negative':  'var(--battu-negative)',
        'battu-warning':   'var(--battu-warning)',
        'battu-header':    'var(--battu-header-bg)',
        'battu-cmd':       'var(--battu-cmd-bg)',
        'battu-label':     'var(--battu-label-color)',
        'battu-value':     'var(--battu-value-color)',
        'battu-title':     'var(--battu-title-color)',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config
