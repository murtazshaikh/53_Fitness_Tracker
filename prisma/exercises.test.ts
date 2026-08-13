import { describe, it, expect } from 'vitest'
import { SEED_EXERCISES } from './exercises'

const EXERCISE_TYPES = new Set([
  'WEIGHT_REPS', 'REPS_ONLY', 'BODYWEIGHT_REPS', 'BODYWEIGHT_ASSISTED_REPS',
  'DURATION', 'WEIGHT_DURATION', 'DISTANCE_DURATION', 'SHORT_DISTANCE_WEIGHT',
])

const MUSCLE_GROUPS = new Set([
  'ABDOMINALS', 'SHOULDERS', 'BICEPS', 'TRICEPS', 'FOREARMS', 'QUADRICEPS',
  'HAMSTRINGS', 'CALVES', 'GLUTES', 'ABDUCTORS', 'ADDUCTORS', 'LATS',
  'UPPER_BACK', 'TRAPS', 'LOWER_BACK', 'CHEST', 'CARDIO', 'NECK', 'FULL_BODY', 'OTHER',
])

const EQUIPMENT = new Set([
  'NONE', 'BARBELL', 'DUMBBELL', 'KETTLEBELL', 'MACHINE', 'PLATE',
  'RESISTANCE_BAND', 'SUSPENSION', 'OTHER',
])

describe('seed exercises', () => {
  it('ships a usable library', () => {
    expect(SEED_EXERCISES.length).toBeGreaterThanOrEqual(80)
  })

  it('has unique titles', () => {
    const titles = SEED_EXERCISES.map(e => e.title)
    expect(new Set(titles).size).toBe(titles.length)
  })

  it('uses only valid enum values', () => {
    for (const e of SEED_EXERCISES) {
      expect(EXERCISE_TYPES.has(e.type), `${e.title} type`).toBe(true)
      expect(MUSCLE_GROUPS.has(e.primaryMuscleGroup), `${e.title} primary`).toBe(true)
      expect(EQUIPMENT.has(e.equipmentCategory), `${e.title} equipment`).toBe(true)
      for (const s of e.secondaryMuscleGroups) {
        expect(MUSCLE_GROUPS.has(s), `${e.title} secondary`).toBe(true)
      }
    }
  })

  it('never repeats the primary muscle in the secondary list', () => {
    for (const e of SEED_EXERCISES) {
      expect(e.secondaryMuscleGroups, e.title).not.toContain(e.primaryMuscleGroup)
    }
  })

  it('covers every set kind the UI must render', () => {
    const types = new Set(SEED_EXERCISES.map(e => e.type))
    expect(types.has('WEIGHT_REPS')).toBe(true)
    expect(types.has('BODYWEIGHT_REPS')).toBe(true)
    expect(types.has('BODYWEIGHT_ASSISTED_REPS')).toBe(true)
    expect(types.has('DURATION')).toBe(true)
    expect(types.has('DISTANCE_DURATION')).toBe(true)
  })
})
