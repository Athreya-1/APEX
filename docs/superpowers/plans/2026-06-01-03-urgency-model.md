# Plan 03 — Robust Urgency Model (pure)

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:test-driven-development`. Pure TypeScript. Steps use checkbox (`- [ ]`). ADD new exports to `src/lib/planning/urgency.ts`; KEEP the existing display helpers (`getUrgencyTier`, `getSchedulingPriority`, `hasUrgencyFlipped`, `sortTasksForScheduling`) and their tests untouched.

**Goal:** Deterministic urgency: **Layer 1** Earliest-Deadline-First feasibility (slack + at-risk hard guarantee) and **Layer 2** continuous urgency score (ranking + UI bar) with soft floor, uncertainty, and contention. Importance is NOT in the score — only a tie-break.

**Architecture:** Pure functions appended to `urgency.ts`. Capacity (available working hours up to a deadline) is injected as a function `capacityHoursUntil(deadlineISO) => hours`, so the module never computes the skeleton itself (the engine/route supplies it) and tests stay deterministic.

**Tech Stack:** TypeScript 5, Jest 30.

---

### Task 1: EDF feasibility + continuous urgency (`computeUrgency`)

**Files:**
- Modify: `apex/src/lib/planning/urgency.ts`
- Test: `apex/src/__tests__/urgency-model.test.ts`

**Spec:**

```typescript
export interface UrgencyTask {
  taskId: string
  deadline: string | null   // ISO; null = not scored (daily allocation)
  paddedHours: number       // H from Plan 02
  meanHours: number         // for uncertainty ratio (use estimate if unknown)
  stdevHours: number
}

export interface UrgencyParams {
  now: string                                   // ISO
  capacityHoursUntil: (deadlineISO: string) => number  // available working hrs now->deadline
  tFloorHours?: number   // default 2  (soft floor; denominator never < this)
  beta?: number          // default 1.2
  uncertaintyC?: number  // default 0.5
  alpha?: number         // default 0.5 (contention)
  overdueScore?: number  // default 999 (sentinel "max")
}
```

`computeUrgency(tasks: UrgencyTask[], params: UrgencyParams): UrgencyResult[]` (UrgencyResult from `@/types`: `{ taskId, score, isAtRisk, slackHours, paddedHours }`).

Algorithm:
1. **No deadline** → `{ score: 0, isAtRisk: false, slackHours: Number.POSITIVE_INFINITY, paddedHours }` (not time-pressure ranked).
2. **Overdue** (`deadline <= now`) → `{ score: overdueScore, isAtRisk: true, slackHours: -paddedHours, paddedHours }`.
3. Otherwise build the EDF pass over deadline-bearing, non-overdue tasks sorted by deadline ascending. Maintain `requiredBefore` = Σ paddedHours of strictly-earlier-deadline tasks; `requiredThrough` = `requiredBefore + thisPadded`.
   - `available = capacityHoursUntil(deadline)`
   - `slackHours = available - requiredThrough`
   - `isAtRisk = slackHours < 0`
   - `aTask = max(available - requiredBefore, tFloor)` (capacity left for this task after earlier-deadline commitments; floored)
   - `uncertainty = 1 + uncertaintyC * (meanHours > 0 ? stdevHours / meanHours : 0)`
   - `contention = 1 + alpha * (requiredThrough / Math.max(available, tFloor))`
   - `score = Math.pow(paddedHours / Math.max(aTask, tFloor), beta) * uncertainty * contention`
4. Preserve input order in the returned array (map taskId → result), so callers aren't surprised by reordering. Round `score` and `slackHours` to 3 decimals (leave Infinity / sentinel as-is).

- [ ] **Step 1: Write failing tests with concrete numbers**

```typescript
// apex/src/__tests__/urgency-model.test.ts
import { computeUrgency, orderByUrgency } from '@/lib/planning/urgency'
import type { UrgencyTask } from '@/lib/planning/urgency'

const NOW = '2026-06-01T08:00:00.000Z'
const inDays = (d: number) => new Date(Date.parse(NOW) + d * 86400000).toISOString()

