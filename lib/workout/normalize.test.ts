import { describe, it, expect } from 'vitest'
import { normalizeDraft } from './normalize'
import type { DraftSet, WorkoutDraft } from './types'

const set = (o: Partial<DraftSet>): DraftSet => ({
  type: 'normal', weightKg: null, reps: null, distanceMeters: null,
  durationSeconds: null, rpe: null, completed: true, ...o,
})

const draft = (exercises: WorkoutDraft['exercises']): WorkoutDraft => ({
  title: 'T', description: null, exercises,
})

const exercise = (id: string, sets: DraftSet[]) => ({
  exerciseTemplateId: id, notes: null, restSeconds: null, supersetId: null, sets,
})

describe('normalizeDraft', () => {
  it('keeps only completed sets', () => {
    const rows = normalizeDraft(draft([
      exercise('bench', [
        set({ weightKg: 60, reps: 10, completed: true }),
        set({ weightKg: 65, reps: 8, completed: false }),
      ]),
    ]))

    expect(rows[0].sets).toHaveLength(1)
    expect(rows[0].sets[0].weightKg).toBe(60)
  })

  it('assigns contiguous set indexes after filtering', () => {
    const rows = normalizeDraft(draft([
      exercise('bench', [
        set({ reps: 1, completed: false }),
        set({ reps: 2, completed: true }),
        set({ reps: 3, completed: false }),
        set({ reps: 4, completed: true }),
      ]),
    ]))

    expect(rows[0].sets.map(s => s.index)).toEqual([0, 1])
    expect(rows[0].sets.map(s => s.reps)).toEqual([2, 4])
  })

  it('drops an exercise left with no completed sets', () => {
    const rows = normalizeDraft(draft([
      exercise('bench', [set({ reps: 10, completed: true })]),
      exercise('curl', [set({ reps: 10, completed: false })]),
      exercise('row', [set({ reps: 10, completed: true })]),
    ]))

    expect(rows.map(r => r.exerciseTemplateId)).toEqual(['bench', 'row'])
  })

  it('assigns contiguous exercise indexes after dropping empties', () => {
    const rows = normalizeDraft(draft([
      exercise('bench', [set({ reps: 10, completed: true })]),
      exercise('curl', [set({ reps: 10, completed: false })]),
      exercise('row', [set({ reps: 10, completed: true })]),
    ]))

    expect(rows.map(r => r.index)).toEqual([0, 1])
  })

  it('drops an exercise with no sets at all', () => {
    const rows = normalizeDraft(draft([exercise('bench', [])]))
    expect(rows).toEqual([])
  })

  it('uppercases the set type for Prisma', () => {
    const rows = normalizeDraft(draft([
      exercise('bench', [set({ type: 'dropset', reps: 10 })]),
    ]))
    expect(rows[0].sets[0].type).toBe('DROPSET')
  })

  it('carries exercise metadata through', () => {
    const rows = normalizeDraft(draft([{
      exerciseTemplateId: 'bench',
      notes: 'felt heavy',
      restSeconds: 180,
      supersetId: 1,
      sets: [set({ reps: 10 })],
    }]))

    expect(rows[0].notes).toBe('felt heavy')
    expect(rows[0].restSeconds).toBe(180)
    expect(rows[0].supersetId).toBe(1)
  })

  it('does not carry the completed flag into rows', () => {
    const rows = normalizeDraft(draft([exercise('bench', [set({ reps: 10 })])]))
    expect('completed' in rows[0].sets[0]).toBe(false)
  })

  it('returns an empty list for an empty draft', () => {
    expect(normalizeDraft(draft([]))).toEqual([])
  })
})
