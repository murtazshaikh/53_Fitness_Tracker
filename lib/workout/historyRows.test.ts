import { describe, it, expect } from 'vitest'
import { toHistoryRow } from './historyRows'

const workout = {
  id: 'w1',
  title: 'Chest Day',
  startTime: new Date('2026-08-13T10:00:00Z'),
  endTime: new Date('2026-08-13T11:02:00Z'),
  exercises: [{
    sets: [
      { weightKg: 60, reps: 10, distanceMeters: null, durationSeconds: null },
      { weightKg: 65, reps: 8, distanceMeters: null, durationSeconds: null },
    ],
  }],
}

describe('toHistoryRow', () => {
  it('derives duration from start and end time', () => {
    expect(toHistoryRow(workout, 'metric').durationSeconds).toBe(3720)
  })

  it('summarises every set across every exercise', () => {
    const row = toHistoryRow(workout, 'metric')
    expect(row.summary.totalSets).toBe(2)
    expect(row.summary.volumeKg).toBe(60 * 10 + 65 * 8)
  })

  it('reports zero duration when endTime is missing', () => {
    expect(toHistoryRow({ ...workout, endTime: null }, 'metric').durationSeconds).toBe(0)
  })
})
