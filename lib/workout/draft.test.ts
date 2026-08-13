import { describe, it, expect } from 'vitest'
import { workoutDraftSchema, emptyDraft, validateAgainstTypes } from './draft'
import type { WorkoutDraft, ExerciseTypeWire } from './types'

const draftWith = (sets: unknown[]): unknown => ({
  title: 'Chest',
  description: null,
  exercises: [
    { exerciseTemplateId: 'tpl1', notes: null, restSeconds: null, supersetId: null, sets },
  ],
})

describe('workoutDraftSchema', () => {
  it('accepts a well-formed draft', () => {
    const parsed = workoutDraftSchema.safeParse(draftWith([
      { type: 'normal', weightKg: 60, reps: 10, distanceMeters: null, durationSeconds: null, rpe: null, completed: true },
    ]))
    expect(parsed.success).toBe(true)
  })

  it('rejects an unknown set type', () => {
    const parsed = workoutDraftSchema.safeParse(draftWith([
      { type: 'superset', weightKg: 60, reps: 10, distanceMeters: null, durationSeconds: null, rpe: null, completed: true },
    ]))
    expect(parsed.success).toBe(false)
  })

  it('rejects negative weight', () => {
    const parsed = workoutDraftSchema.safeParse(draftWith([
      { type: 'normal', weightKg: -5, reps: 10, distanceMeters: null, durationSeconds: null, rpe: null, completed: true },
    ]))
    expect(parsed.success).toBe(false)
  })

  it('rejects an rpe outside the allowed scale', () => {
    const parsed = workoutDraftSchema.safeParse(draftWith([
      { type: 'normal', weightKg: 60, reps: 10, distanceMeters: null, durationSeconds: null, rpe: 7.2, completed: true },
    ]))
    expect(parsed.success).toBe(false)
  })

  it('accepts a valid rpe', () => {
    const parsed = workoutDraftSchema.safeParse(draftWith([
      { type: 'normal', weightKg: 60, reps: 10, distanceMeters: null, durationSeconds: null, rpe: 8.5, completed: true },
    ]))
    expect(parsed.success).toBe(true)
  })

  it('rejects fractional reps', () => {
    const parsed = workoutDraftSchema.safeParse(draftWith([
      { type: 'normal', weightKg: 60, reps: 10.5, distanceMeters: null, durationSeconds: null, rpe: null, completed: true },
    ]))
    expect(parsed.success).toBe(false)
  })
})

describe('emptyDraft', () => {
  it('starts with a title and no exercises', () => {
    const d = emptyDraft('Morning Workout')
    expect(d.title).toBe('Morning Workout')
    expect(d.exercises).toEqual([])
    expect(workoutDraftSchema.safeParse(d).success).toBe(true)
  })
})

describe('validateAgainstTypes', () => {
  const types = new Map<string, ExerciseTypeWire>([
    ['bench', 'weight_reps'],
    ['treadmill', 'distance_duration'],
  ])

  const draft = (templateId: string, set: Record<string, unknown>): WorkoutDraft => ({
    title: 'T',
    description: null,
    exercises: [{
      exerciseTemplateId: templateId,
      notes: null,
      restSeconds: null,
      supersetId: null,
      sets: [{
        type: 'normal', weightKg: null, reps: null, distanceMeters: null,
        durationSeconds: null, rpe: null, completed: true, ...set,
      } as never],
    }],
  })

  it('passes when populated fields match the exercise type', () => {
    expect(validateAgainstTypes(draft('bench', { weightKg: 60, reps: 10 }), types)).toEqual([])
    expect(validateAgainstTypes(draft('treadmill', { distanceMeters: 5000, durationSeconds: 1695 }), types)).toEqual([])
  })

  it('rejects a field the exercise type does not use', () => {
    const errors = validateAgainstTypes(draft('bench', { weightKg: 60, reps: 10, distanceMeters: 5000 }), types)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('distance')
  })

  it('rejects an unknown exercise template', () => {
    const errors = validateAgainstTypes(draft('ghost', { reps: 10 }), types)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('ghost')
  })

  it('ignores incomplete sets, which are discarded on finish anyway', () => {
    const d = draft('bench', { weightKg: 60, reps: 10, distanceMeters: 5000 })
    d.exercises[0].sets[0].completed = false
    expect(validateAgainstTypes(d, types)).toEqual([])
  })
})
