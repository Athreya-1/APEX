import {
  blendShrinkage, summarizeActuals, updateVelocityEWMA, computePaddedEffort,
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
