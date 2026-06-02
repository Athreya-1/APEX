'use client'
import { useEffect, useRef } from 'react'

export interface ClarifyMessage {
  role: 'system' | 'user'
  text: string
}

interface ClarifyOverlayProps {
  active: boolean
  messages: ClarifyMessage[]
  chips?: string[]
  onChip: (value: string) => void
}

export function ClarifyOverlay({ active, messages, chips, onChip }: ClarifyOverlayProps) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (!active) return null

  return (
    <>
      <div
        aria-hidden
        style={{
          position: 'absolute', inset: 0, zIndex: 5,
          background: 'rgba(0,0,0,.55)',
          pointerEvents: 'none',
        }}
      />
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 72, zIndex: 6,
        maxHeight: '45%', overflowY: 'auto', padding: '12px 16px',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.role === 'system' ? 'flex-start' : 'flex-end',
              maxWidth: '85%',
              padding: '10px 14px',
              borderRadius: m.role === 'system' ? '14px 14px 14px 4px' : '14px 14px 4px 14px',
              background: m.role === 'system' ? 'rgba(245,166,35,.12)' : 'var(--bg3)',
              border: `1px solid ${m.role === 'system' ? 'rgba(245,166,35,.25)' : 'var(--border2)'}`,
              fontSize: 12,
              lineHeight: 1.5,
              color: m.role === 'system' ? 'var(--amber)' : 'var(--text)',
            }}
          >
            {m.text}
          </div>
        ))}
        {chips && chips.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            {chips.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onChip(c)}
                style={{
                  fontSize: 11, padding: '6px 12px', borderRadius: 20,
                  background: 'var(--bg3)', border: '1px solid var(--border2)',
                  color: 'var(--text)', cursor: 'pointer',
                }}
              >
                {c}
              </button>
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>
    </>
  )
}
