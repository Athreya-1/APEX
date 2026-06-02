import type { BlockType } from '@/types'
import type { EngineBlock } from './engine-types'

const ENGINE_TO_BLOCK_TYPE: Record<string, BlockType> = {
  deep_work: 'deep_work',
  admin: 'custom',
  break: 'break',
  gym: 'gym',
  habit: 'routine',
  meal: 'meal',
  fixed: 'class',
  rest: 'sleep',
  custom: 'custom',
}

export function engineBlockTypeToDb(blockType: string): BlockType {
  return ENGINE_TO_BLOCK_TYPE[blockType] ?? 'custom'
}

export interface PlanBlockInsert {
  task_id: string | null
  block_type: BlockType
  start_time: string
  end_time: string
  label: string | null
  description: string | null
  status: 'scheduled'
  sort_order: number
  original_start_time: string
  original_end_time: string
  cognitive_class: string | null
}

export function engineBlocksToInserts(blocks: EngineBlock[]): PlanBlockInsert[] {
  return blocks
    .filter((b) => b.blockType !== 'break' || b.taskId != null)
    .map((b, i) => ({
      task_id: b.taskId,
      block_type: engineBlockTypeToDb(b.blockType),
      start_time: b.start,
      end_time: b.end,
      label: b.label,
      description: null,
      status: 'scheduled' as const,
      sort_order: i,
      original_start_time: b.start,
      original_end_time: b.end,
      cognitive_class: b.cognitiveClass,
    }))
}
