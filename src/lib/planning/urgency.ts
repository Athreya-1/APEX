import type { EisenhowerQuadrant, UrgencyResult } from '@/types'

export type UrgencyTier = 'urgent' | 'this_week' | 'on_radar'

export interface UrgencyInfo {
  tier: UrgencyTier
  label: string
  color: string
}

/**
 * Map urgency_score to a display tier.
 * urgency_score = estimated_hours / hours_until_deadline (computed in DB)
 */
export function getUrgencyTier(score: number): UrgencyInfo {
  if (score > 0.6) return { tier: 'urgent', label: 'Urgent · do today', color: 'var(--red)' }
  if (score > 0.3) return { tier: 'this_week', label: 'This week', color: 'var(--amber)' }
  return { tier: 'on_radar', label: 'On radar', color: 'var(--text3)' }
}

/**
 * Map Eisenhower quadrant to scheduling priority and time-of-day preference.
 */
export function getSchedulingPriority(quadrant: EisenhowerQuadrant): {
  priority: number
  preferPeakEnergy: boolean
} {
  switch (quadrant) {
    case 'urgent_important':
      return { priority: 1, preferPeakEnergy: true }
    case 'not_urgent_important':
      return { priority: 2, preferPeakEnergy: true }
    case 'urgent_not_important':
      return { priority: 3, preferPeakEnergy: false }
    case 'neither':
      return { priority: 4, preferPeakEnergy: false }
  }
}

/**
 * Check if a task has crossed the urgency flip threshold.
 * Returns true if score just crossed 0.6 (was below, now above).
 */
export function hasUrgencyFlipped(previousScore: number, currentScore: number): boolean {
  return previousScore < 0.6 && currentScore >= 0.6
}

/**
 * Sort tasks by scheduling priority:
 * 1. do_date = today (always first)
 * 2. urgency_score DESC
 * 3. eisenhower priority
 */
export function sortTasksForScheduling<T extends {
  do_date: string | null
  urgency_score: number
  eisenhower_quadrant: EisenhowerQuadrant | null
}>(tasks: T[], planDate: string): T[] {
  return [...tasks].sort((a, b) => {
    const aDoToday = a.do_date === planDate
    const bDoToday = b.do_date === planDate
    if (aDoToday && !bDoToday) return -1
    if (!aDoToday && bDoToday) return 1

    if (b.urgency_score !== a.urgency_score) return b.urgency_score - a.urgency_score

    const aPri = getSchedulingPriority(a.eisenhower_quadrant ?? 'not_urgent_important').priority
    const bPri = getSchedulingPriority(b.eisenhower_quadrant ?? 'not_urgent_important').priority
    return aPri - bPri
  })
}

export interface UrgencyTask {
  taskId: string
  deadline: string | null   // ISO; null = not scored (daily allocation)
  paddedHours: number       // H from Plan 02
  meanHours: number         // for uncertainty ratio (use estimate if unknown)
  stdevHours: number
}

export interface UrgencyParams {
  now: string                                   // ISO
  capacityHoursUntil: (deadlineISO: string) => number  // available working hrs now->deadline
  tFloorHours?: number   // default 2  (soft floor; denominator never < this)
  beta?: number          // default 1.2
  uncertaintyC?: number  // default 0.5
  alpha?: number         // default 0.5 (contention)
  overdueScore?: number  // default 999 (sentinel "max")
}

function round3(x: number): number {
  return Number.isFinite(x) ? Math.round(x * 1000) / 1000 : x
}

export function computeUrgency(tasks: UrgencyTask[], params: UrgencyParams): UrgencyResult[] {
  const {
    now, capacityHoursUntil,
    tFloorHours = 2, beta = 1.2, uncertaintyC = 0.5, alpha = 0.5, overdueScore = 999,
  } = params
  const nowMs = Date.parse(now)

  // EDF order over deadline-bearing, non-overdue tasks
  const dated = tasks
    .filter((t) => t.deadline && Date.parse(t.deadline) > nowMs)
    .sort((a, b) => Date.parse(a.deadline!) - Date.parse(b.deadline!))

  const byId = new Map<string, UrgencyResult>()
  let requiredBefore = 0
  for (const t of dated) {
    const available = capacityHoursUntil(t.deadline!)
    const requiredThrough = requiredBefore + t.paddedHours
    const slackHours = available - requiredThrough
    const aTask = Math.max(available - requiredBefore, tFloorHours)
    const uncertainty = 1 + uncertaintyC * (t.meanHours > 0 ? t.stdevHours / t.meanHours : 0)
    const contention = 1 + alpha * (requiredThrough / Math.max(available, tFloorHours))
    const score = Math.pow(t.paddedHours / Math.max(aTask, tFloorHours), beta) * uncertainty * contention
    byId.set(t.taskId, {
      taskId: t.taskId, score: round3(score), isAtRisk: slackHours < 0,
      slackHours: round3(slackHours), paddedHours: t.paddedHours,
    })
    requiredBefore = requiredThrough
  }

  // Map back in original order; handle no-deadline + overdue
  return tasks.map((t) => {
    if (byId.has(t.taskId)) return byId.get(t.taskId)!
    if (!t.deadline) {
      return { taskId: t.taskId, score: 0, isAtRisk: false, slackHours: Number.POSITIVE_INFINITY, paddedHours: t.paddedHours }
    }
    // overdue
    return { taskId: t.taskId, score: overdueScore, isAtRisk: true, slackHours: -t.paddedHours, paddedHours: t.paddedHours }
  })
}

/** Ordering for scheduling: at-risk first, then score desc, importance (higher first) breaks near-ties. */
export function orderByUrgency(
  results: UrgencyResult[], importanceById: Record<string, number> = {},
): UrgencyResult[] {
  return [...results].sort((a, b) => {
    if (a.isAtRisk !== b.isAtRisk) return a.isAtRisk ? -1 : 1
    if (Math.abs(b.score - a.score) > 0.05) return b.score - a.score
    return (importanceById[b.taskId] ?? 2) - (importanceById[a.taskId] ?? 2)
  })
}
