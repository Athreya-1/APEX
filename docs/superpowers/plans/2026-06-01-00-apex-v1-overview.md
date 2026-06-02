# APEX V1 — Master Implementation Overview

> **For agentic workers:** This is the index/architecture doc for the APEX V1 rebuild. Each subsystem has its own detailed plan file (`2026-06-01-NN-*.md`). Execute plans in the numbered order — later plans depend on types/modules created by earlier ones. Use `superpowers:executing-plans` (inline, with checkpoints) or `superpowers:subagent-driven-development` (fresh subagent per task). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Rebuild APEX around a genuinely excellent **daily planner** whose visible surface is **Home · Planner · To-Do · Habits** (+ Settings/Onboarding), where To-Do and Habits are high-quality *inputs* to a **deterministic, testable scheduling engine**; the LLM only ever emits structured decisions/parameters, never a timeline.

**Architecture (the core principle):**
- A deterministic TypeScript engine owns ALL hard math and constraints: padded effort, robust urgency, a 96-block 15-minute timeline, a reserve-then-arbitrate packer, energy-matched placement, validate/repair.
- LLMs (Haiku → Sonnet → top tier, routed by complexity) handle ONLY natural-language parsing, importance/cut judgment, goal→habit decomposition, and human-readable explanations. They emit JSON decision/parameter objects that the engine consumes.
- Observed behavior (effort actuals, calendar drift, check-in efficiency) is captured richly in V1 and applied simply (EWMA velocity + shrinkage), forming the long-term moat.

**Tech stack (already installed):** Next.js 16.2.6 (App Router; APIs differ from older Next — read `node_modules/next/dist/docs/` before touching framework code), React 19, TypeScript 5, Supabase (`@supabase/ssr`), `@anthropic-ai/sdk`, `googleapis`, Zustand 5, Tailwind 4 (`@theme` in `src/styles/globals.css`), framer-motion 12, Jest 30 + Testing Library.

---

## Current state (what exists today)

A prior scaffold built for an **older, broader** vision (exams, knowledge bank, notes, voice, Canvas) using **Claude to emit timelines directly** — the opposite of the V1 principle. Reusable assets:

- **Auth & infra:** Google OAuth login, `auth/callback`, `src/proxy.ts` (Next 16 middleware-equivalent; needs `middleware.ts` wiring), `supabase/{client,server}.ts`. ✅
- **Data layer:** `useTasks` (realtime), `taskStore`, `usePlan`, `planStore`, `useHabits` (built but unused). Tasks + plan wired; habits split.
- **Components:** `AppShell`, `DesktopSidebar`, `MobileNav`, tasks/plan/habits presentational components, an unused `ui/*` kit. Heavy inline-style + CSS-var pattern. framer-motion unused.
- **Engine (must rebuild):** `urgency.ts` = display tiers only (no robust model); `effort.ts` = 3-tier average (no variance/shrinkage/triangulation); `scheduler.ts` = naive, orphaned; production planning is Claude-emits-JSON in `api/plan/generate`.
- **AI:** `prompts.ts`, `extractor.ts` (screenshot), `router.ts` (intent CRUD; broken replan URL; missing intents), `estimator.ts` (orphaned).
- **GCal:** `gcal.ts` read/create/delete (no token refresh, no update/diff).
- **Schema:** `SCHEMA.sql` — comprehensive but pre-V1 (missing goals, custom fields, priors, focus_sessions, drift_events, guardrails, and ~25 columns).

**Test baseline:** 93 passing / 4 failing. The 4 failures are `LoginPage.test.tsx` needing a `useSearchParams` mock after a recent login edit (fix when touching auth).

---

## Decomposition into plans (execute in order)

