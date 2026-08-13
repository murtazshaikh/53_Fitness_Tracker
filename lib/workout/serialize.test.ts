import { describe, it, expect } from 'vitest'
import { enumToWire, enumFromWire, setToWire, setFromWire } from './serialize'
import type { DraftSet } from './types'

describe('enum casing', () => {
  it('lowercases Prisma enums for the wire', () => {
    expect(enumToWire('WEIGHT_REPS')).toBe('weight_reps')
    expect(enumToWire('DROPSET')).toBe('dropset')
    expect(enumToWire('UPPER_BACK')).toBe('upper_back')
  })

  it('uppercases wire values for Prisma', () => {
    expect(enumFromWire('weight_reps')).toBe('WEIGHT_REPS')
    expect(enumFromWire('dropset')).toBe('DROPSET')
    expect(enumFromWire('upper_back')).toBe('UPPER_BACK')
  })

  it('round-trips', () => {
    for (const v of ['WEIGHT_REPS', 'NONE', 'RESISTANCE_BAND', 'FULL_BODY']) {
      expect(enumFromWire(enumToWire(v))).toBe(v)
    }
  })
})

describe('set serialization', () => {
  it('maps camelCase fields to snake_case on the wire', () => {
    const wire = setToWire({
      index: 0,
      type: 'NORMAL',
      weightKg: 60,
      reps: 10,
      distanceMeters: null,
      durationSeconds: null,
      rpe: 8.5,
      customMetric: null,
    })

    expect(wire).toEqual({
      index: 0,
      type: 'normal',
      weight_kg: 60,
      reps: 10,
      distance_meters: null,
      duration_seconds: null,
      rpe: 8.5,
      custom_metric: null,
    })
  })

  it('reads a wire set back into draft shape, defaulting completed to false', () => {
    const draft: DraftSet = setFromWire({
      index: 0,
      type: 'dropset',
      weight_kg: 40,
      reps: 12,
      distance_meters: null,
      duration_seconds: null,
      rpe: null,
      custom_metric: null,
    })

    expect(draft.type).toBe('dropset')
    expect(draft.weightKg).toBe(40)
    expect(draft.reps).toBe(12)
    expect(draft.completed).toBe(false)
  })
})
