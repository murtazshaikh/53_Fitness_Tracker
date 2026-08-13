import { describe, it, expect } from 'vitest'
import {
  kgToDisplay, displayToKg, metersToDisplay, displayToMeters,
  speedFrom, weightUnit, distanceUnit, speedUnit, formatDuration,
} from './units'

describe('weight conversion', () => {
  it('is identity under metric', () => {
    expect(kgToDisplay(60, 'metric')).toBe(60)
    expect(displayToKg(60, 'metric')).toBe(60)
  })

  it('converts to pounds under imperial', () => {
    expect(kgToDisplay(100, 'imperial')).toBeCloseTo(220.462, 2)
    expect(displayToKg(220.462, 'imperial')).toBeCloseTo(100, 3)
  })

  it('round-trips without drift', () => {
    expect(displayToKg(kgToDisplay(72.5, 'imperial'), 'imperial')).toBeCloseTo(72.5, 6)
  })
})

describe('distance conversion', () => {
  it('shows kilometres under metric', () => {
    expect(metersToDisplay(5000, 'metric')).toBe(5)
    expect(displayToMeters(5, 'metric')).toBe(5000)
  })

  it('shows miles under imperial', () => {
    expect(metersToDisplay(1609.344, 'imperial')).toBeCloseTo(1, 6)
    expect(displayToMeters(1, 'imperial')).toBeCloseTo(1609.344, 3)
  })
})

describe('speedFrom', () => {
  it('derives km/h from metres and seconds', () => {
    // 5 km in 28:15 (1695s) = 10.619... km/h
    expect(speedFrom(5000, 1695, 'metric')).toBeCloseTo(10.619, 2)
  })

  it('derives mph under imperial', () => {
    expect(speedFrom(1609.344, 3600, 'imperial')).toBeCloseTo(1, 4)
  })

  it('returns null when duration is zero, rather than dividing by zero', () => {
    expect(speedFrom(5000, 0, 'metric')).toBeNull()
  })

  it('returns null when either input is missing', () => {
    expect(speedFrom(null, 100, 'metric')).toBeNull()
    expect(speedFrom(5000, null, 'metric')).toBeNull()
  })
})

describe('unit labels', () => {
  it('names units per system', () => {
    expect(weightUnit('metric')).toBe('kg')
    expect(weightUnit('imperial')).toBe('lb')
    expect(distanceUnit('metric')).toBe('km')
    expect(distanceUnit('imperial')).toBe('mi')
    expect(speedUnit('metric')).toBe('km/h')
    expect(speedUnit('imperial')).toBe('mph')
  })
})

describe('formatDuration', () => {
  it('formats under an hour as m:ss', () => {
    expect(formatDuration(1695)).toBe('28:15')
    expect(formatDuration(65)).toBe('1:05')
    expect(formatDuration(0)).toBe('0:00')
  })

  it('formats an hour or more as h:mm:ss', () => {
    expect(formatDuration(3661)).toBe('1:01:01')
  })
})
