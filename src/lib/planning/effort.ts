import { createClient } from '@/lib/supabase/server'
import type { TaskTypeTag, EffortEstimate } from '@/types'

export const COLD_START_DEFAULTS: Record<TaskTypeTag, number> = {
  lab: 3.5,
  pset: 2.5,
  reading: 0.75,
  project: 5.0,
  writeup: 1.5,
  quiz: 0.5,
  review: 1.0,
  exam: 0,
  other: 2.0,
}

export type EstimateSource = 'course_type_history' | 'global_type_history' | 'cold_start_default'

function average(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

export async function estimateHours(
  task_type_tag: TaskTypeTag,
  course_id: string | null,
  user_id: string,
): Promise<EffortEstimate> {
  const supabase = await createClient()

  // 1. Course + type history (most specific)
  if (course_id) {
    const { data: courseHistory } = await supabase
      .from('task_effort_history')
      .select('actual_hours')
      .eq('user_id', user_id)
      .eq('course_id', course_id)
      .eq('task_type_tag', task_type_tag)
      .order('completed_at', { ascending: false })
      .limit(10)

    if (courseHistory && courseHistory.length >= 2) {
      return {
        estimated_hours: average(courseHistory.map((r) => r.actual_hours)),
        source: 'course_type_history',
        sample_size: courseHistory.length,
      }
    }
  }

  // 2. Global type history
  const { data: globalHistory } = await supabase
    .from('task_effort_history')
    .select('actual_hours')
    .eq('user_id', user_id)
    .eq('task_type_tag', task_type_tag)
    .order('completed_at', { ascending: false })
    .limit(10)

  if (globalHistory && globalHistory.length >= 2) {
    return {
      estimated_hours: average(globalHistory.map((r) => r.actual_hours)),
      source: 'global_type_history',
      sample_size: globalHistory.length,
    }
  }

  // 3. Cold-start defaults
  return {
    estimated_hours: COLD_START_DEFAULTS[task_type_tag] ?? 2.0,
    source: 'cold_start_default',
    sample_size: 0,
  }
}
