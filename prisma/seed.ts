import { prisma } from '@/lib/db'
import { SEED_EXERCISES } from './exercises'

async function main() {
  // Seeded templates have ownerId null, which is what distinguishes them from a
  // user's custom exercises. Matching on title keeps re-runs idempotent.
  for (const exercise of SEED_EXERCISES) {
    const existing = await prisma.exerciseTemplate.findFirst({
      where: { title: exercise.title, ownerId: null },
      select: { id: true },
    })

    if (existing) {
      await prisma.exerciseTemplate.update({ where: { id: existing.id }, data: exercise })
    } else {
      await prisma.exerciseTemplate.create({ data: { ...exercise, isCustom: false } })
    }
  }

  const count = await prisma.exerciseTemplate.count({ where: { ownerId: null } })
  console.log(`Seeded ${count} exercise templates`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