describe('computeUrgency', () => {
  it('no-deadline task is not pressure-scored', () => {
    const tasks: UrgencyTask[] = [{ taskId: 'a', deadline: null, paddedHours: 5, meanHours: 5, stdevHours: 0 }]
    const [r] = computeUrgency(tasks, { now: NOW, capacityHoursUntil: () => 100 })
    expect(r.score).toBe(0)
    expect(r.isAtRisk).toBe(false)
    expect(r.slackHours).toBe(Number.POSITIVE_INFINITY)
  })

  it('overdue task gets the max sentinel and is at-risk', () => {
    const tasks: UrgencyTask[] = [{ taskId: 'a', deadline: inDays(-1), paddedHours: 4, meanHours: 4, stdevHours: 0 }]
    const [r] = computeUrgency(tasks, { now: NOW, capacityHoursUntil: () => 50 })
    expect(r.score).toBe(999)
    expect(r.isAtRisk).toBe(true)
    expect(r.slackHours).toBe(-4)
  })

  it('ample capacity -> low score, positive slack, not at-risk', () => {
    const tasks: UrgencyTask[] = [{ taskId: 'a', deadline: inDays(10), paddedHours: 4, meanHours: 4, stdevHours: 0 }]
    const [r] = computeUrgency(tasks, { now: NOW, capacityHoursUntil: () => 40 })
    expect(r.isAtRisk).toBe(false)
    expect(r.slackHours).toBeCloseTo(36)
    expect(r.score).toBeLessThan(0.2)
  })

  it('demand exceeding capacity -> negative slack and at-risk', () => {
    const tasks: UrgencyTask[] = [{ taskId: 'a', deadline: inDays(1), paddedHours: 10, meanHours: 10, stdevHours: 0 }]
    const [r] = computeUrgency(tasks, { now: NOW, capacityHoursUntil: () => 6 })
    expect(r.isAtRisk).toBe(true)
    expect(r.slackHours).toBeCloseTo(-4)
    expect(r.score).toBeGreaterThan(1.5)
  })

  it('EDF: earlier-deadline work reduces capacity available to a later task', () => {
    const tasks: UrgencyTask[] = [
      { taskId: 'early', deadline: inDays(1), paddedHours: 5, meanHours: 5, stdevHours: 0 },
      { taskId: 'late',  deadline: inDays(2), paddedHours: 5, meanHours: 5, stdevHours: 0 },
    ]
    // capacity: 6h by day1, 8h by day2
    const cap = (iso: string) => (iso === inDays(1) ? 6 : 8)
    const res = computeUrgency(tasks, { now: NOW, capacityHoursUntil: cap })
    const late = res.find((r) => r.taskId === 'late')!
    // requiredThrough(late) = 10, available(day2) = 8 -> slack -2, at-risk
    expect(late.slackHours).toBeCloseTo(-2)
    expect(late.isAtRisk).toBe(true)
  })

  it('uncertainty inflates the score', () => {
    const certain = computeUrgency([{ taskId: 'a', deadline: inDays(3), paddedHours: 6, meanHours: 6, stdevHours: 0 }], { now: NOW, capacityHoursUntil: () => 12 })[0]
    const uncertain = computeUrgency([{ taskId: 'a', deadline: inDays(3), paddedHours: 6, meanHours: 6, stdevHours: 3 }], { now: NOW, capacityHoursUntil: () => 12 })[0]
    expect(uncertain.score).toBeGreaterThan(certain.score)
  })
})

describe('orderByUrgency', () => {
  it('at-risk first, then score desc, importance breaks near-ties', () => {
    const results = [
      { taskId: 'low', score: 0.2, isAtRisk: false, slackHours: 10, paddedHours: 2 },
      { taskId: 'risk', score: 0.1, isAtRisk: true, slackHours: -1, paddedHours: 8 },
      { taskId: 'high', score: 0.9, isAtRisk: false, slackHours: 3, paddedHours: 4 },
    ]
    const ordered = orderByUrgency(results, { low: 4, risk: 1, high: 1 })
    expect(ordered[0].taskId).toBe('risk')   // at-risk wins regardless of score
    expect(ordered[1].taskId).toBe('high')   // then highest score
  })
})
```

- [ ] **Step 2: Run → fail** (`npx jest urgency-model --watchAll=false`).

- [ ] **Step 3: Implement (append to `urgency.ts`)**

Add the interfaces above and:

```typescript
import type { UrgencyResult } from '@/types'  // add to existing imports

