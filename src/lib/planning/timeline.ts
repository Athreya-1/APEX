import type { TimelineSlot, SlotState, CognitiveClass } from '@/types'

export const SLOT_MINUTES = 15
const MS = SLOT_MINUTES * 60_000

export function buildTimeline(windowStart: string, windowEnd: string): TimelineSlot[] {
  const start = Date.parse(windowStart)
  const end = Date.parse(windowEnd)
  const slots: TimelineSlot[] = []
  let i = 0
  for (let t = start; t + MS <= end + 1; t += MS) {
    slots.push({
      index: i++, start: new Date(t).toISOString(), end: new Date(t + MS).toISOString(),
      state: 'available', assignedId: null,
    })
  }
  return slots
}

export function slotIndexAt(timeline: TimelineSlot[], iso: string): number {
  const t = Date.parse(iso)
  for (const s of timeline) {
    if (t >= Date.parse(s.start) && t < Date.parse(s.end)) return s.index
  }
  return -1
}

export function lockRange(
  timeline: TimelineSlot[], start: string, end: string, state: SlotState,
  opts?: { assignedId?: string; cognitiveClass?: CognitiveClass },
): TimelineSlot[] {
  const a = Date.parse(start), b = Date.parse(end)
  for (const s of timeline) {
    const mid = Date.parse(s.start) + MS / 2
    if (mid >= a && mid < b) {
      s.state = state
      s.assignedId = opts?.assignedId ?? s.assignedId
      if (opts?.cognitiveClass) s.cognitiveClass = opts.cognitiveClass
    }
  }
  return timeline
}

export interface FreeRun {
  startIndex: number
  endIndexExclusive: number
  startISO: string
  endISO: string
  slotCount: number
  offsetMins: number
}

export function freeRuns(timeline: TimelineSlot[]): FreeRun[] {
  if (timeline.length === 0) return []
  const t0 = Date.parse(timeline[0].start)
  const runs: FreeRun[] = []
  let i = 0
  while (i < timeline.length) {
    if (timeline[i].state !== 'available') { i++; continue }
    let j = i
    while (j < timeline.length && timeline[j].state === 'available') j++
    runs.push({
      startIndex: i, endIndexExclusive: j,
      startISO: timeline[i].start, endISO: timeline[j - 1].end,
      slotCount: j - i, offsetMins: (Date.parse(timeline[i].start) - t0) / 60000,
    })
    i = j
  }
  return runs
}

export function runMinutes(run: FreeRun): number { return run.slotCount * SLOT_MINUTES }
