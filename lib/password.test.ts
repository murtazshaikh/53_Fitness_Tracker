// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from './password'

describe('password hashing', () => {
  it('does not store the plaintext', async () => {
    const hash = await hashPassword('correct horse battery staple')
    expect(hash).not.toContain('correct horse')
    expect(hash.length).toBeGreaterThan(50)
  })

  it('verifies the right password', async () => {
    const hash = await hashPassword('s3cret-pass')
    expect(await verifyPassword('s3cret-pass', hash)).toBe(true)
  })

  it('rejects the wrong password', async () => {
    const hash = await hashPassword('s3cret-pass')
    expect(await verifyPassword('wrong-pass', hash)).toBe(false)
  })

  it('produces a different hash each time, so salts differ', async () => {
    const a = await hashPassword('same-password')
    const b = await hashPassword('same-password')
    expect(a).not.toBe(b)
  })
})
