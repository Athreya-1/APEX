import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { INTENT_CLASSIFICATION_PROMPT, COLD_START_DEFAULTS } from '@/lib/ai/prompts'
import { ClassifiedIntent } from '@/types'

interface AIRequestBody {
  input: string
  context: {
    user_name?: string
    courses?: Array<{ name: string; id: string }>
    notepads?: Array<{ name: string }>
    habits?: Array<{ name: string }>
    recent_tasks?: Array<{ task_name: string }>
  }
  image?: string
  confirmed?: boolean
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body: AIRequestBody = await request.json()
  const { input, context, confirmed } = body

  const systemPrompt = INTENT_CLASSIFICATION_PROMPT
    .replace('{user_name}', context.user_name ?? 'User')
    .replace('{current_datetime}', new Date().toISOString())
    .replace('{courses}', JSON.stringify(context.courses ?? []))
    .replace('{notepads}', JSON.stringify(context.notepads ?? []))
    .replace('{habits}', JSON.stringify(context.habits ?? []))
    .replace('{recent_tasks}', JSON.stringify(context.recent_tasks ?? []))

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: input }],
  })

  const classified: ClassifiedIntent = JSON.parse(
    response.content[0].type === 'text' ? response.content[0].text : '{}',
  )

  if (classified.intent === 'add_task') {
    const parsed = classified.parsed as {
      tasks: Array<{
        task_name: string
        topic: string
        task_type_tag: string
        due_date: string | null
        do_date: string | null
        estimated_hours: number | null
        description: string | null
        eisenhower_quadrant: string
      }>
    }

    if (!confirmed && parsed.tasks.length > 1) {
      return Response.json({
        intent: 'add_task',
        confirmation_needed: true,
        confirmation_data: {
          count: parsed.tasks.length,
          preview: parsed.tasks.map((t) => t.task_name),
        },
      })
    }

    const courseName = parsed.tasks[0]?.topic
    const matchedCourse = context.courses?.find(
      (c) => c.name.toLowerCase() === courseName?.toLowerCase(),
    )

    const typeTag = parsed.tasks[0]?.task_type_tag ?? 'other'
    const estimatedHours = parsed.tasks[0]?.estimated_hours ?? COLD_START_DEFAULTS[typeTag] ?? 2.0

    const newTask = {
      user_id: user.id,
      task_name: parsed.tasks[0].task_name,
      topic: parsed.tasks[0].topic ?? '',
      task_type_tag: typeTag,
      due_date: parsed.tasks[0].due_date,
      do_date: parsed.tasks[0].do_date,
      estimated_hours: estimatedHours,
      description: parsed.tasks[0].description,
      eisenhower_quadrant: parsed.tasks[0].eisenhower_quadrant ?? 'not_urgent_important',
      status: 'pending' as const,
      source: 'manual' as const,
      course_id: matchedCourse?.id ?? null,
    }

    const { data: insertedTask, error } = await supabase
      .from('tasks')
      .insert(newTask)
      .select()
      .single()

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({
      intent: 'add_task',
      result: insertedTask,
      confirmation_needed: false,
    })
  }

  if (classified.intent === 'complete_task') {
    const parsed = classified.parsed as { task_reference: string }

    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, task_name, task_type_tag, course_id, estimated_hours')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .ilike('task_name', `%${parsed.task_reference}%`)
      .limit(1)

    if (!tasks?.length) {
      return Response.json({ error: 'Task not found', intent: 'complete_task' }, { status: 404 })
    }

    const task = tasks[0] as {
      id: string
      task_name: string
      task_type_tag: string
      course_id: string | null
      estimated_hours: number | null
    }
    const now = new Date().toISOString()

    await supabase.from('tasks').update({ status: 'done', completed_at: now }).eq('id', task.id)
    await supabase.from('task_effort_history').insert({
      user_id: user.id,
      task_id: task.id,
      course_id: task.course_id,
      task_type_tag: task.task_type_tag,
      task_name_sample: task.task_name,
      estimated_hours: task.estimated_hours,
      actual_hours: task.estimated_hours ?? 1,
      completed_at: now,
    })

    return Response.json({ intent: 'complete_task', result: { id: task.id } })
  }

  return Response.json(classified)
}
