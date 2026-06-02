# Plan 05 — Eisenhower (importance + cutting) & Guardrails→Skeleton (pure)

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:test-driven-development`. Pure TypeScript. Steps use checkbox (`- [ ]`). The work-life dial and burnout work-hour cap already live in `engine.ts` (Plan 04: `arbitrate`); this plan adds the remaining deterministic pieces: importance assignment, Eisenhower quadrant derivation, the overcommit cut-ordering, and converting guardrail rows into engine skeleton locks.

**Goal:** Deterministic defaults for **importance** (semi-static, LLM-refinable later), **Eisenhower quadrant** derivation (urgency × importance), the **cut-candidate ordering** used when overcommitted, and a **guardrails→SkeletonItem** converter (Pass-1 `rest_lockout` locks).

**Architecture:** Two pure files — `src/lib/planning/eisenhower.ts` (importance, quadrant, cut order) and `src/lib/planning/guardrails.ts` (guardrail rows → `SkeletonItem[]`). No DB. The LLM importance refinement and the actual cut decision are layered later (Plan 06); these are the deterministic seeds.

**Tech Stack:** TypeScript 5, Jest 30.

---

### Task 1: Importance assignment + Eisenhower quadrant

**Files:**
- Create: `apex/src/lib/planning/eisenhower.ts`
- Test: `apex/src/__tests__/eisenhower.test.ts`

**Spec:**

```typescript
import type { TaskTypeTag, EisenhowerQuadrant } from '@/types'

export interface ImportanceSignals {
  taskType: TaskTypeTag
  gradePercent?: number | null   // % of course grade if known (stakes)
  goalAligned?: boolean          // tied to a stated goal
  isGraded?: boolean             // false => optional/ungraded
}
```

- `TYPE_IMPORTANCE: Record<TaskTypeTag, number>` base defaults (1..4): `exam:4, project:3, lab:3, writeup:3, pset:3, quiz:2, review:2, reading:2, other:2`.
- `assignImportance(signals): number` (clamped 1..4):
  1. `imp = TYPE_IMPORTANCE[taskType]`.
  2. If `gradePercent != null`: `>=25 → imp = 4`; else `>=10 → imp = max(imp, 3)`; else `<5 → imp -= 1`.
  3. If `goalAligned` → `imp = min(4, imp + 1)`.
  4. If `isGraded === false` → `imp -= 1`.
  5. Clamp to `[1,4]`.
- `eisenhowerQuadrant(importance, isUrgent): EisenhowerQuadrant` where `important = importance >= 3`:
  - important & urgent → `urgent_important`; important & !urgent → `not_urgent_important`; !important & urgent → `urgent_not_important`; else `neither`.

- [ ] **Step 1: Failing tests**

```typescript
// apex/src/__tests__/eisenhower.test.ts
import { assignImportance, eisenhowerQuadrant, TYPE_IMPORTANCE } from '@/lib/planning/eisenhower'

describe('assignImportance', () => {
  it('uses the type default when no other signal', () => {
    expect(assignImportance({ taskType: 'reading' })).toBe(2)
    expect(assignImportance({ taskType: 'exam' })).toBe(4)
  })
  it('high stakes (>=25% of grade) forces importance 4', () => {
    expect(assignImportance({ taskType: 'reading', gradePercent: 30 })).toBe(4)
  })
  it('low stakes (<5%) reduces importance', () => {
    expect(assignImportance({ taskType: 'pset', gradePercent: 2 })).toBe(2) // 3 -> 2
  })
  it('goal alignment bumps importance (capped at 4)', () => {
    expect(assignImportance({ taskType: 'quiz', goalAligned: true })).toBe(3) // 2 -> 3
    expect(assignImportance({ taskType: 'exam', goalAligned: true })).toBe(4) // capped
  })
  it('ungraded reduces importance', () => {
    expect(assignImportance({ taskType: 'reading', isGraded: false })).toBe(1) // 2 -> 1
  })
  it('clamps to 1..4', () => {
    expect(assignImportance({ taskType: 'other', gradePercent: 1, isGraded: false })).toBe(1)
  })
})

