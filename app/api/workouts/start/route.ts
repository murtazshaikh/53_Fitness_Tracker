import { prisma } from '@/lib/db'
import { requireUserId } from '@/lib/auth'
import { handleApiError } from '@/lib/apiError'
import { emptyDraft } from '@/lib/workout/draft'

function defaultTitle(now: Date): string {
  const hour = now.getHours()
  if (hour < 12) return 'Morning Workout'
  if (hour < 17) return 'Afternoon Workout'
  return 'Evening Workout'
}

export async function POST() {
  try {
    const userId = await requireUserId()

    // The partial unique index would reject this anyway; checking first turns a
    // constraint violation into a useful 409 that tells the client where to go.
    const existing = await prisma.workout.findFirst({
      where: { userId, status: 'IN_PROGRESS' },
      select: { id: true },
    })
    if (existing) {
      return Response.json(
        { error: 'A workout is already in progress', workout_id: existing.id },
        { status: 409 },
      )
    }

    const title = defaultTitle(new Date())
    const workout = await prisma.workout.create({
      data: { userId, title, status: 'IN_PROGRESS', draft: emptyDraft(title) },
    })

    return Response.json(
      {
        id: workout.id,
        status: 'in_progress',
        start_time: workout.startTime.toISOString(),
        draft: workout.draft,
      },
      { status: 201 },
    )
  } catch (e) {
    return handleApiError(e)
  }
}
