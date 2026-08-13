export type ExerciseTypeWire =
  | 'weight_reps'
  | 'reps_only'
  | 'bodyweight_reps'
  | 'bodyweight_assisted_reps'
  | 'duration'
  | 'weight_duration'
  | 'distance_duration'
  | 'short_distance_weight'

export type SetTypeWire = 'warmup' | 'normal' | 'failure' | 'dropset'

export type SetField = 'weight' | 'reps' | 'duration' | 'distance'

export type UnitSystemWire = 'metric' | 'imperial'

/** One set inside the draft blob. `completed` is draft-only and never persisted as a column. */
export type DraftSet = {
  type: SetTypeWire
  weightKg: number | null
  reps: number | null
  distanceMeters: number | null
  durationSeconds: number | null
  rpe: number | null
  completed: boolean
}

export type DraftExercise = {
  exerciseTemplateId: string
  notes: string | null
  restSeconds: number | null
  supersetId: number | null
  sets: DraftSet[]
}

export type WorkoutDraft = {
  title: string
  description: string | null
  exercises: DraftExercise[]
}

/** The subset of set fields the summary needs. Accepts drafts and DB rows alike. */
export interface MeasurableSet {
  weightKg: number | null
  reps: number | null
  distanceMeters: number | null
  durationSeconds: number | null
}
