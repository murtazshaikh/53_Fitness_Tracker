import Link from 'next/link'
import { requireUserId } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { toHistoryRow } from '@/lib/workout/historyRows'
import { SummaryStats } from '@/components/SummaryStats'
import { formatDuration } from '@/lib/workout/units'
import type { UnitSystemWire } from '@/lib/workout/types'

export default async function HistoryPage() {
  const userId = await requireUserId()

  const [user, workouts] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { unitSystem: true } }),
    prisma.workout.findMany({
      where: { userId, status: 'COMPLETED' },
      orderBy: { startTime: 'desc' },
      take: 50,
      include: { exercises: { include: { sets: true } } },
    }),
  ])

  const system = user.unitSystem.toLowerCase() as UnitSystemWire

  if (workouts.length === 0) {
    return (
      <p className="mx-auto max-w-2xl p-10 text-center text-neutral-500">
        No workouts yet. <Link href="/workout" className="underline">Start one.</Link>
      </p>
    )
  }

  return (
    <ul className="mx-auto max-w-2xl p-4">
      {workouts.map(w => {
        const row = toHistoryRow(w, system)
        return (
          <li key={row.id} className="border-b border-neutral-100">
            <Link href={`/history/${row.id}`} className="block py-3 hover:bg-neutral-50">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-medium">{row.title}</h2>
                <time className="shrink-0 text-xs text-neutral-500">
                  {row.startTime.toLocaleDateString('en-GB', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </time>
              </div>
              <p className="text-sm text-neutral-500">{formatDuration(row.durationSeconds)}</p>
              <SummaryStats summary={row.summary} system={system} />
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
