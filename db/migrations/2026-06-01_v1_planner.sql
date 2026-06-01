-- ════════════════════════════════════════════════════════════════════
-- APEX V1 Planner — additive migration (idempotent, non-destructive)
-- Run AFTER SCHEMA.sql in the Supabase SQL editor. Safe to re-run.
-- ════════════════════════════════════════════════════════════════════

-- ── Altered: user_preferences (engine levers) ───────────────────────
alter table public.user_preferences
  add column if not exists work_life_dial        numeric not null default 0.5,   -- 0=protect rest .. 1=invest
  add column if not exists daily_work_hour_cap   numeric not null default 8,
  add column if not exists min_chunk_minutes     integer not null default 60,
  add column if not exists max_consecutive_heavy integer not null default 4;     -- ~6h focus / ~7h elapsed

-- ── Altered: courses (effort priors live here, never in urgency) ────
alter table public.courses
  add column if not exists difficulty_multiplier numeric not null default 1.0,
  add column if not exists velocity_modifier     numeric not null default 1.0;   -- EWMA E_actual/E_estimated

-- ── Altered: tasks (engine-authoritative urgency + custom overflow) ─
alter table public.tasks
  add column if not exists metadata                 jsonb   not null default '{}',
  add column if not exists triangulation_multiplier numeric not null default 1.0,
  add column if not exists importance               integer not null default 2,  -- 1=low .. 4=critical
  add column if not exists is_at_risk               boolean not null default false;

-- Retire the SQL urgency trigger; the engine becomes authoritative and
-- writes the cached value into tasks.urgency_score at plan time.
drop trigger if exists tasks_urgency_score on public.tasks;

-- ── Altered: plan_blocks (drift capture + cognitive class) ──────────
alter table public.plan_blocks
  add column if not exists original_start_time timestamptz,
  add column if not exists original_end_time   timestamptz,
  add column if not exists cognitive_class      text;  -- heavy_focus|light_admin|creative|physical|restorative

-- ── New: goals (created before habits.goal_id FK) ───────────────────
create table if not exists public.goals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  name          text not null,
  description   text,
  target_metric text,
  deadline      date,
  color         text not null default 'var(--purple)',
  status        text not null default 'active' check (status in ('active','paused','done','archived')),
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table public.goals enable row level security;
do $$ begin
  create policy "goals_own" on public.goals for all using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- ── Altered: habits (scheduling model) ──────────────────────────────
alter table public.habits
  add column if not exists mode             text    not null default 'check_off', -- time_blocked|check_off
  add column if not exists duration_mins    integer,
  add column if not exists frequency_type   text    not null default 'daily',     -- daily|per_week|weekdays|per_month
  add column if not exists frequency_target integer not null default 1,
  add column if not exists time_ranges      jsonb,                                -- [{start:'12:00',end:'17:00'}]
  add column if not exists goal_id          uuid references public.goals(id) on delete set null,
  add column if not exists notification_time text,
  add column if not exists cognitive_class  text    not null default 'physical';

-- ── Altered: daily_plans (dial + breach record) ─────────────────────
alter table public.daily_plans
  add column if not exists work_life_dial_used    numeric,
  add column if not exists work_hour_cap_breached boolean not null default false;

-- ── New: task_field_defs (per-user custom To-Do schema) ─────────────
create table if not exists public.task_field_defs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  name       text not null,
  kind       text not null check (kind in ('text','single_select','checkbox')),
  options    jsonb,                       -- for single_select
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.task_field_defs enable row level security;
do $$ begin
  create policy "task_field_defs_own" on public.task_field_defs for all using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- ── New: task_field_values ──────────────────────────────────────────
create table if not exists public.task_field_values (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  task_id      uuid not null references public.tasks(id) on delete cascade,
  field_def_id uuid not null references public.task_field_defs(id) on delete cascade,
  value        jsonb,
  unique (task_id, field_def_id)
);
alter table public.task_field_values enable row level security;
do $$ begin
  create policy "task_field_values_own" on public.task_field_values for all using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- ── New: task_priors (estimation base rates; null user = global) ────
create table if not exists public.task_priors (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references public.users(id) on delete cascade,
  category_keyword text not null,
  default_minutes  integer not null,
  unique (user_id, category_keyword)
);
alter table public.task_priors enable row level security;
do $$ begin
  create policy "task_priors_own" on public.task_priors
    for all using (user_id is null or auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- ── New: focus_sessions (per-session learning grain) ────────────────
create table if not exists public.focus_sessions (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references public.users(id) on delete cascade,
  task_id                  uuid references public.tasks(id) on delete set null,
  plan_block_id            uuid references public.plan_blocks(id) on delete set null,
  started_at               timestamptz not null,
  ended_at                 timestamptz not null,
  interrupted              boolean not null default false,
  user_reported_efficiency integer check (user_reported_efficiency between 1 and 5),
  cognitive_class          text,
  created_at               timestamptz not null default now()
);
alter table public.focus_sessions enable row level security;
do $$ begin
  create policy "focus_sessions_own" on public.focus_sessions for all using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- ── New: drift_events (observed-behavior capture / PMF signal) ──────
create table if not exists public.drift_events (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.users(id) on delete cascade,
  plan_block_id  uuid references public.plan_blocks(id) on delete set null,
  kind           text not null check (kind in ('moved','skipped','overran','early_done','deleted')),
  original_start timestamptz,
  new_start      timestamptz,
  delta_mins     integer,
  created_at     timestamptz not null default now()
);
alter table public.drift_events enable row level security;
do $$ begin
  create policy "drift_events_own" on public.drift_events for all using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- ── New: guardrails (global hard bounds; Pass-1 locks) ──────────────
create table if not exists public.guardrails (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  kind       text not null check (kind in ('no_work_before','no_work_after','protected_window','break_day')),
  payload    jsonb not null default '{}',  -- {time:'20:00'} | {start,end} | {date:'2026-06-10'}
  hard       boolean not null default true,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.guardrails enable row level security;
do $$ begin
  create policy "guardrails_own" on public.guardrails for all using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- ── Seed: global task_priors (minutes) ──────────────────────────────
insert into public.task_priors (user_id, category_keyword, default_minutes) values
  (null,'lab',210),(null,'pset',150),(null,'reading',45),(null,'project',300),
  (null,'writeup',90),(null,'quiz',30),(null,'review',60),(null,'exam',0),(null,'other',120)
on conflict (user_id, category_keyword) do nothing;
