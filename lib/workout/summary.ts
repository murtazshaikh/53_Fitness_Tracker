import type { MeasurableSet, UnitSystemWire } from './types'
import { speedFrom } from './units'

export interface WorkoutSummary {
  totalSets: number
  /** Σ(weight × reps) over sets having both. Null when no set qualifies. */
  volumeKg: number | null
  distanceMeters: number | null
  /** Total duration of distance sets. */
  movingSeconds: number | null
  /** Total distance ÷ total moving time, in the user's speed unit. */
  avgSpeed: number | null
  /** Total duration of sets that have duration but no distance. */
  timeUnderTensionSeconds: number | null
}

/**
 * Stats adapt to the set kinds present. Every field is null rather than zero when
 * no set qualifies, so the UI can omit it instead of showing a misleading 0.
 */
export function summarize(sets: MeasurableSet[], system: UnitSystemWire): WorkoutSummary {
  let volumeKg = 0
  let hasVolume = false
  let distanceMeters = 0
  let movingSeconds = 0
  let hasDistance = false
  let tension = 0
  let hasTension = false

  for (const s of sets) {
    if (s.weightKg !== null && s.reps !== null) {
      volumeKg += s.weightKg * s.reps
      hasVolume = true
    }
    if (s.distanceMeters !== null) {
      distanceMeters += s.distanceMeters
      movingSeconds += s.durationSeconds ?? 0
      hasDistance = true
    } else if (s.durationSeconds !== null) {
      tension += s.durationSeconds
      hasTension = true
    }
  }

  return {
    totalSets: sets.length,
    volumeKg: hasVolume ? volumeKg : null,
    distanceMeters: hasDistance ? distanceMeters : null,
    movingSeconds: hasDistance ? movingSeconds : null,
    avgSpeed: hasDistance ? speedFrom(distanceMeters, movingSeconds, system) : null,
    timeUnderTensionSeconds: hasTension ? tension : null,
  }
}
