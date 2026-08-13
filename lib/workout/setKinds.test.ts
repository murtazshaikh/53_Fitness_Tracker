import { describe, it, expect } from 'vitest'
import { fieldsFor, allowsField, isAssistedType } from './setKinds'
import type { ExerciseTypeWire } from './types'

describe('fieldsFor', () => {
  it('maps each exercise type to its measurable fields', () => {
    expect(fieldsFor('weight_reps')).toEqual(['weight', 'reps'])
    expect(fieldsFor('reps_only')).toEqual(['reps'])
    expect(fieldsFor('bodyweight_reps')).toEqual(['reps'])
    expect(fieldsFor('bodyweight_assisted_reps')).toEqual(['weight', 'reps'])
    expect(fieldsFor('duration')).toEqual(['duration'])
    expect(fieldsFor('weight_duration')).toEqual(['weight', 'duration'])
    expect(fieldsFor('distance_duration')).toEqual(['distance', 'duration'])
    expect(fieldsFor('short_distance_weight')).toEqual(['weight', 'distance'])
  })

  it('covers every exercise type', () => {
    const all: ExerciseTypeWire[] = [
      'weight_reps', 'reps_only', 'bodyweight_reps', 'bodyweight_assisted_reps',
      'duration', 'weight_duration', 'distance_duration', 'short_distance_weight',
    ]
    for (const t of all) {
      expect(fieldsFor(t).length).toBeGreaterThan(0)
    }
  })
})

describe('allowsField', () => {
  it('is true only for fields the type uses', () => {
    expect(allowsField('weight_reps', 'weight')).toBe(true)
    expect(allowsField('weight_reps', 'distance')).toBe(false)
    expect(allowsField('duration', 'duration')).toBe(true)
    expect(allowsField('duration', 'reps')).toBe(false)
  })
})

describe('isAssistedType', () => {
  it('flags assisted bodyweight, where weight reduces effort', () => {
    expect(isAssistedType('bodyweight_assisted_reps')).toBe(true)
    expect(isAssistedType('weight_reps')).toBe(false)
  })
})
