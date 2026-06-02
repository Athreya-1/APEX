'use client'
import { useState } from 'react'
import type { TriangulationChoice } from '@/lib/tasks/triangulation'
import { choiceFromMultiplier } from '@/lib/tasks/triangulation'

interface TriangulationControlProps {
  multiplier: number
  onChange: (choice: TriangulationChoice) => void
  disabled?: boolean
}

export function TriangulationControl({ multiplier, onChange, disabled }: TriangulationControlProps) {
  const [choice, setChoice] = useState<TriangulationChoice>(choiceFromMultiplier(multiplier))

  function pick(c: TriangulationChoice) {
    if (disabled) return
    setChoice(c)
    onChange(c)
  }

  const btn = (c: TriangulationChoice, label: string) => (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => { e.stopPropagation(); pick(c) }}
      style={{
        width: 26, height: 24, borderRadius: 7, border: 'none', cursor: disabled ? 'default' : 'pointer',
        fontSize: 13, fontFamily: 'var(--font-mono)',
        background: choice === c ? 'rgba(245,166,35,.16)' : 'transparent',
        color: choice === c ? 'var(--amber)' : 'var(--text2)',
        transition: 'background .15s, color .15s',
      }}
    >
      {c === 'shorter' ? '–' : c === 'longer' ? '+' : '•'}
    </button>
  )

  return (
    <div
      className="triangulation-pop"
      onClick={(e) => e.stopPropagation()}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
        background: 'var(--bg3)', border: '1px solid var(--border2)',
        borderRadius: 11, padding: '7px 8px',
        boxShadow: '0 8px 24px rgba(0,0,0,.4)',
      }}
    >
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
        vs typical
      </span>
      <div style={{ display: 'flex', gap: 3 }}>
        {btn('shorter', 'Smaller than usual')}
        {btn('typical', 'Typical')}
        {btn('longer', 'Bigger than usual')}
      </div>
    </div>
  )
}
