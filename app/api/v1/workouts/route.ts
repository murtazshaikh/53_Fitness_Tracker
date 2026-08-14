import { prisma } from '@/lib/db'
import { requireUserId } from '@/lib/auth'
import { handleApiError } from '@/lib/apiError'
import { workoutToWire } from '@/lib/workout/present'

const MAX_PAGE_SIZE = 50

export async function GET(request: Request) {
  try {
    const userId = await requireUserId()
    const url = new URL(request.url)

    const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1)
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Number(url.searchParams.get('pageSize') ?? '10') || 10),
    )

    const [workouts, total] = await Promise.all([
      prisma.workout.findMany({
        where: { userId, status: 'COMPLETED' },
        orderBy: { startTime: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          exercises: {
            orderBy: { index: 'asc' },
            include: {
              template: { select: { title: true } },
              sets: { orderBy: { index: 'asc' } },
            },
          },
        },
      }),
      prisma.workout.count({ where: { userId, status: 'COMPLETED' } }),
    ])

    return Response.json({
      page,
      page_size: pageSize,
      page_count: Math.ceil(total / pageSize),
      workouts: workouts.map(workoutToWire),
    })
  } catch (e) {
    return handleApiError(e)
  }
}
