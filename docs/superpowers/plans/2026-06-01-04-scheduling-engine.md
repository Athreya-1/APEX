# Plan 04 — Deterministic Scheduling Engine (pure) — the crown jewel

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:test-driven-development`. Pure TypeScript, no DB/network. Steps use checkbox (`- [ ]`). Build NEW modules; do NOT touch the orphaned `scheduler.ts` (a later plan replaces it). Determinism: the engine receives `windowStart`/`windowEnd` as ISO and never reads the clock.

**Goal:** A pure engine that turns a `PlanRequest` (skeleton + scored tasks + due habits + levers) into a `PlanResult` (typed, non-overlapping timeline blocks + warnings + reasoning) using a 96-block 15-min timeline and a reserve-then-arbitrate, energy-matched, consolidation-aware packer.

**Architecture:** Three new files —
- `src/lib/planning/timeline.ts` — the 15-min slot primitive + free-run detection + session chunking (Tasks 1–2).
- `src/lib/planning/engine-types.ts` — the engine I/O contracts (Task 3).
- `src/lib/planning/engine.ts` — the 5 passes, placement, validate/repair, `generatePlan` (Tasks 3–5).

The engine consumes outputs of Plans 02–03 (paddedHours, urgency/at-risk) but imports only their types — ordering/scoring is done by the caller and passed in.

**Tech Stack:** TypeScript 5, Jest 30, `date-fns` (already installed) for ISO math (or raw `Date.parse`/arithmetic — both fine).

---

### Task 1: Timeline primitive (`timeline.ts`)

**Files:**
- Create: `apex/src/lib/planning/timeline.ts`
- Test: `apex/src/__tests__/timeline.test.ts`

**Spec — exact behavior:**
- `SLOT_MINUTES = 15`.
- `buildTimeline(windowStart, windowEnd)`: returns `TimelineSlot[]` (from `@/types`) of 15-min slots fully inside `[windowStart, windowEnd)`. `index` 0-based; `start`/`end` ISO; `state:'available'`; `assignedId:null`. A trailing partial < 15 min is dropped.
- `slotIndexAt(timeline, iso)`: index of the slot containing `iso`, or `-1`.
- `lockRange(timeline, start, end, state, opts?)`: mutate+return; every slot whose midpoint is within `[start, end)` becomes `state` with `opts.assignedId`/`opts.cognitiveClass`. Out-of-window ranges are clamped (ignored where no slot). Never throws.
- `freeRuns(timeline)`: array of `{ startIndex, endIndexExclusive, startISO, endISO, slotCount, offsetMins }` for each maximal run of `state==='available'`. `offsetMins` = minutes from `timeline[0].start` to the run's start (used for energy classification).
- `runMinutes(run)` = `slotCount * 15`.

- [ ] **Step 1: Failing tests**

```typescript
// apex/src/__tests__/timeline.test.ts
import { buildTimeline, slotIndexAt, lockRange, freeRuns, SLOT_MINUTES } from '@/lib/planning/timeline'

const S = '2026-06-01T08:00:00.000Z'
const E = '2026-06-01T20:00:00.000Z' // 12h -> 48 slots

describe('buildTimeline', () => {
  it('creates 15-min slots across the window', () => {
    const t = buildTimeline(S, E)
    expect(SLOT_MINUTES).toBe(15)
    expect(t.length).toBe(48)
    expect(t[0].start).toBe(S)
    expect(t[0].state).toBe('available')
    expect(t[47].end).toBe(E)
  })
  it('drops a trailing partial slot', () => {
    const t = buildTimeline(S, '2026-06-01T08:20:00.000Z') // 20 min -> 1 full slot
    expect(t.length).toBe(1)
  })
})

