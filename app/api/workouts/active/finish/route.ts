import { prisma } from '@/lib/db'
import { Prisma } from '@/generated/prisma/client'
import { requireUserId } from '@/lib/auth'
import { handleApiError } from '@/lib/apiError'
import { workoutDraftSchema, validateAgainstTypes } from '@/lib/workout/draft'
import { normalizeDraft } from '@/lib/workout/normalize'
import type { ExerciseTypeWire } from '@/lib/workout/types'
import type { SetType } from '@/generated/prisma/enums'

export async function POST() {
  try {
    const userId = await requireUserId()

    const active = await prisma.workout.findFirst({
      where: { userId, status: 'IN_PROGRESS' },
      select: { id: true, draft: true },
    })
    if (!active) {
      return Response.json({ error: 'No workout in progress' }, { status: 404 })
    }

    const parsed = workoutDraftSchema.safeParse(active.draft)
    if (!parsed.success) {
      return Response.json({ error: 'Stored draft is malformed' }, { status: 400 })
    }
    const draft = parsed.data

    // Validate populated fields against each exercise's type before writing anything.
    // Scoped to seeded templates plus this user's own, so a borrowed id cannot be used.
    const templates = await prisma.exerciseTemplate.findMany({
      where: {
        id: { in: draft.exercises.map(e => e.exerciseTemplateId) },
        OR: [{ ownerId: null }, { ownerId: userId }],
      },
      select: { id: true, type: true },
    })
    const types = new Map<string, ExerciseTypeWire>(
      templates.map(t => [t.id, t.type.toLowerCase() as ExerciseTypeWire]),
    )

    const errors = validateAgainstTypes(draft, types)
    if (errors.length > 0) {
      return Response.json({ error: 'Invalid sets', issues: errors }, { status: 400 })
    }

    const rows = normalizeDraft(draft)
    if (rows.length === 0) {
      return Response.json(
        { error: 'Complete at least one set before finishing' },
        { status: 400 },
      )
    }

    // One transaction: rows in, draft out, status flipped. A partial finish would
    // leave a workout that is neither in progress nor complete.
    const finished = await prisma.$transaction(async (tx) => {
      for (const exercise of rows) {
        await tx.workoutExercise.create({
          data: {
            workoutId: active.id,
            exerciseTemplateId: exercise.exerciseTemplateId,
            index: exercise.index,
            notes: exercise.notes,
            restSeconds: exercise.restSeconds,
            supersetId: exercise.supersetId,
            sets: {
              create: exercise.sets.map(s => ({
                index: s.index,
                type: s.type as SetType,
                weightKg: s.weightKg,
                reps: s.reps,
                distanceMeters: s.distanceMeters,
                durationSeconds: s.durationSeconds,
                rpe: s.rpe,
              })),
            },
          },
        })
      }

      return tx.workout.update({
        where: { id: active.id },
        data: {
          status: 'COMPLETED',
          endTime: new Date(),
          // Prisma distinguishes JSON null from SQL NULL; DbNull clears the column.
          draft: Prisma.DbNull,
          title: draft.title,
          description: draft.description,
        },
        select: { id: true, startTime: true, endTime: true },
      })
    })

    return Response.json({
      id: finished.id,
      start_time: finished.startTime.toISOString(),
      end_time: finished.endTime!.toISOString(),
    })
  } catch (e) {
    return handleApiError(e)
  }
}
