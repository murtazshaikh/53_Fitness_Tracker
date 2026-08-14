import { z } from 'zod'
import { fieldsFor } from './setKinds'
import type { ExerciseTypeWire, SetField, WorkoutDraft } from './types'

const draftSetSchema = z.object({
  type: z.enum(['warmup', 'normal', 'failure', 'dropset']),
  weightKg: z.number().min(0).nullable(),
  reps: z.number().int().min(0).nullable(),
  distanceMeters: z.number().min(0).nullable(),
  durationSeconds: z.number().int().min(0).nullable(),
  rpe: z.union([z.literal(6), z.literal(7), z.literal(7.5), z.literal(8),
                z.literal(8.5), z.literal(9), z.literal(9.5), z.literal(10)]).nullable(),
  completed: z.boolean(),
})

const draftExerciseSchema = z.object({
  exerciseTemplateId: z.string().min(1),
  notes: z.string().max(2000).nullable(),
  restSeconds: z.number().int().min(0).max(3600).nullable(),
  supersetId: z.number().int().nullable(),
  sets: z.array(draftSetSchema).max(50),
})

export const workoutDraftSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable(),
  exercises: z.array(draftExerciseSchema).max(50),
})

export function emptyDraft(title: string): WorkoutDraft {
  return { title, description: null, exercises: [] }
}

/** Which draft field backs each measurable field. */
const FIELD_TO_KEY: Record<SetField, 'weightKg' | 'reps' | 'distanceMeters' | 'durationSeconds'> = {
  weight: 'weightKg',
  reps: 'reps',
  distance: 'distanceMeters',
  duration: 'durationSeconds',
}

/**
 * Structural validity is not enough: a bench-press set must not carry a distance.
 * Only completed sets are checked, since incomplete ones are discarded on finish.
 */
export function validateAgainstTypes(
  draft: WorkoutDraft,
  types: Map<string, ExerciseTypeWire>,
): string[] {
  const errors: string[] = []

  draft.exercises.forEach((exercise, ei) => {
    const type = types.get(exercise.exerciseTemplateId)
    if (!type) {
      errors.push(`Exercise ${ei + 1}: unknown exercise template "${exercise.exerciseTemplateId}"`)
      return
    }

    const allowed = new Set(fieldsFor(type))

    exercise.sets.forEach((set, si) => {
      if (!set.completed) return
      for (const field of ['weight', 'reps', 'distance', 'duration'] as SetField[]) {
        const value = set[FIELD_TO_KEY[field]]
        if (value !== null && !allowed.has(field)) {
          errors.push(
            `Exercise ${ei + 1}, set ${si + 1}: ${field} is not valid for a ${type} exercise`,
          )
        }
      }
    })
  })

  return errors
}
