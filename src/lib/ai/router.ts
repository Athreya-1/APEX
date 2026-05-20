import type { SupabaseClient } from '@supabase/supabase-js'
import { extractFromScreenshot } from './extractor'
import { indexTask, indexNote } from '@/lib/knowledge/index'
import { queryKnowledge } from '@/lib/knowledge/query'
import type { TaskTypeTag, EisenhowerQuadrant } from '@/types'

export interface IntentResult {
  action: string
  result: unknown
  confirmation_needed: boolean
  confirmation_data?: unknown
}

interface ParsedAddTask {
  tasks?: Array<{
    task_name: string
    topic: string
    task_type_tag: TaskTypeTag | null
    due_date: string | null
    do_date: string | null
    estimated_hours: number | null
    description: string | null
    eisenhower_quadrant: EisenhowerQuadrant | null
  }>
}

interface ParsedCompleteTask {
  task_reference: string
}

interface ParsedModifyTask {
  task_reference: string
  changes: Record<string, unknown>
}

interface ParsedAddNote {
  pad_name: string | null
  content: string
}

interface ParsedQueryKnowledge {
  query: string
}

interface ParsedReplan {
  scope: string
  instruction: string
  constraints: Record<string, unknown>
}

interface ParsedAddHabitLog {
  habit_name: string
  completed: boolean
  note: string | null
}

interface ParsedAddRecurringTask {
  base_task: {
    task_name: string
    topic: string
    task_type_tag: TaskTypeTag | null
    due_date: string | null
    do_date: string | null
    estimated_hours: number | null
    eisenhower_quadrant: EisenhowerQuadrant | null
  }
  recurrence: {
    frequency: 'weekly' | 'biweekly' | 'daily'
    day_of_week: number | null
    occurrences: number
    end_date: string | null
    name_pattern: string | null
    skip_dates: string[]
  }
}

