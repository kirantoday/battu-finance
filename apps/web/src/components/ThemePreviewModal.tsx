import { useState } from 'react'
import { THEMES } from '@battu/shared'
import type { ThemeName } from '@battu/shared'
import { useTerminal } from '@/store/terminal'

interface Props {
  open: boolean
  onClose: () => void
}

export function ThemePreviewModal({ open, onClose }: Props) {
  const theme    = useTerminal((s) => s.theme)
  const setTheme = useTerminal((s) => s.setTheme)
  const [hovering, setHovering] = useState<ThemeName | null>(null)

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#0A0A0A',
          border: '1px solid #222',
          borderRadius: '4px',
          padding: '24px',
          width: '720px',
          maxWidth: '95vw',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '11px', letterSpacing: '3px',
          color: '#666', marginBottom: '20px',
          textTransform: 'uppercase',
          display: 'flex', justifyContent: 'space-between',
        }}>
          <span>Select Terminal Theme</span>
          <span
            style={{ cursor: 'pointer', color: '#444' }}
            onClick={onClose}
          >ESC</span>
        </div>

        {/* Theme cards */}
        <div style={{ display: 'flex', gap: '12px' }}>
          {(Object.entries(THEMES) as [ThemeName, typeof THEMES[ThemeName]][]).map(([name, t]) => {
            const active = theme === name
            const hov = hovering === name
            return (
              <div
                key={name}
                onMouseEnter={() => setHovering(name)}
                onMouseLeave={() => setHovering(null)}
                onClick={() => { setTheme(name); onClose() }}
                style={{
                  flex: 1,
                  background: t.tokens.bg,
                  border: `2px solid ${active || hov ? t.tokens.accent : t.tokens.border}`,
                  borderRadius: '3px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s',
                }}
              >
                {/* Mini terminal preview */}
                <div style={{
                  background: t.tokens.headerBg,
                  borderBottom: `1px solid ${t.tokens.border}`,
                  padding: '5px 8px',
                  display: 'flex', justifyContent: 'space-between',
                }}>
                  <span style={{
                    fontFamily: 'monospace', fontSize: '9px',
                    color: t.tokens.accent, fontWeight: 'bold',
                    letterSpacing: '2px',
                    textShadow: t.tokens.glow !== 'none' ? t.tokens.glow : undefined,
                  }}>BATTU</span>
                  {active && (
                    <span style={{ fontSize: '8px', color: t.tokens.positive }}>● ACTIVE</span>
                  )}
                </div>
                <div style={{
                  background: t.tokens.cmdBg,
                  borderBottom: `1px solid ${t.tokens.border}`,
                  padding: '4px 8px',
                  display: 'flex', gap: '6px',
                }}>
                  <span style={{ color: t.tokens.accent, fontSize: '10px' }}>›</span>
                  <span style={{ color: t.tokens.text, fontSize: '9px', fontFamily: 'monospace' }}>
                    DES AAPL
                  </span>
                </div>
                <div style={{ padding: '8px', fontFamily: 'monospace' }}>
                  {([
                    ['LAST PRICE', '$213.49', t.tokens.positive],
                    ['MARKET CAP', '$3.21T',  t.tokens.valueColor],
                    ['P/E RATIO',  '32.4x',   t.tokens.valueColor],
                    ['52W HIGH',   '$237.23', t.tokens.valueColor],
                  ] as [string, string, string][]).map(([label, val, color]) => (
                    <div key={label} style={{
                      display: 'flex', justifyContent: 'space-between',
                      padding: '2px 0',
                      borderBottom: `1px solid ${t.tokens.divider}`,
                    }}>
                      <span style={{ fontSize: '8px', color: t.tokens.labelColor }}>{label}</span>
                      <span style={{ fontSize: '8px', color }}>{val}</span>
                    </div>
                  ))}
                </div>
                <div style={{
                  padding: '6px 8px',
                  background: t.tokens.tickerBg,
                  borderTop: `1px solid ${t.tokens.border}`,
                  textAlign: 'center',
                  fontFamily: 'monospace',
                  fontSize: '9px',
                  letterSpacing: '1px',
                  color: active ? t.tokens.accent : t.tokens.muted,
                }}>
                  {t.label.toUpperCase()}
                </div>
              </div>
            )
          })}
        </div>

        <div style={{
          marginTop: '16px', textAlign: 'center',
          fontSize: '9px', letterSpacing: '2px', color: '#333',
          fontFamily: 'monospace',
        }}>
          CLICK TO APPLY · PREFERENCE SAVED AUTOMATICALLY
        </div>
      </div>
    </div>
  )
}
