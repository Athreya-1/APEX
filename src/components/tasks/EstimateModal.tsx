'use client'
import { useEffect, useState } from 'react'
import { EST_STOPS, DEFAULT_EST_STOP_INDEX, formatEstimateHours, hoursFromStopIndex } from '@/lib/tasks/estimate-stops'

interface EstimateModalProps {
  open: boolean
  taskTitle: string
  suggestedHours?: number
  onConfirm: (hours: number) => void
  onCancel: () => void
}

export function EstimateModal({ open, taskTitle, suggestedHours, onConfirm, onCancel }: EstimateModalProps) {
  const [stopIndex, setStopIndex] = useState(DEFAULT_EST_STOP_INDEX)

  useEffect(() => {
    if (!open) return
    if (suggestedHours != null) {
      let best = DEFAULT_EST_STOP_INDEX
      let diff = Infinity
      EST_STOPS.forEach((s, i) => {
        const d = Math.abs(s - suggestedHours)
        if (d < diff) { diff = d; best = i }
      })
      setStopIndex(best)
    } else {
      setStopIndex(DEFAULT_EST_STOP_INDEX)
    }
  }, [open, suggestedHours])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Enter') onConfirm(hoursFromStopIndex(stopIndex))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, stopIndex, onConfirm, onCancel])

  if (!open) return null

  const hours = hoursFromStopIndex(stopIndex)
  const hint = hours >= 13 ? 'Large block — planner may split across sessions.' : undefined

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="est-modal-title"
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 360,
          background: 'var(--bg2)',
          border: '1px solid var(--border2)',
          borderRadius: 16,
          padding: '20px 22px',
        }}
      >
        <div id="est-modal-title" style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
          Set a time estimate
        </div>
        <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 16, lineHeight: 1.5 }}>
          First time for this kind of task — your answer trains future estimates for &ldquo;{taskTitle}&rdquo;.
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 500,
          color: 'var(--amber)', textAlign: 'center', marginBottom: 12,
        }}>
          {formatEstimateHours(hours)}
        </div>
        <input
          type="range"
          min={0}
          max={EST_STOPS.length - 1}
          step={1}
          value={stopIndex}
          onChange={(e) => setStopIndex(Number(e.target.value))}
          aria-label="Estimate hours"
          style={{ width: '100%', accentColor: 'var(--amber)' }}
        />
        {hint && (
          <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 10, fontFamily: 'var(--font-mono)' }}>
            {hint}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 10,
              background: 'var(--bg3)', border: '1px solid var(--border2)',
              color: 'var(--text2)', fontSize: 12, cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(hours)}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 10,
              background: 'var(--amber)', border: 'none',
              color: '#000', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Set estimate
          </button>
        </div>
      </div>
    </div>
  )
}
