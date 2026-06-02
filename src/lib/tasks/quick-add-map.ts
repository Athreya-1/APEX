import type { ParsedTask, QuickAddResult } from '@/lib/llm/schemas'
import type { EisenhowerQuadrant, TaskTypeTag } from '@/types'
import { assignImportance, eisenhowerQuadrant } from '@/lib/planning/eisenhower'

export interface TaskInsertFromParse {
  task_name: string
  topic: string
  task_type_tag: TaskTypeTag
  due_date: string | null
  do_date: string | null
  estimated_hours: number | null
  importance: number
  eisenhower_quadrant: EisenhowerQuadrant
  metadata: Record<string, unknown>
}

export function parsedTaskToInsert(
  parsed: ParsedTask,
  courseName: string | null,
): TaskInsertFromParse {
  const importance = assignImportance({ taskType: parsed.taskType })
  const isUrgent = parsed.dueDate != null
    && (Date.parse(parsed.dueDate) - Date.now()) / 3_600_000 < 48
  return {
    task_name: parsed.title,
    topic: courseName ?? parsed.courseCode ?? '',
    task_type_tag: parsed.taskType,
    due_date: parsed.dueDate,
    do_date: parsed.doDate,
    estimated_hours: parsed.estimateHours,
    importance,
    eisenhower_quadrant: eisenhowerQuadrant(importance, isUrgent),
    metadata: { quick_add_confidence: parsed.confidence },
  }
}

export function isParsedTask(result: QuickAddResult): result is ParsedTask {
  return result.kind === 'task'
}
