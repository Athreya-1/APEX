import { guardrailsToSkeleton } from '@/lib/planning/guardrails'
import type { Guardrail } from '@/types'

const WS = '2026-06-01T06:00:00.000Z'
const WE = '2026-06-01T23:00:00.000Z'
const g = (over: Partial<Guardrail>): Guardrail => ({
  id: 'g', user_id: 'u', kind: 'no_work_after', payload: {}, hard: true, is_active: true, created_at: '', ...over,
})

describe('guardrailsToSkeleton', () => {
  it('no_work_before locks the morning up to the time', () => {
    const [item] = guardrailsToSkeleton([g({ kind: 'no_work_before', payload: { time: '09:00' } })], WS, WE)
    expect(item.state).toBe('rest_lockout')
    expect(item.start).toBe(WS)
    expect(item.end).toBe('2026-06-01T09:00:00.000Z')
  })
  it('no_work_after locks the evening from the time', () => {
    const [item] = guardrailsToSkeleton([g({ kind: 'no_work_after', payload: { time: '20:00' } })], WS, WE)
    expect(item.start).toBe('2026-06-01T20:00:00.000Z')
    expect(item.end).toBe(WE)
  })
  it('protected_window locks an arbitrary range', () => {
    const [item] = guardrailsToSkeleton([g({ kind: 'protected_window', payload: { start: '13:00', end: '14:30' } })], WS, WE)
    expect(item.start).toBe('2026-06-01T13:00:00.000Z')
    expect(item.end).toBe('2026-06-01T14:30:00.000Z')
  })
  it('break_day on the plan date locks the whole window', () => {
    const [item] = guardrailsToSkeleton([g({ kind: 'break_day', payload: { date: '2026-06-01' } })], WS, WE)
    expect(item.start).toBe(WS)
    expect(item.end).toBe(WE)
  })
  it('break_day on another date produces nothing', () => {
    expect(guardrailsToSkeleton([g({ kind: 'break_day', payload: { date: '2026-06-02' } })], WS, WE)).toEqual([])
  })
  it('skips inactive guardrails', () => {
    expect(guardrailsToSkeleton([g({ kind: 'no_work_after', payload: { time: '20:00' }, is_active: false })], WS, WE)).toEqual([])
  })
})
