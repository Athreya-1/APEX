import { createClient } from '@/lib/supabase/server'
import { parseQuickAdd } from '@/lib/llm/functions'
import { parseQuickAddLocal } from '@/lib/llm/quickAddLocal'
import { createAnthropicCaller } from '@/lib/llm/client'
import { parsedTaskToInsert } from '@/lib/tasks/quick-add-map'
import { estimateTaskEffort } from '@/lib/tasks/estimate-task'
import { matchCourseFromText, type CourseForMatch } from '@/lib/courses/match-from-text'
import { courseDisplayName } from '@/lib/courses/normalize'
import type { QuickAddResult } from '@/lib/llm/schemas'

interface QuickAddBody {
  text: string
  estimate_hours?: number
  /** Follow-up answers when the parser returned clarify */
  clarify?: Record<string, string>
}

const LOCAL_CONFIDENCE_THRESHOLD = 0.65

async function loadCourses(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<CourseForMatch[]> {
  const { data: courses } = await supabase
    .from('courses')
    .select('id, name, code')
    .eq('user_id', userId)
    .eq('is_active', true)
  return (courses ?? []).map((c) => ({ id: c.id, name: c.name, code: c.code }))
}

async function resolveCourse(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  parsed: Extract<QuickAddResult, { kind: 'task' }>,
  courses: CourseForMatch[],
): Promise<{ courseId: string | null; courseName: string | null }> {
  if (parsed.resolvedCourseId) {
    const hit = courses.find((c) => c.id === parsed.resolvedCourseId)
    if (hit) return { courseId: hit.id, courseName: hit.name }
  }
  if (!parsed.courseCode) return { courseId: null, courseName: null }

  const matched = matchCourseFromText(parsed.courseCode, courses)
  if (matched.kind === 'match') {
    return { courseId: matched.course.id, courseName: matched.course.name }
  }

  const lc = parsed.courseCode.toLowerCase()
  const hit = courses.find(
    (c) => c.name.toLowerCase().includes(lc)
      || lc.includes(c.name.toLowerCase())
      || (c.code?.toLowerCase() === lc),
  )
  return hit
    ? { courseId: hit.id, courseName: hit.name }
    : { courseId: null, courseName: parsed.courseCode }
}

function mergeClarify(result: QuickAddResult, answers: Record<string, string>, courses: CourseForMatch[]): QuickAddResult {
  if (result.kind !== 'clarify' || !result.partial) return result
  const partial = { ...result.partial, kind: 'task' as const }
  if (answers.courseCode) {
    partial.courseCode = answers.courseCode
    const byId = courses.find((c) => c.id === answers.courseCode)
    const byLabel = courses.find((c) => courseDisplayName(c).toLowerCase() === answers.courseCode.toLowerCase())
    const byName = courses.find((c) => c.name.toLowerCase() === answers.courseCode.toLowerCase())
    const hit = byId ?? byLabel ?? byName
    if (hit) {
      partial.courseCode = hit.code?.trim() || courseDisplayName(hit)
      partial.resolvedCourseId = hit.id
    }
  }
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
    resolvedCourseId: partial.resolvedCourseId,
  }
}

async function parseQuickAddText(
  text: string,
  courses: CourseForMatch[],
  now: string,
): Promise<QuickAddResult> {
  const local = parseQuickAddLocal(text, { now, courses })
  const useLocal =
    local.kind === 'clarify'
    || (local.kind === 'task' && local.confidence >= LOCAL_CONFIDENCE_THRESHOLD)

  if (useLocal || !process.env.ANTHROPIC_API_KEY) return local

  try {
    const caller = createAnthropicCaller()
    const knownCourses = courses.map((c) => courseDisplayName(c))
    return await parseQuickAdd(text, { knownCourses }, caller, { now, courses, knownCourses })
  } catch (err) {
    console.warn('[quick-add] LLM parse failed, falling back to local:', (err as Error).message)
    return local
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
  const courses = await loadCourses(supabase, user.id)

  let parsed = await parseQuickAddText(text, courses, now)

  if (clarify) parsed = mergeClarify(parsed, clarify, courses)

  if (parsed.kind === 'clarify') {
    return Response.json({
      kind: 'clarify',
      question: parsed.question,
      missingFields: parsed.missingFields,
      partial: parsed.partial,
      courseCandidates: parsed.courseCandidates,
    })
  }

  const { courseId, courseName } = await resolveCourse(supabase, user.id, parsed, courses)
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
