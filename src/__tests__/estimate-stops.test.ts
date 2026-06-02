import { EST_STOPS, formatEstimateHours, hoursFromStopIndex, nearestStopIndex } from '@/lib/tasks/estimate-stops'

describe('estimate-stops', () => {
  it('formats hours and minutes', () => {
    expect(formatEstimateHours(0.5)).toBe('30m')
    expect(formatEstimateHours(3)).toBe('3h')
    expect(formatEstimateHours(3.5)).toBe('3.5h')
  })
  it('maps slider index to hours', () => {
    expect(hoursFromStopIndex(EST_STOPS.indexOf(13))).toBe(13)
  })
  it('finds nearest stop for a value', () => {
    expect(EST_STOPS[nearestStopIndex(12.8)]).toBe(13)
  })
})
