import { buildTimeline } from '@/lib/planning/timeline'
import { classifyEnergy, placeTasks } from '@/lib/planning/engine'
import type { EngineTask, PlanRequest } from '@/lib/planning/engine-types'

const W = { windowStart: '2026-06-01T08:00:00.000Z', windowEnd: '2026-06-01T22:00:00.000Z' } // 14h
const base: PlanRequest = {
  ...W, sessionMode: '90_20', workLifeDial: 0.5, workHourCap: 12,
  minChunkMinutes: 60, maxConsecutiveHeavy: 2, skeleton: [], tasks: [], habits: [],
}
const heavy = (id: string, h: number, must = true): EngineTask => ({
  id, label: id, paddedHours: h, cognitiveClass: 'heavy_focus',
  importance: 3, urgencyScore: 1, isAtRisk: false, mustToday: must,
})

describe('classifyEnergy', () => {
  it('peak window is 2-5h post wake', () => {
    expect(classifyEnergy(180)).toBe('peak')
    expect(classifyEnergy(420)).toBe('trough')
    expect(classifyEnergy(0)).toBe('other')
  })
})

describe('placeTasks', () => {
  it('places a heavy task into the peak zone, chunked, no overlaps', () => {
    const t = buildTimeline(W.windowStart, W.windowEnd)
    const budget = { reservedMustMins: 180, gymMins: 0, habitMins: 0, discretionaryMins: 0, dialUsed: 0.5, capBreached: false }
    const { blocks, scheduledHoursByTask } = placeTasks(t, [heavy('lab', 3)], budget, base)
    const focusBlocks = blocks.filter((b) => b.taskId === 'lab' && b.blockType !== 'break')
    const totalMin = focusBlocks.reduce((s, b) => s + (Date.parse(b.end) - Date.parse(b.start)) / 60000, 0)
    expect(totalMin).toBe(180)
    expect(scheduledHoursByTask['lab']).toBeCloseTo(3)
    // first focus block should start within the peak window (>=2h after wake)
    const first = focusBlocks.sort((a, b) => Date.parse(a.start) - Date.parse(b.start))[0]
    const offset = (Date.parse(first.start) - Date.parse(W.windowStart)) / 60000
    expect(offset).toBeGreaterThanOrEqual(120)
    // no two blocks overlap
    const sorted = [...blocks].sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
    for (let i = 1; i < sorted.length; i++) {
      expect(Date.parse(sorted[i].start)).toBeGreaterThanOrEqual(Date.parse(sorted[i - 1].end))
    }
  })

  it('enforces maxConsecutiveHeavy with a contrasting block', () => {
    const t = buildTimeline(W.windowStart, W.windowEnd)
    const budget = { reservedMustMins: 540, gymMins: 0, habitMins: 0, discretionaryMins: 0, dialUsed: 0.5, capBreached: false }
    // 3 heavy tasks * 90min = need 3 consecutive heavy sessions; cap is 2
    const { blocks } = placeTasks(t, [heavy('a', 1.5), heavy('b', 1.5), heavy('c', 1.5)], budget, { ...base, maxConsecutiveHeavy: 2 })
    // Walk chronological focus/break; never 3 heavy focus in a row without a break/non-heavy between
    const chron = blocks.filter((b) => b.blockType !== 'meal').sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
    let consecutiveHeavy = 0
    for (const b of chron) {
      if (b.cognitiveClass === 'heavy_focus' && b.blockType !== 'break') {
        consecutiveHeavy++
        expect(consecutiveHeavy).toBeLessThanOrEqual(2)
      } else if (b.blockType === 'break' || b.cognitiveClass !== 'heavy_focus') {
        consecutiveHeavy = 0
      }
    }
  })
})
