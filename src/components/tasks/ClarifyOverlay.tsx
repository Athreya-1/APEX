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
  onCancel?: () => void
}

export function ClarifyOverlay({ active, messages, chips, onChip, onCancel }: ClarifyOverlayProps) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <>
      <div
        className={`todo-scrim${active ? ' show' : ''}`}
        aria-hidden={!active}
        onClick={onCancel}
      />
      <div className={`todo-thread${active ? ' show' : ''}`}>
        <div className="todo-thread-inner">
          {messages.map((m, i) => (
            <div key={i} className={`todo-msg ${m.role === 'system' ? 'sys' : 'you'}`}>
              {m.text}
            </div>
          ))}
          {chips && chips.length > 0 && (
            <div className="todo-qr">
              {chips.map((c) => (
                <button key={c} type="button" className="todo-qrchip" onClick={() => onChip(c)}>
                  {c}
                </button>
              ))}
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>
    </>
  )
}
