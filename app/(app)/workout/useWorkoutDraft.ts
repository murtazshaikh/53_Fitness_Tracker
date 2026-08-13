'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { DraftExercise, DraftSet, WorkoutDraft } from '@/lib/workout/types'

export const DRAFT_STORAGE_KEY = 'workout-draft'
const AUTOSAVE_DELAY_MS = 3000

export type SaveState = 'saved' | 'saving' | 'unsaved'

const emptySet = (): DraftSet => ({
  type: 'normal', weightKg: null, reps: null, distanceMeters: null,
  durationSeconds: null, rpe: null, completed: false,
})

function readStored(): WorkoutDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (typeof parsed?.title !== 'string' || !Array.isArray(parsed?.exercises)) return null
    return parsed as WorkoutDraft
  } catch {
    return null
  }
}

/**
 * Client-first session state. Every edit lands in React state and localStorage
 * immediately, so the UI never blocks on the network; the server copy catches up
 * on a debounce. A failed save leaves the local draft intact and the state
 * "unsaved" so the UI can say so.
 */
export function useWorkoutDraft(initial: WorkoutDraft) {
  // Start from the server's copy so the first client render matches the server
  // HTML exactly; localStorage is read after mount instead. Reading it in the
  // initialiser produces a hydration mismatch whenever the two differ, which is
  // precisely the case this recovery path exists for.
  const [draft, setDraft] = useState<WorkoutDraft>(initial)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const firstRender = useRef(true)
  const latest = useRef(draft)
  latest.current = draft

  const save = useCallback(async (): Promise<boolean> => {
    setSaveState('saving')
    try {
      const res = await fetch('/api/workouts/active', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ draft: latest.current }),
      })
      setSaveState(res.ok ? 'saved' : 'unsaved')
      return res.ok
    } catch {
      setSaveState('unsaved')
      return false
    }
  }, [])

  /**
   * Save immediately, cancelling any pending debounce. Finishing must not race
   * the autosave timer: without this, tapping Finish within the debounce window
   * sends the server a draft that has not caught up, and finish rejects it.
   */
  const flush = useCallback(async (): Promise<boolean> => {
    if (timer.current) clearTimeout(timer.current)
    return save()
  }, [save])

  // Recover a local draft after mount. A newer local copy wins: it is the one the
  // user was actually looking at when the tab closed or the network dropped.
  useEffect(() => {
    const stored = readStored()
    if (stored) setDraft(stored)
  }, [])

  useEffect(() => {
    // Skip the initial render: nothing has changed yet, so there is nothing to save.
    if (firstRender.current) {
      firstRender.current = false
      return
    }

    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft))
    setSaveState('unsaved')

    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { void save() }, AUTOSAVE_DELAY_MS)

    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [draft, save])

  const mutate = useCallback((fn: (d: WorkoutDraft) => WorkoutDraft) => {
    setDraft(prev => fn(prev))
  }, [])

  const setTitle = useCallback((title: string) => {
    mutate(d => ({ ...d, title }))
  }, [mutate])

  const addExercise = useCallback((exerciseTemplateId: string) => {
    const exercise: DraftExercise = {
      exerciseTemplateId, notes: null, restSeconds: null, supersetId: null,
      sets: [emptySet()],
    }
    mutate(d => ({ ...d, exercises: [...d.exercises, exercise] }))
  }, [mutate])

  const removeExercise = useCallback((ei: number) => {
    mutate(d => ({ ...d, exercises: d.exercises.filter((_, i) => i !== ei) }))
  }, [mutate])

  const updateExercise = useCallback((ei: number, changes: Partial<DraftExercise>) => {
    mutate(d => ({
      ...d,
      exercises: d.exercises.map((e, i) => (i === ei ? { ...e, ...changes } : e)),
    }))
  }, [mutate])

  /** New sets inherit the previous set's numbers — you rarely change weight between sets. */
  const addSet = useCallback((ei: number) => {
    mutate(d => ({
      ...d,
      exercises: d.exercises.map((e, i) => {
        if (i !== ei) return e
        const last = e.sets[e.sets.length - 1]
        const next: DraftSet = last ? { ...last, completed: false } : emptySet()
        return { ...e, sets: [...e.sets, next] }
      }),
    }))
  }, [mutate])

  const updateSet = useCallback((ei: number, si: number, changes: Partial<DraftSet>) => {
    mutate(d => ({
      ...d,
      exercises: d.exercises.map((e, i) => (
        i !== ei ? e : { ...e, sets: e.sets.map((s, j) => (j === si ? { ...s, ...changes } : s)) }
      )),
    }))
  }, [mutate])

  const removeSet = useCallback((ei: number, si: number) => {
    mutate(d => ({
      ...d,
      exercises: d.exercises.map((e, i) => (
        i !== ei ? e : { ...e, sets: e.sets.filter((_, j) => j !== si) }
      )),
    }))
  }, [mutate])

  return {
    draft, saveState, flush, setTitle,
    addExercise, removeExercise, updateExercise,
    addSet, updateSet, removeSet,
  }
}