| # | Plan file | Produces | Needs API keys? |
|---|-----------|----------|-----------------|
| 01 | `01-foundation-schema.md` | DB migration + updated `types/index.ts` + surface reduction (nav) + `middleware.ts` wiring + fix login test | No |
| 02 | `02-effort-estimation.md` | `effort.ts` rebuild: priors, EWMA bucket history, variance pad, shrinkage, triangulation, course difficulty/velocity (pure, TDD) | No |
| 03 | `03-urgency-model.md` | `urgency.ts` rebuild: Layer 0 padded effort wiring, Layer 1 EDF feasibility/slack/at-risk, Layer 2 continuous urgency + contention (pure, TDD) | No |
| 04 | `04-scheduling-engine.md` | `scheduler.ts` rebuild: 96-block timeline, 5-pass reserve-then-arbitrate packer, zones/energy/consolidation/variety, validate/repair (pure, TDD) — **the crown jewel** | No |
| 05 | `05-eisenhower-wlb-guardrails.md` | Importance assignment + cut-ordering; work-life dial allocation; burnout guard; guardrails-as-locks (pure, TDD) | No |
| 06 | `06-llm-layer-routing.md` | Rewrite planner prompts to decision/parameter outputs; model tier routing; NLP quick-add parser; importance/cut LLM calls; goal-decomposition prompt | Yes (live), mockable for tests |
| 07 | `07-generate-replan-gcal.md` | Rebuild `api/plan/generate` (deterministic orchestration), `api/plan/replan` (micro + NL), GCal read+write+diff sync, fix router replan | Yes (live) |
| 08 | `08-todo-custom-fields-input.md` | To-Do custom fields (defs/values UI), NLP quick-add + live preview, triangulation control, cold-start estimate modal | Partial |
| 09 | `09-habits-goals.md` | goals→habits decomposition (conversational), habit scheduling model, "due today" engine, habits page rebuild on `useHabits` | Partial |
| 10 | `10-checkin-learning.md` | Check-in loop (Done/+N/efficiency), focus_sessions + drift_events capture, apply velocity/effort updates, "why" notes | No (capture); partial (UI) |
| 11 | `11-ui-design-polish.md` | Design language (Satoshi, amber scarcity, depth/light), motion (plan cascade, FLIP reflow, dial preview), Home/Planner/To-Do/Habits hero screens, plan-my-day wizard, font pipeline fix | No |

**Why this order:** 01 unblocks everything (types/schema). 02→03→04→05 are the deterministic, API-key-free core that can be fully verified by tests now — the differentiator. 06–07 layer LLM + integration on top. 08–10 are feature UIs that consume the engine. 11 is the polish pass (can interleave). Each plan ends in a green test run and a commit.

---

## Consolidated data model (target)

Created via an additive migration `db/migrations/2026-06-01_v1_planner.sql` (never destructive; keeps hidden-feature tables). Full DDL lives in Plan 01.

**Altered tables**
- `user_preferences` + `work_life_dial numeric (0..1, default 0.5)`, `daily_work_hour_cap numeric (default 8)`, `min_chunk_minutes int (default 60)`, `max_consecutive_heavy int (default 4)`.
- `courses` + `difficulty_multiplier numeric (default 1.0)`, `velocity_modifier numeric (default 1.0)` (EWMA).
- `tasks` + `metadata jsonb default '{}'`, `triangulation_multiplier numeric (default 1.0)`, `importance int (1..4)`, `is_at_risk boolean default false`, `current_urgency_score numeric default 0` (cached, engine-written). Retire the SQL urgency trigger (keep column for back-compat display; engine becomes authoritative).
- `plan_blocks` + `original_start_time timestamptz`, `original_end_time timestamptz`, `cognitive_class text` (`heavy_focus|light_admin|creative|physical|restorative`).
- `habits` + `mode text (time_blocked|check_off)`, `duration_mins int`, `frequency_type text (daily|per_week|weekdays|per_month)`, `frequency_target int`, `time_ranges jsonb`, `goal_id uuid fk`, `notification_time text`, `cognitive_class text`.
- `daily_plans` + `work_life_dial_used numeric`, `work_hour_cap_breached boolean default false`.

**New tables** (all RLS `auth.uid() = user_id`)
- `goals` (parent objective: name, description, target_metric, deadline, status).
- `task_field_defs` (per-user list schema: name, kind `text|single_select|checkbox`, options jsonb, sort_order).
- `task_field_values` (task_id, field_def_id, value jsonb).
- `task_priors` (user nullable=global, category_keyword, default_minutes).
- `focus_sessions` (task_id, started_at, ended_at, interrupted, user_reported_efficiency 1..5, cognitive_class).
- `drift_events` (plan_block_id, kind `moved|skipped|overran|early_done`, original/new times, delta_mins).
- `guardrails` (kind `no_work_before|no_work_after|protected_window|break_day`, payload jsonb, hard boolean).

---

## Shared TypeScript contracts (defined in Plan 01, used everywhere)

These are the stable interfaces the engine plans depend on. Authoritative definitions go in `src/types/index.ts` (and `src/lib/planning/types.ts` for engine-internal types).