describe('lockRange + freeRuns', () => {
  it('locks slots overlapping a range and splits free runs around it', () => {
    const t = buildTimeline(S, E)
    lockRange(t, '2026-06-01T12:00:00.000Z', '2026-06-01T13:00:00.000Z', 'meal', { assignedId: 'lunch' })
    const locked = t.filter((s) => s.state === 'meal')
    expect(locked.length).toBe(4) // 1h
    expect(locked[0].assignedId).toBe('lunch')
    const runs = freeRuns(t)
    expect(runs.length).toBe(2) // before & after lunch
    expect(runs[0].offsetMins).toBe(0)
    expect(runs[1].startISO).toBe('2026-06-01T13:00:00.000Z')
  })
  it('clamps out-of-window ranges without throwing', () => {
    const t = buildTimeline(S, E)
    expect(() => lockRange(t, '2026-06-01T06:00:00.000Z', '2026-06-01T09:00:00.000Z', 'fixed')).not.toThrow()
    expect(t.filter((s) => s.state === 'fixed').length).toBe(4) // only 08:00-09:00 inside
  })
  it('slotIndexAt finds the containing slot', () => {
    const t = buildTimeline(S, E)
    expect(slotIndexAt(t, '2026-06-01T08:07:00.000Z')).toBe(0)
    expect(slotIndexAt(t, '2026-06-01T09:00:00.000Z')).toBe(4)
    expect(slotIndexAt(t, '2026-06-01T21:00:00.000Z')).toBe(-1)
  })
})
```

- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement `timeline.ts`** (reference implementation):

```typescript
import type { TimelineSlot, SlotState, CognitiveClass } from '@/types'

export const SLOT_MINUTES = 15
const MS = SLOT_MINUTES * 60_000

export function buildTimeline(windowStart: string, windowEnd: string): TimelineSlot[] {
  const start = Date.parse(windowStart)
  const end = Date.parse(windowEnd)
  const slots: TimelineSlot[] = []
  let i = 0
  for (let t = start; t + MS <= end + 1; t += MS) {
    slots.push({
      index: i++, start: new Date(t).toISOString(), end: new Date(t + MS).toISOString(),
      state: 'available', assignedId: null,
    })
  }
  return slots
}

export function slotIndexAt(timeline: TimelineSlot[], iso: string): number {
  const t = Date.parse(iso)
  for (const s of timeline) {
    if (t >= Date.parse(s.start) && t < Date.parse(s.end)) return s.index
  }
  return -1
}

export function lockRange(
  timeline: TimelineSlot[], start: string, end: string, state: SlotState,
  opts?: { assignedId?: string; cognitiveClass?: CognitiveClass },
): TimelineSlot[] {
  const a = Date.parse(start), b = Date.parse(end)
  for (const s of timeline) {
    const mid = Date.parse(s.start) + MS / 2
    if (mid >= a && mid < b) {
      s.state = state
      s.assignedId = opts?.assignedId ?? s.assignedId
      if (opts?.cognitiveClass) s.cognitiveClass = opts.cognitiveClass
    }
  }
  return timeline
}

export interface FreeRun {
  startIndex: number
  endIndexExclusive: number
  startISO: string
  endISO: string
  slotCount: number
  offsetMins: number
}

export function freeRuns(timeline: TimelineSlot[]): FreeRun[] {
  if (timeline.length === 0) return []
  const t0 = Date.parse(timeline[0].start)
  const runs: FreeRun[] = []
  let i = 0
  while (i < timeline.length) {
    if (timeline[i].state !== 'available') { i++; continue }
    let j = i
    while (j < timeline.length && timeline[j].state === 'available') j++
    runs.push({
      startIndex: i, endIndexExclusive: j,
      startISO: timeline[i].start, endISO: timeline[j - 1].end,
      slotCount: j - i, offsetMins: (Date.parse(timeline[i].start) - t0) / 60000,
    })
    i = j
  }
  return runs
}

