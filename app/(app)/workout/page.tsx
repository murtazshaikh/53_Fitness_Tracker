import { requireUserId } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { templateToWire } from '@/lib/workout/present'
import { ActiveWorkout } from './ActiveWorkout'
import { StartWorkoutButton } from './StartWorkoutButton'
import type { TemplateSummary } from './ExercisePicker'
import type { UnitSystemWire, WorkoutDraft } from '@/lib/workout/types'

export default async function WorkoutPage() {
  const userId = await requireUserId()

  const [user, active, templates] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { unitSystem: true } }),
    prisma.workout.findFirst({
      where: { userId, status: 'IN_PROGRESS' },
      select: { id: true, title: true, startTime: true, draft: true },
    }),
    prisma.exerciseTemplate.findMany({
      where: { OR: [{ ownerId: null }, { ownerId: userId }] },
      orderBy: { title: 'asc' },
    }),
  ])

  const system = user.unitSystem.toLowerCase() as UnitSystemWire
  const wire = templates.map(templateToWire) as TemplateSummary[]

  if (!active) return <StartWorkoutButton />

  return (
    <ActiveWorkout
      workout={{
        id: active.id,
        title: active.title,
        start_time: active.startTime.toISOString(),
        draft: active.draft as unknown as WorkoutDraft,
      }}
      templates={wire}
      system={system}
    />
  )
}
