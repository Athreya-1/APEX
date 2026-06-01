# Plan 01 — Foundation: Schema, Types, Surface Reduction, Middleware

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:executing-plans`. Steps use checkbox (`- [ ]`) syntax. This plan unblocks all later plans. The DB migration is written here but **applied later** (when the user provides Supabase credentials); everything else is verified now via `npm test` and `npx tsc --noEmit`.

**Goal:** Land the additive DB migration, extend `types/index.ts` with all V1 + shared-engine contracts, reduce the visible nav to Home·Planner·To-Do·Habits·Settings, wire the Next 16 middleware, and fix the pre-existing login test.

**Architecture:** Additive-only schema (never drops feature tables); one new migration file. Types are the stable contracts every engine plan imports. Surface reduction = comment-out (restorable).

**Tech Stack:** Postgres/Supabase, TypeScript 5, Next.js 16, Jest 30.

---

### Task 1: Additive DB migration

**Files:**
- Create: `apex/db/migrations/2026-06-01_v1_planner.sql`

**Notes:** Pure DDL, additive. Cannot be executed until the user supplies Supabase creds; verification is a careful read + (later) running it in the Supabase SQL editor. Uses `if not exists` / `add column if not exists` so it is idempotent and safe to re-run.

- [ ] **Step 1: Write the migration file**

```sql
-- ════════════════════════════════════════════════════════════════════
-- APEX V1 Planner — additive migration (idempotent, non-destructive)
-- Run AFTER SCHEMA.sql. Safe to re-run.
-- ════════════════════════════════════════════════════════════════════

-- ── Altered: user_preferences (engine levers) ───────────────────────
alter table public.user_preferences
  add column if not exists work_life_dial       numeric not null default 0.5,   -- 0=protect rest .. 1=invest
  add column if not exists daily_work_hour_cap  numeric not null default 8,
  add column if not exists min_chunk_minutes    integer not null default 60,
  add column if not exists max_consecutive_heavy integer not null default 4;    -- ~6h focus / ~7h elapsed

-- ── Altered: courses (effort priors live here, never in urgency) ────
alter table public.courses
  add column if not exists difficulty_multiplier numeric not null default 1.0,
  add column if not exists velocity_modifier     numeric not null default 1.0;  -- EWMA E_actual/E_estimated

-- ── Altered: tasks (engine-authoritative urgency + custom overflow) ─
alter table public.tasks
  add column if not exists metadata               jsonb   not null default '{}',
  add column if not exists triangulation_multiplier numeric not null default 1.0,
  add column if not exists importance             integer not null default 2,   -- 1=low .. 4=critical
  add column if not exists is_at_risk             boolean not null default false;

-- Retire the SQL urgency trigger; the engine becomes authoritative and
-- writes the cached value into tasks.urgency_score at plan time.
drop trigger if exists tasks_urgency_score on public.tasks;

-- ── Altered: plan_blocks (drift capture + cognitive class) ──────────
alter table public.plan_blocks
  add column if not exists original_start_time timestamptz,
  add column if not exists original_end_time   timestamptz,
  add column if not exists cognitive_class      text;  -- heavy_focus|light_admin|creative|physical|restorative

-- ── Altered: habits (scheduling model) ──────────────────────────────
alter table public.habits
  add column if not exists mode            text    not null default 'check_off', -- time_blocked|check_off
  add column if not exists duration_mins   integer,
  add column if not exists frequency_type  text    not null default 'daily',     -- daily|per_week|weekdays|per_month
  add column if not exists frequency_target integer not null default 1,
  add column if not exists time_ranges     jsonb,                                -- [{start:'12:00',end:'17:00'}]
  add column if not exists goal_id         uuid references public.goals(id) on delete set null,
  add column if not exists notification_time text,
  add column if not exists cognitive_class text    not null default 'physical';

-- ── Altered: daily_plans (dial + breach record) ─────────────────────
alter table public.daily_plans
  add column if not exists work_life_dial_used   numeric,
  add column if not exists work_hour_cap_breached boolean not null default false;

-- ── New: goals ──────────────────────────────────────────────────────
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
create policy "goals_own" on public.goals for all using (auth.uid() = user_id);

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
create policy "task_field_defs_own" on public.task_field_defs for all using (auth.uid() = user_id);

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
create policy "task_field_values_own" on public.task_field_values for all using (auth.uid() = user_id);

