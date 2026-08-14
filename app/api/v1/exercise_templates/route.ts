import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireUserId } from '@/lib/auth'
import { handleApiError } from '@/lib/apiError'
import { templateToWire } from '@/lib/workout/present'
import { enumFromWire } from '@/lib/workout/serialize'
import type { Prisma } from '@/generated/prisma/client'
import type { ExerciseType, MuscleGroup, EquipmentCategory } from '@/generated/prisma/enums'

const EXERCISE_TYPES = [
  'weight_reps', 'reps_only', 'bodyweight_reps', 'bodyweight_assisted_reps',
  'duration', 'weight_duration', 'distance_duration', 'short_distance_weight',
] as const

const MUSCLE_GROUPS = [
  'abdominals', 'shoulders', 'biceps', 'triceps', 'forearms', 'quadriceps',
  'hamstrings', 'calves', 'glutes', 'abductors', 'adductors', 'lats',
  'upper_back', 'traps', 'lower_back', 'chest', 'cardio', 'neck', 'full_body', 'other',
] as const

const EQUIPMENT = [
  'none', 'barbell', 'dumbbell', 'kettlebell', 'machine', 'plate',
  'resistance_band', 'suspension', 'other',
] as const

export async function GET(request: Request) {
  try {
    const userId = await requireUserId()
    const url = new URL(request.url)
    const q = url.searchParams.get('q')?.trim()
    const muscleGroup = url.searchParams.get('muscle_group')?.trim()

    const where: Prisma.ExerciseTemplateWhereInput = {
      // Seeded templates plus the caller's own custom ones — never anyone else's.
      OR: [{ ownerId: null }, { ownerId: userId }],
    }
    if (q) where.title = { contains: q, mode: 'insensitive' }
    if (muscleGroup && (MUSCLE_GROUPS as readonly string[]).includes(muscleGroup)) {
      where.primaryMuscleGroup = enumFromWire(muscleGroup) as MuscleGroup
    }

    const templates = await prisma.exerciseTemplate.findMany({
      where,
      orderBy: { title: 'asc' },
      take: 500,
    })

    return Response.json({ exercise_templates: templates.map(templateToWire) })
  } catch (e) {
    return handleApiError(e)
  }
}

const createSchema = z.object({
  title: z.string().min(1).max(200),
  type: z.enum(EXERCISE_TYPES),
  primary_muscle_group: z.enum(MUSCLE_GROUPS),
  secondary_muscle_groups: z.array(z.enum(MUSCLE_GROUPS)).max(5),
  equipment_category: z.enum(EQUIPMENT),
})

export async function POST(request: Request) {
  try {
    const userId = await requireUserId()

    const parsed = createSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return Response.json({ error: 'Invalid exercise' }, { status: 400 })
    }

    const template = await prisma.exerciseTemplate.create({
      data: {
        title: parsed.data.title,
        type: enumFromWire(parsed.data.type) as ExerciseType,
        primaryMuscleGroup: enumFromWire(parsed.data.primary_muscle_group) as MuscleGroup,
        secondaryMuscleGroups: parsed.data.secondary_muscle_groups.map(enumFromWire) as MuscleGroup[],
        equipmentCategory: enumFromWire(parsed.data.equipment_category) as EquipmentCategory,
        isCustom: true,
        ownerId: userId,
      },
    })

    return Response.json({ exercise_template: templateToWire(template) }, { status: 201 })
  } catch (e) {
    return handleApiError(e)
  }
}
