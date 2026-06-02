# Plan 02 — Effort & Estimation Engine (pure)

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:test-driven-development`. Pure TypeScript, no DB, no network — fully unit-testable. Steps use checkbox (`- [ ]`). Do NOT modify the existing `effort.ts` (DB adapter) — create a new pure module; a later plan wires the DB layer to it.

**Goal:** A pure estimation core that turns priors + per-bucket history + course difficulty/velocity + triangulation into a **padded effort** `H` (estimate + k·stdev), with cold-start shrinkage so one data point can't overfit.

**Architecture:** One pure module `src/lib/planning/estimation.ts`. The DB layer (Plan 07/10) pre-fetches actuals and calls these functions; this module never touches Supabase. Determinism: no `Date.now()`.

**Tech Stack:** TypeScript 5, Jest 30.

---

### Task 1: Statistical helpers (EWMA mean/stdev, shrinkage blend, velocity update)

**Files:**
- Create: `apex/src/lib/planning/estimation.ts`
- Test: `apex/src/__tests__/estimation.test.ts`

- [ ] **Step 1: Write failing tests for the helpers**

```typescript
// apex/src/__tests__/estimation.test.ts
import {
  blendShrinkage, summarizeActuals, updateVelocityEWMA,
} from '@/lib/planning/estimation'

describe('blendShrinkage', () => {
  it('n=0 returns the prior unchanged', () => {
    expect(blendShrinkage(10, 4, 0)).toBeCloseTo(4)
  })
  it('large n approaches the learned value', () => {
    expect(blendShrinkage(10, 4, 100)).toBeCloseTo(9.83, 1)
  })
  it('n=k weights learned and prior equally (k=3)', () => {
    // n=3,k=3 -> 0.5*learned + 0.5*prior
    expect(blendShrinkage(10, 4, 3)).toBeCloseTo(7)
  })
})

describe('summarizeActuals', () => {
  it('empty list -> n=0, mean 0, stdev 0', () => {
    const s = summarizeActuals([])
    expect(s.n).toBe(0)
    expect(s.meanHours).toBe(0)
    expect(s.stdevHours).toBe(0)
  })
  it('single value -> mean=value, stdev 0', () => {
    const s = summarizeActuals([5])
    expect(s.meanHours).toBeCloseTo(5)
    expect(s.stdevHours).toBeCloseTo(0)
    expect(s.n).toBe(1)
  })
  it('EWMA mean weights the most recent (first) value more', () => {
    // newest-first: [10, 2, 2]; recency weighting pulls mean above the plain avg (4.67)
    const s = summarizeActuals([10, 2, 2])
    expect(s.meanHours).toBeGreaterThan(4.67)
    expect(s.n).toBe(3)
    expect(s.stdevHours).toBeGreaterThan(0)
  })
})

describe('updateVelocityEWMA', () => {
  it('first observation moves toward the ratio', () => {
    // prev=1.0, actual=6, est=4 -> ratio 1.5; alpha 0.3 -> 1.0*0.7 + 1.5*0.3 = 1.15
    expect(updateVelocityEWMA(1.0, 6, 4)).toBeCloseTo(1.15)
  })
  it('guards divide-by-zero (est=0 returns prev)', () => {
    expect(updateVelocityEWMA(1.2, 5, 0)).toBeCloseTo(1.2)
  })
})
```

- [ ] **Step 2: Run → fail** (`npx jest estimation --watchAll=false`) — module not found.

- [ ] **Step 3: Implement the helpers**

```typescript
// apex/src/lib/planning/estimation.ts
import type { PaddedEffort } from '@/types'

export const SHRINKAGE_K = 3          // prior weight in the blend
export const PAD_K = 0.5              // stdev multiplier for the planning pad
export const EWMA_ALPHA = 0.5         // recency weight for bucket history
export const VELOCITY_ALPHA = 0.3     // recency weight for course velocity

/** Shrinkage blend: pull a learned value toward a prior when samples are few. */
export function blendShrinkage(
  learned: number, prior: number, n: number, k: number = SHRINKAGE_K,
): number {
  if (n <= 0) return prior
  return (n / (n + k)) * learned + (k / (n + k)) * prior
}

export interface ActualsSummary {
  meanHours: number
  stdevHours: number
  n: number
}

