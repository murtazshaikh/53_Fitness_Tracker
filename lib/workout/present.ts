import { enumToWire, setToWire, type DbSetLike } from './serialize'

type TemplateRow = {
  id: string
  title: string
  type: string
  primaryMuscleGroup: string
  secondaryMuscleGroups: string[]
  equipmentCategory: string
  isCustom: boolean
}

export function templateToWire(t: TemplateRow) {
  return {
    id: t.id,
    title: t.title,
    type: enumToWire(t.type),
    primary_muscle_group: enumToWire(t.primaryMuscleGroup),
    secondary_muscle_groups: t.secondaryMuscleGroups.map(enumToWire),
    equipment_category: enumToWire(t.equipmentCategory),
    is_custom: t.isCustom,
  }
}

type WorkoutRow = {
  id: string
  title: string
  description: string | null
  startTime: Date
  endTime: Date | null
  createdAt: Date
  updatedAt: Date
  exercises: {
    index: number
    notes: string | null
    supersetId: number | null
    restSeconds: number | null
    exerciseTemplateId: string
    template: { title: string }
    sets: DbSetLike[]
  }[]
}

export function workoutToWire(w: WorkoutRow) {
  return {
    id: w.id,
    title: w.title,
    description: w.description,
    start_time: w.startTime.toISOString(),
    end_time: w.endTime ? w.endTime.toISOString() : null,
    created_at: w.createdAt.toISOString(),
    updated_at: w.updatedAt.toISOString(),
    exercises: w.exercises.map(e => ({
      index: e.index,
      title: e.template.title,
      notes: e.notes,
      exercise_template_id: e.exerciseTemplateId,
      superset_id: e.supersetId,
      rest_seconds: e.restSeconds,
      sets: e.sets.map(setToWire),
    })),
  }
}
