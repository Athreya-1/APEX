import type { CognitiveClass, TimelineSlot } from '@/types'
import { freeRuns, lockRange } from './timeline'
import type { EngineBlock, EngineTask, PlanRequest, ReasoningNote, SkeletonItem } from './engine-types'

import { SLOT_MINUTES } from './timeline'

// ── Pass 1: skeleton + capacity ──

export function lockSkeleton(timeline: TimelineSlot[], skeleton: SkeletonItem[]): TimelineSlot[] {
  for (const item of skeleton) {
    lockRange(timeline, item.start, item.end, item.state, {
      assignedId: item.id,
      cognitiveClass: item.cognitiveClass,
    })
  }
  return timeline
}

export function availableMinutes(timeline: TimelineSlot[]): number {
  return timeline.filter((s) => s.state === 'available').length * SLOT_MINUTES
}

// ── Pass 2: demands ──

export interface Demands {
  mustHours: number
  flexHabitMins: number
  discretionaryTasks: EngineTask[]
}

export function computeDemands(request: PlanRequest): Demands {
  const mustHours = request.tasks
    .filter((t) => t.mustToday)
    .reduce((sum, t) => sum + t.paddedHours, 0)

  const flexHabitMins = request.habits.reduce((sum, h) => {
    const mins = h.cascade && h.cascade.length > 0 ? h.cascade[0] : h.durationMins
    return sum + mins
  }, 0)

  const discretionaryTasks = request.tasks.filter((t) => !t.mustToday)

  return { mustHours, flexHabitMins, discretionaryTasks }
}

// ── Pass 3: arbitration ──

export interface Budget {
  reservedMustMins: number
  gymMins: number
  habitMins: number
  discretionaryMins: number
  dialUsed: number
  capBreached: boolean
}

export function arbitrate(request: PlanRequest, freeMins: number): Budget {
  const capMins = request.workHourCap * 60
  const { mustHours } = computeDemands(request)
  const reservedMustMins = mustHours * 60

  const capBreached = reservedMustMins > capMins || reservedMustMins > freeMins

  // Budget available after reserving must-do, bounded by both cap and free capacity.
  const rem = Math.max(0, Math.min(capMins, freeMins) - reservedMustMins)

  // Habits: gym-style cascades pick the largest tier that fits the remaining budget;
  // frequency/time-blocked habits are included at their duration if they fit.
  let remaining = rem
  let gymMins = 0
  let habitMins = 0
  for (const h of request.habits) {
    if (h.cascade && h.cascade.length > 0) {
      const tier = h.cascade.find((m) => m <= remaining)
      if (tier !== undefined) {
        gymMins += tier
        remaining -= tier
      }
    } else if (h.durationMins <= remaining) {
      habitMins += h.durationMins
      remaining -= h.durationMins
    }
  }

  // Discretionary: dial share of the leftover after must-do + habits.
  const discretionaryMins = Math.floor(request.workLifeDial * remaining)

  return {
    reservedMustMins,
    gymMins,
    habitMins,
    discretionaryMins,
    dialUsed: request.workLifeDial,
    capBreached,
  }
}

// ── Pass 4: placement (energy zones, consolidation, chunking, cognitive variety) ──

export type EnergyZone = 'peak' | 'trough' | 'other'

export function classifyEnergy(offsetMins: number): EnergyZone {
  if (offsetMins >= 120 && offsetMins <= 300) return 'peak'
  if (offsetMins >= 360 && offsetMins <= 540) return 'trough'
  return 'other'
}

function preferredZone(cognitiveClass: CognitiveClass): EnergyZone {
  if (cognitiveClass === 'heavy_focus' || cognitiveClass === 'creative') return 'peak'
  if (cognitiveClass === 'light_admin') return 'trough'
  return 'other'
}

function blockTypeFor(cognitiveClass: CognitiveClass): string {
  switch (cognitiveClass) {
    case 'heavy_focus': return 'deep_work'
    case 'creative': return 'deep_work'
    case 'light_admin': return 'admin'
    case 'physical': return 'gym'
    case 'restorative': return 'rest'
    default: return 'custom'
  }
}

interface PlacementCtx {
  consecutiveHeavy: number
  maxConsecutiveHeavy: number
  blocks: EngineBlock[]
}

function emitSlots(
  timeline: TimelineSlot[], startIdx: number, count: number,
  state: TimelineSlot['state'], opts: {
    taskId?: string; habitId?: string; cognitiveClass?: CognitiveClass; blockType: string; label: string
  }, blocks: EngineBlock[],
): void {
  const start = timeline[startIdx].start
  const end = timeline[startIdx + count - 1].end
  const assignedId = opts.taskId ?? opts.habitId ?? null
  for (let i = startIdx; i < startIdx + count; i++) {
    timeline[i].state = state
    timeline[i].assignedId = assignedId
    if (opts.cognitiveClass) timeline[i].cognitiveClass = opts.cognitiveClass
  }
  blocks.push({
    taskId: opts.taskId ?? null,
    habitId: opts.habitId ?? null,
    blockType: opts.blockType,
    cognitiveClass: opts.cognitiveClass ?? null,
    start, end, label: opts.label,
  })
}

function slotOffsetMins(timeline: TimelineSlot[], idx: number, wakeMs: number): number {
  return (Date.parse(timeline[idx].start) - wakeMs) / 60000
}

