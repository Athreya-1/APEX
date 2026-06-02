import { createClient } from '@/lib/supabase/server'
import { parseQuickAdd } from '@/lib/llm/functions'
import { parseQuickAddLocal } from '@/lib/llm/quickAddLocal'
import { createAnthropicCaller } from '@/lib/llm/client'
import { parsedTaskToInsert } from '@/lib/tasks/quick-add-map'
import { estimateTaskEffort } from '@/lib/tasks/estimate-task'
import type { QuickAddResult } from '@/lib/llm/schemas'

interface QuickAddBody {
  text: string
  estimate_hours?: number
  /** Follow-up answers when the parser returned clarify */
  clarify?: Record<string, string>
}

async function resolveCourseId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  courseCode: string | null,
): Promise<{ courseId: string | null; courseName: string | null }> {
  if (!courseCode) return { courseId: null, courseName: null }
  const { data: courses } = await supabase
    .from('courses')
    .select('id, name')
    .eq('user_id', userId)
    .eq('is_active', true)
  const match = (courses ?? []).find(
    (c) => c.name.toLowerCase().includes(courseCode.toLowerCase())
      || courseCode.toLowerCase().includes(c.name.toLowerCase()),
  )
  return match ? { courseId: match.id, courseName: match.name } : { courseId: null, courseName: courseCode }
}

function mergeClarify(result: QuickAddResult, answers: Record<string, string>): QuickAddResult {
  if (result.kind !== 'clarify' || !result.partial) return result
  const partial = { ...result.partial, kind: 'task' as const }
  if (answers.courseCode) partial.courseCode = answers.courseCode
  if (answers.title) partial.title = answers.title
  if (answers.taskType) partial.taskType = answers.taskType as typeof partial.taskType
  if (answers.dueDate) partial.dueDate = answers.dueDate
  return {
    kind: 'task',
    title: partial.title ?? 'Task',
    courseCode: partial.courseCode ?? null,
    taskType: partial.taskType ?? 'other',
    dueDate: partial.dueDate ?? null,
    doDate: partial.doDate ?? null,
    estimateHours: partial.estimateHours ?? null,
    confidence: partial.confidence ?? 0.7,
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body: QuickAddBody = await request.json()
  const { text, estimate_hours, clarify } = body
  if (!text?.trim()) return Response.json({ error: 'text required' }, { status: 400 })

  const now = new Date().toISOString()
  const { data: courses } = await supabase
    .from('courses')
    .select('name')
    .eq('user_id', user.id)
    .eq('is_active', true)
  const knownCourses = (courses ?? []).map((c) => c.name)

  let parsed: QuickAddResult
  try {
    const caller = createAnthropicCaller()
    parsed = await parseQuickAdd(text, { knownCourses }, caller, { now, knownCourses })
  } catch {
    parsed = parseQuickAddLocal(text, { now, knownCourses })
  }

  if (clarify) parsed = mergeClarify(parsed, clarify)

  if (parsed.kind === 'clarify') {
    return Response.json({ kind: 'clarify', question: parsed.question, missingFields: parsed.missingFields, partial: parsed.partial })
  }

  const { courseId, courseName } = await resolveCourseId(supabase, user.id, parsed.courseCode)
  const effort = await estimateTaskEffort(supabase, user.id, parsed.taskType, courseId)

  if (effort.needsFirstEstimate && estimate_hours == null) {
    return Response.json({
      kind: 'needs_estimate',
      suggested_hours: effort.estimatedHours,
      confidence: effort.confidence,
      parsed: {
        title: parsed.title,
        courseCode: parsed.courseCode,
        taskType: parsed.taskType,
        dueDate: parsed.dueDate,
      },
    })
  }

  const hours = estimate_hours ?? parsed.estimateHours ?? effort.estimatedHours
  const insert = parsedTaskToInsert({ ...parsed, estimateHours: hours }, courseName)

  const { data: task, error } = await supabase.from('tasks').insert({
    user_id: user.id,
    course_id: courseId,
    ...insert,
    ai_estimated_hours: effort.estimatedHours,
    triangulation_multiplier: 1,
    status: 'pending',
    source: 'manual',
  }).select('*, course:courses(id,name,color)').single()

  if (error || !task) return Response.json({ error: error?.message ?? 'Insert failed' }, { status: 500 })

  return Response.json({ kind: 'task', task })
}
