import { assignImportance, eisenhowerQuadrant, cutOrder, TYPE_IMPORTANCE } from '@/lib/planning/eisenhower'
import type { TaskTypeTag } from '@/types'

describe('assignImportance', () => {
  it('uses the type default when no other signal', () => {
    expect(assignImportance({ taskType: 'reading' })).toBe(2)
    expect(assignImportance({ taskType: 'exam' })).toBe(4)
  })
  it('high stakes (>=25% of grade) forces importance 4', () => {
    expect(assignImportance({ taskType: 'reading', gradePercent: 30 })).toBe(4)
  })
  it('low stakes (<5%) reduces importance', () => {
    expect(assignImportance({ taskType: 'pset', gradePercent: 2 })).toBe(2) // 3 -> 2
  })
  it('goal alignment bumps importance (capped at 4)', () => {
    expect(assignImportance({ taskType: 'quiz', goalAligned: true })).toBe(3) // 2 -> 3
    expect(assignImportance({ taskType: 'exam', goalAligned: true })).toBe(4) // capped
  })
  it('ungraded reduces importance', () => {
    expect(assignImportance({ taskType: 'reading', isGraded: false })).toBe(1) // 2 -> 1
  })
  it('clamps to 1..4', () => {
    expect(assignImportance({ taskType: 'other', gradePercent: 1, isGraded: false })).toBe(1)
  })
})

describe('eisenhowerQuadrant', () => {
  it('maps importance x urgency to quadrants', () => {
    expect(eisenhowerQuadrant(4, true)).toBe('urgent_important')
    expect(eisenhowerQuadrant(3, false)).toBe('not_urgent_important')
    expect(eisenhowerQuadrant(2, true)).toBe('urgent_not_important')
    expect(eisenhowerQuadrant(1, false)).toBe('neither')
  })
  it('TYPE_IMPORTANCE covers every task type', () => {
    ;(['lab', 'pset', 'reading', 'project', 'writeup', 'quiz', 'review', 'exam', 'other'] as TaskTypeTag[])
      .forEach((t) => expect(TYPE_IMPORTANCE[t]).toBeGreaterThanOrEqual(1))
  })
})

describe('cutOrder', () => {
  it('cuts neither first, protects at-risk/must-today last', () => {
    const order = cutOrder([
      { id: 'imp', quadrant: 'urgent_important', isAtRisk: false, mustToday: false },
      { id: 'none', quadrant: 'neither', isAtRisk: false, mustToday: false },
      { id: 'uni', quadrant: 'urgent_not_important', isAtRisk: false, mustToday: false },
      { id: 'risk', quadrant: 'neither', isAtRisk: true, mustToday: false },
    ])
    expect(order[0]).toBe('none') // neither, unprotected -> first
    expect(order[1]).toBe('uni') // urgent-not-important
    expect(order[order.length - 1]).toBe('risk') // at-risk protected -> last
  })
})
