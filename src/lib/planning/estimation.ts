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
