import type { SupabaseClient } from '@supabase/supabase-js'
import { computePaddedEffort, summarizeActuals } from '@/lib/planning/estimation'
import { COLD_START_DEFAULTS } from '@/lib/planning/effort'
import type { PaddedEffort, TaskTypeTag } from '@/types'

export interface TaskEffortEstimate {
  estimatedHours: number
  paddedHours: number
  confidence: PaddedEffort['confidence']
  source: PaddedEffort['source']
  needsFirstEstimate: boolean
}

export async function estimateTaskEffort(
  supabase: SupabaseClient,
  userId: string,
  taskType: TaskTypeTag,
  courseId: string | null,
  triangulation = 1.0,
): Promise<TaskEffortEstimate> {
  let courseDifficulty = 1
  let courseVelocity = 1
  if (courseId) {
    const { data: course } = await supabase
      .from('courses')
      .select('difficulty_multiplier, velocity_modifier')
      .eq('id', courseId)
      .single()
    if (course) {
      courseDifficulty = course.difficulty_multiplier ?? 1
      courseVelocity = course.velocity_modifier ?? 1
    }
  }

  const { data: priorRow } = await supabase
    .from('task_priors')
    .select('default_minutes')
    .or(`user_id.eq.${userId},user_id.is.null`)
    .eq('category_keyword', taskType)
    .order('user_id', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  const priorMinutes = priorRow?.default_minutes ?? COLD_START_DEFAULTS[taskType] * 60

  let bucket = null
  let typeHist = null
  if (courseId) {
    const { data: hist } = await supabase
      .from('task_effort_history')
      .select('actual_hours')
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .eq('task_type_tag', taskType)
      .order('completed_at', { ascending: false })
      .limit(10)
    if (hist?.length) bucket = summarizeActuals(hist.map((h) => h.actual_hours))
  }
  if (!bucket?.n) {
    const { data: hist } = await supabase
      .from('task_effort_history')
      .select('actual_hours')
      .eq('user_id', userId)
      .eq('task_type_tag', taskType)
      .order('completed_at', { ascending: false })
      .limit(10)
    if (hist?.length) typeHist = summarizeActuals(hist.map((h) => h.actual_hours))
  }

  const effort = computePaddedEffort({
    priorMinutes,
    courseDifficulty,
    courseVelocity,
    triangulation,
    bucket,
    type: typeHist,
  })

  let histQuery = supabase
    .from('task_effort_history')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('task_type_tag', taskType)
  if (courseId) histQuery = histQuery.eq('course_id', courseId)
  const { count } = await histQuery

  const needsFirstEstimate = (count ?? 0) === 0 && effort.confidence === 'cold'

  return {
    estimatedHours: effort.estimateHours,
    paddedHours: effort.paddedHours,
    confidence: effort.confidence,
    source: effort.source,
    needsFirstEstimate,
  }
}
