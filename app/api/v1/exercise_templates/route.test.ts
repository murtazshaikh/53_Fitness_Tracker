// @vitest-environment node
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/db'

let userId: string
let otherId: string

async function seed() {
  const a = await prisma.user.create({ data: { email: 'a@x.com', passwordHash: 'x', name: 'A' } })
  const b = await prisma.user.create({ data: { email: 'b@x.com', passwordHash: 'x', name: 'B' } })
  userId = a.id
  otherId = b.id

  await prisma.exerciseTemplate.createMany({
    data: [
      { title: 'Bench Press (Barbell)', type: 'WEIGHT_REPS', primaryMuscleGroup: 'CHEST', secondaryMuscleGroups: ['TRICEPS'], equipmentCategory: 'BARBELL' },
      { title: 'Squat (Barbell)', type: 'WEIGHT_REPS', primaryMuscleGroup: 'QUADRICEPS', secondaryMuscleGroups: ['GLUTES'], equipmentCategory: 'BARBELL' },
      { title: 'Treadmill', type: 'DISTANCE_DURATION', primaryMuscleGroup: 'CARDIO', secondaryMuscleGroups: [], equipmentCategory: 'MACHINE' },
      { title: 'My Secret Lift', type: 'WEIGHT_REPS', primaryMuscleGroup: 'CHEST', secondaryMuscleGroups: [], equipmentCategory: 'BARBELL', isCustom: true, ownerId: b.id },
    ],
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
  return import('./route')
}

const get = (query = '') =>
  new Request(`http://localhost/api/v1/exercise_templates${query}`)

describe('GET /api/v1/exercise_templates', () => {
  beforeEach(async () => {
    await prisma.exerciseTemplate.deleteMany()
    await prisma.user.deleteMany()
    await seed()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('returns seeded templates in snake_case with lowercase enums', async () => {
    const { GET } = await load(userId)
    const body = await (await GET(get())).json()

    const bench = body.exercise_templates.find((t: { title: string }) => t.title === 'Bench Press (Barbell)')
    expect(bench.type).toBe('weight_reps')
    expect(bench.primary_muscle_group).toBe('chest')
    expect(bench.secondary_muscle_groups).toEqual(['triceps'])
    expect(bench.equipment_category).toBe('barbell')
    expect(bench.is_custom).toBe(false)
  })

  it('hides another user’s custom exercises', async () => {
    const { GET } = await load(userId)
    const body = await (await GET(get())).json()
    const titles = body.exercise_templates.map((t: { title: string }) => t.title)
    expect(titles).not.toContain('My Secret Lift')
  })

  it('includes the owner’s own custom exercises', async () => {
    const { GET } = await load(otherId)
    const body = await (await GET(get())).json()
    const titles = body.exercise_templates.map((t: { title: string }) => t.title)
    expect(titles).toContain('My Secret Lift')
  })

  it('searches by title, case-insensitively', async () => {
    const { GET } = await load(userId)
    const body = await (await GET(get('?q=bench'))).json()
    expect(body.exercise_templates).toHaveLength(1)
    expect(body.exercise_templates[0].title).toBe('Bench Press (Barbell)')
  })

  it('filters by muscle group', async () => {
    const { GET } = await load(userId)
    const body = await (await GET(get('?muscle_group=cardio'))).json()
    expect(body.exercise_templates).toHaveLength(1)
    expect(body.exercise_templates[0].title).toBe('Treadmill')
  })

  it('returns 401 with no session', async () => {
    const { GET } = await load(null)
    expect((await GET(get())).status).toBe(401)
  })

  it('creates a custom template owned by the caller', async () => {
    const { POST } = await load(userId)
    const res = await POST(new Request('http://localhost/api/v1/exercise_templates', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'Sandbag Carry',
        type: 'duration',
        primary_muscle_group: 'full_body',
        secondary_muscle_groups: ['forearms'],
        equipment_category: 'other',
      }),
    }))

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.exercise_template.is_custom).toBe(true)

    const row = await prisma.exerciseTemplate.findFirst({ where: { title: 'Sandbag Carry' } })
    expect(row!.ownerId).toBe(userId)
    expect(row!.type).toBe('DURATION')
  })

  it('rejects an invalid enum on create with 400', async () => {
    const { POST } = await load(userId)
    const res = await POST(new Request('http://localhost/api/v1/exercise_templates', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'Nonsense',
        type: 'interpretive_dance',
        primary_muscle_group: 'chest',
        secondary_muscle_groups: [],
        equipment_category: 'none',
      }),
    }))
    expect(res.status).toBe(400)
  })
})
