'use client'

import { useEffect, useState } from 'react'
import { EST_STOPS, DEFAULT_EST_STOP_INDEX, formatEstimateHours, hoursFromStopIndex } from '@/lib/tasks/estimate-stops'
import { SparkIcon } from '@/components/ui/SparkIcon'

interface EstimateModalProps {
  open: boolean
  taskTitle: string
  suggestedHours?: number
  onConfirm: (hours: number) => void
  onCancel: () => void
}

const PRESET_INDICES = [1, 3, 5, 8, 12, 16]

export function EstimateModal({ open, taskTitle, suggestedHours, onConfirm, onCancel }: EstimateModalProps) {
  const [stopIndex, setStopIndex] = useState(DEFAULT_EST_STOP_INDEX)

  useEffect(() => {
    if (!open) return
    if (suggestedHours != null) {
      let best = DEFAULT_EST_STOP_INDEX
      let diff = Infinity
      EST_STOPS.forEach((s, i) => {
        const d = Math.abs(s - suggestedHours)
        if (d < diff) {
          diff = d
          best = i
        }
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

  const hours = hoursFromStopIndex(stopIndex)
  const hint = hours >= 13 ? 'Large block — planner may split across sessions.' : ''

  return (
    <div
      className={`todo-estmodal${open ? ' show' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="est-modal-title"
      onClick={onCancel}
    >
      <div
        className="todo-estmodal-card"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="todo-ep-head">
          <div className="todo-ep-ic">
            <SparkIcon className="todo-autoic" />
          </div>
          <div>
            <div id="est-modal-title" className="todo-ep-title">
              How long will <b>{taskTitle}</b> take?
            </div>
            <p className="todo-ep-sub">
              First time for this kind of task — your answer trains future estimates.
            </p>
          </div>
        </div>

        <div className="todo-ep-presets">
          {PRESET_INDICES.map((i) => (
            <button
              key={i}
              type="button"
              className={stopIndex === i ? 'on' : ''}
              onClick={() => setStopIndex(i)}
            >
              {formatEstimateHours(EST_STOPS[i])}
            </button>
          ))}
        </div>

        <div className="todo-ep-sliderrow">
          <div className="todo-ep-bigval">
            {hours < 1 ? `${Math.round(hours * 60)}` : hours % 1 === 0 ? `${hours}` : hours.toFixed(1)}
            <span>{hours < 1 ? 'm' : 'h'}</span>
          </div>
          <div className="todo-ep-sliderwrap">
            <input
              type="range"
              className="todo-ep-range"
              min={0}
              max={EST_STOPS.length - 1}
              step={1}
              value={stopIndex}
              onChange={(e) => setStopIndex(Number(e.target.value))}
              aria-label="Estimate hours"
            />
            <div className="todo-ep-scale">
              <span>30m</span>
              <span>24h</span>
            </div>
          </div>
        </div>

        <p className={`todo-ep-hint${hint ? ' show' : ''}`}>{hint}</p>

        <div className="todo-ep-foot">
          <button type="button" className="lnk" onClick={onCancel}>
            Skip for now
          </button>
          <button type="button" className="todo-btn-primary" onClick={() => onConfirm(hours)}>
            Set estimate
          </button>
        </div>
      </div>
    </div>
  )
}
