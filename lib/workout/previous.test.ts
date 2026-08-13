import { describe, it, expect } from 'vitest'
import { previousBySetIndex, type HistoryEntry } from './previous'

const entry = (o: Partial<HistoryEntry>): HistoryEntry => ({
  workout_start_time: '2026-08-10T10:00:00Z',
  weight_kg: null, reps: null, distance_meters: null, duration_seconds: null, ...o,
})

describe('previousBySetIndex', () => {
  it('formats weight and reps per set', () => {
    const rows = previousBySetIndex([
      entry({ weight_kg: 60, reps: 10 }),
      entry({ weight_kg: 65, reps: 8 }),
    ], 'metric')

    expect(rows).toEqual(['60 × 10', '65 × 8'])
  })

  it('uses only the most recent session, not every past set', () => {
    const rows = previousBySetIndex([
      entry({ workout_start_time: '2026-08-10T10:00:00Z', weight_kg: 70, reps: 8 }),
      entry({ workout_start_time: '2026-08-01T10:00:00Z', weight_kg: 60, reps: 10 }),
      entry({ workout_start_time: '2026-08-01T10:00:00Z', weight_kg: 60, reps: 9 }),
    ], 'metric')

    expect(rows).toEqual(['70 × 8'])
  })

  it('formats cardio as distance and time', () => {
    const rows = previousBySetIndex([
      entry({ distance_meters: 5000, duration_seconds: 1695 }),
    ], 'metric')

    expect(rows).toEqual(['5.00 km / 28:15'])
  })

  it('formats duration-only sets', () => {
    expect(previousBySetIndex([entry({ duration_seconds: 60 })], 'metric')).toEqual(['1:00'])
  })

  it('formats reps-only sets', () => {
    expect(previousBySetIndex([entry({ reps: 12 })], 'metric')).toEqual(['12'])
  })

  it('converts to imperial when asked', () => {
    const rows = previousBySetIndex([entry({ weight_kg: 100, reps: 5 })], 'imperial')
    expect(rows[0]).toMatch(/220\.5 × 5/)
  })

  it('returns an empty list when the exercise has never been done', () => {
    expect(previousBySetIndex([], 'metric')).toEqual([])
  })
})
