import { buildTimeline } from '@/lib/planning/timeline'
import { classifyEnergy, placeTasks } from '@/lib/planning/engine'
import { buildEnergyWindow } from '@/lib/planning/energy-window'
import type { EngineTask, PlanRequest } from '@/lib/planning/engine-types'

const W = { windowStart: '2026-06-01T08:00:00.000Z', windowEnd: '2026-06-01T22:00:00.000Z' } // 14h
const morningPeak = buildEnergyWindow(W.windowStart, '09:00', '12:00')
const base: PlanRequest = {
  ...W, sessionMode: '90_20', workLifeDial: 0.5, workHourCap: 12,
  minChunkMinutes: 60, maxConsecutiveHeavy: 2, skeleton: [], tasks: [], habits: [],
  energyWindow: morningPeak,
}
const heavy = (id: string, h: number, must = true): EngineTask => ({
  id, label: id, paddedHours: h, cognitiveClass: 'heavy_focus',
  importance: 3, urgencyScore: 1, isAtRisk: false, mustToday: must,
})

describe('classifyEnergy', () => {
  it('marks slots inside user peak_start / peak_end as peak', () => {
    expect(classifyEnergy(60, morningPeak)).toBe('peak')
    expect(classifyEnergy(240, morningPeak)).toBe('peak')
    expect(classifyEnergy(0, morningPeak)).toBe('other')
    expect(classifyEnergy(300, morningPeak)).toBe('trough')
  })

  it('respects a custom afternoon peak window', () => {
    const afternoon = buildEnergyWindow(W.windowStart, '14:00', '17:00')
    expect(classifyEnergy(360, afternoon)).toBe('peak')
    expect(classifyEnergy(180, afternoon)).toBe('other')
  })
})

describe('placeTasks', () => {
  it('places a heavy task into the configured peak zone', () => {
    const t = buildTimeline(W.windowStart, W.windowEnd)
    const budget = { reservedMustMins: 180, gymMins: 0, habitMins: 0, discretionaryMins: 0, dialUsed: 0.5, capBreached: false }
    const { blocks, scheduledHoursByTask } = placeTasks(t, [heavy('lab', 3)], budget, base)
    const focusBlocks = blocks.filter((b) => b.taskId === 'lab' && b.blockType !== 'break')
    const totalMin = focusBlocks.reduce((s, b) => s + (Date.parse(b.end) - Date.parse(b.start)) / 60000, 0)
    expect(totalMin).toBe(180)
    expect(scheduledHoursByTask['lab']).toBeCloseTo(3)
    const first = focusBlocks.sort((a, b) => Date.parse(a.start) - Date.parse(b.start))[0]
    const offset = (Date.parse(first.start) - Date.parse(W.windowStart)) / 60000
    expect(offset).toBeGreaterThanOrEqual(morningPeak.peakStartMins)
    expect(offset).toBeLessThanOrEqual(morningPeak.peakEndMins)
    const sorted = [...blocks].sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
    for (let i = 1; i < sorted.length; i++) {
      expect(Date.parse(sorted[i].start)).toBeGreaterThanOrEqual(Date.parse(sorted[i - 1].end))
    }
  })

  it('shifts heavy work to afternoon when peak window is later', () => {
    const afternoonPeak = buildEnergyWindow(W.windowStart, '14:00', '17:00')
    const t = buildTimeline(W.windowStart, W.windowEnd)
    const budget = { reservedMustMins: 90, gymMins: 0, habitMins: 0, discretionaryMins: 0, dialUsed: 0.5, capBreached: false }
    const { blocks } = placeTasks(t, [heavy('lab', 1.5)], budget, { ...base, energyWindow: afternoonPeak })
    const first = blocks.find((b) => b.taskId === 'lab' && b.blockType !== 'break')!
    const offset = (Date.parse(first.start) - Date.parse(W.windowStart)) / 60000
    expect(offset).toBeGreaterThanOrEqual(afternoonPeak.peakStartMins)
  })

  it('enforces maxConsecutiveHeavy with a contrasting block', () => {
    const t = buildTimeline(W.windowStart, W.windowEnd)
    const budget = { reservedMustMins: 540, gymMins: 0, habitMins: 0, discretionaryMins: 0, dialUsed: 0.5, capBreached: false }
    const { blocks } = placeTasks(t, [heavy('a', 1.5), heavy('b', 1.5), heavy('c', 1.5)], budget, { ...base, maxConsecutiveHeavy: 2 })
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
