import { applyTriangulation, multiplierFromChoice, choiceFromMultiplier } from '@/lib/tasks/triangulation'

describe('triangulation', () => {
  it('applies shorter/typical/longer multipliers', () => {
    expect(applyTriangulation(4, 'shorter')).toBe(2.4)
    expect(applyTriangulation(4, 'typical')).toBe(4)
    expect(applyTriangulation(4, 'longer')).toBe(6)
  })
  it('round-trips choice from multiplier', () => {
    expect(choiceFromMultiplier(0.6)).toBe('shorter')
    expect(choiceFromMultiplier(1)).toBe('typical')
    expect(choiceFromMultiplier(1.5)).toBe('longer')
    expect(multiplierFromChoice('longer')).toBe(1.5)
  })
})
