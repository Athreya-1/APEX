'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTaskStore } from '@/stores/taskStore'
import { useTasks } from '@/hooks/useTasks'
import { TaskList } from '@/components/tasks/TaskList'
import { TaskDetail } from '@/components/tasks/TaskDetail'
import { TaskFilters } from '@/components/tasks/TaskFilters'
import { UniversalInput } from '@/components/input/UniversalInput'

const STATIC_FILTERS = ['All', 'Today', 'Urgent']

export default function TasksPage() {
  const supabase = createClient()
  const [userId, setUserId] = useState<string | undefined>()
  const [activeFilter, setActiveFilter] = useState('All')
  const [courses, setCourses] = useState<Array<{ id: string; name: string; color: string }>>([])
  const [aiLoading, setAiLoading] = useState(false)

  const { tasks, selectedTaskId, setSelectedTaskId } = useTaskStore()
  const { completeTask, updateTaskField } = useTasks(userId)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id)
    })
  }, [])

  useEffect(() => {
    if (!userId) return
    supabase
      .from('courses')
      .select('id,name,color')
      .eq('user_id', userId)
      .eq('is_active', true)
      .then(({ data }) => { if (data) setCourses(data) })
  }, [userId])

  const filterPills = [...STATIC_FILTERS, ...courses.map((c) => c.name), 'CMR', 'Startup']

  const filteredTasks = tasks.filter((task) => {
    if (activeFilter === 'All') return task.status !== 'done'
    if (activeFilter === 'Today') {
      const today = new Date().toISOString().slice(0, 10)
      return (task.do_date === today || task.due_date?.slice(0, 10) === today) && task.status !== 'done'
    }
    if (activeFilter === 'Urgent') return task.urgency_score > 0.6 && task.status !== 'done'
    return task.topic?.toLowerCase() === activeFilter.toLowerCase() && task.status !== 'done'
  })

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null

  const handleInputSubmit = useCallback(
    async (input: string, _image?: File): Promise<void> => {
      if (!userId) return
      setAiLoading(true)
      try {
        await fetch('/api/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input,
            context: {
              user_name: 'Athreya',
              courses: courses.map((c) => ({ id: c.id, name: c.name })),
              notepads: [],
              habits: [],
              recent_tasks: tasks.slice(0, 5).map((t) => ({ task_name: t.task_name })),
            },
          }),
        })
      } finally {
        setAiLoading(false)
      }
    },
    [userId, courses, tasks],
  )

  return (
    <div style={{ display: 'flex', height: '100%', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-.02em' }}>Tasks</span>
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text3)' }}>
            {filteredTasks.length} tasks
          </span>
        </div>
        <TaskFilters filters={filterPills} active={activeFilter} onSelect={setActiveFilter} />
      </div>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Task list column */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <TaskList
            tasks={filteredTasks}
            onComplete={completeTask}
            onSelectTask={(id) => setSelectedTaskId(id === selectedTaskId ? null : id)}
            selectedTaskId={selectedTaskId}
          />

          {/* Universal input at bottom */}
          <div style={{
            padding: '8px 16px 14px',
            background: 'var(--bg)',
            flexShrink: 0,
            borderTop: '1px solid var(--border)',
          }}>
            <UniversalInput
              placeholder="Add a task, paste assignments, or ask about tasks…"
              onSubmit={handleInputSubmit}
              loading={aiLoading}
            />
          </div>
        </div>

        {/* Desktop detail panel */}
        {selectedTask && (
          <div
            className="hidden md:flex"
            style={{
              width: 260,
              borderLeft: '1px solid var(--border)',
              flexShrink: 0,
              flexDirection: 'column',
            }}
          >
            <TaskDetail
              task={selectedTask}
              onUpdateField={updateTaskField}
              onComplete={completeTask}
              onClose={() => setSelectedTaskId(null)}
            />
          </div>
        )}
      </div>

      {/* Mobile task detail — slide up from bottom */}
      {selectedTask && (
        <div
          className="md:hidden"
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'var(--bg2)',
            borderTop: '1px solid var(--border)',
            maxHeight: '65vh',
            overflowY: 'auto',
            zIndex: 20,
            borderRadius: '16px 16px 0 0',
          }}
        >
          <div style={{ padding: '8px 20px 4px', display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border2)' }} />
          </div>
          <TaskDetail
            task={selectedTask}
            onUpdateField={updateTaskField}
            onComplete={completeTask}
            onClose={() => setSelectedTaskId(null)}
          />
        </div>
      )}
    </div>
  )
}