/**
 * Summarize completed-actuals (newest first) with an EWMA mean (recency-weighted)
 * and a weighted standard deviation around that mean.
 */
export function summarizeActuals(
  actualsNewestFirst: number[], alpha: number = EWMA_ALPHA,
): ActualsSummary {
  const n = actualsNewestFirst.length
  if (n === 0) return { meanHours: 0, stdevHours: 0, n: 0 }
  if (n === 1) return { meanHours: actualsNewestFirst[0], stdevHours: 0, n: 1 }

  let wSum = 0, mean = 0
  actualsNewestFirst.forEach((v, i) => {
    const w = Math.pow(1 - alpha, i) // newest (i=0) heaviest
    wSum += w
    mean += w * v
  })
  mean /= wSum

  let varAcc = 0
  actualsNewestFirst.forEach((v, i) => {
    const w = Math.pow(1 - alpha, i)
    varAcc += w * (v - mean) ** 2
  })
  const stdev = Math.sqrt(varAcc / wSum)
  return { meanHours: mean, stdevHours: stdev, n }
}

/** EWMA update of per-course velocity = E_actual / E_estimated. */
export function updateVelocityEWMA(
  prev: number, eActual: number, eEstimated: number, alpha: number = VELOCITY_ALPHA,
): number {
  if (!eEstimated || eEstimated <= 0) return prev
  const ratio = eActual / eEstimated
  return prev * (1 - alpha) + ratio * alpha
}
```

- [ ] **Step 4: Run → pass.** Commit:

```bash
git add apex/src/lib/planning/estimation.ts apex/src/__tests__/estimation.test.ts
git commit -m "feat(estimation): EWMA summary, shrinkage blend, velocity update (pure)"
```

---

### Task 2: `computePaddedEffort` — the estimation hierarchy

**Files:**
- Modify: `apex/src/lib/planning/estimation.ts`
- Modify: `apex/src/__tests__/estimation.test.ts`

**Spec (hierarchy, all pure given pre-fetched stats):**
1. `adjustedPriorHours = (priorMinutes / 60) * courseDifficulty * triangulation`
2. If `bucket` (course+type) has `n > 0`: `estimate = blendShrinkage(bucket.meanHours, adjustedPriorHours, bucket.n)`, `stdev = bucket.stdevHours`, `n = bucket.n`, `source = 'bucket_history'`.
3. Else if `type` (global type) has `n > 0`: `learned = type.meanHours * courseVelocity`; `estimate = blendShrinkage(learned, adjustedPriorHours, type.n)`, `stdev = type.stdevHours`, `n = type.n`, `source = 'type_history'`.
4. Else (cold start): `estimate = adjustedPriorHours * courseVelocity`, `stdev = estimate * 0.5`, `n = 0`, `source = 'adjusted_prior'`.
5. `paddedHours = estimate + PAD_K * stdev`.
6. `confidence`: `n >= 5 → 'warm'`, `n >= 2 → 'warming'`, else `'cold'`.
7. Round `estimateHours`, `paddedHours`, `stdevHours` to 2 decimals. `exam` type with prior 0 stays 0.

- [ ] **Step 1: Write failing tests with concrete numbers**

```typescript
import { computePaddedEffort } from '@/lib/planning/estimation'

