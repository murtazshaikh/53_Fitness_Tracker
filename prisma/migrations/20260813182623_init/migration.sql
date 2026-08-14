-- CreateEnum
CREATE TYPE "UnitSystem" AS ENUM ('METRIC', 'IMPERIAL');

-- CreateEnum
CREATE TYPE "WorkoutStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "SetType" AS ENUM ('WARMUP', 'NORMAL', 'FAILURE', 'DROPSET');

-- CreateEnum
CREATE TYPE "ExerciseType" AS ENUM ('WEIGHT_REPS', 'REPS_ONLY', 'BODYWEIGHT_REPS', 'BODYWEIGHT_ASSISTED_REPS', 'DURATION', 'WEIGHT_DURATION', 'DISTANCE_DURATION', 'SHORT_DISTANCE_WEIGHT');

-- CreateEnum
CREATE TYPE "MuscleGroup" AS ENUM ('ABDOMINALS', 'SHOULDERS', 'BICEPS', 'TRICEPS', 'FOREARMS', 'QUADRICEPS', 'HAMSTRINGS', 'CALVES', 'GLUTES', 'ABDUCTORS', 'ADDUCTORS', 'LATS', 'UPPER_BACK', 'TRAPS', 'LOWER_BACK', 'CHEST', 'CARDIO', 'NECK', 'FULL_BODY', 'OTHER');

-- CreateEnum
CREATE TYPE "EquipmentCategory" AS ENUM ('NONE', 'BARBELL', 'DUMBBELL', 'KETTLEBELL', 'MACHINE', 'PLATE', 'RESISTANCE_BAND', 'SUSPENSION', 'OTHER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unitSystem" "UnitSystem" NOT NULL DEFAULT 'METRIC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseTemplate" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "ExerciseType" NOT NULL,
    "primaryMuscleGroup" "MuscleGroup" NOT NULL,
    "secondaryMuscleGroups" "MuscleGroup"[],
    "equipmentCategory" "EquipmentCategory" NOT NULL,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExerciseTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workout" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "WorkoutStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "draft" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutExercise" (
    "id" TEXT NOT NULL,
    "workoutId" TEXT NOT NULL,
    "exerciseTemplateId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "notes" TEXT,
    "supersetId" INTEGER,
    "restSeconds" INTEGER,

    CONSTRAINT "WorkoutExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SetEntry" (
    "id" TEXT NOT NULL,
    "workoutExerciseId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "type" "SetType" NOT NULL DEFAULT 'NORMAL',
    "weightKg" DOUBLE PRECISION,
    "reps" INTEGER,
    "distanceMeters" DOUBLE PRECISION,
    "durationSeconds" INTEGER,
    "rpe" DOUBLE PRECISION,
    "customMetric" DOUBLE PRECISION,

    CONSTRAINT "SetEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "ExerciseTemplate_ownerId_idx" ON "ExerciseTemplate"("ownerId");

-- CreateIndex
CREATE INDEX "ExerciseTemplate_title_idx" ON "ExerciseTemplate"("title");

-- CreateIndex
CREATE INDEX "Workout_userId_status_idx" ON "Workout"("userId", "status");

-- CreateIndex
CREATE INDEX "Workout_userId_startTime_idx" ON "Workout"("userId", "startTime");

-- CreateIndex
CREATE INDEX "WorkoutExercise_workoutId_idx" ON "WorkoutExercise"("workoutId");

-- CreateIndex
CREATE INDEX "WorkoutExercise_exerciseTemplateId_idx" ON "WorkoutExercise"("exerciseTemplateId");

-- CreateIndex
CREATE INDEX "SetEntry_workoutExerciseId_idx" ON "SetEntry"("workoutExerciseId");

-- AddForeignKey
ALTER TABLE "ExerciseTemplate" ADD CONSTRAINT "ExerciseTemplate_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workout" ADD CONSTRAINT "Workout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutExercise" ADD CONSTRAINT "WorkoutExercise_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "Workout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutExercise" ADD CONSTRAINT "WorkoutExercise_exerciseTemplateId_fkey" FOREIGN KEY ("exerciseTemplateId") REFERENCES "ExerciseTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetEntry" ADD CONSTRAINT "SetEntry_workoutExerciseId_fkey" FOREIGN KEY ("workoutExerciseId") REFERENCES "WorkoutExercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;
