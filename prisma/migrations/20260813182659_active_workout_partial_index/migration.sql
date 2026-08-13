-- Enforce at most one in-progress workout per user.
-- Prisma cannot express a partial index in schema.prisma, so this is hand-written.
-- A plain unique index would also block a user having multiple COMPLETED workouts,
-- so the WHERE clause is essential, not an optimisation.
CREATE UNIQUE INDEX "Workout_one_active_per_user"
  ON "Workout" ("userId")
  WHERE "status" = 'IN_PROGRESS';
