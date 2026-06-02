/** Non-linear estimate slider stops (hours). Max single focus block ≈ 7h practical cap at 16. */
export const EST_STOPS: readonly number[] = [
  0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6,
  7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 24,
]

export const DEFAULT_EST_STOP_INDEX = EST_STOPS.indexOf(3)

export function formatEstimateHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`
  return hours % 1 === 0 ? `${hours}h` : `${hours.toFixed(1)}h`
}

export function nearestStopIndex(hours: number): number {
  let best = 0
  let bestDiff = Infinity
  EST_STOPS.forEach((s, i) => {
    const d = Math.abs(s - hours)
    if (d < bestDiff) { bestDiff = d; best = i }
  })
  return best
}

export function hoursFromStopIndex(index: number): number {
  return EST_STOPS[Math.max(0, Math.min(index, EST_STOPS.length - 1))]
}
