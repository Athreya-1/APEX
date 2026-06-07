'use client'

import { useMemo } from 'react'
import { differenceInDays, isToday, parseISO } from 'date-fns'
import { TaskCard } from './TaskCard'
import type { Task, TaskFieldDef, TaskFieldValue } from '@/types'
import type { TriangulationChoice } from '@/lib/tasks/triangulation'

interface TaskListProps {
  tasks: Task[]
  openTaskId: string | null
  onToggleTask: (id: string) => void
  onComplete: (id: string) => void
  onUpdateField: (taskId: string, field: keyof Task, value: unknown) => Promise<void>
  onTriangulation?: (taskId: string, choice: TriangulationChoice) => void
  onRequestEstimate?: (taskId: string) => void
  fieldDefs?: TaskFieldDef[]
  fieldValues?: TaskFieldValue[]
  onSetFieldValue?: (fieldDefId: string, value: unknown) => Promise<void>
  onAddFieldDef?: (name: string, kind: TaskFieldDef['kind'], options?: string[]) => Promise<void>
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
  if (urgent.length) groups.push({ id: 'urgent', label: 'Urgent · do today', dotColor: '#f06a6a', tasks: urgent })
  if (thisWeek.length) groups.push({ id: 'week', label: 'This week', dotColor: 'var(--amber)', tasks: thisWeek })
  if (later.length) groups.push({ id: 'later', label: 'Later', dotColor: 'var(--text3)', tasks: later })
  if (done.length) groups.push({ id: 'done', label: 'Completed', dotColor: 'var(--text3)', tasks: done })

  return groups
}

export function TaskList({
  tasks,
  openTaskId,
  onToggleTask,
  onComplete,
  onUpdateField,
  onTriangulation,
  onRequestEstimate,
  fieldDefs,
  fieldValues,
  onSetFieldValue,
  onAddFieldDef,
}: TaskListProps) {
  const groups = useMemo(() => groupTasks(tasks), [tasks])

  if (!tasks.length) {
    return <p className="todo-empty">No tasks in this view.</p>
  }

  return (
    <>
      {groups.map((group) => (
        <section key={group.id}>
          <div className="todo-group-label">
            <span className="d" style={{ background: group.dotColor }} />
            {group.label}
          </div>
          {group.tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              isOpen={openTaskId === task.id}
              onToggle={onToggleTask}
              onComplete={onComplete}
              onUpdateField={onUpdateField}
              onTriangulation={onTriangulation}
              onRequestEstimate={onRequestEstimate}
              fieldDefs={openTaskId === task.id ? fieldDefs : []}
              fieldValues={openTaskId === task.id ? fieldValues : []}
              onSetFieldValue={onSetFieldValue}
              onAddFieldDef={onAddFieldDef}
            />
          ))}
        </section>
      ))}
    </>
  )
}
