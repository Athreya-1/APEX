import { buildTimeline, slotIndexAt, lockRange, freeRuns, SLOT_MINUTES, planSessions } from '@/lib/planning/timeline'

const S = '2026-06-01T08:00:00.000Z'
const E = '2026-06-01T20:00:00.000Z' // 12h -> 48 slots

describe('buildTimeline', () => {
  it('creates 15-min slots across the window', () => {
    const t = buildTimeline(S, E)
    expect(SLOT_MINUTES).toBe(15)
    expect(t.length).toBe(48)
    expect(t[0].start).toBe(S)
    expect(t[0].state).toBe('available')
    expect(t[47].end).toBe(E)
  })
  it('drops a trailing partial slot', () => {
    const t = buildTimeline(S, '2026-06-01T08:20:00.000Z') // 20 min -> 1 full slot
    expect(t.length).toBe(1)
  })
})

describe('lockRange + freeRuns', () => {
  it('locks slots overlapping a range and splits free runs around it', () => {
    const t = buildTimeline(S, E)
    lockRange(t, '2026-06-01T12:00:00.000Z', '2026-06-01T13:00:00.000Z', 'meal', { assignedId: 'lunch' })
    const locked = t.filter((s) => s.state === 'meal')
    expect(locked.length).toBe(4) // 1h
    expect(locked[0].assignedId).toBe('lunch')
    const runs = freeRuns(t)
    expect(runs.length).toBe(2) // before & after lunch
    expect(runs[0].offsetMins).toBe(0)
    expect(runs[1].startISO).toBe('2026-06-01T13:00:00.000Z')
  })
  it('clamps out-of-window ranges without throwing', () => {
    const t = buildTimeline(S, E)
    expect(() => lockRange(t, '2026-06-01T06:00:00.000Z', '2026-06-01T09:00:00.000Z', 'fixed')).not.toThrow()
    expect(t.filter((s) => s.state === 'fixed').length).toBe(4) // only 08:00-09:00 inside
  })
  it('slotIndexAt finds the containing slot', () => {
    const t = buildTimeline(S, E)
    expect(slotIndexAt(t, '2026-06-01T08:07:00.000Z')).toBe(0)
    expect(slotIndexAt(t, '2026-06-01T09:00:00.000Z')).toBe(4)
    expect(slotIndexAt(t, '2026-06-01T21:00:00.000Z')).toBe(-1)
  })
})

describe('planSessions', () => {
  it('90/20: 210 min -> f90,b20,f90,b20,f30 (remainder >= minChunk)', () => {
    expect(planSessions(210, '90_20', 30)).toEqual([
      { kind: 'focus', minutes: 90 }, { kind: 'break', minutes: 20 },
      { kind: 'focus', minutes: 90 }, { kind: 'break', minutes: 20 },
      { kind: 'focus', minutes: 30 },
    ])
  })
  it('absorbs a sub-min-chunk remainder into the last focus', () => {
    // 200 min, F=90, remainder 20 (<30) -> f90,b20,f110
    expect(planSessions(200, '90_20', 30)).toEqual([
      { kind: 'focus', minutes: 90 }, { kind: 'break', minutes: 20 },
      { kind: 'focus', minutes: 110 },
    ])
  })
  it('single short session has no trailing break', () => {
    expect(planSessions(60, '90_20', 30)).toEqual([{ kind: 'focus', minutes: 60 }])
  })
  it('50/10 splits correctly', () => {
    // 110 mod 50 = 10 < minChunk 25 -> remainder absorbed into last full focus -> f50,b10,f60
    expect(planSessions(110, '50_10', 25)).toEqual([
      { kind: 'focus', minutes: 50 }, { kind: 'break', minutes: 10 },
      { kind: 'focus', minutes: 60 },
    ])
  })
  it('zero or negative -> empty', () => {
    expect(planSessions(0, '90_20', 30)).toEqual([])
  })
})
