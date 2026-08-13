import type { WorkoutDraft } from './types'

export interface NormalizedSet {
  index: number
  type: string
  weightKg: number | null
  reps: number | null
  distanceMeters: number | null
  durationSeconds: number | null
  rpe: number | null
}

export interface NormalizedExercise {
  exerciseTemplateId: string
  index: number
  notes: string | null
  restSeconds: number | null
  supersetId: number | null
  sets: NormalizedSet[]
}

/**
 * A finished workout records what was done, not what was planned: unticked sets are
 * dropped, exercises left empty are dropped with them, and indexes are assigned
 * afterwards so they stay contiguous from 0.
 */
export function normalizeDraft(draft: WorkoutDraft): NormalizedExercise[] {
  const rows: NormalizedExercise[] = []

  for (const exercise of draft.exercises) {
    const sets = exercise.sets
      .filter(s => s.completed)
      .map((s, index) => ({
        index,
        type: s.type.toUpperCase(),
        weightKg: s.weightKg,
        reps: s.reps,
        distanceMeters: s.distanceMeters,
        durationSeconds: s.durationSeconds,
        rpe: s.rpe,
      }))

    if (sets.length === 0) continue

    rows.push({
      exerciseTemplateId: exercise.exerciseTemplateId,
      index: rows.length,
      notes: exercise.notes,
      restSeconds: exercise.restSeconds,
      supersetId: exercise.supersetId,
      sets,
    })
  }

  return rows
}
