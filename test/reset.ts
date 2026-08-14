import { prisma } from '@/lib/db'

/**
 * Clears the test database in foreign-key order. Workouts go first because
 * WorkoutExercise references ExerciseTemplate — deleting templates while any
 * workout still references them violates the constraint. Sets and workout
 * exercises fall away by cascade.
 */
export async function resetDb() {
  await prisma.workout.deleteMany()
  await prisma.exerciseTemplate.deleteMany()
  await prisma.user.deleteMany()
}
