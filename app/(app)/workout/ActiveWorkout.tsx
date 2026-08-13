'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useWorkoutDraft, DRAFT_STORAGE_KEY } from './useWorkoutDraft'
import { SetRow } from './SetRow'
import { ExercisePicker, type TemplateSummary } from './ExercisePicker'
import { SummaryStats } from '@/components/SummaryStats'
import { summarize } from '@/lib/workout/summary'
import { formatDuration } from '@/lib/workout/units'
import { previousBySetIndex } from '@/lib/workout/previous'
import type { UnitSystemWire, WorkoutDraft } from '@/lib/workout/types'

const SAVE_LABEL = { saved: 'Saved', saving: 'Saving…', unsaved: 'Unsaved' } as const

export function ActiveWorkout({
  workout, templates, system,
}: {
  workout: { id: string; title: string; start_time: string; draft: WorkoutDraft }
  templates: TemplateSummary[]
  system: UnitSystemWire
}) {
  const router = useRouter()
  const [picking, setPicking] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [previous, setPrevious] = useState<Record<string, string[]>>({})

  const {
    draft, saveState, setTitle,
    addExercise, removeExercise, addSet, updateSet, removeSet,
  } = useWorkoutDraft(workout.draft)

  const byId = useMemo(() => new Map(templates.map(t => [t.id, t])), [templates])

  useEffect(() => {
    const started = new Date(workout.start_time).getTime()
    const tick = () => setElapsed(Math.floor((Date.now() - started) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [workout.start_time])

  // Fetch last time's numbers for each exercise, once per template id.
  useEffect(() => {
    const ids = [...new Set(draft.exercises.map(e => e.exerciseTemplateId))]
    const missing = ids.filter(id => !(id in previous))
    if (missing.length === 0) return

    let cancelled = false
    Promise.all(missing.map(async (id) => {
      try {
        const res = await fetch(`/api/v1/exercise_history/${id}`)
        if (!res.ok) return [id, [] as string[]] as const
        const body = await res.json()
        return [id, previousBySetIndex(body.exercise_history, system)] as const
      } catch {
        // The PREV column is a convenience; failing to load it must never block logging.
        return [id, [] as string[]] as const
      }
    })).then((pairs) => {
      if (!cancelled) setPrevious(prev => ({ ...prev, ...Object.fromEntries(pairs) }))
    })

    return () => { cancelled = true }
  }, [draft.exercises, previous, system])

  const completedSets = draft.exercises.flatMap(e => e.sets.filter(s => s.completed))
  const summary = summarize(completedSets, system)

  async function finish() {
    setFinishing(true)
    setError(null)
    try {
      const res = await fetch('/api/workouts/active/finish', { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        // Keep the draft: losing a completed session to a failed request would be
        // the worst bug in this app.
        setError(body.issues?.join('; ') ?? body.error ?? 'Could not finish the workout')
        setFinishing(false)
        return
      }
      localStorage.removeItem(DRAFT_STORAGE_KEY)
      router.push('/history')
    } catch {
      setError('Could not reach the server. Your workout is still saved on this device.')
      setFinishing(false)
    }
  }

  async function discard() {
    if (!confirm('Discard this workout? Everything logged will be lost.')) return
    await fetch('/api/workouts/active', { method: 'DELETE' })
    localStorage.removeItem(DRAFT_STORAGE_KEY)
    router.refresh()
  }

  return (
    <div className="mx-auto max-w-2xl p-4 pb-28">
      <header className="mb-3 flex items-center gap-3">
        <input
          aria-label="Workout title"
          className="min-w-0 flex-1 rounded border border-transparent px-2 py-1 text-lg font-semibold hover:border-neutral-300 focus:border-blue-500 focus:outline-none"
          value={draft.title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <span className="shrink-0 tabular-nums text-neutral-700">{formatDuration(elapsed)}</span>
        <span
          className={`shrink-0 text-xs ${saveState === 'unsaved' ? 'text-amber-600' : 'text-neutral-400'}`}
        >
          {SAVE_LABEL[saveState]}
        </span>
      </header>

      <SummaryStats summary={summary} system={system} />

      {error && (
        <p role="alert" className="my-3 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      {draft.exercises.length === 0 && (
        <p className="py-10 text-center text-neutral-500">
          No exercises yet. Add one to start logging.
        </p>
      )}

      {draft.exercises.map((exercise, ei) => {
        const template = byId.get(exercise.exerciseTemplateId)
        const prev = previous[exercise.exerciseTemplateId] ?? []
        return (
          <section key={ei} className="my-4 rounded-lg border border-neutral-200 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="font-medium">{template?.title ?? 'Unknown exercise'}</h2>
              <button
                type="button"
                onClick={() => removeExercise(ei)}
                aria-label={`Remove ${template?.title ?? 'exercise'}`}
                className="text-sm text-neutral-400 hover:text-red-600"
              >
                Remove
              </button>
            </div>

            <div className="flex items-center gap-2 pb-1 text-xs uppercase tracking-wide text-neutral-400">
              <span className="w-8 shrink-0 text-center">Set</span>
              <span className="w-20 shrink-0">Prev</span>
              <span className="flex-1">Log</span>
            </div>

            {exercise.sets.map((set, si) => (
              <SetRow
                key={si}
                index={si}
                set={set}
                type={template?.type ?? 'weight_reps'}
                system={system}
                previous={prev[si] ?? null}
                onChange={(next) => updateSet(ei, si, next)}
                onDelete={() => removeSet(ei, si)}
              />
            ))}

            <button
              type="button"
              onClick={() => addSet(ei)}
              className="mt-2 w-full rounded bg-neutral-100 py-2 text-sm hover:bg-neutral-200"
            >
              + Add Set
            </button>
          </section>
        )
      })}

      <button
        type="button"
        onClick={() => setPicking(true)}
        className="w-full rounded-lg bg-neutral-100 py-3 font-medium hover:bg-neutral-200"
      >
        + Add Exercise
      </button>

      <div className="fixed inset-x-0 bottom-0 border-t bg-white p-3">
        <div className="mx-auto flex max-w-2xl gap-2">
          <button
            type="button"
            onClick={discard}
            className="rounded border px-4 py-3 text-sm text-neutral-600 hover:text-red-600"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={finish}
            disabled={finishing}
            className="flex-1 rounded bg-blue-600 py-3 font-medium text-white disabled:opacity-50"
          >
            {finishing ? 'Finishing…' : 'Finish'}
          </button>
        </div>
      </div>

      {picking && (
        <ExercisePicker
          templates={templates}
          onAdd={(ids) => ids.forEach(addExercise)}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  )
}
