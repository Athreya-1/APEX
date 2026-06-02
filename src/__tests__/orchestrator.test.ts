import {
  buildPlanRequest, gcalEventsToSkeleton, isHabitDueToday, planDayOfWeek, shiftBlocksFromTime,
} from '@/lib/planning/orchestrator'
import type { BuildPlanRequestInput, TaskPadded } from '@/lib/planning/orchestrator'
import type { Guardrail, Habit, Task, UserPreferences } from '@/types'

const PLAN = '2026-06-01' // Monday
const WAKE = '2026-06-01T08:00:00.000Z'
const SLEEP = '2026-06-01T23:00:00.000Z'
const NOW = '2026-06-01T08:00:00.000Z'

const prefs: UserPreferences = {
  id: 'p', user_id: 'u',
  gym_duration_cascade: [90, 60, 30],
  lunch_window_start: '12:00', lunch_window_end: '14:00', lunch_duration_mins: 45,
  dinner_window_start: '19:00', dinner_window_end: '21:00', dinner_duration_mins: 60,
  dinner_sleep_buffer_mins: 60, sleep_target_hours: 8, sleep_buffer_hours: 8.5,
  shower_mins: 30, morning_other_mins: 10, pre_class_buffer_mins: 10, skincare_mins: 20,
  entrepreneur_daily_hours: 0, cmr_daily_hours: 0, class_pre_buffer_mins: 0, class_post_buffer_mins: 0,
  auto_plan_fallback_time: '22:00', checkin_enabled: true, urgency_flip_warning_hours: 24,
  work_life_dial: 0.5, daily_work_hour_cap: 8, min_chunk_minutes: 60, max_consecutive_heavy: 4,
}

const task = (over: Partial<Task>): Task => ({
  id: 't1', user_id: 'u', course_id: null, canvas_assignment_id: null,
  recurrence_rule_id: null, recurrence_index: null,
  topic: 'Lab', task_name: 'Lab 3', description: null, task_type_tag: 'lab',
  do_date: PLAN, due_date: `${PLAN}T23:59:00.000Z`,
  estimated_hours: 4, ai_estimated_hours: null, actual_hours: null, hours_elapsed: 0,
  urgency_score: 0, eisenhower_quadrant: 'urgent_important', priority_override: null,
  metadata: {}, triangulation_multiplier: 1, importance: 4, is_at_risk: false,
  status: 'pending', completed_at: null, source: 'manual', created_at: '', updated_at: '',
  ...over,
})

const padded = (t: Task, h = 4): TaskPadded => ({ task: t, paddedHours: h, meanHours: h, stdevHours: 0.5 })

const baseInput = (): BuildPlanRequestInput => ({
  planDate: PLAN, windowStart: WAKE, windowEnd: SLEEP, now: NOW,
  sessionMode: '90_20', prefs, tasks: [padded(task({}))],
  habits: [], habitLogs: [], guardrails: [], gcalEvents: [], courseSessions: [],
})

describe('orchestrator', () => {
  it('planDayOfWeek treats Monday as 0', () => {
    expect(planDayOfWeek('2026-06-01')).toBe(0)
    expect(planDayOfWeek('2026-06-07')).toBe(6)
  })

  it('gcalEventsToSkeleton skips APEX-owned events', () => {
    const sk = gcalEventsToSkeleton([
      { id: 'e1', title: 'Class', start: '2026-06-01T10:00:00.000Z', end: '2026-06-01T11:00:00.000Z' },
      { id: 'e2', title: '[APEX] Lab', start: '2026-06-01T14:00:00.000Z', end: '2026-06-01T16:00:00.000Z', apex_block_id: 'b1' },
    ])
    expect(sk.length).toBe(1)
    expect(sk[0].state).toBe('fixed')
  })

  it('buildPlanRequest includes guardrails, meals, and must-today tasks', () => {
    const gr: Guardrail = {
      id: 'g1', user_id: 'u', kind: 'no_work_after', payload: { time: '20:00' },
      hard: true, is_active: true, created_at: '',
    }
    const req = buildPlanRequest({ ...baseInput(), guardrails: [gr] })
    expect(req.skeleton.some((s) => s.state === 'rest_lockout')).toBe(true)
    expect(req.skeleton.some((s) => s.label === 'Lunch')).toBe(true)
    expect(req.tasks[0].mustToday).toBe(true)
    expect(req.workLifeDial).toBe(0.5)
  })

  it('isHabitDueToday respects per_week target', () => {
    const habit: Habit = {
      id: 'h1', user_id: 'u', name: 'Gym', icon: 'g', color: '#fff',
      target_frequency: 'custom', target_days: null, is_active: true, sort_order: 0,
      mode: 'time_blocked', duration_mins: 90, frequency_type: 'per_week', frequency_target: 3,
      time_ranges: null, goal_id: null, notification_time: null, cognitive_class: 'physical', created_at: '',
    }
    expect(isHabitDueToday(habit, PLAN, 2, false)).toBe(true)
    expect(isHabitDueToday(habit, PLAN, 3, false)).toBe(false)
  })

  it('shiftBlocksFromTime moves later blocks only', () => {
    const blocks = [
      { start_time: '2026-06-01T08:00:00.000Z', end_time: '2026-06-01T09:00:00.000Z' },
      { start_time: '2026-06-01T10:00:00.000Z', end_time: '2026-06-01T11:00:00.000Z' },
    ]
    const shifted = shiftBlocksFromTime(blocks, '2026-06-01T10:00:00.000Z', 30)
    expect(shifted[0].start_time).toBe(blocks[0].start_time)
    expect(shifted[1].start_time).toBe('2026-06-01T10:30:00.000Z')
  })
})
