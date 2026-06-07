import { buildEnergyWindow, minutesFromWindowStart } from '@/lib/planning/energy-window'

const WAKE = '2026-06-01T08:00:00.000Z'

describe('energy-window', () => {
  it('computes peak offsets from HH:MM prefs relative to wake', () => {
    const win = buildEnergyWindow(WAKE, '09:00', '12:00')
    expect(win.peakStartMins).toBe(60)
    expect(win.peakEndMins).toBe(240)
    expect(win.troughStartMins).toBe(300)
    expect(win.troughEndMins).toBe(480)
  })

  it('normalizes inverted start/end', () => {
    const win = buildEnergyWindow(WAKE, '15:00', '13:00')
    expect(win.peakStartMins).toBe(300)
    expect(win.peakEndMins).toBe(420)
  })

  it('minutesFromWindowStart matches plan-day times', () => {
    expect(minutesFromWindowStart(WAKE, '10:30')).toBe(150)
  })
})
