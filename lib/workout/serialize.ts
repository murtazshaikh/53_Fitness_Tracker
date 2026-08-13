import type { DraftSet, SetTypeWire } from './types'

/** Prisma enums are UPPER_SNAKE_CASE; the wire format is lowercase. */
export function enumToWire(value: string): string {
  return value.toLowerCase()
}

export function enumFromWire(value: string): string {
  return value.toUpperCase()
}

export interface DbSetLike {
  index: number
  type: string
  weightKg: number | null
  reps: number | null
  distanceMeters: number | null
  durationSeconds: number | null
  rpe: number | null
  customMetric: number | null
}

export interface WireSet {
  index: number
  type: string
  weight_kg: number | null
  reps: number | null
  distance_meters: number | null
  duration_seconds: number | null
  rpe: number | null
  custom_metric: number | null
}

export function setToWire(set: DbSetLike): WireSet {
  return {
    index: set.index,
    type: enumToWire(set.type),
    weight_kg: set.weightKg,
    reps: set.reps,
    distance_meters: set.distanceMeters,
    duration_seconds: set.durationSeconds,
    rpe: set.rpe,
    custom_metric: set.customMetric,
  }
}

/** Wire sets carry no completion state; anything read back starts unticked. */
export function setFromWire(set: WireSet): DraftSet {
  return {
    type: set.type as SetTypeWire,
    weightKg: set.weight_kg,
    reps: set.reps,
    distanceMeters: set.distance_meters,
    durationSeconds: set.duration_seconds,
    rpe: set.rpe,
    completed: false,
  }
}
