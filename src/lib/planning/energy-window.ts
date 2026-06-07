import type { EnergyWindow } from './engine-types'

function atPlanTime(planDate: string, hhmm: string): string {
  const [h, m] = hhmm.split(':')
  return `${planDate}T${h.padStart(2, '0')}:${m.padStart(2, '0')}:00.000Z`
}

export function minutesFromWindowStart(windowStartISO: string, hhmm: string): number {
  const planDate = windowStartISO.slice(0, 10)
  return (Date.parse(atPlanTime(planDate, hhmm)) - Date.parse(windowStartISO)) / 60000
}

/** Build peak/trough zones from user prefs relative to the plan day window start (wake). */
export function buildEnergyWindow(
  windowStartISO: string,
  peakStart = '09:00',
  peakEnd = '12:00',
): EnergyWindow {
  const peakStartMins = minutesFromWindowStart(windowStartISO, peakStart)
  const peakEndMins = minutesFromWindowStart(windowStartISO, peakEnd)
  const ps = Math.min(peakStartMins, peakEndMins)
  const pe = Math.max(peakStartMins, peakEndMins)
  return {
    peakStartMins: ps,
    peakEndMins: pe,
    troughStartMins: pe + 60,
    troughEndMins: pe + 240,
  }
}
