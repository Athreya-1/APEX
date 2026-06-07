-- ══════════════════════════════════════════════════════
-- APEX — Full Database Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- Step 1: enable pgvector first (separate query if needed):
--   create extension if not exists vector;
-- Then run this entire file.
-- ══════════════════════════════════════════════════════

-- Extensions
create extension if not exists vector;

-- ── Enum types ──────────────────────────────────────────────────────────────

create type session_mode         as enum ('90_20', '50_10');
create type task_status          as enum ('pending', 'in_progress', 'done', 'deferred');
create type task_source          as enum ('manual', 'canvas', 'screenshot', 'voice', 'recurring');
create type task_type_tag        as enum ('lab', 'pset', 'reading', 'project', 'writeup', 'quiz', 'review', 'exam', 'other');
create type eisenhower_quadrant  as enum ('urgent_important', 'not_urgent_important', 'urgent_not_important', 'neither');
create type block_type           as enum ('deep_work', 'admin', 'break', 'meal', 'gym', 'class', 'cmr', 'entrepreneur', 'routine', 'sleep', 'custom');
create type block_status         as enum ('scheduled', 'done', 'skipped', 'replanned');
create type plan_status          as enum ('draft', 'confirmed', 'in_progress', 'done');
create type habit_frequency      as enum ('daily', 'weekdays', 'weekends', 'custom');
create type note_source          as enum ('typed', 'voice', 'ai_appended', 'apex');
create type knowledge_source_type as enum ('task', 'note', 'plan', 'habit', 'manual_drop', 'canvas', 'exam');
create type exam_mode            as enum ('single', 'exam_week');
create type exam_status          as enum ('planning', 'active', 'done');
create type topic_status         as enum ('not_started', 'in_progress', 'reviewed', 'practiced', 'done');
create type study_session_type   as enum ('review', 'practice', 'past_exam', 'final_sweep');

-- ── users ────────────────────────────────────────────────────────────────────
-- Mirrors auth.users. Created automatically via trigger on sign-up.

create table public.users (
  id                             uuid primary key references auth.users(id) on delete cascade,
  email                          text not null,
  display_name                   text,
  google_calendar_token          text,
  google_calendar_refresh_token  text,
  canvas_api_token               text,
  canvas_domain                  text not null default 'canvas.cmu.edu',
  session_mode                   session_mode not null default '90_20',
  planning_notif_time            text not null default '22:00',
  timezone                       text not null default 'America/New_York',
  onboarding_complete            boolean not null default false,
  created_at                     timestamptz not null default now(),
  updated_at                     timestamptz not null default now()
);

alter table public.users enable row level security;
create policy "users_own" on public.users for all using (auth.uid() = id);

-- Auto-create user row on Google sign-in
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── user_preferences ─────────────────────────────────────────────────────────

create table public.user_preferences (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null unique references public.users(id) on delete cascade,
  gym_duration_cascade     integer[] not null default '{90,60,30}',
  lunch_window_start       text not null default '12:00',
  lunch_window_end         text not null default '15:00',
  lunch_duration_mins      integer not null default 45,
  dinner_window_start      text not null default '19:00',
  dinner_window_end        text not null default '23:00',
  dinner_duration_mins     integer not null default 60,
  dinner_sleep_buffer_mins integer not null default 120,
  sleep_target_hours       numeric not null default 8,
  sleep_buffer_hours       numeric not null default 8.5,
  shower_mins              integer not null default 30,
  morning_other_mins       integer not null default 10,
  pre_class_buffer_mins    integer not null default 20,
  skincare_mins            integer not null default 30,
  entrepreneur_daily_hours numeric not null default 3,
  cmr_daily_hours          numeric not null default 3,
  class_pre_buffer_mins    integer not null default 10,
  class_post_buffer_mins   integer not null default 10,
  auto_plan_fallback_time  text not null default '21:00',
  checkin_enabled          boolean not null default true,
  urgency_flip_warning_hours integer not null default 48,
  wake_time_default        text not null default '08:00',
  sleep_time_default       text not null default '23:30',
  peak_start               text not null default '09:00',
  peak_end                 text not null default '12:00',
  session_mode             session_mode not null default '90_20',
  created_at               timestamptz not null default now()
);

alter table public.user_preferences enable row level security;
create policy "prefs_own" on public.user_preferences for all using (auth.uid() = user_id);

-- ── courses ───────────────────────────────────────────────────────────────────

