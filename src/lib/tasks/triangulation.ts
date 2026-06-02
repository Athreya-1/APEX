export type TriangulationChoice = 'shorter' | 'typical' | 'longer'

export const TRIANGULATION_MULTIPLIERS: Record<TriangulationChoice, number> = {
  shorter: 0.6,
  typical: 1.0,
  longer: 1.5,
}

export function multiplierFromChoice(choice: TriangulationChoice): number {
  return TRIANGULATION_MULTIPLIERS[choice]
}

export function choiceFromMultiplier(mult: number): TriangulationChoice {
  if (mult <= 0.75) return 'shorter'
  if (mult >= 1.25) return 'longer'
  return 'typical'
}

/** Apply triangulation to a base (prior/historical) estimate in hours. */
export function applyTriangulation(baseHours: number, choice: TriangulationChoice): number {
  return Math.round(baseHours * TRIANGULATION_MULTIPLIERS[choice] * 100) / 100
}