describe('eisenhowerQuadrant', () => {
  it('maps importance x urgency to quadrants', () => {
    expect(eisenhowerQuadrant(4, true)).toBe('urgent_important')
    expect(eisenhowerQuadrant(3, false)).toBe('not_urgent_important')
    expect(eisenhowerQuadrant(2, true)).toBe('urgent_not_important')
    expect(eisenhowerQuadrant(1, false)).toBe('neither')
  })
  it('TYPE_IMPORTANCE covers every task type', () => {
    ;(['lab','pset','reading','project','writeup','quiz','review','exam','other'] as TaskTypeTag[])
      .forEach((t) => expect(TYPE_IMPORTANCE[t]).toBeGreaterThanOrEqual(1))
  })
})
```

(Add `import type { TaskTypeTag } from '@/types'` to the test.)

- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement `eisenhower.ts`**:

```typescript
import type { TaskTypeTag, EisenhowerQuadrant } from '@/types'

export const TYPE_IMPORTANCE: Record<TaskTypeTag, number> = {
  exam: 4, project: 3, lab: 3, writeup: 3, pset: 3,
  quiz: 2, review: 2, reading: 2, other: 2,
}

export interface ImportanceSignals {
  taskType: TaskTypeTag
  gradePercent?: number | null
  goalAligned?: boolean
  isGraded?: boolean
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x))

export function assignImportance(s: ImportanceSignals): number {
  let imp = TYPE_IMPORTANCE[s.taskType] ?? 2
  if (s.gradePercent != null) {
    if (s.gradePercent >= 25) imp = 4
    else if (s.gradePercent >= 10) imp = Math.max(imp, 3)
    else if (s.gradePercent < 5) imp -= 1
  }
  if (s.goalAligned) imp = Math.min(4, imp + 1)
  if (s.isGraded === false) imp -= 1
  return clamp(imp, 1, 4)
}

export function eisenhowerQuadrant(importance: number, isUrgent: boolean): EisenhowerQuadrant {
  const important = importance >= 3
  if (important && isUrgent) return 'urgent_important'
  if (important && !isUrgent) return 'not_urgent_important'
  if (!important && isUrgent) return 'urgent_not_important'
  return 'neither'
}
```

- [ ] **Step 4: Run → pass. Commit** `feat(eisenhower): importance assignment + quadrant derivation (pure)`.

---

### Task 2: Overcommit cut-ordering

**Files:** Modify `eisenhower.ts`; modify `eisenhower.test.ts`.

**Spec:** `cutOrder(candidates): string[]` returns task ids ordered **cut-first → cut-last** per the 4 rules:
1. `neither` → cut first.
2. `urgent_not_important` → next (compress/defer).
3. `not_urgent_important` discretionary → next.
4. `urgent_important` / at-risk / mustToday → never cut (last).

```typescript
export interface CutCandidate {
  id: string
  quadrant: EisenhowerQuadrant
  isAtRisk: boolean
  mustToday: boolean
}
```

Ranking (ascending = cut first): base by quadrant `{ neither:0, urgent_not_important:1, not_urgent_important:2, urgent_important:3 }`; if `isAtRisk || mustToday` → rank `99` (protected, last). Stable within equal ranks (preserve input order).

- [ ] **Step 1: Failing test**

```typescript
import { cutOrder } from '@/lib/planning/eisenhower'

