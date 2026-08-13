import { summarize, type WorkoutSummary } from './summary'
import type { MeasurableSet, UnitSystemWire } from './types'

type WorkoutLike = {
  id: string
  title: string
  startTime: Date
  endTime: Date | null
  exercises: { sets: MeasurableSet[] }[]
}

export type HistoryRow = {
  id: string
  title: string
  startTime: Date
  durationSeconds: number
  summary: WorkoutSummary
}

export function toHistoryRow(workout: WorkoutLike, system: UnitSystemWire): HistoryRow {
  const sets = workout.exercises.flatMap(e => e.sets)
  // Duration is derived, never stored — a stored copy could disagree with the timestamps.
  const durationSeconds = workout.endTime
    ? Math.round((workout.endTime.getTime() - workout.startTime.getTime()) / 1000)
    : 0

  return {
    id: workout.id,
    title: workout.title,
    startTime: workout.startTime,
    durationSeconds,
    summary: summarize(sets, system),
  }
}
