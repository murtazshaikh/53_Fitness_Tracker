import type { ExerciseTypeWire, SetField } from './types'

/**
 * Which measurable fields each exercise type uses. The eight types are just
 * combinations of four fields, so the set row renders from this table rather
 * than branching per type.
 */
const SET_FIELDS: Record<ExerciseTypeWire, readonly SetField[]> = {
  weight_reps: ['weight', 'reps'],
  reps_only: ['reps'],
  bodyweight_reps: ['reps'],
  bodyweight_assisted_reps: ['weight', 'reps'],
  duration: ['duration'],
  weight_duration: ['weight', 'duration'],
  distance_duration: ['distance', 'duration'],
  short_distance_weight: ['weight', 'distance'],
}

export function fieldsFor(type: ExerciseTypeWire): readonly SetField[] {
  return SET_FIELDS[type]
}

export function allowsField(type: ExerciseTypeWire, field: SetField): boolean {
  return SET_FIELDS[type].includes(field)
}

/** Assisted types use weight to *reduce* effort, so the UI labels it "assist" not "weight". */
export function isAssistedType(type: ExerciseTypeWire): boolean {
  return type === 'bodyweight_assisted_reps'
}
