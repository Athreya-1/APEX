import { getUrgencyTier, getSchedulingPriority, sortTasksForScheduling } from '@/lib/planning/urgency'
import { COLD_START_DEFAULTS } from '@/lib/planning/effort'

describe('urgency helpers', () => {
  it('scores > 0.6 are urgent', () => {
    expect(getUrgencyTier(0.7).tier).toBe('urgent')
  })

  it('scores 0.3-0.6 are this_week', () => {
    expect(getUrgencyTier(0.4).tier).toBe('this_week')
  })

  it('scores < 0.3 are on_radar', () => {
    expect(getUrgencyTier(0.2).tier).toBe('on_radar')
  })

  it('urgent_important gets priority 1 and prefers peak energy', () => {
    const p = getSchedulingPriority('urgent_important')
    expect(p.priority).toBe(1)
    expect(p.preferPeakEnergy).toBe(true)
  })

  it('sortTasksForScheduling puts do_date=today tasks first', () => {
    const today = new Date().toISOString().split('T')[0]
    const tasks = [
      { do_date: null, urgency_score: 0.9, eisenhower_quadrant: 'urgent_important' as const },
      { do_date: today, urgency_score: 0.3, eisenhower_quadrant: 'neither' as const },
    ]
    const sorted = sortTasksForScheduling(tasks, today)
    expect(sorted[0].do_date).toBe(today)
  })
})

describe('cold start defaults', () => {
  it('lab default is 3.5h', () => {
    expect(COLD_START_DEFAULTS.lab).toBe(3.5)
  })

  it('pset default is 2.5h', () => {
    expect(COLD_START_DEFAULTS.pset).toBe(2.5)
  })
})
