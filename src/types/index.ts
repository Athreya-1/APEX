// APEX — TypeScript Types
// Matches SCHEMA.sql exactly

export type SessionMode = '90_20' | '50_10'
export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'deferred'
export type TaskSource = 'manual' | 'canvas' | 'screenshot' | 'voice' | 'recurring'
export type TaskTypeTag = 'lab' | 'pset' | 'reading' | 'project' | 'writeup' | 'quiz' | 'review' | 'exam' | 'other'
export type EisenhowerQuadrant = 'urgent_important' | 'not_urgent_important' | 'urgent_not_important' | 'neither'
export type BlockType = 'deep_work' | 'admin' | 'break' | 'meal' | 'gym' | 'class' | 'cmr' | 'entrepreneur' | 'routine' | 'sleep' | 'custom'
export type BlockStatus = 'scheduled' | 'done' | 'skipped' | 'replanned'
export type PlanStatus = 'draft' | 'confirmed' | 'in_progress' | 'done'
export type HabitFrequency = 'daily' | 'weekdays' | 'weekends' | 'custom'
export type NoteSource = 'typed' | 'voice' | 'ai_appended' | 'apex'
export type KnowledgeSourceType = 'task' | 'note' | 'plan' | 'habit' | 'manual_drop' | 'canvas' | 'exam'
export type ExamMode = 'single' | 'exam_week'
export type ExamStatus = 'planning' | 'active' | 'done'
export type TopicStatus = 'not_started' | 'in_progress' | 'reviewed' | 'practiced' | 'done'
export type StudySessionType = 'review' | 'practice' | 'past_exam' | 'final_sweep'
export type IntentType =
  | 'add_task'
  | 'add_recurring_task'
  | 'add_event'
  | 'modify_task'
  | 'complete_task'
  | 'query_knowledge'
  | 'replan'
  | 'add_note'
  | 'add_habit_log'
  | 'exam_plan'
  | 'screenshot_extract'
  | 'settings_change'
  | 'ambiguous'

export interface User {
  id: string
  email: string
  display_name: string | null
  google_calendar_token: string | null
  google_calendar_refresh_token: string | null
  canvas_api_token: string | null
  canvas_domain: string
  session_mode: SessionMode
  planning_notif_time: string // HH:MM
  timezone: string
  onboarding_complete: boolean
  created_at: string
  updated_at: string
}

export interface UserPreferences {
  id: string
  user_id: string
  gym_duration_cascade: number[] // [90, 60, 30]
  lunch_window_start: string
  lunch_window_end: string
  lunch_duration_mins: number
  dinner_window_start: string
  dinner_window_end: string
  dinner_duration_mins: number
  dinner_sleep_buffer_mins: number
  sleep_target_hours: number
  sleep_buffer_hours: number
  shower_mins: number
  morning_other_mins: number
  pre_class_buffer_mins: number
  skincare_mins: number
  entrepreneur_daily_hours: number
  cmr_daily_hours: number
  class_pre_buffer_mins: number
  class_post_buffer_mins: number
  auto_plan_fallback_time: string
  checkin_enabled: boolean
  urgency_flip_warning_hours: number
  // V1 engine levers
  work_life_dial: number // 0=protect rest .. 1=invest
  daily_work_hour_cap: number
  min_chunk_minutes: number
  max_consecutive_heavy: number
}

export interface Course {
  id: string
  user_id: string
  canvas_course_id: string | null
  name: string // "15-213"
  display_name: string | null // "Intro to Systems"
  semester: string | null
  color: string
  is_active: boolean
  has_exams: boolean
  study_pref: Record<string, unknown> | null
  lecture_review_mins: number
  // V1 effort priors
  difficulty_multiplier: number
  velocity_modifier: number // EWMA E_actual/E_estimated
  created_at: string
  updated_at: string
  // joined
  sessions?: CourseSession[]
}

export interface CourseSession {
  id: string
  course_id: string
  day_of_week: number // 0=Mon 6=Sun
  start_time: string // HH:MM
  end_time: string
  location: string | null
}

export interface RecurrenceRule {
  id: string
  user_id: string
  frequency: 'daily' | 'weekly' | 'biweekly'
  day_of_week: number | null
  occurrences: number | null
  end_date: string | null
  name_pattern: string | null // "Lab {n}"
}

