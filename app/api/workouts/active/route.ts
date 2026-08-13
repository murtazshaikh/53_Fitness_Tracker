import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireUserId } from '@/lib/auth'
import { handleApiError } from '@/lib/apiError'
import { workoutDraftSchema } from '@/lib/workout/draft'

const patchSchema = z.object({ draft: workoutDraftSchema })

export async function GET() {
  try {
    const userId = await requireUserId()
    const workout = await prisma.workout.findFirst({
      where: { userId, status: 'IN_PROGRESS' },
      select: { id: true, title: true, startTime: true, draft: true, updatedAt: true },
    })

    if (!workout) return Response.json({ workout: null })

    return Response.json({
      workout: {
        id: workout.id,
        title: workout.title,
        start_time: workout.startTime.toISOString(),
        updated_at: workout.updatedAt.toISOString(),
        draft: workout.draft,
      },
    })
  } catch (e) {
    return handleApiError(e)
  }
}

export async function PATCH(request: Request) {
  try {
    const userId = await requireUserId()

    const parsed = patchSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid draft', issues: parsed.error.issues.map(i => i.message) },
        { status: 400 },
      )
    }

    const active = await prisma.workout.findFirst({
      where: { userId, status: 'IN_PROGRESS' },
      select: { id: true },
    })
    if (!active) {
      return Response.json({ error: 'No workout in progress' }, { status: 404 })
    }

    // Last write wins, by design: a single-user tracker with two tabs open resolves
    // on updatedAt rather than carrying conflict-resolution machinery.
    const saved = await prisma.workout.update({
      where: { id: active.id },
      data: { draft: parsed.data.draft, title: parsed.data.draft.title },
      select: { updatedAt: true },
    })

    return Response.json({ updated_at: saved.updatedAt.toISOString() })
  } catch (e) {
    return handleApiError(e)
  }
}

export async function DELETE() {
  try {
    const userId = await requireUserId()
    await prisma.workout.deleteMany({ where: { userId, status: 'IN_PROGRESS' } })
    return new Response(null, { status: 204 })
  } catch (e) {
    return handleApiError(e)
  }
}
