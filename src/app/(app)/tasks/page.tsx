'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTaskStore } from '@/stores/taskStore'
import { useTasks } from '@/hooks/useTasks'
import { useTaskFields } from '@/hooks/useTaskFields'
import { TaskList } from '@/components/tasks/TaskList'
import { QuickAddBar } from '@/components/tasks/QuickAddBar'
import { EstimateModal } from '@/components/tasks/EstimateModal'
import { TodoFilterBar, applyTodoFilters, type TodoFilterState } from '@/components/tasks/TodoFilterBar'
import { useCourses } from '@/hooks/useCourses'
import { courseDisplayName } from '@/lib/courses/normalize'

const EMPTY_FILTERS: TodoFilterState = {
  dateStart: null,
  dateEnd: null,
  courses: [],
  urgentOnly: false,
}

export default function TasksPage() {
  const supabase = createClient()
  const [userId, setUserId] = useState<string | undefined>()
  const [filters, setFilters] = useState<TodoFilterState>(EMPTY_FILTERS)
  const [estimateTaskId, setEstimateTaskId] = useState<string | null>(null)

  const { tasks, selectedTaskId, setSelectedTaskId, addTask } = useTaskStore()
  const { completeTask, updateTaskField, setTriangulation } = useTasks(userId)
  const { fieldDefs, values, addFieldDef, setFieldValue } = useTaskFields(userId, selectedTaskId)
  const { courses } = useCourses(userId)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id)
    })
  }, [supabase.auth])

  const activeTasks = useMemo(() => tasks.filter((t) => t.status !== 'done'), [tasks])

  const filteredTasks = useMemo(() => {
    const pending = tasks.filter((t) => t.status !== 'done')
    return applyTodoFilters(pending, filters)
  }, [tasks, filters])

  const taskCounts = useMemo(() => {
    const byCourse: Record<string, number> = {}
    for (const c of courses) {
      byCourse[c.name] = activeTasks.filter((t) =>
        (t.topic ?? '').toLowerCase().includes(c.name.toLowerCase()),
      ).length
    }
    return {
      byCourse,
      urgent: activeTasks.filter((t) => t.urgency_score > 0.6).length,
    }
  }, [activeTasks, courses])

  const eyebrow = useMemo(() => {
    const open = activeTasks.length
    const dueWeek = activeTasks.filter((t) => {
      if (!t.due_date) return false
      const d = new Date(t.due_date)
      const diff = (d.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      return diff >= 0 && diff <= 7
    }).length
    return `${open} open · ${dueWeek} due this week`
  }, [activeTasks])

  const estimateTask = tasks.find((t) => t.id === estimateTaskId) ?? null

  const handleTaskCreated = useCallback(
    (task: Parameters<typeof addTask>[0]) => {
      addTask(task)
      setSelectedTaskId(task.id)
    },
    [addTask, setSelectedTaskId],
  )

  const handleEstimateConfirm = useCallback(
    async (hours: number) => {
      if (!estimateTaskId) return
      await updateTaskField(estimateTaskId, 'estimated_hours', hours)
      setEstimateTaskId(null)
    },
    [estimateTaskId, updateTaskField],
  )

  const handleToggle = useCallback(
    (id: string) => setSelectedTaskId(selectedTaskId === id ? null : id),
    [selectedTaskId, setSelectedTaskId],
  )

  return (
    <>
      <main className="apex-main">
        <div className="apex-eyebrow">{eyebrow}</div>
        <h1 className="apex-h1">To-Do</h1>

        <TodoFilterBar
          courses={courses.map((c) => ({
            id: c.id,
            name: c.name,
            label: courseDisplayName(c),
          }))}
          taskCounts={taskCounts}
          filters={filters}
          onChange={setFilters}
        />

        <TaskList
          tasks={filteredTasks}
          openTaskId={selectedTaskId}
          onToggleTask={handleToggle}
          onComplete={completeTask}
          onUpdateField={updateTaskField}
          onTriangulation={setTriangulation}
          onRequestEstimate={setEstimateTaskId}
          fieldDefs={fieldDefs}
          fieldValues={values}
          onSetFieldValue={setFieldValue}
          onAddFieldDef={addFieldDef}
        />
      </main>

      <QuickAddBar
        courses={courses.map((c) => ({ id: c.id, name: c.name, code: c.code }))}
        onTaskCreated={handleTaskCreated}
      />

      <EstimateModal
        open={estimateTaskId != null}
        taskTitle={estimateTask?.task_name ?? ''}
        suggestedHours={estimateTask?.ai_estimated_hours ?? undefined}
        onCancel={() => setEstimateTaskId(null)}
        onConfirm={handleEstimateConfirm}
      />
    </>
  )
}
