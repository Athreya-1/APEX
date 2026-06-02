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