describe('cutOrder', () => {
  it('cuts neither first, protects at-risk/must-today last', () => {
    const order = cutOrder([
      { id: 'imp', quadrant: 'urgent_important', isAtRisk: false, mustToday: false },
      { id: 'none', quadrant: 'neither', isAtRisk: false, mustToday: false },
      { id: 'uni', quadrant: 'urgent_not_important', isAtRisk: false, mustToday: false },
      { id: 'risk', quadrant: 'neither', isAtRisk: true, mustToday: false },
    ])
    expect(order[0]).toBe('none')      // neither, unprotected -> first
    expect(order[1]).toBe('uni')       // urgent-not-important
    expect(order[order.length - 1]).toBe('risk') // at-risk protected -> last
  })
})
```

- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement**:

```typescript
export interface CutCandidate {
  id: string
  quadrant: EisenhowerQuadrant
  isAtRisk: boolean
  mustToday: boolean
}

const QUADRANT_CUT_RANK: Record<EisenhowerQuadrant, number> = {
  neither: 0, urgent_not_important: 1, not_urgent_important: 2, urgent_important: 3,
}

export function cutOrder(candidates: CutCandidate[]): string[] {
  return candidates
    .map((c, i) => ({
      id: c.id, i,
      rank: c.isAtRisk || c.mustToday ? 99 : QUADRANT_CUT_RANK[c.quadrant],
    }))
    .sort((a, b) => (a.rank !== b.rank ? a.rank - b.rank : a.i - b.i))
    .map((c) => c.id)
}
```

- [ ] **Step 4: Run → pass. Commit** `feat(eisenhower): overcommit cut-candidate ordering (pure)`.

---

### Task 3: Guardrails → SkeletonItem locks

**Files:**
- Create: `apex/src/lib/planning/guardrails.ts`
- Test: `apex/src/__tests__/guardrails.test.ts`

**Spec:** `guardrailsToSkeleton(guardrails, windowStart, windowEnd): SkeletonItem[]` converts active guardrail rows into `rest_lockout` skeleton items clamped to the day window. The plan date is derived from `windowStart` (its calendar date in UTC for determinism). Times in payloads are `HH:MM` interpreted on that date in UTC.

For each guardrail with `is_active` and `kind`:
- `no_work_before` `{ time }` → lock `[windowStart, min(date@time, windowEnd)]`.
- `no_work_after` `{ time }` → lock `[max(date@time, windowStart), windowEnd]`.
- `protected_window` `{ start, end }` (HH:MM) → lock `[date@start, date@end]` clamped to window.
- `break_day` `{ date }` → if `date === planDate`, lock the whole `[windowStart, windowEnd]`.
Skip items that produce an empty/negative range. Each item: `{ id: guardrail.id, start, end, state: 'rest_lockout', label }` with a human label (e.g. `'No work before 09:00'`).

```typescript
import type { Guardrail } from '@/types'
import type { SkeletonItem } from './engine-types'
```

- [ ] **Step 1: Failing tests**

```typescript
// apex/src/__tests__/guardrails.test.ts
import { guardrailsToSkeleton } from '@/lib/planning/guardrails'
import type { Guardrail } from '@/types'

const WS = '2026-06-01T06:00:00.000Z'
const WE = '2026-06-01T23:00:00.000Z'
const g = (over: Partial<Guardrail>): Guardrail => ({
  id: 'g', user_id: 'u', kind: 'no_work_after', payload: {}, hard: true, is_active: true, created_at: '', ...over,
})

