'use client'

import type { DraftSet, ExerciseTypeWire, SetTypeWire, UnitSystemWire } from '@/lib/workout/types'
import { fieldsFor, isAssistedType } from '@/lib/workout/setKinds'
import {
  kgToDisplay, displayToKg, metersToDisplay, displayToMeters,
  speedFrom, weightUnit, distanceUnit, speedUnit,
} from '@/lib/workout/units'

const SET_TYPE_CYCLE: SetTypeWire[] = ['normal', 'warmup', 'failure', 'dropset']

const SET_TYPE_LABEL: Record<SetTypeWire, string> = {
  normal: '', warmup: 'W', failure: 'F', dropset: 'D',
}

/** Empty input means "not recorded", which is null — never 0. */
function toNumberOrNull(raw: string): number | null {
  if (raw.trim() === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

/** Trim float noise from unit conversion without truncating real precision. */
function round(n: number): number {
  return Math.round(n * 1000) / 1000
}

export function SetRow({
  index, set, type, system, previous, onChange, onDelete,
}: {
  index: number
  set: DraftSet
  type: ExerciseTypeWire
  system: UnitSystemWire
  previous: string | null
  onChange: (set: DraftSet) => void
  onDelete: () => void
}) {
  const fields = fieldsFor(type)
  const weightLabel = isAssistedType(type) ? 'Assist' : 'Weight'
  const speed = speedFrom(set.distanceMeters, set.durationSeconds, system)

  const patch = (changes: Partial<DraftSet>) => onChange({ ...set, ...changes })

  const cycleType = () => {
    const next = SET_TYPE_CYCLE[(SET_TYPE_CYCLE.indexOf(set.type) + 1) % SET_TYPE_CYCLE.length]
    patch({ type: next })
  }

  const inputClass =
    'w-full rounded border border-neutral-300 px-2 py-1.5 text-center tabular-nums ' +
    'focus:border-blue-500 focus:outline-none'

  return (
    <div className={`flex items-center gap-2 py-1 ${set.completed ? 'bg-green-50' : ''}`}>
      <button
        type="button"
        aria-label={`Set type for set ${index + 1}`}
        onClick={cycleType}
        title="Tap to change set type"
        className="w-8 shrink-0 rounded py-1 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
      >
        {SET_TYPE_LABEL[set.type] || index + 1}
      </button>

      <span className="w-20 shrink-0 truncate text-xs text-neutral-400" title={previous ?? undefined}>
        {previous ?? '—'}
      </span>

      {fields.includes('weight') && (
        <input
          aria-label={`${weightLabel} (${weightUnit(system)})`}
          inputMode="decimal"
          placeholder={weightUnit(system)}
          className={inputClass}
          value={set.weightKg === null ? '' : String(round(kgToDisplay(set.weightKg, system)))}
          onChange={(e) => {
            const v = toNumberOrNull(e.target.value)
            patch({ weightKg: v === null ? null : displayToKg(v, system) })
          }}
        />
      )}

      {fields.includes('reps') && (
        <input
          aria-label="Reps"
          inputMode="numeric"
          placeholder="reps"
          className={inputClass}
          value={set.reps === null ? '' : String(set.reps)}
          onChange={(e) => {
            const v = toNumberOrNull(e.target.value)
            patch({ reps: v === null ? null : Math.round(v) })
          }}
        />
      )}

      {fields.includes('distance') && (
        <input
          aria-label={`Distance (${distanceUnit(system)})`}
          inputMode="decimal"
          placeholder={distanceUnit(system)}
          className={inputClass}
          value={set.distanceMeters === null ? '' : String(round(metersToDisplay(set.distanceMeters, system)))}
          onChange={(e) => {
            const v = toNumberOrNull(e.target.value)
            patch({ distanceMeters: v === null ? null : displayToMeters(v, system) })
          }}
        />
      )}

      {fields.includes('duration') && (
        <input
          aria-label="Duration (seconds)"
          inputMode="numeric"
          placeholder="secs"
          className={inputClass}
          value={set.durationSeconds === null ? '' : String(set.durationSeconds)}
          onChange={(e) => {
            const v = toNumberOrNull(e.target.value)
            patch({ durationSeconds: v === null ? null : Math.round(v) })
          }}
        />
      )}

      {speed !== null && (
        <span className="shrink-0 whitespace-nowrap text-xs text-neutral-500">
          {speed.toFixed(1)} {speedUnit(system)}
        </span>
      )}

      <input
        type="checkbox"
        aria-label={`Complete set ${index + 1}`}
        checked={set.completed}
        onChange={(e) => patch({ completed: e.target.checked })}
        className="ml-1 size-5 shrink-0 accent-green-600"
      />

      <button
        type="button"
        aria-label={`Delete set ${index + 1}`}
        onClick={onDelete}
        className="shrink-0 px-1 text-neutral-400 hover:text-red-600"
      >
        ×
      </button>
    </div>
  )
}