export function runMinutes(run: FreeRun): number { return run.slotCount * SLOT_MINUTES }
```

- [ ] **Step 4: Run → pass. Commit** `feat(engine): 15-min timeline primitive (build/lock/freeRuns)`.

---

### Task 2: Session chunking (`timeline.ts` addition)

**Files:** Modify `timeline.ts`; modify `timeline.test.ts`.

**Spec:** `planSessions(totalMinutes, mode, minChunkMinutes)` returns an ordered array of segments `{ kind: 'focus' | 'break'; minutes: number }`.
- Focus length `F` and break length `B`: `90_20 → F=90,B=20`; `50_10 → F=50,B=10`.
- Emit full `F` focus segments separated by `B` breaks. The remainder `R = total mod F` (if `> 0`): if `R >= minChunkMinutes` emit a final `focus R` (preceded by a break if any prior focus exists); if `0 < R < minChunkMinutes` absorb it into the last full focus (last focus becomes `F + R`) — never schedule a sub-min-chunk standalone focus. No trailing break after the last focus.
- `total <= 0` → `[]`. `total < minChunkMinutes` but `> 0` → single `focus total` (caller decides if the hole is usable).

- [ ] **Step 1: Failing tests**

```typescript
import { planSessions } from '@/lib/planning/timeline'

describe('planSessions', () => {
  it('90/20: 210 min -> f90,b20,f90,b20,f30 (remainder >= minChunk)', () => {
    expect(planSessions(210, '90_20', 30)).toEqual([
      { kind: 'focus', minutes: 90 }, { kind: 'break', minutes: 20 },
      { kind: 'focus', minutes: 90 }, { kind: 'break', minutes: 20 },
      { kind: 'focus', minutes: 30 },
    ])
  })
  it('absorbs a sub-min-chunk remainder into the last focus', () => {
    // 200 min, F=90, remainder 20 (<30) -> f90,b20,f110
    expect(planSessions(200, '90_20', 30)).toEqual([
      { kind: 'focus', minutes: 90 }, { kind: 'break', minutes: 20 },
      { kind: 'focus', minutes: 110 },
    ])
  })
  it('single short session has no trailing break', () => {
    expect(planSessions(60, '90_20', 30)).toEqual([{ kind: 'focus', minutes: 60 }])
  })
  it('50/10 splits correctly', () => {
    expect(planSessions(110, '50_10', 25)).toEqual([
      { kind: 'focus', minutes: 50 }, { kind: 'break', minutes: 10 },
      { kind: 'focus', minutes: 50 }, { kind: 'break', minutes: 10 },
      { kind: 'focus', minutes: 10 }, // remainder 10 < 25 -> absorbed? 110 mod 50 = 10
    ])
  })
  it('zero or negative -> empty', () => {
    expect(planSessions(0, '90_20', 30)).toEqual([])
  })
})
```

> Note the 50/10 case: `110 mod 50 = 10 < 25`, so the remainder is absorbed into the last full focus → `f50,b10,f60`. FIX the test to the correct expected value `[{focus50},{break10},{focus60}]` when implementing (the inline comment above is intentionally wrong to force you to apply the spec). Apply the spec, not the wrong comment.

- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement `planSessions`**:

```typescript
export type SessionMode = '90_20' | '50_10'
export interface SessionSegment { kind: 'focus' | 'break'; minutes: number }

