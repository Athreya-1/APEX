import type { TaskTypeTag, EffortEstimate } from '@/types'
import { estimateHours } from '@/lib/planning/effort'

export type { EffortEstimate }

export async function estimateTaskHours(
  task_type_tag: TaskTypeTag | null,
  course_id: string | null,
  user_id: string,
): Promise<number> {
  if (!task_type_tag) return 2.0
  const result = await estimateHours(task_type_tag, course_id, user_id)
  return result.estimated_hours
}
