'use client'
import { useCallback, useRef } from 'react'
import type { Task, TaskTypeTag, EisenhowerQuadrant } from '@/types'

interface TaskDetailProps {
  task: Task
  onUpdateField: (taskId: string, field: keyof Task, value: unknown) => Promise<void>
  onComplete: (taskId: string) => void
  onClose?: () => void
}

function useDebounce<T extends unknown[]>(fn: (...args: T) => void, delay: number) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  return useCallback(
    (...args: T) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => fn(...args), delay)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fn, delay],
  )
}

const EISENHOWER_OPTIONS: { value: EisenhowerQuadrant; label: string }[] = [
  { value: 'urgent_important', label: 'Urgent + Important' },
  { value: 'not_urgent_important', label: 'Not Urgent + Important' },
  { value: 'urgent_not_important', label: 'Urgent + Not Important' },
  { value: 'neither', label: 'Neither' },
]

const TYPE_OPTIONS: TaskTypeTag[] = ['lab', 'pset', 'reading', 'project', 'writeup', 'quiz', 'review', 'exam', 'other']

function getUrgencyColor(score: number): string {
  if (score > 0.6) return 'var(--red)'
  if (score > 0.3) return 'var(--amber)'
  return 'var(--text3)'
}

export function TaskDetail({ task, onUpdateField, onComplete, onClose }: TaskDetailProps) {
  const urgencyColor = getUrgencyColor(task.urgency_score)

  const debouncedUpdate = useDebounce(
    (field: keyof Task, value: unknown) => onUpdateField(task.id, field, value),
    500,
  )

  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    fontFamily: 'var(--font-mono)',
    color: 'var(--text3)',
    textTransform: 'uppercase',
    letterSpacing: '.07em',
    marginBottom: 4,
    marginTop: 14,
  }
  const fieldStyle: React.CSSProperties = {
    fontSize: 12,
    color: 'var(--text)',
    background: 'var(--bg3)',
    border: '1px solid var(--border2)',
    borderRadius: 6,
    padding: '5px 8px',
    width: '100%',
    fontFamily: 'var(--font-head)',
    outline: 'none',
  }

  return (
    <div style={{ overflowY: 'auto', padding: 16, scrollbarWidth: 'thin' }}>
      {/* Task name (editable, debounced) */}
      <input
        type="text"
        defaultValue={task.task_name}
        onChange={(e) => debouncedUpdate('task_name', e.target.value)}
        style={{
          ...fieldStyle,
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: '-.01em',
          marginBottom: 2,
          background: 'transparent',
          border: 'none',
          padding: '0 0 2px',
          borderBottom: '1px solid var(--border2)',
        }}
        aria-label="Task name"
      />
      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text3)' }}>
        Selected task
      </div>

      {/* Topic */}
      <div style={labelStyle}>Topic</div>
      <input
        type="text"
        defaultValue={task.topic}
        onChange={(e) => debouncedUpdate('topic', e.target.value)}
        placeholder="Course, CMR, Startup…"
        style={fieldStyle}
        aria-label="Topic"
      />

      {/* Task type */}
      <div style={labelStyle}>Type</div>
      <select
        defaultValue={task.task_type_tag}
        onChange={(e) => onUpdateField(task.id, 'task_type_tag', e.target.value as TaskTypeTag)}
        style={{ ...fieldStyle, cursor: 'pointer' }}
        aria-label="Task type"
      >
        {TYPE_OPTIONS.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

      {/* Do date */}
      <div style={labelStyle}>Do date</div>
      <input
        type="date"
        defaultValue={task.do_date ?? ''}
        onChange={(e) => onUpdateField(task.id, 'do_date', e.target.value || null)}
        style={fieldStyle}
        aria-label="Do date"
      />

      {/* Due date */}
      <div style={labelStyle}>Due date</div>
      <input
        type="datetime-local"
        defaultValue={task.due_date ? task.due_date.slice(0, 16) : ''}
        onChange={(e) =>
          onUpdateField(task.id, 'due_date', e.target.value ? new Date(e.target.value).toISOString() : null)
        }
        style={{ ...fieldStyle, color: urgencyColor }}
        aria-label="Due date"
      />

      {/* Priority (Eisenhower) */}
      <div style={labelStyle}>Priority</div>
      <select
        defaultValue={task.eisenhower_quadrant}
        onChange={(e) => onUpdateField(task.id, 'eisenhower_quadrant', e.target.value as EisenhowerQuadrant)}
        style={fieldStyle}
        aria-label="Priority"
      >
        {EISENHOWER_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {/* Urgency score (read-only) */}
      <div style={labelStyle}>Urgency score</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: urgencyColor }}>
        {task.urgency_score.toFixed(2)}
      </div>
      <div style={{ height: 4, background: 'var(--bg4)', borderRadius: 2, marginTop: 6 }}>
        <div
          style={{
            height: '100%',
            borderRadius: 2,
            background: urgencyColor,
            width: `${Math.min(task.urgency_score * 100, 100)}%`,
          }}
        />
      </div>

      {/* Time estimate (debounced) */}
      <div style={labelStyle}>Time estimate</div>
      <input
        type="number"
        step="0.25"
        min="0"
        defaultValue={task.estimated_hours ?? ''}
        onChange={(e) => debouncedUpdate('estimated_hours', parseFloat(e.target.value) || null)}
        style={{ ...fieldStyle, width: 80 }}
        aria-label="Estimated hours"
        placeholder="h"
      />

      {/* Description (debounced) */}
      <div style={labelStyle}>Description</div>
      <textarea
        defaultValue={task.description ?? ''}
        onChange={(e) => debouncedUpdate('description', e.target.value)}
        rows={3}
        style={{ ...fieldStyle, resize: 'vertical', lineHeight: 1.6, fontSize: 11, color: 'var(--text2)' }}
        aria-label="Description"
      />

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 6, marginTop: 14, flexWrap: 'wrap' }}>
        <button
          onClick={() => onComplete(task.id)}
          style={{
            fontSize: 10,
            fontFamily: 'var(--font-mono)',
            padding: '5px 10px',
            borderRadius: 6,
            background: 'var(--amber)',
            color: '#000',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Mark done
        </button>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              padding: '5px 10px',
              borderRadius: 6,
              background: 'var(--bg2)',
              color: 'var(--text2)',
              border: '1px solid var(--border2)',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        )}
      </div>
    </div>
  )
}