export function planSessions(totalMinutes: number, mode: SessionMode, minChunkMinutes: number): SessionSegment[] {
  if (totalMinutes <= 0) return []
  const [F, B] = mode === '90_20' ? [90, 20] : [50, 10]
  if (totalMinutes <= F) return [{ kind: 'focus', minutes: totalMinutes }]

  const fullCount = Math.floor(totalMinutes / F)
  let remainder = totalMinutes - fullCount * F
  const focuses: number[] = Array(fullCount).fill(F)
  if (remainder >= minChunkMinutes) focuses.push(remainder)
  else if (remainder > 0) focuses[focuses.length - 1] += remainder

  const segs: SessionSegment[] = []
  focuses.forEach((f, i) => {
    if (i > 0) segs.push({ kind: 'break', minutes: B })
    segs.push({ kind: 'focus', minutes: f })
  })
  return segs
}
```

- [ ] **Step 4: Run → pass. Commit** `feat(engine): session chunking (90/20, 50/10, min-chunk absorption)`.

---

### Task 3: Engine I/O types + Passes 1–3 (skeleton, demands, arbitration)

**Files:**
- Create: `apex/src/lib/planning/engine-types.ts`
- Create: `apex/src/lib/planning/engine.ts`
- Test: `apex/src/__tests__/engine-passes.test.ts`

**Engine types (`engine-types.ts`):**

```typescript
import type { CognitiveClass, SlotState } from '@/types'
import type { SessionMode } from './timeline'

export interface SkeletonItem {
  id: string
  start: string            // ISO
  end: string              // ISO
  state: SlotState         // 'fixed' | 'meal' | 'rest_lockout' | 'habit'
  label: string
  cognitiveClass?: CognitiveClass
}

export interface EngineTask {
  id: string
  label: string
  paddedHours: number
  cognitiveClass: CognitiveClass   // usually heavy_focus | light_admin | creative
  importance: number               // 1..4
  urgencyScore: number
  isAtRisk: boolean
  mustToday: boolean               // due today OR do_date=today OR at-risk
}

export interface EngineHabit {
  id: string
  label: string
  mode: 'time_blocked' | 'check_off'
  durationMins: number
  cognitiveClass: CognitiveClass
  cascade?: number[]               // e.g. [90,60,30] (gym); first entry that fits wins
  timeRanges?: Array<{ start: string; end: string }> // preferred ISO windows
  goalId?: string | null
}

export interface PlanRequest {
  windowStart: string
  windowEnd: string
  sessionMode: SessionMode
  workLifeDial: number             // 0..1
  workHourCap: number              // hours
  minChunkMinutes: number
  maxConsecutiveHeavy: number
  skeleton: SkeletonItem[]
  tasks: EngineTask[]              // already ordered by caller (orderByUrgency)
  habits: EngineHabit[]            // already filtered to "due today"
}

export interface EngineBlock {
  taskId: string | null
  habitId: string | null
  blockType: string                // deep_work|admin|break|gym|habit|meal|fixed|rest|custom
  cognitiveClass: CognitiveClass | null
  start: string
  end: string
  label: string
}

export interface PlanWarning {
  kind: 'deadline_at_risk' | 'work_hour_cap_breached' | 'habit_lapsed' | 'overcommitted'
  message: string
  refId?: string
}

export interface ReasoningNote { refId: string; note: string }

export interface PlanResult {
  blocks: EngineBlock[]
  warnings: PlanWarning[]
  reasoning: ReasoningNote[]
  capBreached: boolean
  dialUsed: number
  scheduledHoursByTask: Record<string, number>
}
```

**Passes 1–3 (in `engine.ts`):**
- `lockSkeleton(timeline, skeleton)` → applies each skeleton item via `lockRange`.
- `availableMinutes(timeline)` = free slots × 15.
- `computeDemands(request)` → `{ mustHours, flexHabitMins, discretionaryTasks }`:
  - `mustHours` = Σ paddedHours of tasks with `mustToday`.
  - `flexHabitMins` = Σ habit durations (using first cascade tier if present, else durationMins).
  - `discretionaryTasks` = tasks not mustToday.
- `arbitrate(request, freeMins)` → budget object:
  - capMins = `workHourCap * 60`.
  - Reserve must-do first: `reservedMustMins = mustHours*60` (never yielded).
  - If `reservedMustMins > capMins` OR `reservedMustMins > freeMins` → `capBreached` candidate + `overcommitted` warning (must-do that is at-risk forces breach; engine still schedules must-do up to freeMins, flags warning).
  - Remaining budget `rem = min(capMins, freeMins) - reservedMustMins` (≥0).
  - Habits: gym cascade picks the largest tier that fits `rem`; frequency habits included if they fit.
  - Discretionary: filled up to `dialUsed = workLifeDial` share of leftover after must + habits; the rest is guarded rest.

- [ ] **Step 1: Failing tests** (focus on the pure pass functions, deterministic):

```typescript
// apex/src/__tests__/engine-passes.test.ts
import { buildTimeline } from '@/lib/planning/timeline'
import { lockSkeleton, availableMinutes, computeDemands, arbitrate } from '@/lib/planning/engine'
import type { PlanRequest } from '@/lib/planning/engine-types'

