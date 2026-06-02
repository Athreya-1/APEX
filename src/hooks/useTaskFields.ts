'use client'
import { useEffect, useState, useCallback } from 'react'
import type { TaskFieldDef, TaskFieldValue, FieldKind } from '@/types'

export function useTaskFields(userId: string | undefined, taskId: string | null) {
  const [fieldDefs, setFieldDefs] = useState<TaskFieldDef[]>([])
  const [values, setValues] = useState<TaskFieldValue[]>([])

  useEffect(() => {
    if (!userId) return
    fetch('/api/tasks/fields')
      .then((r) => r.json())
      .then((d) => { if (d.fields) setFieldDefs(d.fields) })
  }, [userId])

  useEffect(() => {
    if (!userId || !taskId) { setValues([]); return }
    import('@/lib/supabase/client').then(({ createClient }) => {
      createClient()
        .from('task_field_values')
        .select('*')
        .eq('task_id', taskId)
        .then(({ data }) => { if (data) setValues(data as TaskFieldValue[]) })
    })
  }, [userId, taskId])

  const addFieldDef = useCallback(async (name: string, kind: FieldKind, options?: string[]) => {
    const res = await fetch('/api/tasks/fields', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, kind, options }),
    })
    const data = await res.json()
    if (data.field) setFieldDefs((prev) => [...prev, data.field])
  }, [])

  const setFieldValue = useCallback(async (fieldDefId: string, value: unknown) => {
    if (!taskId) return
    await fetch('/api/tasks/fields/values', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: taskId, field_def_id: fieldDefId, value }),
    })
    setValues((prev) => {
      const i = prev.findIndex((v) => v.field_def_id === fieldDefId)
      if (i >= 0) {
        const next = [...prev]
        next[i] = { ...next[i], value }
        return next
      }
      return [...prev, {
        id: `local-${fieldDefId}`, user_id: '', task_id: taskId,
        field_def_id: fieldDefId, value,
      }]
    })
  }, [taskId])

  return { fieldDefs, values, addFieldDef, setFieldValue }
}
