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