export interface Task {
  id: string
  user_id: string
  course_id: string | null
  canvas_assignment_id: string | null
  recurrence_rule_id: string | null
  recurrence_index: number | null
  topic: string
  task_name: string
  description: string | null
  task_type_tag: TaskTypeTag
  do_date: string | null // YYYY-MM-DD
  due_date: string | null // ISO timestamptz
  estimated_hours: number | null
  ai_estimated_hours: number | null
  actual_hours: number | null
  hours_elapsed: number
  urgency_score: number // cached, engine-written (SQL trigger retired in V1)
  eisenhower_quadrant: EisenhowerQuadrant
  priority_override: string | null
  // V1 fields
  metadata: Record<string, unknown>
  triangulation_multiplier: number
  importance: number // 1=low .. 4=critical
  is_at_risk: boolean
  status: TaskStatus
  completed_at: string | null
  source: TaskSource
  created_at: string
  updated_at: string
  // joined
  course?: Course
  effort_avg?: number // from task_effort_history query
}

export interface TaskEffortHistory {
  id: string
  user_id: string
  task_id: string | null
  course_id: string | null
  task_type_tag: TaskTypeTag
  task_name_sample: string | null
  estimated_hours: number | null
  actual_hours: number
  completed_at: string
}

export interface DailyPlan {
  id: string
  user_id: string
  plan_date: string // YYYY-MM-DD
  sleep_time: string | null
  wake_time: string | null
  wake_confirmed: boolean
  session_mode: SessionMode
  status: PlanStatus
  generated_by: 'user' | 'auto'
  cmr_cut: boolean
  entrepreneur_cut: boolean
  gym_duration_used: number | null
  // V1 dial + breach record
  work_life_dial_used: number | null
  work_hour_cap_breached: boolean
  user_constraints: {
    gaps?: Array<{ from: string; to: string }>
    notes?: string
  } | null
  created_at: string
  updated_at: string
  // joined
  blocks?: PlanBlock[]
}

export interface PlanBlock {
  id: string
  plan_id: string
  task_id: string | null
  block_type: BlockType
  start_time: string // ISO timestamptz
  end_time: string
  label: string | null
  description: string | null
  gcal_event_id: string | null
  // V1 drift capture + cognitive class
  original_start_time: string | null
  original_end_time: string | null
  cognitive_class: string | null
  status: BlockStatus
  checkin_done_at: string | null
  checkin_response: {
    choice: 'done' | '+15' | '+30' | '+45' | '+60' | 'custom'
    extra_mins?: number
  } | null
  sort_order: number
  created_at: string
  updated_at: string
  // joined
  task?: Task
}

export interface Habit {
  id: string
  user_id: string
  name: string
  icon: string
  color: string
  target_frequency: HabitFrequency
  target_days: number[] | null
  is_active: boolean
  sort_order: number
  // V1 scheduling model
  mode: HabitMode
  duration_mins: number | null
  frequency_type: HabitFrequencyType
  frequency_target: number
  time_ranges: Array<{ start: string; end: string }> | null
  goal_id: string | null
  notification_time: string | null
  cognitive_class: string
  created_at: string
  // computed
  current_streak?: number
  completion_rate_30d?: number
  total_completions?: number
  logs?: HabitLog[]
}

export interface HabitLog {
  id: string
  habit_id: string
  user_id: string
  logged_date: string // YYYY-MM-DD
  completed: boolean
  note: string | null
  source: 'manual' | 'voice' | 'apple_health' | 'auto'
  created_at: string
}

export interface Notepad {
  id: string
  user_id: string
  name: string
  icon: string
  color: string
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
  // computed
  entry_count?: number
  last_updated?: string
  preview?: string
  notes?: Note[]
}

export interface Note {
  id: string
  notepad_id: string
  user_id: string
  content: string
  source: NoteSource
  created_at: string
  updated_at: string
}