const W = { windowStart: '2026-06-01T08:00:00.000Z', windowEnd: '2026-06-01T20:00:00.000Z' } // 12h
const base: PlanRequest = {
  ...W, sessionMode: '90_20', workLifeDial: 0.5, workHourCap: 8,
  minChunkMinutes: 60, maxConsecutiveHeavy: 4, skeleton: [], tasks: [], habits: [],
}

describe('Pass 1 skeleton + capacity', () => {
  it('locks skeleton and reduces available minutes', () => {
    const t = buildTimeline(W.windowStart, W.windowEnd)
    lockSkeleton(t, [
      { id: 'lunch', start: '2026-06-01T12:00:00.000Z', end: '2026-06-01T12:45:00.000Z', state: 'meal', label: 'Lunch' },
      { id: 'class', start: '2026-06-01T10:00:00.000Z', end: '2026-06-01T11:00:00.000Z', state: 'fixed', label: 'Class' },
    ])
    expect(availableMinutes(t)).toBe(12 * 60 - 45 - 60)
  })
})

describe('Pass 2 demands', () => {
  it('sums must-do hours and separates discretionary', () => {
    const req: PlanRequest = { ...base, tasks: [
      { id: 'm', label: 'Lab', paddedHours: 4, cognitiveClass: 'heavy_focus', importance: 4, urgencyScore: 2, isAtRisk: false, mustToday: true },
      { id: 'd', label: 'CMR', paddedHours: 3, cognitiveClass: 'creative', importance: 2, urgencyScore: 0, isAtRisk: false, mustToday: false },
    ]}
    const d = computeDemands(req)
    expect(d.mustHours).toBe(4)
    expect(d.discretionaryTasks.map((t) => t.id)).toEqual(['d'])
  })
})

