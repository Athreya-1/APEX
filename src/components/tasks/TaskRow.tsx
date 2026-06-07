'use client'

import { format, isToday, isTomorrow, differenceInDays } from 'date-fns'
import type { Task } from '@/types'
import { formatEstimateHours } from '@/lib/tasks/estimate-stops'
import type { TriangulationChoice } from '@/lib/tasks/triangulation'

interface TaskRowProps {
  task: Task
  onComplete: (id: string) => void
  onSelect: (id: string) => void
  isSelected: boolean
  onTriangulation?: (taskId: string, choice: TriangulationChoice) => void
  onRequestEstimate?: (taskId: string) => void
}

function formatDueDate(dateStr: string | null | undefined): { label: string; urgency: 'urgent' | 'soon' | 'normal' } {
  if (!dateStr) return { label: '', urgency: 'normal' }
  const date = new Date(dateStr)
  const days = differenceInDays(date, new Date())
  let label = ''
  if (isToday(date)) label = 'Due today'
  else if (isTomorrow(date)) label = 'Due tomorrow'
  else label = `Due ${format(date, 'EEE MMM d')}`
  const urgency = days <= 1 ? 'urgent' : days <= 3 ? 'soon' : 'normal'
  return { label, urgency }
}

/** Legacy row used in tests; production uses TaskCard accordion. */
export function TaskRow({ task, onComplete, onSelect, isSelected, onRequestEstimate }: TaskRowProps) {
  const isDone = task.status === 'done'
  const score = task.urgency_score
  const { label: dueLabel } = formatDueDate(task.due_date)
  const isCold = task.estimated_hours == null
  const estHours = task.estimated_hours ?? task.ai_estimated_hours
  const urgPct = Math.min(Math.round(score * 100), 100)

  return (
    <article className={`todo-task${isSelected ? ' open' : ''}`}>
      <div className="todo-trow" onClick={() => !isDone && onSelect(task.id)}>
        <div
          className={`todo-cbox${isDone ? ' done' : ''}`}
          role="checkbox"
          aria-checked={isDone}
          onClick={(e) => {
            e.stopPropagation()
            onComplete(task.id)
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden>
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <span className="todo-nm">{task.task_name}</span>
        <span className="todo-spacer" />
        <div className="todo-ubar" role="progressbar" aria-valuenow={urgPct}>
          <i style={{ width: `${urgPct}%` }} />
        </div>
        <div className="todo-est">
          {isCold ? (
            <button type="button" className="todo-estpill cold" onClick={() => onRequestEstimate?.(task.id)}>
              Estimate
            </button>
          ) : (
            <span className="todo-estpill">{estHours != null ? formatEstimateHours(estHours) : '—'}</span>
          )}
        </div>
        {dueLabel && <span className="todo-due">{dueLabel}</span>}
      </div>
    </article>
  )
}
