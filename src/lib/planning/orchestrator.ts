import type {
  CourseSession, Guardrail, Habit, HabitLog, Task, TaskTypeTag, UserPreferences, CognitiveClass,
} from '@/types'
import type { GCalEvent } from '@/lib/calendar/gcal'
import { buildEnergyWindow } from './energy-window'
import { guardrailsToSkeleton } from './guardrails'
import { assignImportance } from './eisenhower'
import { computeUrgency, orderByUrgency, type UrgencyTask } from './urgency'
import type { EngineHabit, EngineTask, PlanRequest, SkeletonItem } from './engine-types'
import type { SessionMode } from './timeline'

export interface TaskPadded {
  task: Task
  paddedHours: number
  meanHours: number
  stdevHours: number
}

export interface BuildPlanRequestInput {
  planDate: string
  windowStart: string
  windowEnd: string
  now: string
  sessionMode: SessionMode
  prefs: UserPreferences
  tasks: TaskPadded[]
  habits: Habit[]
  habitLogs: HabitLog[]
  guardrails: Guardrail[]
  gcalEvents: GCalEvent[]
  courseSessions: CourseSession[]
}

const COGNITIVE_BY_TYPE: Record<TaskTypeTag, CognitiveClass> = {
  lab: 'heavy_focus', pset: 'heavy_focus', exam: 'heavy_focus', project: 'heavy_focus',
  reading: 'light_admin', review: 'light_admin', quiz: 'light_admin',
  writeup: 'creative', other: 'heavy_focus',
}

export function taskTypeToCognitive(tag: TaskTypeTag): CognitiveClass {
  return COGNITIVE_BY_TYPE[tag] ?? 'heavy_focus'
}

/** Monday=0 .. Sunday=6 (matches course_sessions.day_of_week). */
export function planDayOfWeek(planDate: string): number {
  const js = new Date(`${planDate}T12:00:00.000Z`).getUTCDay()
  return js === 0 ? 6 : js - 1
}

export function atPlanTime(planDate: string, hhmm: string): string {
  const [h, m] = hhmm.split(':')
  return `${planDate}T${h.padStart(2, '0')}:${m.padStart(2, '0')}:00.000Z`
}

export function gcalEventsToSkeleton(events: GCalEvent[]): SkeletonItem[] {
  const result: SkeletonItem[] = []
  for (const e of events) {
    if (e.apex_block_id) continue
    if (!e.start || !e.end) continue
    const start = new Date(e.start)
    const end = new Date(e.end)
    if (end <= start) continue // skip midnight-spanning events
    result.push({
      id: `gcal-${e.id}`,
      start: e.start,
      end: e.end,
      state: 'fixed' as const,
      label: e.title,
    })
  }
  return result
}

export function courseSessionsToSkeleton(sessions: CourseSession[], planDate: string): SkeletonItem[] {
  const dow = planDayOfWeek(planDate)
  return sessions
    .filter((s) => s.day_of_week === dow)
    .map((s) => ({
      id: `class-${s.id}`,
      start: atPlanTime(planDate, s.start_time),
      end: atPlanTime(planDate, s.end_time),
      state: 'fixed' as const,
      label: 'Class',
      cognitiveClass: 'heavy_focus' as const,
    }))
}

export function mealSkeletonFromPrefs(prefs: UserPreferences, planDate: string): SkeletonItem[] {
  const items: SkeletonItem[] = []
  if (prefs.lunch_duration_mins > 0) {
    const start = atPlanTime(planDate, prefs.lunch_window_start)
    const end = new Date(Date.parse(start) + prefs.lunch_duration_mins * 60_000).toISOString()
    items.push({ id: 'lunch', start, end, state: 'meal', label: 'Lunch' })
  }
  if (prefs.dinner_duration_mins > 0) {
    const start = atPlanTime(planDate, prefs.dinner_window_start)
    const end = new Date(Date.parse(start) + prefs.dinner_duration_mins * 60_000).toISOString()
    items.push({ id: 'dinner', start, end, state: 'meal', label: 'Dinner' })
  }
  return items
}

export function isHabitDueToday(
  habit: Habit, planDate: string, weekCompletions: number, completedToday: boolean,
): boolean {
  if (!habit.is_active || completedToday) return false
  switch (habit.frequency_type) {
    case 'daily': return true
    case 'weekdays': {
      const dow = planDayOfWeek(planDate)
      return dow >= 0 && dow <= 4
    }
    case 'per_week':
    case 'per_month':
      return weekCompletions < (habit.frequency_target || 1)
    default:
      return true
  }
}

