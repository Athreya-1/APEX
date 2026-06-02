'use client'
import { useMemo } from 'react'
import { differenceInDays, isToday, parseISO } from 'date-fns'
import { TaskRow } from './TaskRow'
import type { Task } from '@/types'
import type { TriangulationChoice } from '@/lib/tasks/triangulation'

interface TaskListProps {
  tasks: Task[]
  onComplete: (id: string) => void
  onSelectTask: (id: string) => void
  selectedTaskId: string | null
  onTriangulation?: (taskId: string, choice: TriangulationChoice) => void
  onRequestEstimate?: (taskId: string) => void
}

interface TaskGroup {
  id: string
  label: string
  dotColor: string
  tasks: Task[]
}

function groupTasks(tasks: Task[]): TaskGroup[] {
  const pending = tasks.filter((t) => t.status !== 'done')
  const done = tasks.filter((t) => t.status === 'done')

  const urgent = pending.filter((t) => {
    const isDoToday = t.do_date ? isToday(parseISO(t.do_date)) : false
    return t.urgency_score > 0.6 || isDoToday
  })
  const urgentIds = new Set(urgent.map((t) => t.id))

  const thisWeek = pending.filter((t) => {
    if (urgentIds.has(t.id)) return false
    if (!t.due_date) return false
    const days = differenceInDays(parseISO(t.due_date), new Date())
    return days >= 0 && days <= 7
  })
  const thisWeekIds = new Set(thisWeek.map((t) => t.id))

  const later = pending.filter((t) => !urgentIds.has(t.id) && !thisWeekIds.has(t.id))

  const groups: TaskGroup[] = []
  if (urgent.length) groups.push({ id: 'urgent', label: 'Urgent · do today', dotColor: 'var(--red)', tasks: urgent })
  if (thisWeek.length) groups.push({ id: 'week', label: 'This week', dotColor: 'var(--amber)', tasks: thisWeek })
  if (later.length) groups.push({ id: 'later', label: 'Later', dotColor: 'var(--text3)', tasks: later })
  if (done.length) groups.push({ id: 'done', label: 'Completed', dotColor: 'var(--text3)', tasks: done })

  return groups
}

export function TaskList({
  tasks, onComplete, onSelectTask, selectedTaskId, onTriangulation, onRequestEstimate,
}: TaskListProps) {
  const groups = useMemo(() => groupTasks(tasks), [tasks])

  if (!tasks.length) {
    return (
      <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
        No tasks yet — add one above
      </div>
    )
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0', scrollbarWidth: 'none' }}>
      {groups.map((group) => (
        <div key={group.id} style={{ marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 20px 4px', userSelect: 'none' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: group.dotColor, flexShrink: 0, display: 'inline-block' }} />
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text2)' }}>
              {group.label}
            </span>
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text3)', marginLeft: 'auto' }}>
              {group.tasks.length}
            </span>
          </div>
          {group.tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onComplete={onComplete}
              onSelect={onSelectTask}
              isSelected={selectedTaskId === task.id}
              onTriangulation={onTriangulation}
              onRequestEstimate={onRequestEstimate}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
