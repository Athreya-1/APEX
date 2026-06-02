import { computeUrgency, orderByUrgency } from '@/lib/planning/urgency'
import type { UrgencyTask } from '@/lib/planning/urgency'

const NOW = '2026-06-01T08:00:00.000Z'
const inDays = (d: number) => new Date(Date.parse(NOW) + d * 86400000).toISOString()

describe('computeUrgency', () => {
  it('no-deadline task is not pressure-scored', () => {
    const tasks: UrgencyTask[] = [{ taskId: 'a', deadline: null, paddedHours: 5, meanHours: 5, stdevHours: 0 }]
    const [r] = computeUrgency(tasks, { now: NOW, capacityHoursUntil: () => 100 })
    expect(r.score).toBe(0)
    expect(r.isAtRisk).toBe(false)
    expect(r.slackHours).toBe(Number.POSITIVE_INFINITY)
  })

  it('overdue task gets the max sentinel and is at-risk', () => {
    const tasks: UrgencyTask[] = [{ taskId: 'a', deadline: inDays(-1), paddedHours: 4, meanHours: 4, stdevHours: 0 }]
    const [r] = computeUrgency(tasks, { now: NOW, capacityHoursUntil: () => 50 })
    expect(r.score).toBe(999)
    expect(r.isAtRisk).toBe(true)
    expect(r.slackHours).toBe(-4)
  })

  it('ample capacity -> low score, positive slack, not at-risk', () => {
    const tasks: UrgencyTask[] = [{ taskId: 'a', deadline: inDays(10), paddedHours: 4, meanHours: 4, stdevHours: 0 }]
    const [r] = computeUrgency(tasks, { now: NOW, capacityHoursUntil: () => 40 })
    expect(r.isAtRisk).toBe(false)
    expect(r.slackHours).toBeCloseTo(36)
    expect(r.score).toBeLessThan(0.2)
  })

  it('demand exceeding capacity -> negative slack and at-risk', () => {
    const tasks: UrgencyTask[] = [{ taskId: 'a', deadline: inDays(1), paddedHours: 10, meanHours: 10, stdevHours: 0 }]
    const [r] = computeUrgency(tasks, { now: NOW, capacityHoursUntil: () => 6 })
    expect(r.isAtRisk).toBe(true)
    expect(r.slackHours).toBeCloseTo(-4)
    expect(r.score).toBeGreaterThan(1.5)
  })

  it('EDF: earlier-deadline work reduces capacity available to a later task', () => {
    const tasks: UrgencyTask[] = [
      { taskId: 'early', deadline: inDays(1), paddedHours: 5, meanHours: 5, stdevHours: 0 },
      { taskId: 'late',  deadline: inDays(2), paddedHours: 5, meanHours: 5, stdevHours: 0 },
    ]
    // capacity: 6h by day1, 8h by day2
    const cap = (iso: string) => (iso === inDays(1) ? 6 : 8)
    const res = computeUrgency(tasks, { now: NOW, capacityHoursUntil: cap })
    const late = res.find((r) => r.taskId === 'late')!
    // requiredThrough(late) = 10, available(day2) = 8 -> slack -2, at-risk
    expect(late.slackHours).toBeCloseTo(-2)
    expect(late.isAtRisk).toBe(true)
  })

  it('uncertainty inflates the score', () => {
    const certain = computeUrgency([{ taskId: 'a', deadline: inDays(3), paddedHours: 6, meanHours: 6, stdevHours: 0 }], { now: NOW, capacityHoursUntil: () => 12 })[0]
    const uncertain = computeUrgency([{ taskId: 'a', deadline: inDays(3), paddedHours: 6, meanHours: 6, stdevHours: 3 }], { now: NOW, capacityHoursUntil: () => 12 })[0]
    expect(uncertain.score).toBeGreaterThan(certain.score)
  })
})

describe('orderByUrgency', () => {
  it('at-risk first, then score desc, importance breaks near-ties', () => {
    const results = [
      { taskId: 'low', score: 0.2, isAtRisk: false, slackHours: 10, paddedHours: 2 },
      { taskId: 'risk', score: 0.1, isAtRisk: true, slackHours: -1, paddedHours: 8 },
      { taskId: 'high', score: 0.9, isAtRisk: false, slackHours: 3, paddedHours: 4 },
    ]
    const ordered = orderByUrgency(results, { low: 4, risk: 1, high: 1 })
    expect(ordered[0].taskId).toBe('risk')   // at-risk wins regardless of score
    expect(ordered[1].taskId).toBe('high')   // then highest score
  })
})
