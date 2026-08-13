import { prisma } from '@/lib/db'
import { requireUserId } from '@/lib/auth'
import { handleApiError } from '@/lib/apiError'
import { enumToWire } from '@/lib/workout/serialize'

/** Powers the PREV column: every set of this exercise the user has completed, newest first. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ templateId: string }> },
) {
  try {
    const userId = await requireUserId()
    const { templateId } = await params

    const rows = await prisma.workoutExercise.findMany({
      where: {
        exerciseTemplateId: templateId,
        // Scoping through the workout keeps another user's history unreachable.
        workout: { userId, status: 'COMPLETED' },
      },
      orderBy: { workout: { startTime: 'desc' } },
      take: 50,
      select: {
        workout: { select: { id: true, title: true, startTime: true, endTime: true } },
        sets: { orderBy: { index: 'asc' } },
      },
    })

    const history = rows.flatMap(row =>
      row.sets.map(set => ({
        workout_id: row.workout.id,
        workout_title: row.workout.title,
        workout_start_time: row.workout.startTime.toISOString(),
        workout_end_time: row.workout.endTime?.toISOString() ?? null,
        exercise_template_id: templateId,
        set_type: enumToWire(set.type),
        weight_kg: set.weightKg,
        reps: set.reps,
        distance_meters: set.distanceMeters,
        duration_seconds: set.durationSeconds,
        rpe: set.rpe,
      })),
    )

    return Response.json({ exercise_history: history })
  } catch (e) {
    return handleApiError(e)
  }
}
