'use client'
import { useState, useCallback } from 'react'
import type { GoalDecomposition } from '@/lib/llm/schemas'

interface DecompModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (decomposition: GoalDecomposition) => Promise<void>
}

type Step = 'input' | 'loading' | 'confirm'

const HABIT_ICONS = ['🎯', '💻', '📝', '🏋️', '📚', '⚡']

function formatHabitFreq(h: GoalDecomposition['habits'][0]): string {
  const freq =
    h.frequencyType === 'daily'
      ? 'daily'
      : h.frequencyType === 'weekly'
        ? `${h.frequencyTarget}× / week`
        : `${h.frequencyTarget}× custom`
  const mode = h.mode === 'time_blocked' ? 'time-blocked' : 'check-off'
  const dur = h.mode === 'time_blocked' && h.durationMins ? ` · ${h.durationMins}m` : ''
  return `${freq}${dur} · ${mode}`
}

export function DecompModal({ open, onClose, onConfirm }: DecompModalProps) {
  const [input, setInput] = useState('')
  const [step, setStep] = useState<Step>('input')
  const [decomposition, setDecomposition] = useState<GoalDecomposition | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const reset = useCallback(() => {
    setInput('')
    setStep('input')
    setDecomposition(null)
    setError(null)
    setCreating(false)
  }, [])

  const handleClose = useCallback(() => {
    reset()
    onClose()
  }, [onClose, reset])

  const handleSubmit = useCallback(async () => {
    const text = input.trim()
    if (!text) return
    setStep('loading')
    setError(null)
    try {
      const res = await fetch('/api/goals/decompose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalText: text }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to decompose goal')
      }
      const { decomposition: result } = await res.json()
      setDecomposition(result)
      setStep('confirm')
    } catch (err) {
      setError((err as Error).message)
      setStep('input')
    }
  }, [input])

  const handleCreate = useCallback(async () => {
    if (!decomposition) return
    setCreating(true)
    setError(null)
    try {
      await onConfirm(decomposition)
      handleClose()
    } catch (err) {
      setError((err as Error).message)
      setCreating(false)
    }
  }, [decomposition, onConfirm, handleClose])

  if (!open) return null

  return (
    <div
      className="apex-overlay show"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div className="apex-modal">
        <h2 style={{ fontWeight: 900, fontSize: 24, letterSpacing: -1 }}>New goal</h2>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
          APEX turns a goal into the right habits — asking only what it needs.
        </p>

        {step === 'input' && (
          <>
            <div className="conv-bubble apex-msg">What goal would you like to build habits around?</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <input
                className="decomp-input"
                placeholder="e.g. Get better at LeetCode for interviews"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
                autoFocus
              />
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!input.trim()}
                style={{
                  background: 'var(--amber)', border: 'none', borderRadius: 11,
                  padding: '9px 16px', fontWeight: 700, cursor: input.trim() ? 'pointer' : 'not-allowed',
                  color: '#1a1206', opacity: input.trim() ? 1 : 0.5,
                }}
              >
                →
              </button>
            </div>
          </>
        )}

        {step === 'loading' && (
          <div className="conv-bubble apex-msg" style={{ marginTop: 16 }}>
            Designing habits for &ldquo;{input.trim()}&rdquo;…
          </div>
        )}

        {step === 'confirm' && decomposition && (
          <>
            <div className="conv-bubble user-msg">{input.trim()}</div>
            <div className="conv-bubble apex-msg">
              Here&apos;s what I&apos;d set up — tweak anything before we create it:
            </div>
            {decomposition.habits.map((h, i) => (
              <div key={i} className="prop-habit-card">
                <span className="hic">{HABIT_ICONS[i % HABIT_ICONS.length]}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5 }}>{h.title}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text2)', marginTop: 1 }}>
                    {formatHabitFreq(h)}
                  </div>
                </div>
                <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>
                  {h.cognitiveClass.replace(/_/g, ' ')}
                </span>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => { setStep('input'); setDecomposition(null) }}
                style={{ padding: '9px 16px', borderRadius: 11, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', fontFamily: 'var(--font-head)', fontWeight: 600 }}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating}
                style={{ padding: '9px 16px', borderRadius: 11, border: 'none', background: 'linear-gradient(180deg, var(--amber), #e0941a)', color: '#1a1206', fontWeight: 700, cursor: creating ? 'wait' : 'pointer', fontFamily: 'var(--font-head)', opacity: creating ? 0.7 : 1 }}
              >
                {creating ? 'Creating…' : `Create ${decomposition.habits.length} habit${decomposition.habits.length === 1 ? '' : 's'}`}
              </button>
            </div>
          </>
        )}

        {error && (
          <div style={{ marginTop: 12, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--pink)' }}>
            {error}
          </div>
        )}

        {step === 'input' && (
          <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={handleClose}
              style={{ padding: '9px 18px', borderRadius: 11, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text2)', cursor: 'pointer', fontWeight: 600 }}
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
