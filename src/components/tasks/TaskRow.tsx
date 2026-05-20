'use client'
import { format, isToday, isTomorrow, differenceInDays } from 'date-fns'
import type { Task } from '@/types'

interface TaskRowProps {
  task: Task
  onComplete: (id: string) => void
  onSelect: (id: string) => void
  isSelected: boolean
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

function getUrgencyColor(score: number): string {
  if (score > 0.6) return 'var(--red)'
  if (score > 0.3) return 'var(--amber)'
  return 'var(--text3)'
}

export function TaskRow({ task, onComplete, onSelect, isSelected }: TaskRowProps) {
  const isDone = task.status === 'done'
  const score = task.urgency_score
  const urgencyColor = getUrgencyColor(score)
  const { label: dueLabel, urgency } = formatDueDate(task.due_date)

  return (
    <div
      style={{
        display: 'flex', alignItems: 'flex-start', gap: '10px',
        padding: '9px 20px', cursor: 'pointer',
        background: isSelected ? 'var(--bg2)' : 'transparent',
        position: 'relative', transition: 'background .12s',
        opacity: isDone ? 0.4 : 1,
      }}
      onClick={() => !isDone && onSelect(task.id)}
    >
      {isSelected && (
        <div style={{
          position: 'absolute', left: 0, top: 6, bottom: 6,
          width: 2, borderRadius: 1, background: 'var(--amber)',
        }} />
      )}

      <div
        role="checkbox"
        aria-checked={isDone}
        onClick={(e) => { e.stopPropagation(); onComplete(task.id) }}
        style={{
          width: 16, height: 16, borderRadius: 4,
          border: isDone ? 'none' : '1px solid var(--border2)',
          background: isDone ? 'var(--green)' : 'transparent',
          flexShrink: 0, marginTop: 2, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all .15s',
        }}
      >
        {isDone && <span style={{ fontSize: 10, color: '#000' }}>✓</span>}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '12.5px', fontWeight: 500,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          textDecoration: isDone ? 'line-through' : 'none',
          color: isDone ? 'var(--text3)' : 'var(--text)',
        }}>
          {task.task_name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
          {task.topic && (
            <span style={{
              fontSize: 9, fontFamily: 'var(--font-mono)', padding: '1px 6px',
              borderRadius: 3, textTransform: 'uppercase', letterSpacing: '.05em',
              background: 'var(--bg4)', color: task.course?.color ?? 'var(--text2)',
            }}>
              {task.topic}
            </span>
          )}
          {task.task_type_tag && task.task_type_tag !== 'other' && (
            <span style={{
              fontSize: 9, fontFamily: 'var(--font-mono)', padding: '1px 6px',
              borderRadius: 3, textTransform: 'uppercase', letterSpacing: '.05em',
              background: 'var(--amber-bg)', color: 'var(--amber)',
            }}>
              {task.task_type_tag}
            </span>
          )}
          {dueLabel && (
            <span style={{
              fontSize: 10, fontFamily: 'var(--font-mono)',
              color: urgency === 'urgent' ? 'var(--red)' : urgency === 'soon' ? 'var(--amber)' : 'var(--text3)',
            }}>
              {dueLabel}
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
        <div
          role="progressbar"
          aria-valuenow={Math.round(score * 100)}
          style={{ width: 32, height: 3, borderRadius: 2, background: 'var(--bg4)' }}
        >
          <div style={{
            height: '100%', borderRadius: 2,
            width: `${Math.min(score * 100, 100)}%`,
            background: urgencyColor,
          }} />
        </div>
        {task.estimated_hours != null && (
          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text3)' }}>
            ~{task.estimated_hours % 1 === 0
              ? `${task.estimated_hours}h`
              : `${Math.round(task.estimated_hours * 60)}m`}
          </span>
        )}
      </div>
    </div>
  )
}