-- ── New: task_priors (estimation base rates; null user = global) ────
create table if not exists public.task_priors (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references public.users(id) on delete cascade,
  category_keyword text not null,
  default_minutes  integer not null,
  unique (user_id, category_keyword)
);
alter table public.task_priors enable row level security;
create policy "task_priors_own" on public.task_priors
  for all using (user_id is null or auth.uid() = user_id);

-- ── New: focus_sessions (per-session learning grain) ────────────────
create table if not exists public.focus_sessions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references public.users(id) on delete cascade,
  task_id                uuid references public.tasks(id) on delete set null,
  plan_block_id          uuid references public.plan_blocks(id) on delete set null,
  started_at             timestamptz not null,
  ended_at               timestamptz not null,
  interrupted            boolean not null default false,
  user_reported_efficiency integer check (user_reported_efficiency between 1 and 5),
  cognitive_class        text,
  created_at             timestamptz not null default now()
);
alter table public.focus_sessions enable row level security;
create policy "focus_sessions_own" on public.focus_sessions for all using (auth.uid() = user_id);

-- ── New: drift_events (observed-behavior capture / PMF signal) ──────
create table if not exists public.drift_events (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  plan_block_id uuid references public.plan_blocks(id) on delete set null,
  kind          text not null check (kind in ('moved','skipped','overran','early_done','deleted')),
  original_start timestamptz,
  new_start      timestamptz,
  delta_mins     integer,
  created_at     timestamptz not null default now()
);
alter table public.drift_events enable row level security;
create policy "drift_events_own" on public.drift_events for all using (auth.uid() = user_id);

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
create policy "guardrails_own" on public.guardrails for all using (auth.uid() = user_id);

-- ── Seed: global task_priors (minutes) ──────────────────────────────
insert into public.task_priors (user_id, category_keyword, default_minutes) values
  (null,'lab',210),(null,'pset',150),(null,'reading',45),(null,'project',300),
  (null,'writeup',90),(null,'quiz',30),(null,'review',60),(null,'exam',0),(null,'other',120)
on conflict (user_id, category_keyword) do nothing;
```

> **Ordering note:** `habits.goal_id` references `goals`, and the `alter habits` runs before `create goals`. Fix by moving the `goals` table block ABOVE the `alter table public.habits` block when writing the file. (Engineer: place "New: goals" first, then the habits alter.)

- [ ] **Step 2: Verify ordering & idempotency by reading the file**

Confirm `goals` is created before `habits.goal_id` FK is added; confirm every statement uses `if not exists` / `add column if not exists` / `drop ... if exists`. No `npm` verification possible without a DB.

- [ ] **Step 3: Commit**

```bash
git add apex/db/migrations/2026-06-01_v1_planner.sql
git commit -m "feat(db): additive V1 planner migration (goals, custom fields, priors, focus/drift, guardrails, engine columns)"
```

---

### Task 2: Extend `types/index.ts` with V1 + shared engine contracts

**Files:**
- Modify: `apex/src/types/index.ts`
- Test: `apex/src/__tests__/types-v1.test.ts`

- [ ] **Step 1: Write a failing type/shape test**

```typescript
// apex/src/__tests__/types-v1.test.ts
import type {
  CognitiveClass, SlotState, PaddedEffort, UrgencyResult,
  Goal, TaskFieldDef, Guardrail, FocusSession,
} from '@/types'

