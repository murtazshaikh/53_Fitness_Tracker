import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useWorkoutDraft, DRAFT_STORAGE_KEY } from './useWorkoutDraft'
import type { WorkoutDraft } from '@/lib/workout/types'

const initial: WorkoutDraft = { title: 'Session', description: null, exercises: [] }

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.stubGlobal('fetch', vi.fn(async () => new Response(
    JSON.stringify({ updated_at: '2026-08-13T00:00:00Z' }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('useWorkoutDraft', () => {
  it('starts from the initial draft', () => {
    const { result } = renderHook(() => useWorkoutDraft(initial))
    expect(result.current.draft.title).toBe('Session')
    expect(result.current.draft.exercises).toEqual([])
  })

  it('adds an exercise with one empty set', () => {
    const { result } = renderHook(() => useWorkoutDraft(initial))
    act(() => result.current.addExercise('tpl-1'))

    expect(result.current.draft.exercises).toHaveLength(1)
    expect(result.current.draft.exercises[0].exerciseTemplateId).toBe('tpl-1')
    expect(result.current.draft.exercises[0].sets).toHaveLength(1)
    expect(result.current.draft.exercises[0].sets[0].completed).toBe(false)
  })

  it('adds a set copying the previous set values but unticked', () => {
    const { result } = renderHook(() => useWorkoutDraft(initial))
    act(() => result.current.addExercise('tpl-1'))
    act(() => result.current.updateSet(0, 0, { weightKg: 60, reps: 10, completed: true }))
    act(() => result.current.addSet(0))

    const sets = result.current.draft.exercises[0].sets
    expect(sets).toHaveLength(2)
    expect(sets[1].weightKg).toBe(60)
    expect(sets[1].reps).toBe(10)
    expect(sets[1].completed).toBe(false)
  })

  it('removes a set', () => {
    const { result } = renderHook(() => useWorkoutDraft(initial))
    act(() => result.current.addExercise('tpl-1'))
    act(() => result.current.addSet(0))
    act(() => result.current.removeSet(0, 0))

    expect(result.current.draft.exercises[0].sets).toHaveLength(1)
  })

  it('removes an exercise', () => {
    const { result } = renderHook(() => useWorkoutDraft(initial))
    act(() => result.current.addExercise('tpl-1'))
    act(() => result.current.addExercise('tpl-2'))
    act(() => result.current.removeExercise(0))

    expect(result.current.draft.exercises).toHaveLength(1)
    expect(result.current.draft.exercises[0].exerciseTemplateId).toBe('tpl-2')
  })

  it('mirrors every change to localStorage immediately', () => {
    const { result } = renderHook(() => useWorkoutDraft(initial))
    act(() => result.current.addExercise('tpl-1'))

    const stored = JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY)!)
    expect(stored.exercises).toHaveLength(1)
  })

  it('prefers a newer localStorage draft over the server copy', () => {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({
      title: 'Recovered', description: null,
      exercises: [{ exerciseTemplateId: 'tpl-9', notes: null, restSeconds: null, supersetId: null, sets: [] }],
    }))

    const { result } = renderHook(() => useWorkoutDraft(initial))
    expect(result.current.draft.title).toBe('Recovered')
  })

  it('ignores a corrupt localStorage draft', () => {
    localStorage.setItem(DRAFT_STORAGE_KEY, 'not json{')
    const { result } = renderHook(() => useWorkoutDraft(initial))
    expect(result.current.draft.title).toBe('Session')
  })

  it('debounces autosave into a single request', async () => {
    const { result } = renderHook(() => useWorkoutDraft(initial))

    act(() => result.current.addExercise('tpl-1'))
    act(() => result.current.addSet(0))
    act(() => result.current.addSet(0))

    expect(fetch).not.toHaveBeenCalled()
    await act(async () => { vi.advanceTimersByTime(3000) })

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  })

  it('reports save state through the cycle', async () => {
    const { result } = renderHook(() => useWorkoutDraft(initial))
    expect(result.current.saveState).toBe('saved')

    act(() => result.current.addExercise('tpl-1'))
    expect(result.current.saveState).toBe('unsaved')

    await act(async () => { vi.advanceTimersByTime(3000) })
    await waitFor(() => expect(result.current.saveState).toBe('saved'))
  })

  it('stays unsaved when the request fails, so the UI can warn', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))

    const { result } = renderHook(() => useWorkoutDraft(initial))
    act(() => result.current.addExercise('tpl-1'))
    await act(async () => { vi.advanceTimersByTime(3000) })

    await waitFor(() => expect(result.current.saveState).toBe('unsaved'))
    // The local copy survives a failed save — that is the point of client-first state.
    expect(result.current.draft.exercises).toHaveLength(1)
  })
})
