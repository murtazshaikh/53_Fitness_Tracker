// @vitest-environment node
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { resetDb } from '@/test/reset'

let userId: string
let benchId: string
let treadmillId: string

async function seed() {
  const user = await prisma.user.create({
    data: { email: 'f@example.com', passwordHash: 'x', name: 'F' },
  })
  userId = user.id

  const bench = await prisma.exerciseTemplate.create({
    data: {
      title: 'Bench Press (Barbell)', type: 'WEIGHT_REPS',
      primaryMuscleGroup: 'CHEST', secondaryMuscleGroups: ['TRICEPS'],
      equipmentCategory: 'BARBELL',
    },
  })
  const treadmill = await prisma.exerciseTemplate.create({
    data: {
      title: 'Treadmill', type: 'DISTANCE_DURATION',
      primaryMuscleGroup: 'CARDIO', secondaryMuscleGroups: [],
      equipmentCategory: 'MACHINE',
    },
  })
  benchId = bench.id
  treadmillId = treadmill.id
}

async function loadFinish(asUser: string | null) {
  vi.resetModules()
  vi.doMock('@/lib/auth', async () => {
    // Imported inside the factory: resetModules() gives the route under test a
    // fresh lib/errors, and instanceof only holds within one module instance.
    const { UnauthorizedError } = await import('@/lib/errors')
    return {
      requireUserId: async () => {
        if (asUser === null) throw new UnauthorizedError()
        return asUser
      },
    }
  })
  return (await import('./route')).POST
}

const set = (o: Record<string, unknown>) => ({
  type: 'normal', weightKg: null, reps: null, distanceMeters: null,
  durationSeconds: null, rpe: null, completed: true, ...o,
})

async function startWith(draft: unknown) {
  return prisma.workout.create({
    data: { userId, title: 'Session', status: 'IN_PROGRESS', draft: draft as object },
  })
}

describe('POST /api/workouts/active/finish', () => {
  beforeEach(async () => {
    await resetDb()
    await seed()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('normalizes the draft into rows and completes the workout', async () => {
    await startWith({
      title: 'Chest Day',
      description: null,
      exercises: [{
        exerciseTemplateId: benchId, notes: 'felt good', restSeconds: 180, supersetId: null,
        sets: [set({ weightKg: 60, reps: 10 }), set({ weightKg: 65, reps: 8 })],
      }],
    })

    const finish = await loadFinish(userId)
    const res = await finish()
    expect(res.status).toBe(200)

    const workout = await prisma.workout.findFirst({
      include: { exercises: { include: { sets: true } } },
    })

    expect(workout!.status).toBe('COMPLETED')
    expect(workout!.endTime).not.toBeNull()
    expect(workout!.draft).toBeNull()
    expect(workout!.exercises).toHaveLength(1)
    expect(workout!.exercises[0].notes).toBe('felt good')
    expect(workout!.exercises[0].sets).toHaveLength(2)
  })

  it('discards incomplete sets', async () => {
    await startWith({
      title: 'T', description: null,
      exercises: [{
        exerciseTemplateId: benchId, notes: null, restSeconds: null, supersetId: null,
        sets: [set({ weightKg: 60, reps: 10 }), set({ weightKg: 65, reps: 8, completed: false })],
      }],
    })

    const finish = await loadFinish(userId)
    await finish()

    const sets = await prisma.setEntry.findMany()
    expect(sets).toHaveLength(1)
    expect(sets[0].weightKg).toBe(60)
  })

  it('rejects a set whose fields contradict the exercise type', async () => {
    await startWith({
      title: 'T', description: null,
      exercises: [{
        exerciseTemplateId: benchId, notes: null, restSeconds: null, supersetId: null,
        sets: [set({ weightKg: 60, reps: 10, distanceMeters: 5000 })],
      }],
    })

    const finish = await loadFinish(userId)
    const res = await finish()

    expect(res.status).toBe(400)
    expect(JSON.stringify(await res.json())).toContain('distance')
  })

  it('leaves the workout in progress when validation fails', async () => {
    await startWith({
      title: 'T', description: null,
      exercises: [{
        exerciseTemplateId: benchId, notes: null, restSeconds: null, supersetId: null,
        sets: [set({ weightKg: 60, reps: 10, durationSeconds: 30 })],
      }],
    })

    const finish = await loadFinish(userId)
    await finish()

    const workout = await prisma.workout.findFirst()
    expect(workout!.status).toBe('IN_PROGRESS')
    expect(workout!.draft).not.toBeNull()
  })

  it('accepts a cardio set with distance and duration', async () => {
    await startWith({
      title: 'Cardio', description: null,
      exercises: [{
        exerciseTemplateId: treadmillId, notes: null, restSeconds: null, supersetId: null,
        sets: [set({ distanceMeters: 5000, durationSeconds: 1695 })],
      }],
    })

    const finish = await loadFinish(userId)
    expect((await finish()).status).toBe(200)

    const sets = await prisma.setEntry.findMany()
    expect(sets[0].distanceMeters).toBe(5000)
  })

  it('rejects finishing an empty workout with 400', async () => {
    await startWith({ title: 'T', description: null, exercises: [] })

    const finish = await loadFinish(userId)
    const res = await finish()

    expect(res.status).toBe(400)
    expect(await prisma.workout.count({ where: { status: 'IN_PROGRESS' } })).toBe(1)
  })

  it('returns 404 when no session is live', async () => {
    const finish = await loadFinish(userId)
    expect((await finish()).status).toBe(404)
  })

  it('frees the user to start another workout afterwards', async () => {
    await startWith({
      title: 'T', description: null,
      exercises: [{
        exerciseTemplateId: benchId, notes: null, restSeconds: null, supersetId: null,
        sets: [set({ weightKg: 60, reps: 10 })],
      }],
    })

    const finish = await loadFinish(userId)
    await finish()

    await expect(prisma.workout.create({
      data: { userId, title: 'Next', status: 'IN_PROGRESS' },
    })).resolves.toBeDefined()
  })
})