// Places up to `targetMins` of focus time for a single task; returns placed minutes.
function placeOneTask(
  timeline: TimelineSlot[], task: EngineTask, targetMins: number, request: PlanRequest, ctx: PlacementCtx,
): number {
  const [F, B] = request.sessionMode === '90_20' ? [90, 20] : [50, 10]
  const Fslots = Math.max(1, Math.round(F / SLOT_MINUTES))
  const Bslots = Math.max(1, Math.round(B / SLOT_MINUTES))
  const restorativeSlots = Bslots + 1
  const minChunkSlots = Math.max(1, Math.round(request.minChunkMinutes / SLOT_MINUTES))
  const pref = preferredZone(task.cognitiveClass)
  const wakeMs = Date.parse(timeline[0].start)
  const label = task.label

  let remainingSlots = Math.round(targetMins / SLOT_MINUTES)

  while (remainingSlots > 0) {
    const runs = freeRuns(timeline)
    if (runs.length === 0) break

    // When a proper chunk is still owed, only consider runs that can hold one.
    const needFull = remainingSlots >= minChunkSlots
    const usable = runs.filter((r) => (needFull ? r.slotCount >= minChunkSlots : r.slotCount >= 1))
    if (usable.length === 0) break

    usable.sort((a, b) => {
      const sa = suitability(pref, classifyEnergy(a.offsetMins))
      const sb = suitability(pref, classifyEnergy(b.offsetMins))
      if (sa !== sb) return sa - sb
      if (b.slotCount !== a.slotCount) return b.slotCount - a.slotCount
      return a.startIndex - b.startIndex
    })
    const run = usable[0]

    // Start within the run at the preferred energy zone if there is room for a real chunk there.
    let startIdx = run.startIndex
    for (let k = run.startIndex; k < run.endIndexExclusive; k++) {
      if (classifyEnergy(slotOffsetMins(timeline, k, wakeMs)) === pref) {
        if (run.endIndexExclusive - k >= minChunkSlots) startIdx = k
        break
      }
    }

    let cursor = startIdx
    while (remainingSlots > 0 && cursor < run.endIndexExclusive) {
      let avail = run.endIndexExclusive - cursor
      if (avail < minChunkSlots && remainingSlots >= minChunkSlots) break

      if (task.cognitiveClass === 'heavy_focus' && ctx.consecutiveHeavy >= ctx.maxConsecutiveHeavy) {
        const rb = Math.min(restorativeSlots, avail)
        emitSlots(timeline, cursor, rb, 'break', { blockType: 'break', label: 'Recharge' }, ctx.blocks)
        cursor += rb
        ctx.consecutiveHeavy = 0
        avail = run.endIndexExclusive - cursor
        if (avail <= 0) break
        if (avail < minChunkSlots && remainingSlots >= minChunkSlots) break
      }

      const focusSlots = Math.min(Fslots, remainingSlots, avail)
      if (focusSlots <= 0) break
      emitSlots(timeline, cursor, focusSlots, 'focus', {
        taskId: task.id, cognitiveClass: task.cognitiveClass,
        blockType: blockTypeFor(task.cognitiveClass), label,
      }, ctx.blocks)
      cursor += focusSlots
      remainingSlots -= focusSlots
      ctx.consecutiveHeavy = task.cognitiveClass === 'heavy_focus' ? ctx.consecutiveHeavy + 1 : 0

      if (remainingSlots > 0) {
        avail = run.endIndexExclusive - cursor
        if (avail <= 0) break
        const bs = Math.min(Bslots, avail)
        emitSlots(timeline, cursor, bs, 'break', { blockType: 'break', label: 'Break' }, ctx.blocks)
        cursor += bs
        ctx.consecutiveHeavy = 0
      }
    }
  }

  const placedSlots = Math.round(targetMins / SLOT_MINUTES) - remainingSlots
  return placedSlots * SLOT_MINUTES
}

function suitability(pref: EnergyZone, zone: EnergyZone): number {
  if (pref === 'other') return 0
  if (zone === pref) return 0
  if (zone === 'other') return 1
  return 2
}

export interface PlacementResult {
  blocks: EngineBlock[]
  scheduledHoursByTask: Record<string, number>
  reasoning: ReasoningNote[]
}

export function placeTasks(
  timeline: TimelineSlot[], orderedTasks: EngineTask[], budget: Budget, request: PlanRequest,
): PlacementResult {
  const blocks: EngineBlock[] = []
  const scheduledHoursByTask: Record<string, number> = {}
  const reasoning: ReasoningNote[] = []
  const ctx: PlacementCtx = {
    consecutiveHeavy: 0,
    maxConsecutiveHeavy: Math.max(1, request.maxConsecutiveHeavy),
    blocks,
  }

  let discretionaryRemaining = budget.discretionaryMins

  for (const task of orderedTasks) {
    let target = task.paddedHours * 60
    if (!task.mustToday) target = Math.min(target, discretionaryRemaining)
    if (target <= 0) {
      scheduledHoursByTask[task.id] = 0
      continue
    }
    const placed = placeOneTask(timeline, task, target, request, ctx)
    scheduledHoursByTask[task.id] = placed / 60
    if (!task.mustToday) discretionaryRemaining -= placed
    reasoning.push({
      refId: task.id,
      note: `Scheduled ${(placed / 60).toFixed(2)}h of "${task.label}" (${task.cognitiveClass}, prefers ${preferredZone(task.cognitiveClass)} energy)`,
    })
  }

  return { blocks, scheduledHoursByTask, reasoning }
}
