import { startOfDay, isAfter, isBefore } from 'date-fns'
import { sortTasksForScheduling } from './urgency'
import type { Task, UserPreferences, CourseSession, BlockType, EisenhowerQuadrant } from '@/types'

export interface SchedulerInput {
  plan_date: string // YYYY-MM-DD
  sleep_time: string // ISO timestamptz (previous night)
  wake_time: string // ISO timestamptz
  session_mode: '90_20' | '50_10'
  tasks: Task[]
  preferences: UserPreferences
  course_sessions: CourseSession[]
  existing_gcal_events: Array<{ start: string; end: string; title: string }>
  constraints?: {
    gaps?: Array<{ from: string; to: string }> // HH:MM format
  }
}

export interface ScheduledBlock {
  block_type: BlockType
  start_time: string // ISO
  end_time: string // ISO
  label: string
  description?: string
  task_id?: string
  sort_order: number
}

interface TimeSlot {
  start: Date
  end: Date
}

function minutesToMs(mins: number): number {
  return mins * 60 * 1000
}

function addMins(date: Date, mins: number): Date {
  return new Date(date.getTime() + minutesToMs(mins))
}

function overlaps(a: TimeSlot, b: TimeSlot): boolean {
  return a.start < b.end && a.end > b.start
}

export function generateDayPlan(input: SchedulerInput): ScheduledBlock[] {
  const blocks: ScheduledBlock[] = []
  const {
    wake_time, sleep_time, session_mode, tasks, preferences,
    course_sessions, plan_date, constraints,
  } = input

  const wakeDate = new Date(wake_time)
  const sleepDate = new Date(sleep_time)

  const blockedSlots: TimeSlot[] = []

  // Day of week for course sessions (JS: 0=Sun, converted to Mon=0)
  const dayOfWeek = new Date(plan_date).getDay()
  const adjustedDow = dayOfWeek === 0 ? 6 : dayOfWeek - 1

  // Add class sessions
  const dayClasses = course_sessions.filter((cs) => cs.day_of_week === adjustedDow)
  for (const cls of dayClasses) {
    const [sh, sm] = cls.start_time.split(':').map(Number)
    const [eh, em] = cls.end_time.split(':').map(Number)
    const planDay = startOfDay(new Date(plan_date))
    const classStart = new Date(planDay)
    classStart.setHours(sh, sm, 0, 0)
    const classEnd = new Date(planDay)
    classEnd.setHours(eh, em, 0, 0)

    blocks.push({
      block_type: 'class',
      start_time: classStart.toISOString(),
      end_time: classEnd.toISOString(),
      label: 'Class',
      sort_order: blocks.length,
    })

    blockedSlots.push({
      start: addMins(classStart, -(preferences.class_pre_buffer_mins ?? 10)),
      end: addMins(classEnd, preferences.class_post_buffer_mins ?? 10),
    })
  }

  // Extra buffer before the first class of the day
  if (dayClasses.length > 0) {
    const planDay = startOfDay(new Date(plan_date))
    const firstClassTimes = dayClasses.map((cs) => {
      const [h, m] = cs.start_time.split(':').map(Number)
      const d = new Date(planDay)
      d.setHours(h, m, 0, 0)
      return d
    })
    const firstClass = firstClassTimes.reduce((a, b) => (a < b ? a : b))
    blockedSlots.push({
      start: addMins(firstClass, -(preferences.pre_class_buffer_mins ?? 20)),
      end: firstClass,
    })
  }

  // GCal events
  for (const ev of input.existing_gcal_events) {
    blockedSlots.push({ start: new Date(ev.start), end: new Date(ev.end) })
  }

  // User-specified gaps
  if (constraints?.gaps) {
    const planDay = startOfDay(new Date(plan_date))
    for (const gap of constraints.gaps) {
      const [gh, gm] = gap.from.split(':').map(Number)
      const [eh, em] = gap.to.split(':').map(Number)
      const gapStart = new Date(planDay)
      gapStart.setHours(gh, gm, 0, 0)
      const gapEnd = new Date(planDay)
      gapEnd.setHours(eh, em, 0, 0)
      blockedSlots.push({ start: gapStart, end: gapEnd })
    }
  }

  let cursor = new Date(wakeDate)
  let sortOrder = 0

  function addBlock(block: Omit<ScheduledBlock, 'sort_order'>) {
    blocks.push({ ...block, sort_order: sortOrder++ })
    cursor = new Date(block.end_time)
  }

  function isSlotFree(start: Date, end: Date): boolean {
    const slot: TimeSlot = { start, end }
    return !blockedSlots.some((b) => overlaps(slot, b))
  }

  function findNextFreeSlot(durationMins: number, from: Date): Date | null {
    let tryStart = new Date(from)
    const sleepCutoff = addMins(sleepDate, -(preferences.skincare_mins ?? 30) - 60)
    while (isBefore(tryStart, sleepCutoff)) {
      const tryEnd = addMins(tryStart, durationMins)
      if (isSlotFree(tryStart, tryEnd)) return tryStart
      tryStart = addMins(tryStart, 15)
    }
    return null
  }

  // 1. Morning routine
  const morningRoutineEnd = addMins(cursor, (preferences.shower_mins ?? 30) + (preferences.morning_other_mins ?? 10))
  addBlock({
    block_type: 'routine',
    start_time: cursor.toISOString(),
    end_time: morningRoutineEnd.toISOString(),
    label: 'Morning routine',
  })

  // 2. Schedule tasks (sorted by priority)
  const sortedTasks = sortTasksForScheduling(
    tasks.filter((t) => t.status === 'pending' || t.status === 'in_progress'),
    plan_date,
  )

  const [deepMins, breakMins] = session_mode === '90_20' ? [90, 20] : [50, 10]

  for (const task of sortedTasks) {
    const hours = task.estimated_hours ?? 2.0
    let remaining = hours * 60

    while (remaining > 0) {
      const sessionMins = Math.min(remaining, deepMins)
      const slot = findNextFreeSlot(sessionMins, cursor)
      if (!slot || isAfter(slot, addMins(sleepDate, -60))) break

      addBlock({
        block_type: 'deep_work',
        start_time: slot.toISOString(),
        end_time: addMins(slot, sessionMins).toISOString(),
        label: task.task_name,
        description: `${task.topic ?? ''} · ${task.task_type_tag ?? ''}`.trim(),
        task_id: task.id,
      })

      remaining -= sessionMins

      if (remaining > 0) {
        const breakSlot = findNextFreeSlot(breakMins, cursor)
        if (breakSlot) {
          addBlock({
            block_type: 'break',
            start_time: breakSlot.toISOString(),
            end_time: addMins(breakSlot, breakMins).toISOString(),
            label: 'Break',
          })
        }
      }
    }
  }

  // 3. Night routine + sleep
  const skincareMins = preferences.skincare_mins ?? 30
  const skincareStart = addMins(sleepDate, -skincareMins)
  addBlock({
    block_type: 'routine',
    start_time: skincareStart.toISOString(),
    end_time: sleepDate.toISOString(),
    label: 'Night routine',
  })
  addBlock({
    block_type: 'sleep',
    start_time: sleepDate.toISOString(),
    end_time: addMins(sleepDate, (preferences.sleep_target_hours ?? 8) * 60).toISOString(),
    label: 'Sleep',
  })

  return blocks
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    .map((b, i) => ({ ...b, sort_order: i }))
}
