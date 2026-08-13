import type { UnitSystemWire } from './types'

const KG_PER_LB = 0.45359237
const M_PER_KM = 1000
const M_PER_MI = 1609.344

export function kgToDisplay(kg: number, system: UnitSystemWire): number {
  return system === 'metric' ? kg : kg / KG_PER_LB
}

export function displayToKg(value: number, system: UnitSystemWire): number {
  return system === 'metric' ? value : value * KG_PER_LB
}

export function metersToDisplay(m: number, system: UnitSystemWire): number {
  return system === 'metric' ? m / M_PER_KM : m / M_PER_MI
}

export function displayToMeters(value: number, system: UnitSystemWire): number {
  return system === 'metric' ? value * M_PER_KM : value * M_PER_MI
}

/**
 * Speed in the user's distance-unit per hour. Returns null when either input is
 * absent or duration is zero — a zero-duration set is bad data, not infinite speed.
 */
export function speedFrom(
  distanceMeters: number | null,
  durationSeconds: number | null,
  system: UnitSystemWire,
): number | null {
  if (distanceMeters === null || durationSeconds === null) return null
  if (durationSeconds <= 0) return null
  const hours = durationSeconds / 3600
  return metersToDisplay(distanceMeters, system) / hours
}

export function weightUnit(system: UnitSystemWire): string {
  return system === 'metric' ? 'kg' : 'lb'
}

export function distanceUnit(system: UnitSystemWire): string {
  return system === 'metric' ? 'km' : 'mi'
}

export function speedUnit(system: UnitSystemWire): string {
  return system === 'metric' ? 'km/h' : 'mph'
}

/** `m:ss` under an hour, `h:mm:ss` at or above it. */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`
}