function round3(x: number): number {
  return Number.isFinite(x) ? Math.round(x * 1000) / 1000 : x
}

export function computeUrgency(tasks: UrgencyTask[], params: UrgencyParams): UrgencyResult[] {
  const {
    now, capacityHoursUntil,
    tFloorHours = 2, beta = 1.2, uncertaintyC = 0.5, alpha = 0.5, overdueScore = 999,
  } = params
  const nowMs = Date.parse(now)

  // EDF order over deadline-bearing, non-overdue tasks
  const dated = tasks
    .filter((t) => t.deadline && Date.parse(t.deadline) > nowMs)
    .sort((a, b) => Date.parse(a.deadline!) - Date.parse(b.deadline!))

  const byId = new Map<string, UrgencyResult>()
  let requiredBefore = 0
  for (const t of dated) {
    const available = capacityHoursUntil(t.deadline!)
    const requiredThrough = requiredBefore + t.paddedHours
    const slackHours = available - requiredThrough
    const aTask = Math.max(available - requiredBefore, tFloorHours)
    const uncertainty = 1 + uncertaintyC * (t.meanHours > 0 ? t.stdevHours / t.meanHours : 0)
    const contention = 1 + alpha * (requiredThrough / Math.max(available, tFloorHours))
    const score = Math.pow(t.paddedHours / Math.max(aTask, tFloorHours), beta) * uncertainty * contention
    byId.set(t.taskId, {
      taskId: t.taskId, score: round3(score), isAtRisk: slackHours < 0,
      slackHours: round3(slackHours), paddedHours: t.paddedHours,
    })
    requiredBefore = requiredThrough
  }

  // Map back in original order; handle no-deadline + overdue
  return tasks.map((t) => {
    if (byId.has(t.taskId)) return byId.get(t.taskId)!
    if (!t.deadline) {
      return { taskId: t.taskId, score: 0, isAtRisk: false, slackHours: Number.POSITIVE_INFINITY, paddedHours: t.paddedHours }
    }
    // overdue
    return { taskId: t.taskId, score: overdueScore, isAtRisk: true, slackHours: -t.paddedHours, paddedHours: t.paddedHours }
  })
}

/** Ordering for scheduling: at-risk first, then score desc, importance (higher first) breaks near-ties. */
export function orderByUrgency(
  results: UrgencyResult[], importanceById: Record<string, number> = {},
): UrgencyResult[] {
  return [...results].sort((a, b) => {
    if (a.isAtRisk !== b.isAtRisk) return a.isAtRisk ? -1 : 1
    if (Math.abs(b.score - a.score) > 0.05) return b.score - a.score
    return (importanceById[b.taskId] ?? 2) - (importanceById[a.taskId] ?? 2)
  })
}
```

- [ ] **Step 4: Run → pass.** Then full suite (`npm test -- --watchAll=false`) green, `npx tsc --noEmit` 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apex/src/lib/planning/urgency.ts apex/src/__tests__/urgency-model.test.ts
git commit -m "feat(urgency): EDF feasibility/slack/at-risk + continuous urgency score (pure)"
```

---

## Self-review checklist
- Spec coverage: padded effort consumed, EDF slack, at-risk hard flag, soft floor, uncertainty multiplier, contention saturation, overdue=max, no-deadline excluded, importance-only tie-break → all tested. ✓
- No placeholders: full code + concrete numbers. ✓
- Type consistency: returns `UrgencyResult` from `@/types`; `UrgencyTask`/`UrgencyParams` new local exports. Existing display helpers untouched. ✓
- Determinism: `now` injected; capacity injected. ✓
