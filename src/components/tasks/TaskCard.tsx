'use client'

import { useCallback, useRef } from 'react'
import { format, isToday, isTomorrow, differenceInDays } from 'date-fns'
import type { Task, TaskTypeTag, EisenhowerQuadrant, TaskFieldDef, TaskFieldValue } from '@/types'
import { formatEstimateHours } from '@/lib/tasks/estimate-stops'
import { SparkIcon } from '@/components/ui/SparkIcon'
import { TriangulationControl } from './TriangulationControl'
import { CustomFieldsSection } from './CustomFieldsSection'
import type { TriangulationChoice } from '@/lib/tasks/triangulation'

interface TaskCardProps {
  task: Task
  isOpen: boolean
  onToggle: (id: string) => void
  onComplete: (id: string) => void
  onUpdateField: (taskId: string, field: keyof Task, value: unknown) => Promise<void>
  onTriangulation?: (taskId: string, choice: TriangulationChoice) => void
  onRequestEstimate?: (taskId: string) => void
  fieldDefs?: TaskFieldDef[]
  fieldValues?: TaskFieldValue[]
  onSetFieldValue?: (fieldDefId: string, value: unknown) => Promise<void>
  onAddFieldDef?: (name: string, kind: TaskFieldDef['kind'], options?: string[]) => Promise<void>
}

const EISENHOWER_OPTIONS: { value: EisenhowerQuadrant; label: string }[] = [
  { value: 'urgent_important', label: 'Urgent + Important' },
  { value: 'not_urgent_important', label: 'Not Urgent + Important' },
  { value: 'urgent_not_important', label: 'Urgent + Not Important' },
  { value: 'neither', label: 'Neither' },
]

const TYPE_OPTIONS: TaskTypeTag[] = ['lab', 'pset', 'reading', 'project', 'writeup', 'quiz', 'review', 'exam', 'other']

function useDebounce<T extends unknown[]>(fn: (...args: T) => void, delay: number) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  return useCallback(
    (...args: T) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => fn(...args), delay)
    },
    [fn, delay],
  )
}

function formatDueShort(dateStr: string | null | undefined): { label: string; urgent: boolean } {
  if (!dateStr) return { label: '', urgent: false }
  const date = new Date(dateStr)
  const days = differenceInDays(date, new Date())
  if (isToday(date)) return { label: 'Today', urgent: true }
  if (isTomorrow(date)) return { label: 'Thu', urgent: days <= 1 }
  return { label: format(date, 'EEE'), urgent: days <= 1 }
}

function getUrgencyPct(score: number): number {
  return Math.min(Math.round(score * 100), 100)
}

