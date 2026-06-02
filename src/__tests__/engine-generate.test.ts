import { generatePlan } from '@/lib/planning/engine'
import type { PlanRequest } from '@/lib/planning/engine-types'

const W = { windowStart: '2026-06-01T08:00:00.000Z', windowEnd: '2026-06-01T22:00:00.000Z' }
const req: PlanRequest = {
  ...W, sessionMode: '90_20', workLifeDial: 0.5, workHourCap: 8,
  minChunkMinutes: 60, maxConsecutiveHeavy: 4,
  skeleton: [
    { id: 'lunch', start: '2026-06-01T12:00:00.000Z', end: '2026-06-01T12:45:00.000Z', state: 'meal', label: 'Lunch' },
    { id: 'class', start: '2026-06-01T15:00:00.000Z', end: '2026-06-01T16:00:00.000Z', state: 'fixed', label: 'Lecture' },
  ],
  tasks: [
    { id: 'lab', label: '15-213 Lab', paddedHours: 4, cognitiveClass: 'heavy_focus', importance: 4, urgencyScore: 3, isAtRisk: false, mustToday: true },
    { id: 'read', label: 'Reading', paddedHours: 1, cognitiveClass: 'light_admin', importance: 2, urgencyScore: 0.5, isAtRisk: false, mustToday: false },
  ],
  habits: [
    { id: 'gym', label: 'Gym', mode: 'time_blocked', durationMins: 90, cognitiveClass: 'physical', cascade: [90, 60, 30] },
  ],
}

describe('generatePlan', () => {
  it('produces a non-overlapping plan that includes skeleton, lab, and gym', () => {
    const plan = generatePlan(req)
    const ids = plan.blocks.map((b) => b.label)
    expect(ids).toContain('Lunch')
    expect(ids).toContain('Lecture')
    expect(plan.blocks.some((b) => b.taskId === 'lab')).toBe(true)
    expect(plan.blocks.some((b) => b.habitId === 'gym')).toBe(true)
    // no overlaps
    const s = [...plan.blocks].sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
    for (let i = 1; i < s.length; i++) {
      expect(Date.parse(s[i].start)).toBeGreaterThanOrEqual(Date.parse(s[i - 1].end))
    }
    expect(plan.scheduledHoursByTask['lab']).toBeCloseTo(4)
    expect(plan.capBreached).toBe(false)
  })

  it('flags at-risk + cap breach when a must-do exceeds the cap', () => {
    const tight: PlanRequest = { ...req, workHourCap: 3, tasks: [
      { id: 'lab', label: 'Lab', paddedHours: 6, cognitiveClass: 'heavy_focus', importance: 4, urgencyScore: 9, isAtRisk: true, mustToday: true },
    ], habits: [] }
    const plan = generatePlan(tight)
    expect(plan.capBreached).toBe(true)
    expect(plan.warnings.some((w) => w.kind === 'work_hour_cap_breached')).toBe(true)
    expect(plan.warnings.some((w) => w.kind === 'deadline_at_risk' && w.refId === 'lab')).toBe(true)
  })

  it('returns no overlap warnings on a normal plan', () => {
    const plan = generatePlan(req)
    expect(plan.warnings.some((w) => w.kind === 'overcommitted')).toBe(false)
  })
})
