'use client'
import type { TaskEffortHistory } from '@/types'

interface AccuracyTableProps {
  history: TaskEffortHistory[]
}

export function AccuracyTable({ history }: AccuracyTableProps) {
  if (!history.length) return null
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>
        Estimate accuracy
      </div>
      <div>
        {history.slice(0, 6).map((h) => {
          const diff = (h.actual_hours ?? 0) - (h.estimated_hours ?? 0)
          const isOver = diff > 0.1
          const isUnder = diff < -0.1
          return (
            <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ flex: 1, fontSize: 11, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {h.task_name_sample}
              </div>
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text3)' }}>
                {h.estimated_hours?.toFixed(1)}h est
              </span>
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text2)' }}>
                {h.actual_hours?.toFixed(1)}h act
              </span>
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: isOver ? 'var(--red)' : isUnder ? 'var(--green)' : 'var(--amber)', minWidth: 40, textAlign: 'right' }}>
                {isOver ? '+' : ''}{diff.toFixed(1)}h
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
