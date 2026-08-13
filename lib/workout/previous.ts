import { kgToDisplay, metersToDisplay, formatDuration, distanceUnit } from './units'
import type { UnitSystemWire } from './types'

export type HistoryEntry = {
  workout_start_time: string
  weight_kg: number | null
  reps: number | null
  distance_meters: number | null
  duration_seconds: number | null
}

function trim(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

function format(entry: HistoryEntry, system: UnitSystemWire): string {
  const parts: string[] = []

  if (entry.weight_kg !== null) {
    const w = trim(kgToDisplay(entry.weight_kg, system))
    parts.push(entry.reps !== null ? `${w} × ${entry.reps}` : w)
  } else if (entry.reps !== null) {
    parts.push(String(entry.reps))
  }

  if (entry.distance_meters !== null) {
    const d = metersToDisplay(entry.distance_meters, system)
    const label = `${d.toFixed(2)} ${distanceUnit(system)}`
    parts.push(entry.duration_seconds !== null
      ? `${label} / ${formatDuration(entry.duration_seconds)}`
      : label)
  } else if (entry.duration_seconds !== null && entry.weight_kg === null && entry.reps === null) {
    parts.push(formatDuration(entry.duration_seconds))
  }

  return parts.join(' ')
}

/**
 * The PREV column shows what you did *last time*, so only the most recent session
 * counts — the API returns every past set newest-first, across all workouts.
 */
export function previousBySetIndex(
  entries: HistoryEntry[],
  system: UnitSystemWire,
): string[] {
  if (entries.length === 0) return []
  const mostRecent = entries[0].workout_start_time
  return entries
    .filter(e => e.workout_start_time === mostRecent)
    .map(e => format(e, system))
}
