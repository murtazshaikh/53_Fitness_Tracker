// @vitest-environment node
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { prisma } from './db'

async function makeUser(email: string) {
  return prisma.user.create({
    data: { email, passwordHash: 'x', name: 'Test' },
  })
}

describe('one in-progress workout per user', () => {
  beforeEach(async () => {
    await prisma.workout.deleteMany()
    await prisma.user.deleteMany()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('rejects a second in-progress workout for the same user', async () => {
    const user = await makeUser('a@example.com')
    await prisma.workout.create({
      data: { userId: user.id, title: 'First', status: 'IN_PROGRESS' },
    })

    await expect(
      prisma.workout.create({
        data: { userId: user.id, title: 'Second', status: 'IN_PROGRESS' },
      }),
    ).rejects.toThrow()
  })

  it('allows many completed workouts for the same user', async () => {
    const user = await makeUser('b@example.com')
    await prisma.workout.create({
      data: { userId: user.id, title: 'One', status: 'COMPLETED', endTime: new Date() },
    })
    await prisma.workout.create({
      data: { userId: user.id, title: 'Two', status: 'COMPLETED', endTime: new Date() },
    })

    expect(await prisma.workout.count()).toBe(2)
  })

  it('allows two different users to each have one in progress', async () => {
    const a = await makeUser('c@example.com')
    const b = await makeUser('d@example.com')
    await prisma.workout.create({ data: { userId: a.id, title: 'A', status: 'IN_PROGRESS' } })
    await prisma.workout.create({ data: { userId: b.id, title: 'B', status: 'IN_PROGRESS' } })

    expect(await prisma.workout.count()).toBe(2)
  })
})