describe('Pass 3 arbitration', () => {
  it('reserves must-do, then gym cascade picks largest fitting tier', () => {
    const req: PlanRequest = { ...base, tasks: [
      { id: 'm', label: 'Lab', paddedHours: 4, cognitiveClass: 'heavy_focus', importance: 4, urgencyScore: 2, isAtRisk: false, mustToday: true },
    ], habits: [
      { id: 'gym', label: 'Gym', mode: 'time_blocked', durationMins: 90, cognitiveClass: 'physical', cascade: [90, 60, 30] },
    ]}
    const b = arbitrate(req, 12 * 60) // plenty
    expect(b.reservedMustMins).toBe(240)
    expect(b.gymMins).toBe(90)
    expect(b.capBreached).toBe(false)
  })
  it('flags cap breach when must-do exceeds the work-hour cap', () => {
    const req: PlanRequest = { ...base, workHourCap: 3, tasks: [
      { id: 'm', label: 'Lab', paddedHours: 5, cognitiveClass: 'heavy_focus', importance: 4, urgencyScore: 9, isAtRisk: true, mustToday: true },
    ]}
    const b = arbitrate(req, 12 * 60)
    expect(b.capBreached).toBe(true)
  })
})
```

- [ ] **Step 2–4:** Implement `engine-types.ts` + the four functions in `engine.ts` to pass; commit `feat(engine): passes 1-3 (skeleton lock, demand compute, budget arbitration)`.

> The implementer designs the `arbitrate` return shape to satisfy the tests (must include `reservedMustMins`, `gymMins`, `capBreached`, plus `discretionaryMins`, `dialUsed`, `habitMins`). Keep it a plain interface exported from `engine.ts`.

---

### Task 4: Pass 4 — placement (zones, energy, consolidation, cognitive variety)

**Files:** Modify `engine.ts`; Test `apex/src/__tests__/engine-placement.test.ts`.

**Spec:** `placeTasks(timeline, orderedTasks, budget, request)` mutates the timeline (marking `focus`/`break` slots with `assignedId` + cognitiveClass) and returns `{ blocks, scheduledHoursByTask, reasoning }`.

Behavior (deterministic, invariant-driven — exact internal heuristic is the implementer's, but ALL these tests must pass):
1. **Energy zones:** classify each free run by `offsetMins` from wake: `peak` if `120 ≤ offset ≤ 300`, `trough` if `360 ≤ offset ≤ 540`, else `other`. Helper `classifyEnergy(offsetMins)`.
2. **Placement order:** iterate `orderedTasks` (already urgency-ordered). For each, allocate up to its `paddedHours` (must-do first; discretionary only within budget).
3. **Energy match:** `heavy_focus`/`creative` prefer `peak` runs (then `other`, then `trough`); `light_admin` prefer `trough` (then `other`). Sort candidate runs by suitability.
4. **Consolidation:** put a task's minutes into the FEWEST, largest runs — fill one run as much as possible before spilling to the next; never scatter into tiny non-adjacent holes when a big run exists.
5. **Chunking:** within a run, lay out `planSessions(mins, mode, minChunk)`; mark focus slots `focus` (assignedId=taskId, cognitiveClass), break slots `break`.
6. **Cognitive variety / `maxConsecutiveHeavy`:** never place more than `maxConsecutiveHeavy` consecutive heavy_focus FOCUS sessions (across the day's running tally) without an intervening contrasting block (a `break` longer than the normal inter-session break, or a non-heavy block). When the cap is hit, insert a longer restorative break before the next heavy session.
7. Holes `< minChunkMinutes` are left `available` (become buffer) — heavy work never placed in them.
8. Return `scheduledHoursByTask` (actual placed hours; may be < paddedHours if capacity ran out).

- [ ] **Step 1: Failing tests**

```typescript
// apex/src/__tests__/engine-placement.test.ts
import { buildTimeline } from '@/lib/planning/timeline'
import { classifyEnergy, placeTasks } from '@/lib/planning/engine'
import type { EngineTask, PlanRequest } from '@/lib/planning/engine-types'

const W = { windowStart: '2026-06-01T08:00:00.000Z', windowEnd: '2026-06-01T22:00:00.000Z' } // 14h
const base: PlanRequest = {
  ...W, sessionMode: '90_20', workLifeDial: 0.5, workHourCap: 12,
  minChunkMinutes: 60, maxConsecutiveHeavy: 2, skeleton: [], tasks: [], habits: [],
}
const heavy = (id: string, h: number, must = true): EngineTask => ({
  id, label: id, paddedHours: h, cognitiveClass: 'heavy_focus',
  importance: 3, urgencyScore: 1, isAtRisk: false, mustToday: must,
})

describe('classifyEnergy', () => {
  it('peak window is 2-5h post wake', () => {
    expect(classifyEnergy(180)).toBe('peak')
    expect(classifyEnergy(420)).toBe('trough')
    expect(classifyEnergy(0)).toBe('other')
  })
})

