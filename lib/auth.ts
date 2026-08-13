import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { z } from 'zod'
import { prisma } from './db'
import { verifyPassword } from './password'

export class UnauthorizedError extends Error {
  constructor() {
    super('Not authenticated')
    this.name = 'UnauthorizedError'
  }
}

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw)
        if (!parsed.success) return null

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
        })
        if (!user) return null

        const ok = await verifyPassword(parsed.data.password, user.passwordHash)
        if (!ok) return null

        return { id: user.id, email: user.email, name: user.name }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.sub = user.id
      return token
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub
      return session
    },
  },
})

/**
 * Every API handler calls this instead of trusting a client-supplied id.
 * Throws rather than returning null so a forgotten check cannot silently
 * turn into an unscoped query.
 */
export async function requireUserId(): Promise<string> {
  const session = await auth()
  if (!session?.user?.id) throw new UnauthorizedError()
  return session.user.id
}