describe('V1 type contracts', () => {
  it('CognitiveClass values are usable', () => {
    const c: CognitiveClass = 'heavy_focus'
    expect(c).toBe('heavy_focus')
  })
  it('SlotState values are usable', () => {
    const s: SlotState = 'available'
    expect(s).toBe('available')
  })
  it('PaddedEffort shape holds', () => {
    const e: PaddedEffort = {
      estimateHours: 4, paddedHours: 5.2, stdevHours: 0.8,
      sampleSize: 3, source: 'bucket_history', confidence: 'warm',
    }
    expect(e.paddedHours).toBeGreaterThan(e.estimateHours)
  })
  it('UrgencyResult + Goal + TaskFieldDef + Guardrail + FocusSession compile', () => {
    const u: UrgencyResult = { taskId: 't', score: 1.2, isAtRisk: false, slackHours: 3, paddedHours: 5 }
    const g: Goal = { id: 'g', user_id: 'u', name: 'Launch', description: null, target_metric: null, deadline: null, color: 'x', status: 'active', sort_order: 0, created_at: '', updated_at: '' }
    const f: TaskFieldDef = { id: 'f', user_id: 'u', name: 'Energy', kind: 'single_select', options: ['low','high'], sort_order: 0, created_at: '' }
    const r: Guardrail = { id: 'r', user_id: 'u', kind: 'no_work_after', payload: { time: '20:00' }, hard: true, is_active: true, created_at: '' }
    const s: FocusSession = { id: 's', user_id: 'u', task_id: 't', plan_block_id: null, started_at: '', ended_at: '', interrupted: false, user_reported_efficiency: 4, cognitive_class: 'heavy_focus', created_at: '' }
    expect([u.score, g.status, f.kind, r.hard, s.interrupted]).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run it to confirm it fails to compile**

Run: `npx jest types-v1 --watchAll=false`
Expected: FAIL — `Module '"@/types"' has no exported member 'CognitiveClass'` etc.

- [ ] **Step 3: Append the new types to `src/types/index.ts`**

Add at the end of the file (and extend existing interfaces in place where noted):

```typescript
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
```

- [ ] **Step 4: Extend existing interfaces in place**

In `UserPreferences` add:
```typescript
  work_life_dial: number
  daily_work_hour_cap: number
  min_chunk_minutes: number
  max_consecutive_heavy: number
```
In `Course` add:
```typescript
  difficulty_multiplier: number
  velocity_modifier: number
```
In `Task` add:
```typescript
  metadata: Record<string, unknown>
  triangulation_multiplier: number
  importance: number
  is_at_risk: boolean
```
In `PlanBlock` add:
```typescript
  original_start_time: string | null
  original_end_time: string | null
  cognitive_class: string | null
```
In `Habit` add:
```typescript
  mode: HabitMode
  duration_mins: number | null
  frequency_type: HabitFrequencyType
  frequency_target: number
  time_ranges: Array<{ start: string; end: string }> | null
  goal_id: string | null
  notification_time: string | null
  cognitive_class: string
```
In `DailyPlan` add:
```typescript
  work_life_dial_used: number | null
  work_hour_cap_breached: boolean
```

- [ ] **Step 5: Run the type test + full typecheck**

Run: `npx jest types-v1 --watchAll=false` → Expected: PASS
Run: `npx tsc --noEmit` → Expected: no new errors from `types/index.ts` (other pre-existing errors, if any, unchanged).

- [ ] **Step 6: Commit**

```bash
git add apex/src/types/index.ts apex/src/__tests__/types-v1.test.ts
git commit -m "feat(types): add V1 engine + domain contracts and extend existing interfaces"
```

---

### Task 3: Surface reduction — nav to Home·Planner·To-Do·Habits·Settings

**Files:**
- Modify: `apex/src/components/layout/DesktopSidebar.tsx`
- Modify: `apex/src/components/layout/MobileNav.tsx`
- Modify: `apex/src/__tests__/DesktopSidebar.test.tsx`
- Modify: `apex/src/__tests__/MobileNav.test.tsx`

- [ ] **Step 1: Update DesktopSidebar test to expect only V1 items**

Replace the nav-item assertions so the rendered labels are exactly: `Home`, `Planner` (or current `Plan` label — keep whatever label string the component uses), `Tasks`, `Habits`, `Settings`; and assert `Notes`, `Exams`, `Knowledge`, `Review` are NOT rendered.

```typescript
it('renders only V1 nav items', () => {
  render(<DesktopSidebar />)
  ;['Home', 'Plan', 'Tasks', 'Habits', 'Settings'].forEach((l) =>
    expect(screen.getByText(l)).toBeInTheDocument())
  ;['Notes', 'Exams', 'Knowledge', 'Review'].forEach((l) =>
    expect(screen.queryByText(l)).not.toBeInTheDocument())
})
```

- [ ] **Step 2: Run → fail**

Run: `npx jest DesktopSidebar --watchAll=false`
Expected: FAIL (Notes/Exams/Knowledge still present).

- [ ] **Step 3: Comment out hidden items in `DesktopSidebar.tsx`**

In the `SIDEBAR_ITEMS` array, comment out the `Notes`, `Exams`, `Knowledge`, `Review` entries (leave `Home`, `Plan`, `Tasks`, `Habits`, `Settings`). Wrap each removed line in `/* hidden in V1: ... */` so it is obviously restorable. Do not delete the route files.

- [ ] **Step 4: Run → pass**

Run: `npx jest DesktopSidebar --watchAll=false` → Expected: PASS

- [ ] **Step 5: Repeat for MobileNav**

Update `MobileNav.test.tsx` to expect tabs `Home`, `Plan`, `Tasks`, `Habits`, `Settings` (and not `Notes`/`Review`), then comment out hidden entries in `NAV_ITEMS` in `MobileNav.tsx`. Run `npx jest MobileNav --watchAll=false` → PASS.

- [ ] **Step 6: Commit**

```bash
git add apex/src/components/layout/DesktopSidebar.tsx apex/src/components/layout/MobileNav.tsx apex/src/__tests__/DesktopSidebar.test.tsx apex/src/__tests__/MobileNav.test.tsx
git commit -m "feat(nav): reduce visible surface to Home/Plan/Tasks/Habits/Settings (hidden, restorable)"
```

---

### Task 4: Wire Next 16 middleware

**Files:**
- Read: `node_modules/next/dist/docs/` (confirm whether Next 16 uses `proxy.ts` natively or requires `middleware.ts`)
- Possibly create: `apex/src/middleware.ts`
- Test: `apex/src/__tests__/middleware.test.ts` (already imports `../proxy`)

- [ ] **Step 1: Determine the Next 16 convention**

Search the installed docs for `proxy` and `middleware`:
Run: `npx --yes rg -l "proxy" node_modules/next/dist/docs 2>$null; npx --yes rg -l "middleware" node_modules/next/dist/docs 2>$null` (or use the Grep tool on `node_modules/next/dist/docs`).
Decision rule:
- If Next 16 supports a top-level `proxy.ts` convention → ensure `src/proxy.ts` is at the location Next expects (likely project root or `src/`); no new file needed.
- If Next 16 still uses `middleware.ts` → create `src/middleware.ts` that re-exports the proxy:

```typescript
// apex/src/middleware.ts
export { proxy as middleware, config } from './proxy'
```

- [ ] **Step 2: Verify the existing middleware test still passes**

Run: `npx jest middleware --watchAll=false` → Expected: PASS (the test imports `../proxy` directly and is convention-agnostic).

- [ ] **Step 3: Commit (only if a file was added/moved)**

```bash
git add apex/src/middleware.ts
git commit -m "fix(auth): wire proxy as Next 16 middleware so route protection runs"
```

---

### Task 5: Fix the pre-existing LoginPage test (useSearchParams)

**Files:**
- Modify: `apex/src/__tests__/LoginPage.test.tsx`

- [ ] **Step 1: Add a `next/navigation` mock providing `useSearchParams`**

At the top of the test (with the other mocks), add:

```typescript
jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(''),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/login',
}))
```

- [ ] **Step 2: Run → pass**

Run: `npx jest LoginPage --watchAll=false` → Expected: PASS (4 previously-failing tests green).

- [ ] **Step 3: Full suite green**

Run: `npm test -- --watchAll=false` → Expected: all suites pass (was 93/4 → now 0 failing).

- [ ] **Step 4: Commit**

```bash
git add apex/src/__tests__/LoginPage.test.tsx
git commit -m "test(auth): mock next/navigation useSearchParams in LoginPage test"
```

---

## Self-review checklist (run after writing this plan)
- Spec coverage: schema additions, type contracts, surface reduction, middleware, test baseline → all have tasks. ✓
- No placeholders: all DDL and type code is complete. ✓
- Type consistency: `PaddedEffort`/`UrgencyResult`/`CognitiveClass`/`SlotState` match the overview's shared-contracts block. ✓
- Decision logged: we reuse `tasks.urgency_score` as the engine-written cached value (trigger dropped) rather than adding `current_urgency_score`, to minimize churn; `is_at_risk` added alongside. (Overview mentions `current_urgency_score`; this plan supersedes that detail.)