describe('guardrailsToSkeleton', () => {
  it('no_work_before locks the morning up to the time', () => {
    const [item] = guardrailsToSkeleton([g({ kind: 'no_work_before', payload: { time: '09:00' } })], WS, WE)
    expect(item.state).toBe('rest_lockout')
    expect(item.start).toBe(WS)
    expect(item.end).toBe('2026-06-01T09:00:00.000Z')
  })
  it('no_work_after locks the evening from the time', () => {
    const [item] = guardrailsToSkeleton([g({ kind: 'no_work_after', payload: { time: '20:00' } })], WS, WE)
    expect(item.start).toBe('2026-06-01T20:00:00.000Z')
    expect(item.end).toBe(WE)
  })
  it('protected_window locks an arbitrary range', () => {
    const [item] = guardrailsToSkeleton([g({ kind: 'protected_window', payload: { start: '13:00', end: '14:30' } })], WS, WE)
    expect(item.start).toBe('2026-06-01T13:00:00.000Z')
    expect(item.end).toBe('2026-06-01T14:30:00.000Z')
  })
  it('break_day on the plan date locks the whole window', () => {
    const [item] = guardrailsToSkeleton([g({ kind: 'break_day', payload: { date: '2026-06-01' } })], WS, WE)
    expect(item.start).toBe(WS)
    expect(item.end).toBe(WE)
  })
  it('break_day on another date produces nothing', () => {
    expect(guardrailsToSkeleton([g({ kind: 'break_day', payload: { date: '2026-06-02' } })], WS, WE)).toEqual([])
  })
  it('skips inactive guardrails', () => {
    expect(guardrailsToSkeleton([g({ kind: 'no_work_after', payload: { time: '20:00' }, is_active: false })], WS, WE)).toEqual([])
  })
})
```

- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement `guardrails.ts`**:

```typescript
import type { Guardrail } from '@/types'
import type { SkeletonItem } from './engine-types'

function atTime(windowStart: string, hhmm: string): string {
  const date = windowStart.slice(0, 10) // YYYY-MM-DD (UTC)
  const [h, m] = hhmm.split(':')
  return `${date}T${h.padStart(2, '0')}:${m.padStart(2, '0')}:00.000Z`
}

function clampRange(start: string, end: string, ws: string, we: string): [string, string] | null {
  const s = Math.max(Date.parse(start), Date.parse(ws))
  const e = Math.min(Date.parse(end), Date.parse(we))
  if (e <= s) return null
  return [new Date(s).toISOString(), new Date(e).toISOString()]
}

export function guardrailsToSkeleton(
  guardrails: Guardrail[], windowStart: string, windowEnd: string,
): SkeletonItem[] {
  const planDate = windowStart.slice(0, 10)
  const out: SkeletonItem[] = []
  for (const gr of guardrails) {
    if (!gr.is_active) continue
    const p = gr.payload as Record<string, string>
    let range: [string, string] | null = null
    let label = ''
    switch (gr.kind) {
      case 'no_work_before':
        range = clampRange(windowStart, atTime(windowStart, p.time), windowStart, windowEnd)
        label = `No work before ${p.time}`
        break
      case 'no_work_after':
        range = clampRange(atTime(windowStart, p.time), windowEnd, windowStart, windowEnd)
        label = `No work after ${p.time}`
        break
      case 'protected_window':
        range = clampRange(atTime(windowStart, p.start), atTime(windowStart, p.end), windowStart, windowEnd)
        label = `Protected ${p.start}–${p.end}`
        break
      case 'break_day':
        if (p.date === planDate) { range = [windowStart, windowEnd]; label = 'Break day' }
        break
    }
    if (range) out.push({ id: gr.id, start: range[0], end: range[1], state: 'rest_lockout', label })
  }
  return out
}
```

- [ ] **Step 4: Run → pass.** Full suite green; `tsc --noEmit` 0 errors. Commit `feat(guardrails): convert guardrail rows to skeleton rest-lockouts (pure)`.

---

## Self-review checklist
- Spec coverage: importance defaults + stakes/goal/graded modifiers, quadrant derivation, cut ordering (4 rules + protection), guardrail kinds (before/after/protected/break-day), inactive skip, clamping → all tested. ✓
- No placeholders: full code + concrete numbers. ✓
- Type consistency: uses `TaskTypeTag`/`EisenhowerQuadrant`/`Guardrail` from `@/types` and `SkeletonItem` from `engine-types.ts` (Plan 04). ✓
- Determinism: UTC date from `windowStart`; no clock reads. ✓
- Note: WLB dial + work-hour cap already implemented in `engine.ts:arbitrate` (Plan 04); not duplicated here.
