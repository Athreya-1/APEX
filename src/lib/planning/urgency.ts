import type { EisenhowerQuadrant } from '@/types'

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
