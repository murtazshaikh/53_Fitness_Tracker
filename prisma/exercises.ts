import type { ExerciseType, MuscleGroup, EquipmentCategory } from '@/generated/prisma/enums'

export interface SeedExercise {
  title: string
  type: ExerciseType
  primaryMuscleGroup: MuscleGroup
  secondaryMuscleGroups: MuscleGroup[]
  equipmentCategory: EquipmentCategory
}

// Short aliases keep the table below readable; the enum values are the real contract.
const wr: ExerciseType = 'WEIGHT_REPS'
const bw: ExerciseType = 'BODYWEIGHT_REPS'
const bwa: ExerciseType = 'BODYWEIGHT_ASSISTED_REPS'
const dur: ExerciseType = 'DURATION'
const dd: ExerciseType = 'DISTANCE_DURATION'

const BB: EquipmentCategory = 'BARBELL'
const DB: EquipmentCategory = 'DUMBBELL'
const MC: EquipmentCategory = 'MACHINE'
const KB: EquipmentCategory = 'KETTLEBELL'
const NO: EquipmentCategory = 'NONE'
const OT: EquipmentCategory = 'OTHER'

export const SEED_EXERCISES: SeedExercise[] = [
  // Chest
  { title: 'Bench Press (Barbell)', type: wr, primaryMuscleGroup: 'CHEST', secondaryMuscleGroups: ['TRICEPS', 'SHOULDERS'], equipmentCategory: BB },
  { title: 'Bench Press (Dumbbell)', type: wr, primaryMuscleGroup: 'CHEST', secondaryMuscleGroups: ['TRICEPS', 'SHOULDERS'], equipmentCategory: DB },
  { title: 'Incline Bench Press (Barbell)', type: wr, primaryMuscleGroup: 'CHEST', secondaryMuscleGroups: ['TRICEPS', 'SHOULDERS'], equipmentCategory: BB },
  { title: 'Incline Bench Press (Dumbbell)', type: wr, primaryMuscleGroup: 'CHEST', secondaryMuscleGroups: ['TRICEPS', 'SHOULDERS'], equipmentCategory: DB },
  { title: 'Decline Bench Press (Barbell)', type: wr, primaryMuscleGroup: 'CHEST', secondaryMuscleGroups: ['TRICEPS'], equipmentCategory: BB },
  { title: 'Chest Fly (Dumbbell)', type: wr, primaryMuscleGroup: 'CHEST', secondaryMuscleGroups: ['SHOULDERS'], equipmentCategory: DB },
  { title: 'Chest Fly (Machine)', type: wr, primaryMuscleGroup: 'CHEST', secondaryMuscleGroups: ['SHOULDERS'], equipmentCategory: MC },
  { title: 'Cable Fly Crossovers', type: wr, primaryMuscleGroup: 'CHEST', secondaryMuscleGroups: ['SHOULDERS'], equipmentCategory: MC },
  { title: 'Chest Press (Machine)', type: wr, primaryMuscleGroup: 'CHEST', secondaryMuscleGroups: ['TRICEPS'], equipmentCategory: MC },
  { title: 'Push Up', type: bw, primaryMuscleGroup: 'CHEST', secondaryMuscleGroups: ['TRICEPS', 'SHOULDERS'], equipmentCategory: NO },
  { title: 'Chest Dip', type: bw, primaryMuscleGroup: 'CHEST', secondaryMuscleGroups: ['TRICEPS'], equipmentCategory: NO },
  { title: 'Chest Dip (Assisted)', type: bwa, primaryMuscleGroup: 'CHEST', secondaryMuscleGroups: ['TRICEPS'], equipmentCategory: MC },

  // Back — lats
  { title: 'Lat Pulldown (Cable)', type: wr, primaryMuscleGroup: 'LATS', secondaryMuscleGroups: ['BICEPS', 'UPPER_BACK'], equipmentCategory: MC },
  { title: 'Lat Pulldown - Close Grip (Cable)', type: wr, primaryMuscleGroup: 'LATS', secondaryMuscleGroups: ['BICEPS'], equipmentCategory: MC },
  { title: 'Pull Up', type: bw, primaryMuscleGroup: 'LATS', secondaryMuscleGroups: ['BICEPS', 'UPPER_BACK'], equipmentCategory: NO },
  { title: 'Pull Up (Assisted)', type: bwa, primaryMuscleGroup: 'LATS', secondaryMuscleGroups: ['BICEPS'], equipmentCategory: MC },
  { title: 'Chin Up', type: bw, primaryMuscleGroup: 'LATS', secondaryMuscleGroups: ['BICEPS'], equipmentCategory: NO },
  { title: 'Dumbbell Row', type: wr, primaryMuscleGroup: 'LATS', secondaryMuscleGroups: ['UPPER_BACK', 'BICEPS'], equipmentCategory: DB },
  { title: 'Straight Arm Lat Pulldown (Cable)', type: wr, primaryMuscleGroup: 'LATS', secondaryMuscleGroups: [], equipmentCategory: MC },
  { title: 'Pullover (Dumbbell)', type: wr, primaryMuscleGroup: 'LATS', secondaryMuscleGroups: ['CHEST'], equipmentCategory: DB },

  // Back — upper
  { title: 'Bent Over Row (Barbell)', type: wr, primaryMuscleGroup: 'UPPER_BACK', secondaryMuscleGroups: ['LATS', 'BICEPS'], equipmentCategory: BB },
  { title: 'Bent Over Row (Dumbbell)', type: wr, primaryMuscleGroup: 'UPPER_BACK', secondaryMuscleGroups: ['LATS', 'BICEPS'], equipmentCategory: DB },
  { title: 'Seated Cable Row - V Grip (Cable)', type: wr, primaryMuscleGroup: 'UPPER_BACK', secondaryMuscleGroups: ['LATS', 'BICEPS'], equipmentCategory: MC },
  { title: 'Seated Row (Machine)', type: wr, primaryMuscleGroup: 'UPPER_BACK', secondaryMuscleGroups: ['LATS'], equipmentCategory: MC },
  { title: 'T Bar Row', type: wr, primaryMuscleGroup: 'UPPER_BACK', secondaryMuscleGroups: ['LATS', 'BICEPS'], equipmentCategory: BB },
  { title: 'Face Pull', type: wr, primaryMuscleGroup: 'SHOULDERS', secondaryMuscleGroups: ['UPPER_BACK'], equipmentCategory: MC },
  { title: 'Inverted Row', type: bw, primaryMuscleGroup: 'UPPER_BACK', secondaryMuscleGroups: ['BICEPS'], equipmentCategory: NO },
  { title: 'Rack Pull', type: wr, primaryMuscleGroup: 'UPPER_BACK', secondaryMuscleGroups: ['GLUTES', 'HAMSTRINGS'], equipmentCategory: BB },

  // Shoulders
  { title: 'Overhead Press (Barbell)', type: wr, primaryMuscleGroup: 'SHOULDERS', secondaryMuscleGroups: ['TRICEPS'], equipmentCategory: BB },
  { title: 'Shoulder Press (Dumbbell)', type: wr, primaryMuscleGroup: 'SHOULDERS', secondaryMuscleGroups: ['TRICEPS'], equipmentCategory: DB },
  { title: 'Seated Shoulder Press (Machine)', type: wr, primaryMuscleGroup: 'SHOULDERS', secondaryMuscleGroups: ['TRICEPS'], equipmentCategory: MC },
  { title: 'Arnold Press (Dumbbell)', type: wr, primaryMuscleGroup: 'SHOULDERS', secondaryMuscleGroups: ['TRICEPS'], equipmentCategory: DB },
  { title: 'Lateral Raise (Dumbbell)', type: wr, primaryMuscleGroup: 'SHOULDERS', secondaryMuscleGroups: [], equipmentCategory: DB },
  { title: 'Lateral Raise (Cable)', type: wr, primaryMuscleGroup: 'SHOULDERS', secondaryMuscleGroups: [], equipmentCategory: MC },
  { title: 'Front Raise (Dumbbell)', type: wr, primaryMuscleGroup: 'SHOULDERS', secondaryMuscleGroups: [], equipmentCategory: DB },
  { title: 'Rear Delt Reverse Fly (Dumbbell)', type: wr, primaryMuscleGroup: 'SHOULDERS', secondaryMuscleGroups: ['UPPER_BACK'], equipmentCategory: DB },
  { title: 'Upright Row (Barbell)', type: wr, primaryMuscleGroup: 'SHOULDERS', secondaryMuscleGroups: ['TRAPS'], equipmentCategory: BB },
  { title: 'Shrug (Barbell)', type: wr, primaryMuscleGroup: 'TRAPS', secondaryMuscleGroups: [], equipmentCategory: BB },
  { title: 'Shrug (Dumbbell)', type: wr, primaryMuscleGroup: 'TRAPS', secondaryMuscleGroups: [], equipmentCategory: DB },

  // Arms — biceps
  { title: 'Bicep Curl (Barbell)', type: wr, primaryMuscleGroup: 'BICEPS', secondaryMuscleGroups: ['FOREARMS'], equipmentCategory: BB },
  { title: 'Bicep Curl (Dumbbell)', type: wr, primaryMuscleGroup: 'BICEPS', secondaryMuscleGroups: ['FOREARMS'], equipmentCategory: DB },
  { title: 'Bicep Curl (Cable)', type: wr, primaryMuscleGroup: 'BICEPS', secondaryMuscleGroups: ['FOREARMS'], equipmentCategory: MC },
  { title: 'Hammer Curl (Dumbbell)', type: wr, primaryMuscleGroup: 'BICEPS', secondaryMuscleGroups: ['FOREARMS'], equipmentCategory: DB },
  { title: 'Preacher Curl (Barbell)', type: wr, primaryMuscleGroup: 'BICEPS', secondaryMuscleGroups: [], equipmentCategory: BB },
  { title: 'Concentration Curl', type: wr, primaryMuscleGroup: 'BICEPS', secondaryMuscleGroups: [], equipmentCategory: DB },
  { title: 'EZ Bar Biceps Curl', type: wr, primaryMuscleGroup: 'BICEPS', secondaryMuscleGroups: ['FOREARMS'], equipmentCategory: BB },

  // Arms — triceps
  { title: 'Triceps Pushdown', type: wr, primaryMuscleGroup: 'TRICEPS', secondaryMuscleGroups: [], equipmentCategory: MC },
  { title: 'Triceps Rope Pushdown', type: wr, primaryMuscleGroup: 'TRICEPS', secondaryMuscleGroups: [], equipmentCategory: MC },
  { title: 'Skullcrusher (Barbell)', type: wr, primaryMuscleGroup: 'TRICEPS', secondaryMuscleGroups: [], equipmentCategory: BB },
  { title: 'Overhead Triceps Extension (Cable)', type: wr, primaryMuscleGroup: 'TRICEPS', secondaryMuscleGroups: [], equipmentCategory: MC },
  { title: 'Triceps Extension (Dumbbell)', type: wr, primaryMuscleGroup: 'TRICEPS', secondaryMuscleGroups: [], equipmentCategory: DB },
  { title: 'Bench Press - Close Grip (Barbell)', type: wr, primaryMuscleGroup: 'TRICEPS', secondaryMuscleGroups: ['CHEST'], equipmentCategory: BB },
  { title: 'Triceps Dip', type: bw, primaryMuscleGroup: 'TRICEPS', secondaryMuscleGroups: ['CHEST'], equipmentCategory: NO },
  { title: 'Diamond Push Up', type: bw, primaryMuscleGroup: 'TRICEPS', secondaryMuscleGroups: ['CHEST'], equipmentCategory: NO },

  // Legs — quads
  { title: 'Squat (Barbell)', type: wr, primaryMuscleGroup: 'QUADRICEPS', secondaryMuscleGroups: ['GLUTES', 'HAMSTRINGS'], equipmentCategory: BB },
  { title: 'Front Squat', type: wr, primaryMuscleGroup: 'QUADRICEPS', secondaryMuscleGroups: ['GLUTES'], equipmentCategory: BB },
  { title: 'Leg Press (Machine)', type: wr, primaryMuscleGroup: 'QUADRICEPS', secondaryMuscleGroups: ['GLUTES', 'HAMSTRINGS'], equipmentCategory: MC },
  { title: 'Leg Extension (Machine)', type: wr, primaryMuscleGroup: 'QUADRICEPS', secondaryMuscleGroups: [], equipmentCategory: MC },
  { title: 'Hack Squat (Machine)', type: wr, primaryMuscleGroup: 'QUADRICEPS', secondaryMuscleGroups: ['GLUTES'], equipmentCategory: MC },
  { title: 'Bulgarian Split Squat', type: wr, primaryMuscleGroup: 'QUADRICEPS', secondaryMuscleGroups: ['GLUTES'], equipmentCategory: DB },
  { title: 'Lunge (Dumbbell)', type: wr, primaryMuscleGroup: 'QUADRICEPS', secondaryMuscleGroups: ['GLUTES'], equipmentCategory: DB },
  { title: 'Goblet Squat', type: wr, primaryMuscleGroup: 'QUADRICEPS', secondaryMuscleGroups: ['GLUTES'], equipmentCategory: KB },
  { title: 'Squat (Bodyweight)', type: bw, primaryMuscleGroup: 'QUADRICEPS', secondaryMuscleGroups: ['GLUTES'], equipmentCategory: NO },
  { title: 'Step Up', type: wr, primaryMuscleGroup: 'QUADRICEPS', secondaryMuscleGroups: ['GLUTES'], equipmentCategory: DB },

  // Legs — posterior
  { title: 'Deadlift (Barbell)', type: wr, primaryMuscleGroup: 'GLUTES', secondaryMuscleGroups: ['HAMSTRINGS', 'LOWER_BACK', 'TRAPS'], equipmentCategory: BB },
  { title: 'Romanian Deadlift (Barbell)', type: wr, primaryMuscleGroup: 'HAMSTRINGS', secondaryMuscleGroups: ['GLUTES', 'LOWER_BACK'], equipmentCategory: BB },
  { title: 'Sumo Deadlift', type: wr, primaryMuscleGroup: 'GLUTES', secondaryMuscleGroups: ['HAMSTRINGS', 'QUADRICEPS'], equipmentCategory: BB },
  { title: 'Lying Leg Curl (Machine)', type: wr, primaryMuscleGroup: 'HAMSTRINGS', secondaryMuscleGroups: [], equipmentCategory: MC },
  { title: 'Seated Leg Curl (Machine)', type: wr, primaryMuscleGroup: 'HAMSTRINGS', secondaryMuscleGroups: [], equipmentCategory: MC },
  { title: 'Hip Thrust (Barbell)', type: wr, primaryMuscleGroup: 'GLUTES', secondaryMuscleGroups: ['HAMSTRINGS'], equipmentCategory: BB },
  { title: 'Glute Bridge', type: bw, primaryMuscleGroup: 'GLUTES', secondaryMuscleGroups: ['HAMSTRINGS'], equipmentCategory: NO },
  { title: 'Good Morning (Barbell)', type: wr, primaryMuscleGroup: 'HAMSTRINGS', secondaryMuscleGroups: ['LOWER_BACK', 'GLUTES'], equipmentCategory: BB },
  { title: 'Hip Abduction (Machine)', type: wr, primaryMuscleGroup: 'ABDUCTORS', secondaryMuscleGroups: ['GLUTES'], equipmentCategory: MC },
  { title: 'Hip Adduction (Machine)', type: wr, primaryMuscleGroup: 'ADDUCTORS', secondaryMuscleGroups: [], equipmentCategory: MC },
  { title: 'Standing Calf Raise (Machine)', type: wr, primaryMuscleGroup: 'CALVES', secondaryMuscleGroups: [], equipmentCategory: MC },
  { title: 'Seated Calf Raise', type: wr, primaryMuscleGroup: 'CALVES', secondaryMuscleGroups: [], equipmentCategory: MC },
  { title: 'Back Extension (Hyperextension)', type: bw, primaryMuscleGroup: 'LOWER_BACK', secondaryMuscleGroups: ['GLUTES'], equipmentCategory: NO },

  // Core — note the duration types
  { title: 'Plank', type: dur, primaryMuscleGroup: 'ABDOMINALS', secondaryMuscleGroups: [], equipmentCategory: NO },
  { title: 'Side Plank', type: dur, primaryMuscleGroup: 'ABDOMINALS', secondaryMuscleGroups: [], equipmentCategory: NO },
  { title: 'Dead Hang', type: dur, primaryMuscleGroup: 'UPPER_BACK', secondaryMuscleGroups: ['FOREARMS'], equipmentCategory: NO },
  { title: 'Crunch', type: bw, primaryMuscleGroup: 'ABDOMINALS', secondaryMuscleGroups: [], equipmentCategory: NO },
  { title: 'Hanging Leg Raise', type: bw, primaryMuscleGroup: 'ABDOMINALS', secondaryMuscleGroups: [], equipmentCategory: NO },
  { title: 'Cable Crunch', type: wr, primaryMuscleGroup: 'ABDOMINALS', secondaryMuscleGroups: [], equipmentCategory: MC },
  { title: 'Russian Twist (Bodyweight)', type: bw, primaryMuscleGroup: 'ABDOMINALS', secondaryMuscleGroups: [], equipmentCategory: NO },
  { title: 'Sit Up', type: bw, primaryMuscleGroup: 'ABDOMINALS', secondaryMuscleGroups: [], equipmentCategory: NO },
  { title: 'Ab Wheel', type: bw, primaryMuscleGroup: 'ABDOMINALS', secondaryMuscleGroups: [], equipmentCategory: NO },

  // Cardio — distance + duration, or duration only
  { title: 'Treadmill', type: dd, primaryMuscleGroup: 'CARDIO', secondaryMuscleGroups: [], equipmentCategory: MC },
  { title: 'Running', type: dd, primaryMuscleGroup: 'CARDIO', secondaryMuscleGroups: [], equipmentCategory: NO },
  { title: 'Walking', type: dd, primaryMuscleGroup: 'CARDIO', secondaryMuscleGroups: [], equipmentCategory: NO },
  { title: 'Cycling', type: dd, primaryMuscleGroup: 'CARDIO', secondaryMuscleGroups: [], equipmentCategory: MC },
  { title: 'Rowing Machine', type: dd, primaryMuscleGroup: 'CARDIO', secondaryMuscleGroups: ['UPPER_BACK'], equipmentCategory: MC },
  { title: 'Elliptical Trainer', type: dd, primaryMuscleGroup: 'CARDIO', secondaryMuscleGroups: [], equipmentCategory: MC },
  { title: 'Swimming', type: dd, primaryMuscleGroup: 'CARDIO', secondaryMuscleGroups: ['FULL_BODY'], equipmentCategory: NO },
  { title: 'Jump Rope', type: dur, primaryMuscleGroup: 'CARDIO', secondaryMuscleGroups: ['CALVES'], equipmentCategory: OT },
  { title: 'Stair Machine', type: dur, primaryMuscleGroup: 'CARDIO', secondaryMuscleGroups: ['QUADRICEPS'], equipmentCategory: MC },
  { title: 'Battle Ropes', type: dur, primaryMuscleGroup: 'CARDIO', secondaryMuscleGroups: ['SHOULDERS'], equipmentCategory: OT },

  // Full body
  { title: 'Burpee', type: bw, primaryMuscleGroup: 'FULL_BODY', secondaryMuscleGroups: ['CARDIO'], equipmentCategory: NO },
  { title: 'Kettlebell Swing', type: wr, primaryMuscleGroup: 'FULL_BODY', secondaryMuscleGroups: ['GLUTES', 'HAMSTRINGS'], equipmentCategory: KB },
  { title: 'Clean and Jerk', type: wr, primaryMuscleGroup: 'FULL_BODY', secondaryMuscleGroups: ['SHOULDERS', 'QUADRICEPS'], equipmentCategory: BB },
  { title: 'Farmers Walk', type: dur, primaryMuscleGroup: 'FULL_BODY', secondaryMuscleGroups: ['FOREARMS', 'TRAPS'], equipmentCategory: DB },
  { title: 'Mountain Climber', type: dur, primaryMuscleGroup: 'FULL_BODY', secondaryMuscleGroups: ['ABDOMINALS'], equipmentCategory: NO },
]
