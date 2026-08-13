// @vitest-environment node
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { POST } from './route'
import { prisma } from '@/lib/db'
import { resetDb } from '@/test/reset'
import { verifyPassword } from '@/lib/password'

const request = (body: unknown) =>
  new Request('http://localhost/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

describe('POST /api/auth/register', () => {
  beforeEach(async () => {
    await resetDb()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('creates a user and hashes the password', async () => {
    const res = await POST(request({
      email: 'new@example.com', password: 'password123', name: 'New User',
    }))

    expect(res.status).toBe(201)
    const user = await prisma.user.findUnique({ where: { email: 'new@example.com' } })
    expect(user).not.toBeNull()
    expect(user!.passwordHash).not.toBe('password123')
    expect(await verifyPassword('password123', user!.passwordHash)).toBe(true)
  })

  it('never returns the password hash', async () => {
    const res = await POST(request({
      email: 'new@example.com', password: 'password123', name: 'New User',
    }))
    const body = await res.json()
    expect(JSON.stringify(body)).not.toContain('$2')
  })

  it('rejects a duplicate email with 409', async () => {
    const body = { email: 'dupe@example.com', password: 'password123', name: 'A' }
    await POST(request(body))
    const res = await POST(request(body))
    expect(res.status).toBe(409)
  })

  it('rejects a short password with 400', async () => {
    const res = await POST(request({
      email: 'short@example.com', password: 'abc', name: 'A',
    }))
    expect(res.status).toBe(400)
  })

  it('rejects a malformed email with 400', async () => {
    const res = await POST(request({
      email: 'not-an-email', password: 'password123', name: 'A',
    }))
    expect(res.status).toBe(400)
  })

  it('lowercases the email so casing cannot create duplicates', async () => {
    await POST(request({ email: 'Mixed@Example.com', password: 'password123', name: 'A' }))
    const user = await prisma.user.findUnique({ where: { email: 'mixed@example.com' } })
    expect(user).not.toBeNull()
  })
})
