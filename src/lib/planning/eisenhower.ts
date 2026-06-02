import type { TaskTypeTag, EisenhowerQuadrant } from '@/types'

export const TYPE_IMPORTANCE: Record<TaskTypeTag, number> = {
  exam: 4, project: 3, lab: 3, writeup: 3, pset: 3,
  quiz: 2, review: 2, reading: 2, other: 2,
}

export interface ImportanceSignals {
  taskType: TaskTypeTag
  gradePercent?: number | null
  goalAligned?: boolean
  isGraded?: boolean
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x))

export function assignImportance(s: ImportanceSignals): number {
  let imp = TYPE_IMPORTANCE[s.taskType] ?? 2
  if (s.gradePercent != null) {
    if (s.gradePercent >= 25) imp = 4
    else if (s.gradePercent >= 10) imp = Math.max(imp, 3)
    else if (s.gradePercent < 5) imp -= 1
  }
  if (s.goalAligned) imp = Math.min(4, imp + 1)
  if (s.isGraded === false) imp -= 1
  return clamp(imp, 1, 4)
}

export function eisenhowerQuadrant(importance: number, isUrgent: boolean): EisenhowerQuadrant {
  const important = importance >= 3
  if (important && isUrgent) return 'urgent_important'
  if (important && !isUrgent) return 'not_urgent_important'
  if (!important && isUrgent) return 'urgent_not_important'
  return 'neither'
}

export interface CutCandidate {
  id: string
  quadrant: EisenhowerQuadrant
  isAtRisk: boolean
  mustToday: boolean
}

const QUADRANT_CUT_RANK: Record<EisenhowerQuadrant, number> = {
  neither: 0, urgent_not_important: 1, not_urgent_important: 2, urgent_important: 3,
}

export function cutOrder(candidates: CutCandidate[]): string[] {
  return candidates
    .map((c, i) => ({
      id: c.id, i,
      rank: c.isAtRisk || c.mustToday ? 99 : QUADRANT_CUT_RANK[c.quadrant],
    }))
    .sort((a, b) => (a.rank !== b.rank ? a.rank - b.rank : a.i - b.i))
    .map((c) => c.id)
}
