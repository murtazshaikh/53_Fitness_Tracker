import { z } from 'zod'
import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/password'

const bodySchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(200),
  name: z.string().min(1).max(100),
})

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return Response.json({ error: 'Invalid registration details' }, { status: 400 })
  }

  // Normalise casing so Mixed@Example.com and mixed@example.com cannot both exist.
  const email = parsed.data.email.toLowerCase()

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return Response.json({ error: 'That email is already registered' }, { status: 409 })
  }

  const user = await prisma.user.create({
    data: {
      email,
      name: parsed.data.name,
      passwordHash: await hashPassword(parsed.data.password),
    },
    // Explicit select: never let the hash reach the response.
    select: { id: true, email: true, name: true },
  })

  return Response.json({ user }, { status: 201 })
}