describe('computePaddedEffort', () => {
  const base = {
    priorMinutes: 150, courseDifficulty: 1, courseVelocity: 1,
    triangulation: 1, bucket: null, type: null,
  }
  it('cold start uses adjusted prior with a 50% pad', () => {
    const e = computePaddedEffort(base)
    expect(e.estimateHours).toBeCloseTo(2.5)        // 150/60
    expect(e.stdevHours).toBeCloseTo(1.25)          // 2.5*0.5
    expect(e.paddedHours).toBeCloseTo(3.13, 1)      // 2.5 + 0.5*1.25
    expect(e.source).toBe('adjusted_prior')
    expect(e.confidence).toBe('cold')
    expect(e.sampleSize).toBe(0)
  })
  it('course difficulty and triangulation scale the prior', () => {
    const e = computePaddedEffort({ ...base, courseDifficulty: 1.3, triangulation: 1.5 })
    expect(e.estimateHours).toBeCloseTo(4.88, 1)    // 2.5*1.3*1.5
  })
  it('bucket history blends toward learned with shrinkage', () => {
    const e = computePaddedEffort({ ...base, bucket: { meanHours: 5, stdevHours: 0.8, n: 3 } })
    // blend(5, 2.5, 3) = 0.5*5 + 0.5*2.5 = 3.75
    expect(e.estimateHours).toBeCloseTo(3.75)
    expect(e.source).toBe('bucket_history')
    expect(e.confidence).toBe('warming')
    expect(e.paddedHours).toBeCloseTo(4.15, 1)      // 3.75 + 0.5*0.8
  })
  it('warm bucket (n>=5) reports warm confidence and tracks learned closely', () => {
    const e = computePaddedEffort({ ...base, bucket: { meanHours: 5, stdevHours: 1, n: 12 } })
    expect(e.confidence).toBe('warm')
    expect(e.estimateHours).toBeGreaterThan(4.3)    // blend(5,2.5,12) = 4.5
  })
  it('type history applies course velocity', () => {
    const e = computePaddedEffort({ ...base, courseVelocity: 1.4, type: { meanHours: 3, stdevHours: 0.5, n: 4 } })
    // learned = 3*1.4 = 4.2 ; blend(4.2, 2.5, 4) with k=3 -> (4/7)*4.2 + (3/7)*2.5 = 3.47
    expect(e.estimateHours).toBeCloseTo(3.47, 1)
    expect(e.source).toBe('type_history')
  })
  it('exam with zero prior and no history stays zero', () => {
    const e = computePaddedEffort({ ...base, priorMinutes: 0 })
    expect(e.estimateHours).toBe(0)
    expect(e.paddedHours).toBe(0)
  })
})
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement `computePaddedEffort`**

```typescript
export interface EffortInput {
  priorMinutes: number            // base prior for the (type) from task_priors
  courseDifficulty: number        // default 1.0
  courseVelocity: number          // default 1.0 (EWMA)
  triangulation: number           // default 1.0 (0.6 / 1.0 / 1.5)
  bucket: ActualsSummary | null   // course+type history
  type: ActualsSummary | null     // global type history
}

function round2(x: number): number { return Math.round(x * 100) / 100 }

export function computePaddedEffort(input: EffortInput): PaddedEffort {
  const { priorMinutes, courseDifficulty, courseVelocity, triangulation, bucket, type } = input
  const adjustedPrior = (priorMinutes / 60) * courseDifficulty * triangulation

  let estimate: number, stdev: number, n: number, source: PaddedEffort['source']

  if (bucket && bucket.n > 0) {
    estimate = blendShrinkage(bucket.meanHours, adjustedPrior, bucket.n)
    stdev = bucket.stdevHours
    n = bucket.n
    source = 'bucket_history'
  } else if (type && type.n > 0) {
    const learned = type.meanHours * courseVelocity
    estimate = blendShrinkage(learned, adjustedPrior, type.n)
    stdev = type.stdevHours
    n = type.n
    source = 'type_history'
  } else {
    estimate = adjustedPrior * courseVelocity
    stdev = estimate * 0.5
    n = 0
    source = 'adjusted_prior'
  }

  const paddedHours = estimate + PAD_K * stdev
  const confidence: PaddedEffort['confidence'] = n >= 5 ? 'warm' : n >= 2 ? 'warming' : 'cold'

  return {
    estimateHours: round2(estimate),
    paddedHours: round2(paddedHours),
    stdevHours: round2(stdev),
    sampleSize: n,
    source,
    confidence,
  }
}
```

- [ ] **Step 4: Run → pass.** Run full suite (`npm test -- --watchAll=false`) — Expected: all green (nothing else touched).

- [ ] **Step 5: Commit**

```bash
git add apex/src/lib/planning/estimation.ts apex/src/__tests__/estimation.test.ts
git commit -m "feat(estimation): computePaddedEffort hierarchy (prior -> shrinkage blend -> pad)"
```

---

## Self-review checklist
- Spec coverage: priors, course difficulty/velocity, triangulation, bucket vs type history, shrinkage, variance pad, cold-start, confidence tiers → all tested. ✓
- No placeholders: all formulas + test numbers concrete. ✓
- Type consistency: returns `PaddedEffort` exactly as defined in `types/index.ts` (Plan 01). `ActualsSummary` is the shared history-stats shape used by the DB layer in Plan 07/10. ✓
- Determinism: no clock reads; the DB layer passes pre-fetched stats. ✓
