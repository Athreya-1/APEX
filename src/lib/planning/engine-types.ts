import type { CognitiveClass, SlotState } from '@/types'
import type { SessionMode } from './timeline'

export interface SkeletonItem {
  id: string
  start: string            // ISO
  end: string              // ISO
  state: SlotState         // 'fixed' | 'meal' | 'rest_lockout' | 'habit'
  label: string
  cognitiveClass?: CognitiveClass
}

export interface EngineTask {
  id: string
  label: string
  paddedHours: number
  cognitiveClass: CognitiveClass   // usually heavy_focus | light_admin | creative
  importance: number               // 1..4
  urgencyScore: number
  isAtRisk: boolean
  mustToday: boolean               // due today OR do_date=today OR at-risk
}

export interface EngineHabit {
  id: string
  label: string
  mode: 'time_blocked' | 'check_off'
  durationMins: number
  cognitiveClass: CognitiveClass
  cascade?: number[]               // e.g. [90,60,30] (gym); first entry that fits wins
  timeRanges?: Array<{ start: string; end: string }> // preferred ISO windows
  goalId?: string | null
}

export interface PlanRequest {
  windowStart: string
  windowEnd: string
  sessionMode: SessionMode
  workLifeDial: number             // 0..1
  workHourCap: number              // hours
  minChunkMinutes: number
  maxConsecutiveHeavy: number
  skeleton: SkeletonItem[]
  tasks: EngineTask[]              // already ordered by caller (orderByUrgency)
  habits: EngineHabit[]            // already filtered to "due today"
}

export interface EngineBlock {
  taskId: string | null
  habitId: string | null
  blockType: string                // deep_work|admin|break|gym|habit|meal|fixed|rest|custom
  cognitiveClass: CognitiveClass | null
  start: string
  end: string
  label: string
}

export interface PlanWarning {
  kind: 'deadline_at_risk' | 'work_hour_cap_breached' | 'habit_lapsed' | 'overcommitted'
  message: string
  refId?: string
}

export interface ReasoningNote { refId: string; note: string }

export interface PlanResult {
  blocks: EngineBlock[]
  warnings: PlanWarning[]
  reasoning: ReasoningNote[]
  capBreached: boolean
  dialUsed: number
  scheduledHoursByTask: Record<string, number>
}
