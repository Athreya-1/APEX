// src/hooks/useTasks.ts
'use client'
import { useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTaskStore } from '@/stores/taskStore'
import type { Task, TaskEffortHistory } from '@/types'

export function useTasks(userId: string | undefined) {
  const { setTasks, addTask, updateTask, removeTask, setLoading } = useTaskStore()
  const supabase = createClient()

  useEffect(() => {
    if (!userId) return

    setLoading(true)
    supabase
      .from('tasks')
      .select('*, course:courses(id,name,color)')
      .eq('user_id', userId)
      .order('urgency_score', { ascending: false, nullsFirst: false })
      .then(({ data }) => {
        if (data) setTasks(data as Task[])
        setLoading(false)
      })

    const channel = supabase
      .channel(`tasks:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'tasks', filter: `user_id=eq.${userId}` },
        (payload) => addTask(payload.new as Task),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tasks', filter: `user_id=eq.${userId}` },
        (payload) => updateTask((payload.new as Task).id, payload.new as Partial<Task>),
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'tasks', filter: `user_id=eq.${userId}` },
        (payload) => removeTask((payload.old as Task).id),
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  const completeTask = useCallback(
    async (taskId: string) => {
      const { tasks } = useTaskStore.getState()
      const task = tasks.find((t) => t.id === taskId)
      if (!task) return

      const actualHours = task.actual_hours ?? task.estimated_hours ?? 0

      await supabase
        .from('tasks')
        .update({
          status: 'done',
          completed_at: new Date().toISOString(),
          actual_hours: actualHours,
        })
        .eq('id', taskId)

      await supabase.from('task_effort_history').insert({
        user_id: task.user_id,
        task_id: task.id,
        course_id: task.course_id,
        task_type_tag: task.task_type_tag,
        task_name_sample: task.task_name,
        estimated_hours: task.estimated_hours,
        actual_hours: actualHours,
        completed_at: new Date().toISOString(),
      } satisfies Omit<TaskEffortHistory, 'id'>)

      updateTask(taskId, { status: 'done', completed_at: new Date().toISOString() })
    },
    [supabase, updateTask],
  )

  const updateTaskField = useCallback(
    async (taskId: string, field: keyof Task, value: unknown) => {
      await supabase
        .from('tasks')
        .update({ [field]: value })
        .eq('id', taskId)
      updateTask(taskId, { [field]: value } as Partial<Task>)
    },
    [supabase, updateTask],
  )

  const setTriangulation = useCallback(
    async (taskId: string, choice: 'shorter' | 'typical' | 'longer') => {
      const task = useTaskStore.getState().tasks.find((t) => t.id === taskId)
      if (!task) return
      const res = await fetch('/api/tasks/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_type_tag: task.task_type_tag,
          course_id: task.course_id,
          triangulation: choice,
        }),
      })
      const data = await res.json()
      const mult = choice === 'shorter' ? 0.6 : choice === 'longer' ? 1.5 : 1
      await supabase.from('tasks').update({
        triangulation_multiplier: mult,
        estimated_hours: data.estimated_hours,
      }).eq('id', taskId)
      updateTask(taskId, {
        triangulation_multiplier: mult,
        estimated_hours: data.estimated_hours,
      })
    },
    [supabase, updateTask],
  )

  return { completeTask, updateTaskField, setTriangulation }
}
