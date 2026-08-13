// @vitest-environment node
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { resetDb } from '@/test/reset'

let userId: string
let otherId: string

async function seedUsers() {
  const a = await prisma.user.create({
    data: { email: 'a@example.com', passwordHash: 'x', name: 'A' },
  })
  const b = await prisma.user.create({
    data: { email: 'b@example.com', passwordHash: 'x', name: 'B' },
  })
  userId = a.id
  otherId = b.id
}

/**
 * vi.doMock must run before the module under test is imported, so the mock and the
 * dynamic import have to live together in one helper.
 */
async function load(asUser: string | null) {
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
  return {
    start: (await import('../start/route')).POST,
    active: await import('./route'),
  }
}

const patchReq = (body?: unknown) =>
  new Request('http://localhost/api/workouts/active', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

describe('live session endpoints', () => {
  beforeEach(async () => {
    await resetDb()
    await seedUsers()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('starts a workout and returns an empty draft', async () => {
    const { start } = await load(userId)
    const res = await start()

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.draft.exercises).toEqual([])
    expect(body.status).toBe('in_progress')
  })

  it('returns 409 when a session is already live', async () => {
    const { start } = await load(userId)
    await start()
    const res = await start()

    expect(res.status).toBe(409)
  })

  it('returns 401 with no session', async () => {
    const { start } = await load(null)
    expect((await start()).status).toBe(401)
  })

  it('GET returns null when nothing is in progress', async () => {
    const { active } = await load(userId)
    const res = await active.GET()

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ workout: null })
  })

  it('PATCH saves the draft and GET reads it back', async () => {
    const { start, active } = await load(userId)
    await start()

    const draft = {
      title: 'Chest Day',
      description: null,
      exercises: [{
        exerciseTemplateId: 'tpl-1', notes: null, restSeconds: 180, supersetId: null,
        sets: [{
          type: 'normal', weightKg: 60, reps: 10, distanceMeters: null,
          durationSeconds: null, rpe: null, completed: true,
        }],
      }],
    }

    const patch = await active.PATCH(patchReq({ draft }))
    expect(patch.status).toBe(200)

    const got = await (await active.GET()).json()
    expect(got.workout.draft.title).toBe('Chest Day')
    expect(got.workout.draft.exercises[0].sets[0].weightKg).toBe(60)
  })

  it('PATCH rejects a malformed draft with 400', async () => {
    const { start, active } = await load(userId)
    await start()

    const res = await active.PATCH(patchReq({
      draft: { title: '', description: null, exercises: [] },
    }))
    expect(res.status).toBe(400)
  })

  it('PATCH returns 404 when no session is live', async () => {
    const { active } = await load(userId)
    const res = await active.PATCH(patchReq({
      draft: { title: 'X', description: null, exercises: [] },
    }))
    expect(res.status).toBe(404)
  })

  it('never exposes another user’s session', async () => {
    const mine = await load(userId)
    await mine.start()

    const theirs = await load(otherId)
    expect(await (await theirs.active.GET()).json()).toEqual({ workout: null })
  })

  it('DELETE discards the session', async () => {
    const { start, active } = await load(userId)
    await start()

    const res = await active.DELETE()
    expect(res.status).toBe(204)
    expect(await prisma.workout.count()).toBe(0)
  })
})