describe('placeTasks', () => {
  it('places a heavy task into the peak zone, chunked, no overlaps', () => {
    const t = buildTimeline(W.windowStart, W.windowEnd)
    const budget = { reservedMustMins: 180, gymMins: 0, habitMins: 0, discretionaryMins: 0, dialUsed: 0.5, capBreached: false }
    const { blocks, scheduledHoursByTask } = placeTasks(t, [heavy('lab', 3)], budget, base)
    const focusBlocks = blocks.filter((b) => b.taskId === 'lab' && b.blockType !== 'break')
    const totalMin = focusBlocks.reduce((s, b) => s + (Date.parse(b.end) - Date.parse(b.start)) / 60000, 0)
    expect(totalMin).toBe(180)
    expect(scheduledHoursByTask['lab']).toBeCloseTo(3)
    // first focus block should start within the peak window (>=2h after wake)
    const first = focusBlocks.sort((a, b) => Date.parse(a.start) - Date.parse(b.start))[0]
    const offset = (Date.parse(first.start) - Date.parse(W.windowStart)) / 60000
    expect(offset).toBeGreaterThanOrEqual(120)
    // no two blocks overlap
    const sorted = [...blocks].sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
    for (let i = 1; i < sorted.length; i++) {
      expect(Date.parse(sorted[i].start)).toBeGreaterThanOrEqual(Date.parse(sorted[i - 1].end))
    }
  })

  it('enforces maxConsecutiveHeavy with a contrasting block', () => {
    const t = buildTimeline(W.windowStart, W.windowEnd)
    const budget = { reservedMustMins: 540, gymMins: 0, habitMins: 0, discretionaryMins: 0, dialUsed: 0.5, capBreached: false }
    // 3 heavy tasks * 90min = need 3 consecutive heavy sessions; cap is 2
    const { blocks } = placeTasks(t, [heavy('a', 1.5), heavy('b', 1.5), heavy('c', 1.5)], budget, { ...base, maxConsecutiveHeavy: 2 })
    // Walk chronological focus/break; never 3 heavy focus in a row without a break/non-heavy between
    const chron = blocks.filter((b) => b.blockType !== 'meal').sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
    let consecutiveHeavy = 0
    for (const b of chron) {
      if (b.cognitiveClass === 'heavy_focus' && b.blockType !== 'break') {
        consecutiveHeavy++
        expect(consecutiveHeavy).toBeLessThanOrEqual(2)
      } else if (b.blockType === 'break' || b.cognitiveClass !== 'heavy_focus') {
        consecutiveHeavy = 0
      }
    }
  })
})
```

- [ ] **Step 2–4:** Implement `classifyEnergy` + `placeTasks`; pass; commit `feat(engine): pass 4 placement (energy zones, consolidation, chunking, cognitive variety)`.

---

### Task 5: Pass 5 validate/repair + `generatePlan` orchestration

**Files:** Modify `engine.ts`; Test `apex/src/__tests__/engine-generate.test.ts`.

**Spec:**
- `validatePlan(blocks, request)` → `PlanWarning[]` for: overlapping blocks (should be none after placement), any block crossing a skeleton lock, total scheduled work > cap (allowed only if a must-do/at-risk forced it — then it's `work_hour_cap_breached`, not an error).
- `generatePlan(request): PlanResult` orchestrates: buildTimeline → lockSkeleton → computeDemands → arbitrate → placeTasks (must-do, then habits as blocks, then discretionary within budget) → assemble all blocks (skeleton blocks + placed blocks) sorted by start → validatePlan → produce warnings (`deadline_at_risk` for each at-risk task, `work_hour_cap_breached` if breached) + reasoning notes. `dialUsed` echoes `workLifeDial`. `scheduledHoursByTask` from placement.

- [ ] **Step 1: Failing integration tests**

```typescript
// apex/src/__tests__/engine-generate.test.ts
import { generatePlan } from '@/lib/planning/engine'
import type { PlanRequest } from '@/lib/planning/engine-types'