create table public.courses (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users(id) on delete cascade,
  canvas_course_id  text,
  name              text not null,
  code              text,
  display_name      text,
  semester          text,
  color             text not null default 'var(--amber)',
  is_active         boolean not null default true,
  has_exams         boolean not null default true,
  study_pref        jsonb,
  lecture_review_mins integer not null default 30,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.courses enable row level security;
create policy "courses_own" on public.courses for all using (auth.uid() = user_id);

-- ── course_sessions ───────────────────────────────────────────────────────────

create table public.course_sessions (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null references public.courses(id) on delete cascade,
  user_id      uuid not null references public.users(id) on delete cascade,
  day_of_week  integer not null check (day_of_week between 0 and 6),
  start_time   text not null,
  end_time     text not null,
  location     text
);

alter table public.course_sessions enable row level security;
create policy "course_sessions_own" on public.course_sessions for all using (auth.uid() = user_id);

-- ── recurrence_rules ──────────────────────────────────────────────────────────

create table public.recurrence_rules (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  frequency    text not null check (frequency in ('daily', 'weekly', 'biweekly')),
  day_of_week  integer,
  occurrences  integer,
  end_date     date,
  name_pattern text,
  created_at   timestamptz not null default now()
);

alter table public.recurrence_rules enable row level security;
create policy "recurrence_own" on public.recurrence_rules for all using (auth.uid() = user_id);

-- ── tasks ─────────────────────────────────────────────────────────────────────

create table public.tasks (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.users(id) on delete cascade,
  course_id            uuid references public.courses(id) on delete set null,
  canvas_assignment_id text,
  recurrence_rule_id   uuid references public.recurrence_rules(id) on delete set null,
  recurrence_index     integer,
  topic                text not null default '',
  task_name            text not null,
  description          text,
  task_type_tag        task_type_tag not null default 'other',
  do_date              date,
  due_date             timestamptz,
  estimated_hours      numeric,
  ai_estimated_hours   numeric,
  actual_hours         numeric,
  hours_elapsed        numeric not null default 0,
  urgency_score        numeric not null default 0,
  eisenhower_quadrant  eisenhower_quadrant not null default 'not_urgent_important',
  priority_override    text,
  status               task_status not null default 'pending',
  completed_at         timestamptz,
  source               task_source not null default 'manual',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table public.tasks enable row level security;
create policy "tasks_own" on public.tasks for all using (auth.uid() = user_id);
create index tasks_user_status on public.tasks(user_id, status);
create index tasks_due_date    on public.tasks(user_id, due_date);

-- Urgency score — updated by trigger on every insert/update
create or replace function update_urgency_score()
returns trigger as $$
declare
  h numeric;
begin
  if new.status in ('done', 'deferred') then
    new.urgency_score := 0;
    return new;
  end if;

  if new.due_date is null then
    new.urgency_score := 20;
    return new;
  end if;

  h := extract(epoch from (new.due_date - now())) / 3600.0;

  new.urgency_score :=
    case
      when h <= 0   then 100
      when h <= 24  then 90
      when h <= 48  then 75
      when h <= 72  then 60
      when h <= 168 then 40
      else               20
    end;

  return new;
end;
$$ language plpgsql;

create trigger tasks_urgency_score
  before insert or update on public.tasks
  for each row execute function update_urgency_score();

-- ── task_effort_history ───────────────────────────────────────────────────────

create table public.task_effort_history (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  task_id         uuid references public.tasks(id) on delete set null,
  course_id       uuid references public.courses(id) on delete set null,
  task_type_tag   task_type_tag not null default 'other',
  task_name_sample text,
  estimated_hours  numeric,
  actual_hours     numeric not null,
  completed_at     timestamptz not null default now()
);

alter table public.task_effort_history enable row level security;
create policy "effort_own" on public.task_effort_history for all using (auth.uid() = user_id);

-- ── daily_plans ───────────────────────────────────────────────────────────────

create table public.daily_plans (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users(id) on delete cascade,
  plan_date         date not null,
  sleep_time        text,
  wake_time         text,
  wake_confirmed    boolean not null default false,
  session_mode      session_mode not null default '90_20',
  status            plan_status not null default 'draft',
  generated_by      text not null default 'user' check (generated_by in ('user', 'auto')),
  cmr_cut           boolean not null default false,
  entrepreneur_cut  boolean not null default false,
  gym_duration_used integer,
  user_constraints  jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, plan_date)
);

alter table public.daily_plans enable row level security;
create policy "plans_own" on public.daily_plans for all using (auth.uid() = user_id);

-- ── plan_blocks ───────────────────────────────────────────────────────────────

create table public.plan_blocks (
  id               uuid primary key default gen_random_uuid(),
  plan_id          uuid not null references public.daily_plans(id) on delete cascade,
  user_id          uuid not null references public.users(id) on delete cascade,
  task_id          uuid references public.tasks(id) on delete set null,
  block_type       block_type not null default 'custom',
  start_time       timestamptz not null,
  end_time         timestamptz not null,
  label            text,
  description      text,
  gcal_event_id    text,
  status           block_status not null default 'scheduled',
  checkin_done_at  timestamptz,
  checkin_response jsonb,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.plan_blocks enable row level security;
create policy "blocks_own" on public.plan_blocks for all using (auth.uid() = user_id);
create index plan_blocks_plan on public.plan_blocks(plan_id, sort_order);

-- ── habits ────────────────────────────────────────────────────────────────────

create table public.habits (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users(id) on delete cascade,
  name             text not null,
  icon             text not null default '⚡',
  color            text not null default 'var(--amber)',
  target_frequency habit_frequency not null default 'daily',
  target_days      integer[],
  is_active        boolean not null default true,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now()
);

alter table public.habits enable row level security;
create policy "habits_own" on public.habits for all using (auth.uid() = user_id);

-- ── habit_logs ────────────────────────────────────────────────────────────────

create table public.habit_logs (
  id          uuid primary key default gen_random_uuid(),
  habit_id    uuid not null references public.habits(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  logged_date date not null,
  completed   boolean not null default true,
  note        text,
  source      text not null default 'manual' check (source in ('manual', 'voice', 'apple_health', 'auto')),
  created_at  timestamptz not null default now(),
  unique (habit_id, logged_date)
);

alter table public.habit_logs enable row level security;
create policy "habit_logs_own" on public.habit_logs for all using (auth.uid() = user_id);

-- ── notepads ──────────────────────────────────────────────────────────────────

create table public.notepads (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  name       text not null,
  icon       text not null default '📝',
  color      text not null default 'var(--amber)',
  sort_order integer not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notepads enable row level security;
create policy "notepads_own" on public.notepads for all using (auth.uid() = user_id);

-- ── notes ─────────────────────────────────────────────────────────────────────

create table public.notes (
  id          uuid primary key default gen_random_uuid(),
  notepad_id  uuid not null references public.notepads(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  content     text not null default '',
  source      note_source not null default 'typed',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.notes enable row level security;
create policy "notes_own" on public.notes for all using (auth.uid() = user_id);

-- ── knowledge_bank ────────────────────────────────────────────────────────────

create table public.knowledge_bank (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  content     text not null,
  source_type knowledge_source_type not null,
  source_id   uuid,
  embedding   vector(1536),
  metadata    jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

alter table public.knowledge_bank enable row level security;
create policy "knowledge_own" on public.knowledge_bank for all using (auth.uid() = user_id);

create index knowledge_embedding_idx on public.knowledge_bank
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- ── exam_plans ────────────────────────────────────────────────────────────────

create table public.exam_plans (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.users(id) on delete cascade,
  course_id             uuid references public.courses(id) on delete set null,
  exam_name             text not null,
  exam_date             date not null,
  exam_weight           numeric,
  mode                  exam_mode not null default 'single',
  study_strategy        jsonb,
  status                exam_status not null default 'planning',
  source_screenshot_url text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.exam_plans enable row level security;
create policy "exams_own" on public.exam_plans for all using (auth.uid() = user_id);

-- ── exam_topics ───────────────────────────────────────────────────────────────

create table public.exam_topics (
  id              uuid primary key default gen_random_uuid(),
  exam_plan_id    uuid not null references public.exam_plans(id) on delete cascade,
  user_id         uuid not null references public.users(id) on delete cascade,
  topic_name      text not null,
  sort_order      integer not null default 0,
  estimated_hours numeric,
  actual_hours    numeric,
  confidence_level integer check (confidence_level between 1 and 5),
  needs_practice  boolean not null default false,
  status          topic_status not null default 'not_started',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.exam_topics enable row level security;
create policy "exam_topics_own" on public.exam_topics for all using (auth.uid() = user_id);

-- ── exam_study_sessions ───────────────────────────────────────────────────────

create table public.exam_study_sessions (
  id              uuid primary key default gen_random_uuid(),
  exam_plan_id    uuid not null references public.exam_plans(id) on delete cascade,
  user_id         uuid not null references public.users(id) on delete cascade,
  exam_topic_id   uuid references public.exam_topics(id) on delete set null,
  plan_block_id   uuid references public.plan_blocks(id) on delete set null,
  session_type    study_session_type not null,
  scheduled_date  date,
  status          text not null default 'scheduled' check (status in ('scheduled', 'done', 'skipped')),
  created_at      timestamptz not null default now()
);

alter table public.exam_study_sessions enable row level security;
create policy "study_sessions_own" on public.exam_study_sessions for all using (auth.uid() = user_id);

-- ── canvas_sync_logs ──────────────────────────────────────────────────────────

create table public.canvas_sync_logs (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.users(id) on delete cascade,
  synced_at            timestamptz not null default now(),
  assignments_found    integer not null default 0,
  assignments_new      integer not null default 0,
  assignments_updated  integer not null default 0,
  courses_synced       text[] not null default '{}',
  errors               jsonb,
  triggered_by         text not null default 'manual' check (triggered_by in ('scheduled', 'pre_planning', 'manual'))
);

alter table public.canvas_sync_logs enable row level security;
create policy "canvas_logs_own" on public.canvas_sync_logs for all using (auth.uid() = user_id);
