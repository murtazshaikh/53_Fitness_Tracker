// @vitest-environment node
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/db'

let userId: string
let otherId: string
let benchId: string

async function seed() {
  const a = await prisma.user.create({ data: { email: 'a@x.com', passwordHash: 'x', name: 'A' } })
  const b = await prisma.user.create({ data: { email: 'b@x.com', passwordHash: 'x', name: 'B' } })
  userId = a.id
  otherId = b.id

  const bench = await prisma.exerciseTemplate.create({
    data: {
      title: 'Bench Press (Barbell)', type: 'WEIGHT_REPS', primaryMuscleGroup: 'CHEST',
      secondaryMuscleGroups: [], equipmentCategory: 'BARBELL',
    },
  })
  benchId = bench.id
}

async function logWorkout(owner: string, when: Date, weight: number) {
  await prisma.workout.create({
    data: {
      userId: owner, title: 'W', status: 'COMPLETED',
      startTime: when, endTime: new Date(when.getTime() + 3_600_000),
      exercises: {
        create: [{
          exerciseTemplateId: benchId, index: 0,
          sets: { create: [{ index: 0, type: 'NORMAL', weightKg: weight, reps: 10 }] },
        }],
      },
    },
  })
}

async function load(asUser: string | null) {
  vi.resetModules()
  vi.doMock('@/lib/auth', async () => {
    const { UnauthorizedError } = await import('@/lib/errors')
    return {
      requireUserId: async () => {
        if (asUser === null) throw new UnauthorizedError()
        return asUser
      },
    }
  })
  return (await import('./route')).GET
}

const req = () => new Request('http://localhost/api/v1/exercise_history/x')

describe('GET /api/v1/exercise_history/[templateId]', () => {
  beforeEach(async () => {
    await prisma.workout.deleteMany()
    await prisma.exerciseTemplate.deleteMany()
    await prisma.user.deleteMany()
    await seed()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('returns the most recent performance first', async () => {
    await logWorkout(userId, new Date('2026-08-01T10:00:00Z'), 60)
    await logWorkout(userId, new Date('2026-08-10T10:00:00Z'), 70)

    const GET = await load(userId)
    const body = await (await GET(req(), { params: Promise.resolve({ templateId: benchId }) })).json()

    expect(body.exercise_history[0].weight_kg).toBe(70)
    expect(body.exercise_history[1].weight_kg).toBe(60)
  })

  it('never returns another user’s history', async () => {
    await logWorkout(otherId, new Date('2026-08-10T10:00:00Z'), 100)

    const GET = await load(userId)
    const body = await (await GET(req(), { params: Promise.resolve({ templateId: benchId }) })).json()

    expect(body.exercise_history).toEqual([])
  })

  it('returns an empty list for an exercise never performed', async () => {
    const GET = await load(userId)
    const body = await (await GET(req(), { params: Promise.resolve({ templateId: benchId }) })).json()
    expect(body.exercise_history).toEqual([])
  })

  it('returns 401 with no session', async () => {
    const GET = await load(null)
    const res = await GET(req(), { params: Promise.resolve({ templateId: benchId }) })
    expect(res.status).toBe(401)
  })
})
