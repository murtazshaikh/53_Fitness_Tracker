import { requireUserId } from '@/lib/auth'
import { prisma } from '@/lib/db'

const humanise = (s: string) => s.toLowerCase().replace(/_/g, ' ')

export default async function ExercisesPage() {
  const userId = await requireUserId()

  const templates = await prisma.exerciseTemplate.findMany({
    where: { OR: [{ ownerId: null }, { ownerId: userId }] },
    orderBy: [{ primaryMuscleGroup: 'asc' }, { title: 'asc' }],
  })

  return (
    <div className="mx-auto max-w-2xl p-4">
      <h1 className="mb-3 text-lg font-semibold">
        Exercises <span className="text-sm font-normal text-neutral-500">({templates.length})</span>
      </h1>
      <ul>
        {templates.map(t => (
          <li key={t.id} className="flex items-baseline justify-between gap-3 border-b border-neutral-100 py-2">
            <span>
              {t.title}
              {t.isCustom && <span className="ml-2 text-xs text-blue-600">custom</span>}
            </span>
            <span className="shrink-0 text-xs text-neutral-500">
              {humanise(t.primaryMuscleGroup)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
