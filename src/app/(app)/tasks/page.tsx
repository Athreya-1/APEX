'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTaskStore } from '@/stores/taskStore'
import { useTasks } from '@/hooks/useTasks'
import { useTaskFields } from '@/hooks/useTaskFields'
import { TaskList } from '@/components/tasks/TaskList'
import { TaskDetail } from '@/components/tasks/TaskDetail'
import { TaskFilters } from '@/components/tasks/TaskFilters'
import { QuickAddBar } from '@/components/tasks/QuickAddBar'
import { EstimateModal } from '@/components/tasks/EstimateModal'

const STATIC_FILTERS = ['All', 'Today', 'Urgent']

export default function TasksPage() {
  const supabase = createClient()
  const [userId, setUserId] = useState<string | undefined>()
  const [activeFilter, setActiveFilter] = useState('All')
  const [courses, setCourses] = useState<Array<{ id: string; name: string; color: string }>>([])
  const [estimateTaskId, setEstimateTaskId] = useState<string | null>(null)

  const { tasks, selectedTaskId, setSelectedTaskId, addTask } = useTaskStore()
  const { completeTask, updateTaskField, setTriangulation } = useTasks(userId)
  const { fieldDefs, values, addFieldDef, setFieldValue } = useTaskFields(userId, selectedTaskId)

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

  const filterPills = [...STATIC_FILTERS, ...courses.map((c) => c.name)]

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
  const estimateTask = tasks.find((t) => t.id === estimateTaskId) ?? null

  const handleTaskCreated = useCallback((task: Parameters<typeof addTask>[0]) => {
    addTask(task)
    setSelectedTaskId(task.id)
  }, [addTask, setSelectedTaskId])

  const handleEstimateConfirm = useCallback(async (hours: number) => {
    if (!estimateTaskId) return
    await updateTaskField(estimateTaskId, 'estimated_hours', hours)
    setEstimateTaskId(null)
  }, [estimateTaskId, updateTaskField])

  return (
    <div style={{ display: 'flex', height: '100%', flexDirection: 'column' }}>
      <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-.02em' }}>Tasks</span>
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text3)' }}>
            {filteredTasks.length} tasks
          </span>
        </div>
        <TaskFilters filters={filterPills} active={activeFilter} onSelect={setActiveFilter} />
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
          <TaskList
            tasks={filteredTasks}
            onComplete={completeTask}
            onSelectTask={(id) => setSelectedTaskId(id === selectedTaskId ? null : id)}
            selectedTaskId={selectedTaskId}
            onTriangulation={setTriangulation}
            onRequestEstimate={setEstimateTaskId}
          />
          <div style={{
            padding: '8px 16px 14px',
            background: 'var(--bg)',
            flexShrink: 0,
            borderTop: '1px solid var(--border)',
          }}>
            <QuickAddBar
              knownCourses={courses.map((c) => c.name)}
              onTaskCreated={handleTaskCreated}
            />
          </div>
        </div>

        {selectedTask && (
          <div
            className="hidden md:flex"
            style={{
              width: 280, borderLeft: '1px solid var(--border)',
              flexShrink: 0, flexDirection: 'column',
            }}
          >
            <TaskDetail
              task={selectedTask}
              onUpdateField={updateTaskField}
              onComplete={completeTask}
              onClose={() => setSelectedTaskId(null)}
              onTriangulation={setTriangulation}
              onRequestEstimate={() => setEstimateTaskId(selectedTask.id)}
              fieldDefs={fieldDefs}
              fieldValues={values}
              onSetFieldValue={setFieldValue}
              onAddFieldDef={addFieldDef}
            />
          </div>
        )}
      </div>

      {selectedTask && (
        <div
          className="md:hidden"
          style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            background: 'var(--bg2)', borderTop: '1px solid var(--border)',
            maxHeight: '65vh', overflowY: 'auto', zIndex: 20,
            borderRadius: '16px 16px 0 0',
          }}
        >
          <TaskDetail
            task={selectedTask}
            onUpdateField={updateTaskField}
            onComplete={completeTask}
            onClose={() => setSelectedTaskId(null)}
            onTriangulation={setTriangulation}
            onRequestEstimate={() => setEstimateTaskId(selectedTask.id)}
            fieldDefs={fieldDefs}
            fieldValues={values}
            onSetFieldValue={setFieldValue}
            onAddFieldDef={addFieldDef}
          />
        </div>
      )}

      <EstimateModal
        open={estimateTaskId != null}
        taskTitle={estimateTask?.task_name ?? ''}
        suggestedHours={estimateTask?.ai_estimated_hours ?? undefined}
        onCancel={() => setEstimateTaskId(null)}
        onConfirm={handleEstimateConfirm}
      />
    </div>
  )
}