export function TaskCard({
  task,
  isOpen,
  onToggle,
  onComplete,
  onUpdateField,
  onTriangulation,
  onRequestEstimate,
  fieldDefs = [],
  fieldValues = [],
  onSetFieldValue,
  onAddFieldDef,
}: TaskCardProps) {
  const isDone = task.status === 'done'
  const isCold = task.estimated_hours == null
  const estHours = task.estimated_hours ?? task.ai_estimated_hours
  const { label: dueLabel, urgent: dueUrgent } = formatDueShort(task.due_date)
  const urgPct = getUrgencyPct(task.urgency_score)
  const debouncedUpdate = useDebounce(
    (field: keyof Task, value: unknown) => onUpdateField(task.id, field, value),
    500,
  )

  const courseTag = task.topic?.split(' ')[0] ?? task.topic

  return (
    <article className={`todo-task${isOpen ? ' open' : ''}${isDone ? ' done' : ''}`}>
      <div
        className="todo-trow"
        onClick={() => !isDone && onToggle(task.id)}
        onKeyDown={(e) => e.key === 'Enter' && onToggle(task.id)}
        role="button"
        tabIndex={0}
      >
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

        <div className="todo-tags">
          {courseTag && <span className="todo-tag course">{courseTag}</span>}
          {task.task_type_tag && task.task_type_tag !== 'other' && (
            <span className="todo-tag type">{task.task_type_tag}</span>
          )}
        </div>

        <span className="todo-spacer" />

        <div className="todo-ubar" role="progressbar" aria-valuenow={urgPct} aria-hidden={!isOpen}>
          <i style={{ width: `${urgPct}%` }} />
        </div>

        <div className="todo-est" onClick={(e) => e.stopPropagation()}>
          {isCold ? (
            <button
              type="button"
              className="todo-estpill cold"
              onClick={() => onRequestEstimate?.(task.id)}
            >
              <SparkIcon />
              Estimate
            </button>
          ) : (
            <>
              <span className="todo-estpill estval">
                <SparkIcon />
                {estHours != null ? formatEstimateHours(estHours) : '—'}
              </span>
              {onTriangulation && (
                <div className="todo-tri">
                  <span className="todo-tricap">vs typical</span>
                  <TriangulationControl
                    mockup
                    multiplier={task.triangulation_multiplier ?? 1}
                    onChange={(c) => onTriangulation(task.id, c)}
                  />
                </div>
              )}
            </>
          )}
        </div>

        {dueLabel && (
          <span className={`todo-due${dueUrgent ? ' urg' : ''}`}>{dueLabel}</span>
        )}
      </div>

      <div className="todo-detail">
        <div className="todo-detail-inner">
          <div className="todo-fgrid">
            <div className="todo-field">
              <div className="fl">Topic</div>
              <input
                className="fv"
                type="text"
                defaultValue={task.topic ?? ''}
                onChange={(e) => debouncedUpdate('topic', e.target.value)}
                onClick={(e) => e.stopPropagation()}
                aria-label="Topic"
              />
            </div>
            <div className="todo-field">
              <div className="fl">Type</div>
              <select
                className="fv"
                defaultValue={task.task_type_tag}
                onChange={(e) => onUpdateField(task.id, 'task_type_tag', e.target.value as TaskTypeTag)}
                onClick={(e) => e.stopPropagation()}
                aria-label="Type"
              >
                {TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="todo-field">
              <div className="fl">Do date</div>
              <input
                className="fv"
                type="date"
                defaultValue={task.do_date ?? ''}
                onChange={(e) => onUpdateField(task.id, 'do_date', e.target.value || null)}
                onClick={(e) => e.stopPropagation()}
                aria-label="Do date"
              />
            </div>
            <div className="todo-field">
              <div className="fl">Due</div>
              <input
                className="fv"
                type="datetime-local"
                defaultValue={task.due_date ? task.due_date.slice(0, 16) : ''}
                onChange={(e) =>
                  onUpdateField(
                    task.id,
                    'due_date',
                    e.target.value ? new Date(e.target.value).toISOString() : null,
                  )
                }
                onClick={(e) => e.stopPropagation()}
                aria-label="Due date"
              />
            </div>
            <div className="todo-field">
              <div className="fl">Priority</div>
              <select
                className="fv"
                defaultValue={task.eisenhower_quadrant}
                onChange={(e) =>
                  onUpdateField(task.id, 'eisenhower_quadrant', e.target.value as EisenhowerQuadrant)
                }
                onClick={(e) => e.stopPropagation()}
                aria-label="Priority"
              >
                {EISENHOWER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="todo-field">
              <div className="fl">Estimate</div>
              {isCold ? (
                <button
                  type="button"
                  className="fv sel"
                  style={{ cursor: 'pointer', width: '100%', textAlign: 'left' }}
                  onClick={(e) => {
                    e.stopPropagation()
                    onRequestEstimate?.(task.id)
                  }}
                >
                  Set estimate →
                </button>
              ) : (
                <div className="fv sel">{estHours != null ? formatEstimateHours(estHours) : '—'}</div>
              )}
            </div>
            <div className="todo-field wide">
              <div className="fl">Description</div>
              <textarea
                className="fv"
                rows={2}
                defaultValue={task.description ?? ''}
                onChange={(e) => debouncedUpdate('description', e.target.value)}
                onClick={(e) => e.stopPropagation()}
                aria-label="Description"
              />
            </div>
          </div>

          {onSetFieldValue && onAddFieldDef && (
            <CustomFieldsSection
              fieldDefs={fieldDefs}
              values={fieldValues}
              onSetValue={onSetFieldValue}
              onAddField={onAddFieldDef}
            />
          )}
        </div>
      </div>
    </article>
  )
}
