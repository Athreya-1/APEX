import type { TimelineSlot } from '@/types'
import { lockRange } from './timeline'
import type { EngineTask, PlanRequest, SkeletonItem } from './engine-types'

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