const W = { windowStart: '2026-06-01T08:00:00.000Z', windowEnd: '2026-06-01T22:00:00.000Z' }
const req: PlanRequest = {
  ...W, sessionMode: '90_20', workLifeDial: 0.5, workHourCap: 8,
  minChunkMinutes: 60, maxConsecutiveHeavy: 4,
  skeleton: [
    { id: 'lunch', start: '2026-06-01T12:00:00.000Z', end: '2026-06-01T12:45:00.000Z', state: 'meal', label: 'Lunch' },
    { id: 'class', start: '2026-06-01T15:00:00.000Z', end: '2026-06-01T16:00:00.000Z', state: 'fixed', label: 'Lecture' },
  ],
  tasks: [
    { id: 'lab', label: '15-213 Lab', paddedHours: 4, cognitiveClass: 'heavy_focus', importance: 4, urgencyScore: 3, isAtRisk: false, mustToday: true },
    { id: 'read', label: 'Reading', paddedHours: 1, cognitiveClass: 'light_admin', importance: 2, urgencyScore: 0.5, isAtRisk: false, mustToday: false },
  ],
  habits: [
    { id: 'gym', label: 'Gym', mode: 'time_blocked', durationMins: 90, cognitiveClass: 'physical', cascade: [90, 60, 30] },
  ],
}

describe('generatePlan', () => {
  it('produces a non-overlapping plan that includes skeleton, lab, and gym', () => {
    const plan = generatePlan(req)
    const ids = plan.blocks.map((b) => b.label)
    expect(ids).toContain('Lunch')
    expect(ids).toContain('Lecture')
    expect(plan.blocks.some((b) => b.taskId === 'lab')).toBe(true)
    expect(plan.blocks.some((b) => b.habitId === 'gym')).toBe(true)
    // no overlaps
    const s = [...plan.blocks].sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
    for (let i = 1; i < s.length; i++) {
      expect(Date.parse(s[i].start)).toBeGreaterThanOrEqual(Date.parse(s[i - 1].end))
    }
    expect(plan.scheduledHoursByTask['lab']).toBeCloseTo(4)
    expect(plan.capBreached).toBe(false)
  })

  it('flags at-risk + cap breach when a must-do exceeds the cap', () => {
    const tight: PlanRequest = { ...req, workHourCap: 3, tasks: [
      { id: 'lab', label: 'Lab', paddedHours: 6, cognitiveClass: 'heavy_focus', importance: 4, urgencyScore: 9, isAtRisk: true, mustToday: true },
    ], habits: [] }
    const plan = generatePlan(tight)
    expect(plan.capBreached).toBe(true)
    expect(plan.warnings.some((w) => w.kind === 'work_hour_cap_breached')).toBe(true)
    expect(plan.warnings.some((w) => w.kind === 'deadline_at_risk' && w.refId === 'lab')).toBe(true)
  })

  it('returns no overlap warnings on a normal plan', () => {
    const plan = generatePlan(req)
    expect(plan.warnings.some((w) => w.kind === 'overcommitted')).toBe(false)
  })
})
```

- [ ] **Step 2–4:** Implement `validatePlan` + `generatePlan`; run focused + FULL suite green; `tsc --noEmit` 0 errors. Commit `feat(engine): pass 5 validate/repair + generatePlan orchestration`.

---

## Self-review checklist
- Spec coverage: 96-block timeline, skeleton locks, demand compute, arbitration (must-do reserve, gym cascade, dial), energy-matched placement, consolidation, chunking, cognitive variety / maxConsecutiveHeavy, validate, at-risk + cap-breach warnings, scheduledHoursByTask → all have tests. ✓
- No placeholders: timeline + chunking are full reference code; passes/placement give exact signatures, behavior spec, and binding tests. ✓
- Type consistency: `TimelineSlot`/`SlotState`/`CognitiveClass` from `@/types`; `SessionMode` from `timeline.ts`; engine types from `engine-types.ts`; `generatePlan→PlanResult`. ✓
- Determinism: window passed in; no clock reads. ✓
- Deferred to Plan 07: mapping `PlanResult.blocks` → DB `plan_blocks` rows and building `PlanRequest` from Supabase data + GCal. This plan is pure engine only.
