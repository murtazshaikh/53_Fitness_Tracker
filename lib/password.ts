import bcrypt from 'bcryptjs'

// 12 rounds: slow enough to make offline cracking expensive, fast enough that
// a login stays well under a second.
const ROUNDS = 12

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}
