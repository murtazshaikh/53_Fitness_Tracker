import type { WorkoutSummary } from '@/lib/workout/summary'
import type { UnitSystemWire } from '@/lib/workout/types'
import {
  kgToDisplay, metersToDisplay, weightUnit, distanceUnit, speedUnit, formatDuration,
} from '@/lib/workout/units'

/**
 * Renders only the stats a workout actually contains. A null stat is omitted
 * rather than shown as 0, which would read as data.
 */
export function SummaryStats({
  summary,
  system,
}: {
  summary: WorkoutSummary
  system: UnitSystemWire
}) {
  const parts: string[] = [
    `${summary.totalSets} ${summary.totalSets === 1 ? 'set' : 'sets'}`,
  ]

  if (summary.volumeKg !== null) {
    const v = kgToDisplay(summary.volumeKg, system)
    parts.push(`${Math.round(v).toLocaleString('en-US')} ${weightUnit(system)}`)
  }

  if (summary.distanceMeters !== null) {
    parts.push(`${metersToDisplay(summary.distanceMeters, system).toFixed(1)} ${distanceUnit(system)}`)
    if (summary.movingSeconds !== null) parts.push(formatDuration(summary.movingSeconds))
    if (summary.avgSpeed !== null) parts.push(`${summary.avgSpeed.toFixed(1)} ${speedUnit(system)}`)
  }

  if (summary.timeUnderTensionSeconds !== null) {
    parts.push(formatDuration(summary.timeUnderTensionSeconds))
  }

  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-neutral-500">
      {parts.map((p, i) => (
        <span key={i}>{p}</span>
      ))}
    </div>
  )
}