export interface KnowledgeBankEntry {
  id: string
  user_id: string
  content: string
  source_type: KnowledgeSourceType
  source_id: string | null
  embedding: number[] | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface ExamPlan {
  id: string
  user_id: string
  course_id: string | null
  exam_name: string
  exam_date: string
  exam_weight: number | null
  mode: ExamMode
  study_strategy: {
    practice_problems?: boolean
    past_exams?: boolean
    days_to_spread?: number
    notes?: string
  } | null
  status: ExamStatus
  source_screenshot_url: string | null
  created_at: string
  updated_at: string
  // joined
  course?: Course
  topics?: ExamTopic[]
  progress_pct?: number
}

export interface ExamTopic {
  id: string
  exam_plan_id: string
  topic_name: string
  sort_order: number
  estimated_hours: number | null
  actual_hours: number | null
  confidence_level: number | null // 1–5
  needs_practice: boolean
  status: TopicStatus
  created_at: string
  updated_at: string
}

export interface ExamStudySession {
  id: string
  exam_plan_id: string
  exam_topic_id: string | null
  plan_block_id: string | null
  session_type: StudySessionType
  scheduled_date: string | null
  status: 'scheduled' | 'done' | 'skipped'
  created_at: string
}

export interface CanvasSyncLog {
  id: string
  user_id: string
  synced_at: string
  assignments_found: number
  assignments_new: number
  assignments_updated: number
  courses_synced: string[]
  errors: Record<string, unknown> | null
  triggered_by: 'scheduled' | 'pre_planning' | 'manual'
}

// ── AI TYPES ──

export interface ClassifiedIntent {
  intent: IntentType
  confidence: number
  parsed: Record<string, unknown>
  clarification_needed?: string
}

export interface PlannerInput {
  user: User
  preferences: UserPreferences
  courses: Course[]
  tasks: Task[]
  existing_gcal_events: GCalEvent[]
  plan_date: string
  sleep_time: string
  wake_time: string
  session_mode: SessionMode
  constraints?: DailyPlan['user_constraints']
}

export interface GCalEvent {
  id: string
  summary: string
  start: { dateTime: string }
  end: { dateTime: string }
  colorId?: string
}

export interface EffortEstimate {
  estimated_hours: number
  source: 'course_type_history' | 'global_type_history' | 'cold_start_default'
  sample_size: number
  historical_avg?: number
  cold_start_default?: number
}

// ── UI STATE TYPES ──

export interface TaskFilters {
  topic: string | null
  status: TaskStatus | null
  urgency: 'high' | 'medium' | 'low' | null
  dateRange: 'today' | 'week' | 'all' | null
}

export interface CheckInResponse {
  block_id: string
  choice: 'done' | '+15' | '+30' | '+45' | '+60' | 'custom'
  extra_mins?: number
}

export interface VoiceOrbState {
  active: boolean
  mode: 'full' | 'mini'
  listening: boolean
  transcript: string
  processing: boolean
}

// ── V1 ENGINE & DOMAIN TYPES ──

export type CognitiveClass =
  | 'heavy_focus' | 'light_admin' | 'creative' | 'physical' | 'restorative'

export type SlotState =
  | 'available' | 'fixed' | 'habit' | 'focus' | 'break'
  | 'meal' | 'buffer' | 'rest_lockout'

export type HabitMode = 'time_blocked' | 'check_off'
export type HabitFrequencyType = 'daily' | 'per_week' | 'weekdays' | 'per_month'
export type GoalStatus = 'active' | 'paused' | 'done' | 'archived'
export type FieldKind = 'text' | 'single_select' | 'checkbox'
export type GuardrailKind =
  | 'no_work_before' | 'no_work_after' | 'protected_window' | 'break_day'

export interface PaddedEffort {
  estimateHours: number
  paddedHours: number
  stdevHours: number
  sampleSize: number
  source: 'bucket_history' | 'type_history' | 'adjusted_prior'
  confidence: 'cold' | 'warming' | 'warm'
}

export interface UrgencyResult {
  taskId: string
  score: number
  isAtRisk: boolean
  slackHours: number
  paddedHours: number
}

export interface TimelineSlot {
  index: number
  start: string
  end: string
  state: SlotState
  assignedId: string | null
  cognitiveClass?: CognitiveClass
}

export interface Goal {
  id: string
  user_id: string
  name: string
  description: string | null
  target_metric: string | null
  deadline: string | null
  color: string
  status: GoalStatus
  sort_order: number
  created_at: string
  updated_at: string
  habits?: Habit[]
}

export interface TaskFieldDef {
  id: string
  user_id: string
  name: string
  kind: FieldKind
  options: string[] | null
  sort_order: number
  created_at: string
}

export interface TaskFieldValue {
  id: string
  user_id: string
  task_id: string
  field_def_id: string
  value: unknown
}

export interface TaskPrior {
  id: string
  user_id: string | null
  category_keyword: string
  default_minutes: number
}

export interface FocusSession {
  id: string
  user_id: string
  task_id: string | null
  plan_block_id: string | null
  started_at: string
  ended_at: string
  interrupted: boolean
  user_reported_efficiency: number | null
  cognitive_class: string | null
  created_at: string
}

export interface DriftEvent {
  id: string
  user_id: string
  plan_block_id: string | null
  kind: 'moved' | 'skipped' | 'overran' | 'early_done' | 'deleted'
  original_start: string | null
  new_start: string | null
  delta_mins: number | null
  created_at: string
}

export interface Guardrail {
  id: string
  user_id: string
  kind: GuardrailKind
  payload: Record<string, unknown>
  hard: boolean
  is_active: boolean
  created_at: string
}
