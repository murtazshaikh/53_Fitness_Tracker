import { describe, it, expect } from 'vitest'
import { summarize } from './summary'
import type { MeasurableSet } from './types'

const set = (o: Partial<MeasurableSet>): MeasurableSet => ({
  weightKg: null, reps: null, distanceMeters: null, durationSeconds: null, ...o,
})

describe('summarize', () => {
  it('totals volume for a strength-only workout', () => {
    const s = summarize([
      set({ weightKg: 60, reps: 10 }),
      set({ weightKg: 65, reps: 8 }),
    ], 'metric')

    expect(s.totalSets).toBe(2)
    expect(s.volumeKg).toBe(60 * 10 + 65 * 8)
    expect(s.distanceMeters).toBeNull()
    expect(s.timeUnderTensionSeconds).toBeNull()
  })

  it('totals distance and time for a cardio-only workout', () => {
    const s = summarize([
      set({ distanceMeters: 5000, durationSeconds: 1695 }),
      set({ distanceMeters: 2000, durationSeconds: 570 }),
    ], 'metric')

    expect(s.distanceMeters).toBe(7000)
    expect(s.movingSeconds).toBe(2265)
    expect(s.volumeKg).toBeNull()
  })

  it('averages speed over totals, not over per-set speeds', () => {
    // 5 km in 1695s (~10.6 km/h) then 0.2 km in 45s (16 km/h).
    // Mean of per-set speeds would be ~13.3; the correct figure is total/total.
    const s = summarize([
      set({ distanceMeters: 5000, durationSeconds: 1695 }),
      set({ distanceMeters: 200, durationSeconds: 45 }),
    ], 'metric')

    const expected = (5200 / 1000) / (1740 / 3600)
    expect(s.avgSpeed).toBeCloseTo(expected, 6)
    expect(s.avgSpeed).toBeLessThan(13)
  })

  it('reports time under tension for duration-only sets', () => {
    const s = summarize([
      set({ durationSeconds: 60 }),
      set({ durationSeconds: 45 }),
    ], 'metric')

    expect(s.timeUnderTensionSeconds).toBe(105)
    expect(s.movingSeconds).toBeNull()
    expect(s.volumeKg).toBeNull()
  })

  it('reports each applicable stat for a mixed workout', () => {
    const s = summarize([
      set({ weightKg: 60, reps: 10 }),
      set({ distanceMeters: 5000, durationSeconds: 1695 }),
      set({ durationSeconds: 60 }),
    ], 'metric')

    expect(s.totalSets).toBe(3)
    expect(s.volumeKg).toBe(600)
    expect(s.distanceMeters).toBe(5000)
    expect(s.timeUnderTensionSeconds).toBe(60)
  })

  it('returns nulls rather than zeros when nothing qualifies', () => {
    const s = summarize([set({ reps: 12 })], 'metric')

    expect(s.totalSets).toBe(1)
    expect(s.volumeKg).toBeNull()
    expect(s.distanceMeters).toBeNull()
    expect(s.timeUnderTensionSeconds).toBeNull()
    expect(s.avgSpeed).toBeNull()
  })

  it('handles an empty workout', () => {
    const s = summarize([], 'metric')
    expect(s.totalSets).toBe(0)
    expect(s.volumeKg).toBeNull()
  })

  it('does not divide by zero when a distance set has zero duration', () => {
    const s = summarize([set({ distanceMeters: 1000, durationSeconds: 0 })], 'metric')
    expect(s.distanceMeters).toBe(1000)
    expect(s.avgSpeed).toBeNull()
  })
})
