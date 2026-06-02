import type { CognitiveClass, SlotState, TimelineSlot } from '@/types'
import { buildTimeline, freeRuns, lockRange } from './timeline'
import type {
  EngineBlock, EngineHabit, EngineTask, PlanRequest, PlanResult, PlanWarning, ReasoningNote, SkeletonItem,
} from './engine-types'

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

// ── Habit placement (single contiguous blocks; cascade tiers, time ranges) ──

interface HabitPlacement { blocks: EngineBlock[]; reasoning: ReasoningNote[]; lapsed: EngineHabit[] }

function placeHabits(timeline: TimelineSlot[], request: PlanRequest): HabitPlacement {
  const blocks: EngineBlock[] = []
  const reasoning: ReasoningNote[] = []
  const lapsed: EngineHabit[] = []

  for (const habit of request.habits) {
    if (habit.mode !== 'time_blocked') continue // check_off habits aren't time-placed
    const tiers = habit.cascade && habit.cascade.length > 0 ? habit.cascade : [habit.durationMins]

    let placed = false
    for (const tier of tiers) {
      const need = Math.max(1, Math.round(tier / SLOT_MINUTES))
      const runs = freeRuns(timeline)
        .filter((r) => r.slotCount >= need)
        .sort((a, b) => a.startIndex - b.startIndex)
      if (runs.length === 0) continue
      const run = runs[0]
      emitSlots(timeline, run.startIndex, need, 'habit', {
        habitId: habit.id, cognitiveClass: habit.cognitiveClass,
        blockType: blockTypeFor(habit.cognitiveClass), label: habit.label,
      }, blocks)
      reasoning.push({ refId: habit.id, note: `Placed habit "${habit.label}" for ${need * SLOT_MINUTES}min` })
      placed = true
      break
    }
    if (!placed) lapsed.push(habit)
  }

  return { blocks, reasoning, lapsed }
}

// ── Pass 5: validate + generatePlan orchestration ──

function skeletonBlockType(state: SlotState): string {
  switch (state) {
    case 'meal': return 'meal'
    case 'fixed': return 'fixed'
    case 'rest_lockout': return 'rest'
    case 'habit': return 'habit'
    default: return 'custom'
  }
}

export function validatePlan(blocks: EngineBlock[], request: PlanRequest): PlanWarning[] {
  const warnings: PlanWarning[] = []
  const sorted = [...blocks].sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
  for (let i = 1; i < sorted.length; i++) {
    if (Date.parse(sorted[i].start) < Date.parse(sorted[i - 1].end)) {
      warnings.push({
        kind: 'overcommitted',
        message: `Blocks "${sorted[i - 1].label}" and "${sorted[i].label}" overlap`,
      })
    }
  }
  // Placed work crossing a skeleton lock (should never happen after placement).
  for (const item of request.skeleton) {
    const a = Date.parse(item.start), b = Date.parse(item.end)
    for (const block of blocks) {
      if (block.label === item.label) continue
      const s = Date.parse(block.start), e = Date.parse(block.end)
      if (s < b && e > a && (block.taskId || block.habitId)) {
        warnings.push({
          kind: 'overcommitted',
          message: `Block "${block.label}" crosses fixed item "${item.label}"`,
          refId: block.taskId ?? block.habitId ?? undefined,
        })
      }
    }
  }
  return warnings
}

export function generatePlan(request: PlanRequest): PlanResult {
  const timeline = buildTimeline(request.windowStart, request.windowEnd)
  lockSkeleton(timeline, request.skeleton)

  const freeMins = availableMinutes(timeline)
  const budget = arbitrate(request, freeMins)

  const mustTasks = request.tasks.filter((t) => t.mustToday)
  const discretionaryTasks = request.tasks.filter((t) => !t.mustToday)

  const mustResult = placeTasks(timeline, mustTasks, budget, request)
  const habitResult = placeHabits(timeline, request)
  const discResult = placeTasks(timeline, discretionaryTasks, budget, request)

  const skeletonBlocks: EngineBlock[] = request.skeleton.map((item) => ({
    taskId: null,
    habitId: item.state === 'habit' ? item.id : null,
    blockType: skeletonBlockType(item.state),
    cognitiveClass: item.cognitiveClass ?? null,
    start: item.start,
    end: item.end,
    label: item.label,
  }))

  const blocks = [
    ...skeletonBlocks,
    ...mustResult.blocks,
    ...habitResult.blocks,
    ...discResult.blocks,
  ].sort((a, b) => Date.parse(a.start) - Date.parse(b.start))

  const scheduledHoursByTask = { ...mustResult.scheduledHoursByTask, ...discResult.scheduledHoursByTask }
  const reasoning = [...mustResult.reasoning, ...habitResult.reasoning, ...discResult.reasoning]

  const warnings: PlanWarning[] = [...validatePlan(blocks, request)]

  for (const task of request.tasks) {
    if (task.isAtRisk) {
      warnings.push({
        kind: 'deadline_at_risk',
        message: `"${task.label}" is at risk of missing its deadline`,
        refId: task.id,
      })
    }
  }

  if (budget.capBreached) {
    warnings.push({
      kind: 'work_hour_cap_breached',
      message: `Required work (${Math.round(budget.reservedMustMins / 60)}h) exceeds the work-hour cap of ${request.workHourCap}h`,
    })
  }

  return {
    blocks,
    warnings,
    reasoning,
    capBreached: budget.capBreached,
    dialUsed: request.workLifeDial,
    scheduledHoursByTask,
  }
}
