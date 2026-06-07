import { buildTimeline } from '@/lib/planning/timeline'
import { lockSkeleton, availableMinutes, computeDemands, arbitrate } from '@/lib/planning/engine'
import { buildEnergyWindow } from '@/lib/planning/energy-window'
import type { PlanRequest } from '@/lib/planning/engine-types'

const W = { windowStart: '2026-06-01T08:00:00.000Z', windowEnd: '2026-06-01T20:00:00.000Z' } // 12h
const base: PlanRequest = {
  ...W, sessionMode: '90_20', workLifeDial: 0.5, workHourCap: 8,
  minChunkMinutes: 60, maxConsecutiveHeavy: 4, skeleton: [], tasks: [], habits: [],
  energyWindow: buildEnergyWindow(W.windowStart),
}

describe('Pass 1 skeleton + capacity', () => {
  it('locks skeleton and reduces available minutes', () => {
    const t = buildTimeline(W.windowStart, W.windowEnd)
    lockSkeleton(t, [
      { id: 'lunch', start: '2026-06-01T12:00:00.000Z', end: '2026-06-01T12:45:00.000Z', state: 'meal', label: 'Lunch' },
      { id: 'class', start: '2026-06-01T10:00:00.000Z', end: '2026-06-01T11:00:00.000Z', state: 'fixed', label: 'Class' },
    ])
    expect(availableMinutes(t)).toBe(12 * 60 - 45 - 60)
  })
})

describe('Pass 2 demands', () => {
  it('sums must-do hours and separates discretionary', () => {
    const req: PlanRequest = { ...base, tasks: [
      { id: 'm', label: 'Lab', paddedHours: 4, cognitiveClass: 'heavy_focus', importance: 4, urgencyScore: 2, isAtRisk: false, mustToday: true },
      { id: 'd', label: 'CMR', paddedHours: 3, cognitiveClass: 'creative', importance: 2, urgencyScore: 0, isAtRisk: false, mustToday: false },
    ]}
    const d = computeDemands(req)
    expect(d.mustHours).toBe(4)
    expect(d.discretionaryTasks.map((t) => t.id)).toEqual(['d'])
  })
})

describe('Pass 3 arbitration', () => {
  it('reserves must-do, then gym cascade picks largest fitting tier', () => {
    const req: PlanRequest = { ...base, tasks: [
      { id: 'm', label: 'Lab', paddedHours: 4, cognitiveClass: 'heavy_focus', importance: 4, urgencyScore: 2, isAtRisk: false, mustToday: true },
    ], habits: [
      { id: 'gym', label: 'Gym', mode: 'time_blocked', durationMins: 90, cognitiveClass: 'physical', cascade: [90, 60, 30] },
    ]}
    const b = arbitrate(req, 12 * 60) // plenty
    expect(b.reservedMustMins).toBe(240)
    expect(b.gymMins).toBe(90)
    expect(b.capBreached).toBe(false)
  })
  it('flags cap breach when must-do exceeds the work-hour cap', () => {
    const req: PlanRequest = { ...base, workHourCap: 3, tasks: [
      { id: 'm', label: 'Lab', paddedHours: 5, cognitiveClass: 'heavy_focus', importance: 4, urgencyScore: 9, isAtRisk: true, mustToday: true },
    ]}
    const b = arbitrate(req, 12 * 60)
    expect(b.capBreached).toBe(true)
  })
})
