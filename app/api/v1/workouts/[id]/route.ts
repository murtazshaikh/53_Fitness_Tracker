import { prisma } from '@/lib/db'
import { requireUserId } from '@/lib/auth'
import { handleApiError } from '@/lib/apiError'
import { workoutToWire } from '@/lib/workout/present'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireUserId()
    const { id } = await params

    // Scoped by userId, so another user's id yields 404 rather than their data.
    const workout = await prisma.workout.findFirst({
      where: { id, userId, status: 'COMPLETED' },
      include: {
        exercises: {
          orderBy: { index: 'asc' },
          include: {
            template: { select: { title: true } },
            sets: { orderBy: { index: 'asc' } },
          },
        },
      },
    })

    if (!workout) return Response.json({ error: 'Not found' }, { status: 404 })

    return Response.json({ workout: workoutToWire(workout) })
  } catch (e) {
    return handleApiError(e)
  }
}
