'use client'

import { useState } from 'react'
import type { TriangulationChoice } from '@/lib/tasks/triangulation'
import { choiceFromMultiplier } from '@/lib/tasks/triangulation'

interface TriangulationControlProps {
  multiplier: number
  onChange: (choice: TriangulationChoice) => void
  disabled?: boolean
  mockup?: boolean
}

export function TriangulationControl({ multiplier, onChange, disabled, mockup }: TriangulationControlProps) {
  const [choice, setChoice] = useState<TriangulationChoice>(choiceFromMultiplier(multiplier))

  function pick(c: TriangulationChoice) {
    if (disabled) return
    setChoice(c)
    onChange(c)
  }

  const buttons = (
    <>
      {(['shorter', 'typical', 'longer'] as const).map((c) => (
        <button
          key={c}
          type="button"
          className={choice === c ? 'sel' : undefined}
          aria-label={c === 'shorter' ? 'Smaller than usual' : c === 'longer' ? 'Bigger than usual' : 'Typical'}
          onClick={(e) => {
            e.stopPropagation()
            pick(c)
          }}
        >
          {c === 'shorter' ? '–' : c === 'longer' ? '+' : '•'}
        </button>
      ))}
    </>
  )

  if (mockup) {
    return <div className="todo-trirow">{buttons}</div>
  }

  return (
    <div
      className="triangulation-pop"
      onClick={(e) => e.stopPropagation()}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 5,
        background: 'var(--bg3)',
        border: '1px solid var(--border2)',
        borderRadius: 11,
        padding: '7px 8px',
        boxShadow: '0 8px 24px rgba(0,0,0,.4)',
      }}
    >
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
        vs typical
      </span>
      <div style={{ display: 'flex', gap: 3 }}>{buttons}</div>
    </div>
  )
}
