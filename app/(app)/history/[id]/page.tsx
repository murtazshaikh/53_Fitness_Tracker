import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUserId } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { toHistoryRow } from '@/lib/workout/historyRows'
import { SummaryStats } from '@/components/SummaryStats'
import {
  formatDuration, kgToDisplay, metersToDisplay, weightUnit, distanceUnit,
} from '@/lib/workout/units'
import type { UnitSystemWire } from '@/lib/workout/types'

export default async function WorkoutDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const userId = await requireUserId()
  const { id } = await params

  const [user, workout] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { unitSystem: true } }),
    // Scoped by userId, so someone else's id is a 404, never their data.
    prisma.workout.findFirst({
      where: { id, userId, status: 'COMPLETED' },
      include: {
        exercises: {
          orderBy: { index: 'asc' },
          include: { template: true, sets: { orderBy: { index: 'asc' } } },
        },
      },
    }),
  ])

  if (!workout) notFound()

  const system = user.unitSystem.toLowerCase() as UnitSystemWire
  const row = toHistoryRow(workout, system)

  return (
    <div className="mx-auto max-w-2xl p-4">
      <Link href="/history" className="text-sm text-neutral-500 hover:underline">← History</Link>
      <h1 className="mt-2 text-xl font-semibold">{workout.title}</h1>
      <p className="text-sm text-neutral-500">
        {workout.startTime.toLocaleString('en-GB')} · {formatDuration(row.durationSeconds)}
      </p>
      <SummaryStats summary={row.summary} system={system} />

      {workout.exercises.map(exercise => (
        <section key={exercise.id} className="my-4 rounded-lg border border-neutral-200 p-3">
          <h2 className="font-medium">{exercise.template.title}</h2>
          {exercise.notes && <p className="text-sm text-neutral-500">{exercise.notes}</p>}
          <ul className="mt-2 text-sm">
            {exercise.sets.map(set => (
              <li key={set.id} className="flex gap-3 py-0.5">
                <span className="w-6 text-neutral-400">{set.index + 1}</span>
                {set.weightKg !== null && (
                  <span>{kgToDisplay(set.weightKg, system).toFixed(1)} {weightUnit(system)}</span>
                )}
                {set.reps !== null && <span>× {set.reps}</span>}
                {set.distanceMeters !== null && (
                  <span>{metersToDisplay(set.distanceMeters, system).toFixed(2)} {distanceUnit(system)}</span>
                )}
                {set.durationSeconds !== null && <span>{formatDuration(set.durationSeconds)}</span>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