export async function handleIntent(
  intent: string,
  parsed: Record<string, unknown>,
  userId: string,
  supabase: SupabaseClient,
  imageBase64?: string,
): Promise<IntentResult> {
  switch (intent) {
    case 'add_task': {
      const { tasks } = parsed as unknown as ParsedAddTask
      if (!tasks?.length) return { action: 'add_task', result: null, confirmation_needed: false }

      if (tasks.length > 3) {
        return {
          action: 'add_task',
          result: null,
          confirmation_needed: true,
          confirmation_data: { count: tasks.length, tasks: tasks.map((t) => t.task_name) },
        }
      }

      const inserted = []
      for (const task of tasks) {
        const { data } = await supabase
          .from('tasks')
          .insert({
            user_id: userId,
            task_name: task.task_name,
            topic: task.topic ?? 'Other',
            task_type_tag: task.task_type_tag,
            due_date: task.due_date,
            do_date: task.do_date,
            estimated_hours: task.estimated_hours,
            description: task.description,
            eisenhower_quadrant: task.eisenhower_quadrant ?? 'urgent_important',
            status: 'pending',
            source: 'manual',
          })
          .select()
          .single()
        if (data) {
          inserted.push(data)
          await indexTask(supabase, userId, data)
        }
      }
      return { action: 'add_task', result: inserted, confirmation_needed: false }
    }

    case 'add_recurring_task': {
      const { base_task, recurrence } = parsed as unknown as ParsedAddRecurringTask
      const namePattern = recurrence.name_pattern
      const tasks = []
      for (let i = 0; i < (recurrence.occurrences ?? 1); i++) {
        const taskName = namePattern
          ? namePattern.replace('{n}', String(i + 1))
          : base_task.task_name
        tasks.push({
          user_id: userId,
          task_name: taskName,
          topic: base_task.topic ?? 'Other',
          task_type_tag: base_task.task_type_tag,
          estimated_hours: base_task.estimated_hours,
          eisenhower_quadrant: base_task.eisenhower_quadrant ?? 'not_urgent_important',
          status: 'pending',
          source: 'manual',
        })
      }

      if (tasks.length > 5) {
        return {
          action: 'add_recurring_task',
          result: null,
          confirmation_needed: true,
          confirmation_data: { count: tasks.length, sample: tasks.slice(0, 3).map((t) => t.task_name) },
        }
      }

      const { data } = await supabase.from('tasks').insert(tasks).select()
      return { action: 'add_recurring_task', result: data, confirmation_needed: false }
    }

    case 'complete_task': {
      const { task_reference } = parsed as unknown as ParsedCompleteTask
      const { data: matchedTasks } = await supabase
        .from('tasks')
        .select('id, task_name, estimated_hours')
        .eq('user_id', userId)
        .ilike('task_name', `%${task_reference}%`)
        .neq('status', 'done')
        .limit(1)

      if (!matchedTasks?.length) {
        return {
          action: 'complete_task',
          result: { error: 'Task not found' },
          confirmation_needed: false,
        }
      }

      const task = matchedTasks[0] as {
        id: string
        task_name: string
        estimated_hours: number | null
      }
      const now = new Date().toISOString()
      await supabase.from('tasks').update({ status: 'done', completed_at: now }).eq('id', task.id)
      await supabase.from('task_effort_history').insert({
        user_id: userId,
        task_id: task.id,
        task_name_sample: task.task_name,
        estimated_hours: task.estimated_hours,
        actual_hours: task.estimated_hours,
        completed_at: now,
      })
      return {
        action: 'complete_task',
        result: { completed: task.task_name },
        confirmation_needed: false,
      }
    }

    case 'modify_task': {
      const { task_reference, changes } = parsed as unknown as ParsedModifyTask
      const { data: matchedTasks } = await supabase
        .from('tasks')
        .select('id, task_name')
        .eq('user_id', userId)
        .ilike('task_name', `%${task_reference}%`)
        .limit(1)

      if (!matchedTasks?.length) {
        return {
          action: 'modify_task',
          result: { error: 'Task not found' },
          confirmation_needed: false,
        }
      }

      await supabase.from('tasks').update(changes).eq('id', matchedTasks[0].id)
      return {
        action: 'modify_task',
        result: { updated: matchedTasks[0].task_name, changes },
        confirmation_needed: false,
      }
    }

    case 'add_note': {
      const { pad_name, content } = parsed as unknown as ParsedAddNote

      let padId: string | null = null
      if (pad_name) {
        const { data: pads } = await supabase
          .from('notepads')
          .select('id, name')
          .eq('user_id', userId)
          .ilike('name', `%${pad_name}%`)
          .limit(1)
        padId = (pads as Array<{ id: string; name: string }> | null)?.[0]?.id ?? null
      }

      if (!padId) {
        const { data: defaultPad } = await supabase
          .from('notepads')
          .select('id')
          .eq('user_id', userId)
          .order('created_at')
          .limit(1)
          .single()
        padId = (defaultPad as { id: string } | null)?.id ?? null
      }

      if (!padId) {
        const { data: newPad } = await supabase
          .from('notepads')
          .insert({ user_id: userId, name: 'General', icon: '📝', color: 'var(--amber)' })
          .select()
          .single()
        padId = (newPad as { id: string } | null)?.id ?? null
      }

      if (!padId) {
        return { action: 'add_note', result: { error: 'No pad available' }, confirmation_needed: false }
      }

      const { data: note } = await supabase
        .from('notes')
        .insert({ user_id: userId, notepad_id: padId, content, source: 'typed' })
        .select()
        .single()

      if (note) await indexNote(supabase, userId, note as { id: string; content: string; notepad_id: string })
      return { action: 'add_note', result: note, confirmation_needed: false }
    }

    case 'query_knowledge': {
      const { query } = parsed as unknown as ParsedQueryKnowledge
      const result = await queryKnowledge(supabase, userId, query)
      return { action: 'query_knowledge', result, confirmation_needed: false }
    }

    case 'replan': {
      const { scope, instruction, constraints } = parsed as unknown as ParsedReplan
      const today = new Date().toISOString().slice(0, 10)
      const planDate =
        scope === 'tomorrow'
          ? new Date(Date.now() + 86400000).toISOString().slice(0, 10)
          : today

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('.supabase.co', '') ?? ''}/api/plan/replan`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan_date: planDate, instruction, constraints }),
        },
      )
      const data = await res.json().catch(() => ({}))
      return { action: 'replan', result: data, confirmation_needed: false }
    }

    case 'add_habit_log': {
      const { habit_name, completed, note } = parsed as unknown as ParsedAddHabitLog
      const { data: habits } = await supabase
        .from('habits')
        .select('id')
        .eq('user_id', userId)
        .ilike('name', `%${habit_name}%`)
        .limit(1)

      if (!(habits as unknown[])?.length) {
        return {
          action: 'add_habit_log',
          result: { error: 'Habit not found' },
          confirmation_needed: false,
        }
      }

      const today = new Date().toISOString().slice(0, 10)
      await supabase.from('habit_logs').upsert(
        {
          user_id: userId,
          habit_id: (habits as Array<{ id: string }>)[0].id,
          logged_date: today,
          completed,
          note: note ?? null,
          source: 'manual',
        },
        { onConflict: 'user_id,habit_id,logged_date' },
      )
      return { action: 'add_habit_log', result: { habit_name, completed }, confirmation_needed: false }
    }

    case 'screenshot_extract': {
      if (!imageBase64) {
        return {
          action: 'screenshot_extract',
          result: { error: 'No image provided' },
          confirmation_needed: false,
        }
      }
      const extraction = await extractFromScreenshot(imageBase64)

      if (extraction.assignments.length === 0) {
        return { action: 'screenshot_extract', result: extraction, confirmation_needed: false }
      }

      return {
        action: 'screenshot_extract',
        result: extraction,
        confirmation_needed: true,
        confirmation_data: { assignments: extraction.assignments },
      }
    }

    default:
      return { action: intent, result: null, confirmation_needed: false }
  }
}