export function habitsToEngine(
  habits: Habit[], habitLogs: HabitLog[], planDate: string,
): EngineHabit[] {
  const weekStart = new Date(`${planDate}T00:00:00.000Z`)
  weekStart.setUTCDate(weekStart.getUTCDate() - planDayOfWeek(planDate))

  return habits
    .filter((h) => {
      const completedToday = habitLogs.some((l) => l.habit_id === h.id && l.logged_date === planDate && l.completed)
      const weekCompletions = habitLogs.filter((l) => {
        if (l.habit_id !== h.id || !l.completed) return false
        const d = new Date(`${l.logged_date}T12:00:00.000Z`)
        return d >= weekStart && d <= new Date(`${planDate}T23:59:59.000Z`)
      }).length
      return isHabitDueToday(h, planDate, weekCompletions, completedToday)
    })
    .map((h) => {
      const duration = h.duration_mins ?? 30
      const cascade =
        h.mode === 'time_blocked' && duration >= 60
          ? [duration, Math.max(30, duration - 30), 30]
          : undefined
      return {
        id: h.id,
        label: h.name,
        mode: h.mode,
        durationMins: duration,
        cognitiveClass: (h.cognitive_class as CognitiveClass) || 'physical',
        cascade,
        timeRanges: h.time_ranges ?? undefined,
        goalId: h.goal_id,
      }
    })
}

export function tasksToEngine(
  padded: TaskPadded[], planDate: string, now: string, windowStart: string, windowEnd: string,
): EngineTask[] {
  const urgencyTasks: UrgencyTask[] = padded.map(({ task, paddedHours, meanHours, stdevHours }) => ({
    taskId: task.id,
    deadline: task.due_date,
    paddedHours,
    meanHours,
    stdevHours,
  }))

  const windowMs = Date.parse(windowEnd) - Date.parse(windowStart)
  const capacityHoursUntil = (deadlineISO: string) => {
    const until = Date.parse(deadlineISO) - Date.parse(now)
    const cap = windowMs / 3_600_000
    return Math.max(0, Math.min(until / 3_600_000, cap))
  }

  const urgencyResults = orderByUrgency(
    computeUrgency(urgencyTasks, { now, capacityHoursUntil }),
    Object.fromEntries(padded.map(({ task }) => [task.id, task.importance || assignImportance({ taskType: task.task_type_tag })])),
  )

  const byId = new Map(padded.map((p) => [p.task.id, p]))
  return urgencyResults.map((u) => {
    const { task, paddedHours } = byId.get(u.taskId)!
    const importance = task.importance || assignImportance({ taskType: task.task_type_tag })
    const isUrgent = u.score >= 0.6 || u.isAtRisk
    const mustToday = task.do_date === planDate || u.isAtRisk
      || (task.due_date != null && task.due_date.slice(0, 10) === planDate)
    return {
      id: task.id,
      label: task.task_name || task.topic,
      paddedHours,
      cognitiveClass: taskTypeToCognitive(task.task_type_tag),
      importance,
      urgencyScore: u.score,
      isAtRisk: u.isAtRisk || task.is_at_risk,
      mustToday,
    }
  })
}

export function buildPlanRequest(input: BuildPlanRequestInput): PlanRequest {
  const {
    planDate, windowStart, windowEnd, now, sessionMode, prefs,
    tasks, habits, habitLogs, guardrails, gcalEvents, courseSessions,
  } = input

  const skeleton: SkeletonItem[] = [
    ...guardrailsToSkeleton(guardrails, windowStart, windowEnd),
    ...gcalEventsToSkeleton(gcalEvents),
    ...courseSessionsToSkeleton(courseSessions, planDate),
    ...mealSkeletonFromPrefs(prefs, planDate),
  ]

  const engineHabits = habitsToEngine(habits, habitLogs, planDate)
  const engineTasks = tasksToEngine(tasks, planDate, now, windowStart, windowEnd)

  return {
    windowStart,
    windowEnd,
    sessionMode,
    workLifeDial: prefs.work_life_dial ?? 0.5,
    workHourCap: prefs.daily_work_hour_cap ?? 8,
    minChunkMinutes: prefs.min_chunk_minutes ?? 60,
    maxConsecutiveHeavy: prefs.max_consecutive_heavy ?? 4,
    energyWindow: buildEnergyWindow(windowStart, prefs.peak_start ?? '09:00', prefs.peak_end ?? '12:00'),
    skeleton,
    tasks: engineTasks,
    habits: engineHabits.filter((h) => h.mode === 'time_blocked'),
  }
}

/** Shift all blocks at/after `fromISO` by `deltaMins` (micro-replan). */
export function shiftBlocksFromTime<T extends { start_time: string; end_time: string }>(
  blocks: T[], fromISO: string, deltaMins: number,
): T[] {
  const from = Date.parse(fromISO)
  const delta = deltaMins * 60_000
  return blocks.map((b) => {
    if (Date.parse(b.start_time) < from) return b
    return {
      ...b,
      start_time: new Date(Date.parse(b.start_time) + delta).toISOString(),
      end_time: new Date(Date.parse(b.end_time) + delta).toISOString(),
    }
  })
}