```typescript
// Cognitive classes for variety enforcement
export type CognitiveClass =
  | 'heavy_focus' | 'light_admin' | 'creative' | 'physical' | 'restorative'

// 15-min timeline primitive (96 blocks/day)
export type SlotState =
  | 'available' | 'fixed' | 'habit' | 'focus' | 'break'
  | 'meal' | 'buffer' | 'rest_lockout'

export interface TimelineSlot {
  index: number          // 0..95 (relative to plan day window)
  start: string          // ISO
  end: string            // ISO
  state: SlotState
  assignedId: string | null   // task_id | habit_id | gcal_event_id | null
  cognitiveClass?: CognitiveClass
}

// Effort output (Plan 02)
export interface PaddedEffort {
  estimateHours: number        // blended point estimate
  paddedHours: number          // estimate + k*stdev  -> engine uses this (H)
  stdevHours: number
  sampleSize: number
  source: 'bucket_history' | 'type_history' | 'adjusted_prior'
  confidence: 'cold' | 'warming' | 'warm'
}

// Urgency output (Plan 03)
export interface UrgencyResult {
  taskId: string
  score: number                // Layer 2 continuous (display + ranking)
  isAtRisk: boolean            // Layer 1 negative slack
  slackHours: number
  paddedHours: number          // from Plan 02
}

// Engine I/O (Plan 04)
export interface PlanRequest {
  planDate: string             // YYYY-MM-DD
  windowStart: string          // ISO (wake)
  windowEnd: string            // ISO (sleep)
  sessionMode: '90_20' | '50_10'
  workLifeDial: number         // 0..1 (protect..invest)
  workHourCap: number          // hours
  minChunkMinutes: number
  maxConsecutiveHeavy: number
  skeleton: SkeletonItem[]     // sleep/classes/meals/routine/GCal/guardrails
  tasks: EngineTask[]          // with paddedHours + urgency + importance + cognitiveClass
  habits: EngineHabit[]        // due-today habits with mode/duration/cascade/ranges
  guardrails: Guardrail[]
}

export interface PlanResult {
  blocks: EngineBlock[]        // typed timeline blocks -> persisted as plan_blocks
  warnings: PlanWarning[]      // at-risk, cap-breach, lapsed-habit
  reasoning: ReasoningNote[]   // per-decision "why" notes for the APEX drawer
  capBreached: boolean
  dialUsed: number
}
```

(Each plan repeats the exact fields it introduces — engineers may read plans out of order.)

---

## Cross-cutting conventions

- **TDD:** every engine module is pure and gets unit tests first (Jest). Components get Testing Library tests. Commit after each green task.
- **Determinism:** engine functions are pure (inputs → outputs), no `Date.now()` inside — the "now" is always passed in, so tests are reproducible.
- **No secrets in tests:** LLM/GCal calls are mocked. Live keys only exercised by manual/integration scripts (Plan 06/07) once the user provides keys.
- **Next 16:** before editing `middleware.ts`, route handlers, or `next/font`, consult `node_modules/next/dist/docs/`.
- **Style:** match the existing inline-style + CSS-var pattern; design tokens in `src/styles/globals.css`. Respect `prefers-reduced-motion`.
- **Surface reduction = comment out, never delete** hidden features (Notes/Review/Exams/Knowledge) so they can be restored.

---

## Deferred (not in V1)

V2 chained/blocking tasks; learned energy-curve & burnout prediction; habit-deviation coaching; push notifications / nightly automation; Canvas extension; university-holiday auto-sync; multi-user analytics; planning-influencing custom fields; vector/embedding knowledge search.

---

## Execution status tracker

- [x] Branch `feat/apex-v1-planner` created; in-progress work checkpointed; baseline tests captured (93/4).
- [x] Plan 01 — Foundation (migration + V1 types + surface reduction + proxy verified as Next 16 middleware + login test fixed). Suite: 103/0.
- [x] Plan 02 — Effort/estimation (`estimation.ts`: EWMA summary, shrinkage blend, velocity, `computePaddedEffort`). Suite: 117/0.
- [x] Plan 03 — Urgency model (`urgency.ts` += EDF feasibility/slack/at-risk + continuous score + `orderByUrgency`). Suite: 124/0.
- [x] Plan 04 — Scheduling engine (`timeline.ts` + `engine.ts`: 15-min timeline, session chunking, 5 passes, energy-matched placement, validate/repair, `generatePlan`). Suite: 144/0.
- [x] Plan 05 — Eisenhower/WLB/guardrails (`eisenhower.ts`: importance/quadrant/cut-order; `guardrails.ts`: guardrail→skeleton. WLB dial + cap already in `engine.ts`). Suite: 159/0.
- [x] Plan 06 — LLM layer & model routing (`src/lib/llm/`: models, zod schemas, JSON extraction, offline quick-add parser, injectable caller, parse/decompose/explain/replan). Added `zod`. Suite: 180/0.
- [x] Plan 07 — generate/replan API + GCal (`orchestrator.ts`, `persist.ts`, `gcal-sync.ts`; rebuilt `api/plan/generate` + `replan`; router URL fix). Suite: 189/0.
- [ ] Plan 08 — To-Do custom fields & input (next)
- [ ] Plan 08 — To-Do custom fields & input
- [ ] Plan 09 — Habits & goals
- [ ] Plan 10 — Check-in & learning
- [ ] Plan 11 — UI & design polish
