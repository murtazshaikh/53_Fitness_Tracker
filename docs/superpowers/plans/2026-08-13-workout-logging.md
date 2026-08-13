# Workout Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web app where a signed-in user starts a workout, logs exercises and sets live, finishes it, and sees it in their history.

**Architecture:** Next.js App Router with the backend inside it — API route handlers plus Server Components, Prisma over Postgres. The live session lives in client state mirrored to `localStorage` and is autosaved to the server as a single JSON draft blob; on finish it is normalized into relational rows. All non-trivial logic lives in `lib/workout/` as pure functions with no Next.js or Prisma imports, so it is unit-testable without a server or database.

**Tech Stack:** Bun 1.3 (package manager + runtime), Next.js 16 (App Router), TypeScript, Prisma 6, Postgres 16 (Docker), Auth.js v5 (`next-auth@beta`) with credentials + `bcryptjs`, Zod, Tailwind CSS v4, Vitest, Playwright.

## Global Constraints

- **Never write the name of the reference product** (the commercial tracker this is modelled on) in any file, comment, or commit message. Describe the wire format only as "an established third-party workout-tracking API format".
- **Never add `Co-Authored-By` trailers** or any AI/assistant attribution to commit messages.
- **Canonical units in the database: kilograms and meters.** Convert only at the UI edge.
- **API JSON uses snake_case** (`weight_kg`, `exercise_template_id`); DB and TypeScript use camelCase (`weightKg`).
- **API JSON enum values are lowercase** (`weight_reps`, `dropset`); Prisma enums are `UPPER_SNAKE_CASE` (`WEIGHT_REPS`, `DROPSET`).
- **`lib/workout/` must not import** from `next`, `@prisma/client`, or any React package. It is plain functions over plain data.
- **Every API handler resolves `userId` from the server session** and scopes its queries by it. The client never sends a user id.
- **`null` means absent, never zero.** A `restSeconds` of `null` is "no timer"; a `weightKg` of `null` is "not applicable to this exercise type".
- **Bun is the package manager and script runner** (`bun add`, `bun run`, `bunx`). Bun runs TypeScript directly, so no `tsx`.
- **Vitest is the test runner, not `bun test`** — the API tests use `vi.doMock` and the autosave test uses `vi.useFakeTimers`; the `bun:test` equivalents differ in hoisting and reset semantics.
- **Postgres publishes on host port 5433**, not 5432, which a native Postgres already owns on this machine.
- **Next.js 16 differs from training data.** Consult `node_modules/next/dist/docs/` before writing framework code.
- Bun 1.3, Node 22 available as a fallback.

---

## File Structure

**Domain logic** (`lib/workout/` — pure, framework-free, the heart of the app):

| File | Responsibility |
|---|---|
| `types.ts` | Shared TypeScript types for drafts and set kinds. No logic. |
| `setKinds.ts` | Which of the four measurable fields each `ExerciseType` uses. |
| `units.ts` | kg↔lb, m↔km/mi conversion, speed derivation, unit labels. |
| `summary.ts` | Per-workout stats computed from a set list. |
| `serialize.ts` | camelCase↔snake_case and enum-case mapping for the wire. |
| `draft.ts` | Zod schemas for the draft blob + validation against exercise types. |
| `normalize.ts` | Draft → relational rows, dropping incomplete sets. |

**Infrastructure:**

| File | Responsibility |
|---|---|
| `lib/db.ts` | Prisma client singleton. |
| `lib/auth.ts` | Auth.js config, session helper. |
| `prisma/schema.prisma` | Models and enums. |
| `prisma/seed.ts` | ~80 exercise templates. |

**API** (`app/api/`):

| File | Responsibility |
|---|---|
| `workouts/start/route.ts` | `POST` — create the in-progress row. |
| `workouts/active/route.ts` | `GET`/`PATCH`/`DELETE` — draft rehydrate, autosave, discard. |
| `workouts/active/finish/route.ts` | `POST` — normalize and complete. |
| `v1/workouts/route.ts` | `GET` — paginated finished workouts. |
| `v1/workouts/[id]/route.ts` | `GET` — one workout, full detail. |
| `v1/exercise_templates/route.ts` | `GET`/`POST` — library search, custom create. |
| `v1/exercise_history/[templateId]/route.ts` | `GET` — powers the PREV column. |
| `auth/[...nextauth]/route.ts` | Auth.js handlers. |
| `auth/register/route.ts` | `POST` — account creation. |

**UI** (`app/`):

| File | Responsibility |
|---|---|
| `(auth)/login/page.tsx`, `(auth)/register/page.tsx` | Credential forms. |
| `(app)/workout/page.tsx` | Server shell — loads active draft, renders session. |
| `(app)/workout/ActiveWorkout.tsx` | Client — session state, autosave, finish. |
| `(app)/workout/SetRow.tsx` | Client — renders inputs per set kind, derived speed. |
| `(app)/workout/ExercisePicker.tsx` | Client — search/filter modal, custom create. |
| `(app)/history/page.tsx`, `(app)/history/[id]/page.tsx` | Server — list and detail. |
| `(app)/exercises/page.tsx` | Server — library browse. |
| `components/SummaryStats.tsx` | Shared — renders a `WorkoutSummary`. |

---

## Phase A — Foundation

### Task 1: Scaffold the project and test harness

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `docker-compose.yml`, `.env.example`, `.env`, `.gitignore`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`
- Test: `lib/smoke.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a working `bun run test` (Vitest) and `bun run dev` (Next.js); Postgres reachable at `DATABASE_URL`.

- [ ] **Step 1: Create the Next.js app**

`create-next-app` derives the package name from the directory, and npm forbids capital
letters, so it refuses to scaffold into `53_Fitness_Tracker` directly. Scaffold into a
temporary directory and copy the result in:

```bash
cd /tmp
bunx create-next-app@latest fitness-tracker --typescript --tailwind --app \
  --eslint --import-alias="@/*" --disable-git --yes

cd /tmp/fitness-tracker
for f in $(ls -A | grep -v '^node_modules$'); do
  cp -R "$f" /Users/murtaza/pro/coding/53_Fitness_Tracker/
done
```

`--disable-git` matters: the target is already a git repo. Do not pass `--no-turbopack`
(not a valid flag) and do not pass `--src-dir=false` (not valid syntax).

Then fix two things the generator gets wrong for this project. It may create `src/` from a
saved preference despite the flags, and the plan's file structure puts `app/` at the root:

```bash
cd /Users/murtaza/pro/coding/53_Fitness_Tracker
rm -rf .next
[ -d src/app ] && mv src/app app && rmdir src
```

Then edit `tsconfig.json` so the alias points at the repo root rather than `src/`:

```json
"paths": { "@/*": ["./*"] }
```

- [ ] **Step 2: Install runtime and test dependencies**

```bash
bun add @prisma/client zod next-auth@beta bcryptjs
bun add -d prisma vitest @vitejs/plugin-react vite-tsconfig-paths \
  @testing-library/react @testing-library/jest-dom jsdom @types/bcryptjs tsx
```

- [ ] **Step 3: Configure Vitest**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['node_modules', '.next', 'e2e'],
  },
})
```

Create `vitest.setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
```

Add to `package.json` scripts:

```json
"test": "vitest run",
"test:watch": "vitest",
"db:up": "docker compose up -d",
"db:migrate": "prisma migrate dev",
"db:seed": "tsx prisma/seed.ts"
```

- [ ] **Step 4: Write a smoke test**

Create `lib/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest'

describe('test harness', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 5: Run it and verify it passes**

Run: `bun run test`
Expected: PASS, 1 test.

- [ ] **Step 6: Add Postgres via Docker**

Create `docker-compose.yml`:

```yaml
# Explicit project name so every container, network and volume created here is
# namespaced to this app and cannot collide with other compose projects.
name: fitness-tracker

services:
  db:
    image: postgres:16
    container_name: fitness-tracker-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: fitness
      POSTGRES_PASSWORD: fitness
      POSTGRES_DB: fitness
    # Host port 5433, not 5432: a native Postgres already owns 5432 on this machine.
    # Inside the container it is still 5432.
    ports:
      - '5433:5432'
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U fitness -d fitness']
      interval: 5s
      timeout: 3s
      retries: 10

volumes:
  pgdata:
```

This machine already runs other compose projects. Only ever run `docker compose` from this
directory; never global commands like `docker system prune` or `docker stop $(docker ps -q)`.

Create `.env.example` (commit this) and `.env` (do not commit). `create-next-app` adds `.env*` to `.gitignore`, which also ignores the example — add `!.env.example` below it:

```
DATABASE_URL="postgresql://fitness:fitness@localhost:5433/fitness?schema=public"
AUTH_SECRET="dev-secret-change-me"
```

Generate a real secret for `.env` with `bunx auth secret`.

- [ ] **Step 7: Start the database and verify it accepts connections**

```bash
bun run db:up
docker compose exec db pg_isready -U fitness
```

Expected: `accepting connections`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app, Vitest harness, and Postgres"
```

---

### Task 2: Prisma schema, enums, and the partial unique index

**Files:**
- Create: `prisma/schema.prisma`, `lib/db.ts`, `prisma/migrations/*/migration.sql` (generated, then hand-edited)
- Test: `lib/db.test.ts`

**Interfaces:**
- Consumes: `DATABASE_URL` from Task 1.
- Produces: `prisma` client export from `lib/db.ts`; Prisma-generated types `ExerciseType`, `MuscleGroup`, `EquipmentCategory`, `SetType`, `WorkoutStatus`, `UnitSystem`.

- [ ] **Step 1: Write the schema**

Create `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UnitSystem {
  METRIC
  IMPERIAL
}

enum WorkoutStatus {
  IN_PROGRESS
  COMPLETED
}

enum SetType {
  WARMUP
  NORMAL
  FAILURE
  DROPSET
}

enum ExerciseType {
  WEIGHT_REPS
  REPS_ONLY
  BODYWEIGHT_REPS
  BODYWEIGHT_ASSISTED_REPS
  DURATION
  WEIGHT_DURATION
  DISTANCE_DURATION
  SHORT_DISTANCE_WEIGHT
}

enum MuscleGroup {
  ABDOMINALS
  SHOULDERS
  BICEPS
  TRICEPS
  FOREARMS
  QUADRICEPS
  HAMSTRINGS
  CALVES
  GLUTES
  ABDUCTORS
  ADDUCTORS
  LATS
  UPPER_BACK
  TRAPS
  LOWER_BACK
  CHEST
  CARDIO
  NECK
  FULL_BODY
  OTHER
}

enum EquipmentCategory {
  NONE
  BARBELL
  DUMBBELL
  KETTLEBELL
  MACHINE
  PLATE
  RESISTANCE_BAND
  SUSPENSION
  OTHER
}

model User {
  id           String     @id @default(cuid())
  email        String     @unique
  passwordHash String
  name         String
  unitSystem   UnitSystem @default(METRIC)
  createdAt    DateTime   @default(now())

  workouts        Workout[]
  customExercises ExerciseTemplate[]
}

model ExerciseTemplate {
  id                     String            @id @default(cuid())
  title                  String
  type                   ExerciseType
  primaryMuscleGroup     MuscleGroup
  secondaryMuscleGroups  MuscleGroup[]
  equipmentCategory      EquipmentCategory
  isCustom               Boolean           @default(false)
  ownerId                String?
  createdAt              DateTime          @default(now())

  owner             User?             @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  workoutExercises  WorkoutExercise[]

  @@index([ownerId])
  @@index([title])
}

model Workout {
  id          String        @id @default(cuid())
  userId      String
  title       String
  description String?
  status      WorkoutStatus @default(IN_PROGRESS)
  startTime   DateTime      @default(now())
  endTime     DateTime?
  draft       Json?
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  user      User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  exercises WorkoutExercise[]

  @@index([userId, status])
  @@index([userId, startTime])
}

model WorkoutExercise {
  id                 String  @id @default(cuid())
  workoutId          String
  exerciseTemplateId String
  index              Int
  notes              String?
  supersetId         Int?
  restSeconds        Int?

  workout  Workout          @relation(fields: [workoutId], references: [id], onDelete: Cascade)
  template ExerciseTemplate @relation(fields: [exerciseTemplateId], references: [id])
  sets     SetEntry[]

  @@index([workoutId])
  @@index([exerciseTemplateId])
}

model SetEntry {
  id                String  @id @default(cuid())
  workoutExerciseId String
  index             Int
  type              SetType @default(NORMAL)
  weightKg          Float?
  reps              Int?
  distanceMeters    Float?
  durationSeconds   Int?
  rpe               Float?
  customMetric      Float?

  workoutExercise WorkoutExercise @relation(fields: [workoutExerciseId], references: [id], onDelete: Cascade)

  @@index([workoutExerciseId])
}
```

- [ ] **Step 2: Create the Prisma client singleton**

Create `lib/db.ts`:

```ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

- [ ] **Step 3: Generate the migration**

```bash
bunx prisma migrate dev --name init
```

- [ ] **Step 4: Add the partial unique index by hand**

Prisma cannot express a partial index, so append this to the generated
`prisma/migrations/<timestamp>_init/migration.sql`:

```sql
-- Enforce at most one in-progress workout per user.
-- A plain unique index would also block multiple COMPLETED workouts, so it must be partial.
CREATE UNIQUE INDEX "Workout_one_active_per_user"
  ON "Workout" ("userId")
  WHERE "status" = 'IN_PROGRESS';
```

Re-apply it:

```bash
bunx prisma migrate reset --force
```

- [ ] **Step 5: Write the failing test for the constraint**

Create `lib/db.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { prisma } from './db'

async function makeUser(email: string) {
  return prisma.user.create({
    data: { email, passwordHash: 'x', name: 'Test' },
  })
}

describe('one in-progress workout per user', () => {
  beforeEach(async () => {
    await prisma.workout.deleteMany()
    await prisma.user.deleteMany()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('rejects a second in-progress workout for the same user', async () => {
    const user = await makeUser('a@example.com')
    await prisma.workout.create({
      data: { userId: user.id, title: 'First', status: 'IN_PROGRESS' },
    })

    await expect(
      prisma.workout.create({
        data: { userId: user.id, title: 'Second', status: 'IN_PROGRESS' },
      }),
    ).rejects.toThrow()
  })

  it('allows many completed workouts for the same user', async () => {
    const user = await makeUser('b@example.com')
    await prisma.workout.create({
      data: { userId: user.id, title: 'One', status: 'COMPLETED', endTime: new Date() },
    })
    await prisma.workout.create({
      data: { userId: user.id, title: 'Two', status: 'COMPLETED', endTime: new Date() },
    })

    expect(await prisma.workout.count()).toBe(2)
  })

  it('allows two different users to each have one in progress', async () => {
    const a = await makeUser('c@example.com')
    const b = await makeUser('d@example.com')
    await prisma.workout.create({ data: { userId: a.id, title: 'A', status: 'IN_PROGRESS' } })
    await prisma.workout.create({ data: { userId: b.id, title: 'B', status: 'IN_PROGRESS' } })

    expect(await prisma.workout.count()).toBe(2)
  })
})
```

- [ ] **Step 6: Run the tests**

Run: `bunx vitest run lib/db.test.ts`
Expected: PASS, 3 tests. If the first test fails with "expected to throw", the partial index was not applied — re-check Step 4 and re-run `bunx prisma migrate reset --force`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add Prisma schema with partial unique index on active workouts"
```

---

## Phase B — Domain logic (pure functions, no framework)

### Task 3: Shared types and the set-kind lookup

**Files:**
- Create: `lib/workout/types.ts`, `lib/workout/setKinds.ts`
- Test: `lib/workout/setKinds.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type ExerciseTypeWire = 'weight_reps' | 'reps_only' | 'bodyweight_reps' | 'bodyweight_assisted_reps' | 'duration' | 'weight_duration' | 'distance_duration' | 'short_distance_weight'`
  - `type SetField = 'weight' | 'reps' | 'duration' | 'distance'`
  - `type SetTypeWire = 'warmup' | 'normal' | 'failure' | 'dropset'`
  - `type UnitSystemWire = 'metric' | 'imperial'`
  - `interface DraftSet`, `interface DraftExercise`, `interface WorkoutDraft`
  - `fieldsFor(type: ExerciseTypeWire): readonly SetField[]`
  - `allowsField(type: ExerciseTypeWire, field: SetField): boolean`
  - `isAssistedType(type: ExerciseTypeWire): boolean`

- [ ] **Step 1: Write the types**

Create `lib/workout/types.ts`:

```ts
export type ExerciseTypeWire =
  | 'weight_reps'
  | 'reps_only'
  | 'bodyweight_reps'
  | 'bodyweight_assisted_reps'
  | 'duration'
  | 'weight_duration'
  | 'distance_duration'
  | 'short_distance_weight'

export type SetTypeWire = 'warmup' | 'normal' | 'failure' | 'dropset'

export type SetField = 'weight' | 'reps' | 'duration' | 'distance'

export type UnitSystemWire = 'metric' | 'imperial'

/** One set inside the draft blob. `completed` is draft-only and never persisted as a column. */
export interface DraftSet {
  type: SetTypeWire
  weightKg: number | null
  reps: number | null
  distanceMeters: number | null
  durationSeconds: number | null
  rpe: number | null
  completed: boolean
}

export interface DraftExercise {
  exerciseTemplateId: string
  notes: string | null
  restSeconds: number | null
  supersetId: number | null
  sets: DraftSet[]
}

export interface WorkoutDraft {
  title: string
  description: string | null
  exercises: DraftExercise[]
}

/** The subset of set fields the summary needs. Accepts drafts and DB rows alike. */
export interface MeasurableSet {
  weightKg: number | null
  reps: number | null
  distanceMeters: number | null
  durationSeconds: number | null
}
```

- [ ] **Step 2: Write the failing test**

Create `lib/workout/setKinds.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { fieldsFor, allowsField, isAssistedType } from './setKinds'
import type { ExerciseTypeWire } from './types'

describe('fieldsFor', () => {
  it('maps each exercise type to its measurable fields', () => {
    expect(fieldsFor('weight_reps')).toEqual(['weight', 'reps'])
    expect(fieldsFor('reps_only')).toEqual(['reps'])
    expect(fieldsFor('bodyweight_reps')).toEqual(['reps'])
    expect(fieldsFor('bodyweight_assisted_reps')).toEqual(['weight', 'reps'])
    expect(fieldsFor('duration')).toEqual(['duration'])
    expect(fieldsFor('weight_duration')).toEqual(['weight', 'duration'])
    expect(fieldsFor('distance_duration')).toEqual(['distance', 'duration'])
    expect(fieldsFor('short_distance_weight')).toEqual(['weight', 'distance'])
  })

  it('covers every exercise type', () => {
    const all: ExerciseTypeWire[] = [
      'weight_reps', 'reps_only', 'bodyweight_reps', 'bodyweight_assisted_reps',
      'duration', 'weight_duration', 'distance_duration', 'short_distance_weight',
    ]
    for (const t of all) {
      expect(fieldsFor(t).length).toBeGreaterThan(0)
    }
  })
})

describe('allowsField', () => {
  it('is true only for fields the type uses', () => {
    expect(allowsField('weight_reps', 'weight')).toBe(true)
    expect(allowsField('weight_reps', 'distance')).toBe(false)
    expect(allowsField('duration', 'duration')).toBe(true)
    expect(allowsField('duration', 'reps')).toBe(false)
  })
})

describe('isAssistedType', () => {
  it('flags assisted bodyweight, where weight reduces effort', () => {
    expect(isAssistedType('bodyweight_assisted_reps')).toBe(true)
    expect(isAssistedType('weight_reps')).toBe(false)
  })
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `bunx vitest run lib/workout/setKinds.test.ts`
Expected: FAIL — "Failed to resolve import ./setKinds".

- [ ] **Step 4: Write the implementation**

Create `lib/workout/setKinds.ts`:

```ts
import type { ExerciseTypeWire, SetField } from './types'

/**
 * Which measurable fields each exercise type uses. The eight types are just
 * combinations of four fields, so the set row renders from this table rather
 * than branching per type.
 */
const SET_FIELDS: Record<ExerciseTypeWire, readonly SetField[]> = {
  weight_reps: ['weight', 'reps'],
  reps_only: ['reps'],
  bodyweight_reps: ['reps'],
  bodyweight_assisted_reps: ['weight', 'reps'],
  duration: ['duration'],
  weight_duration: ['weight', 'duration'],
  distance_duration: ['distance', 'duration'],
  short_distance_weight: ['weight', 'distance'],
}

export function fieldsFor(type: ExerciseTypeWire): readonly SetField[] {
  return SET_FIELDS[type]
}

export function allowsField(type: ExerciseTypeWire, field: SetField): boolean {
  return SET_FIELDS[type].includes(field)
}

/** Assisted types use weight to *reduce* effort, so the UI labels it "assist" not "weight". */
export function isAssistedType(type: ExerciseTypeWire): boolean {
  return type === 'bodyweight_assisted_reps'
}
```

- [ ] **Step 5: Run the tests**

Run: `bunx vitest run lib/workout/setKinds.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add lib/workout/types.ts lib/workout/setKinds.ts lib/workout/setKinds.test.ts
git commit -m "feat: add draft types and exercise-type field lookup"
```

---

### Task 4: Unit conversion and speed derivation

**Files:**
- Create: `lib/workout/units.ts`
- Test: `lib/workout/units.test.ts`

**Interfaces:**
- Consumes: `UnitSystemWire` from `types.ts`.
- Produces:
  - `kgToDisplay(kg: number, system: UnitSystemWire): number`
  - `displayToKg(value: number, system: UnitSystemWire): number`
  - `metersToDisplay(m: number, system: UnitSystemWire): number`
  - `displayToMeters(value: number, system: UnitSystemWire): number`
  - `speedFrom(distanceMeters: number | null, durationSeconds: number | null, system: UnitSystemWire): number | null`
  - `weightUnit(system)`, `distanceUnit(system)`, `speedUnit(system)` → `string`
  - `formatDuration(seconds: number): string`

- [ ] **Step 1: Write the failing test**

Create `lib/workout/units.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  kgToDisplay, displayToKg, metersToDisplay, displayToMeters,
  speedFrom, weightUnit, distanceUnit, speedUnit, formatDuration,
} from './units'

describe('weight conversion', () => {
  it('is identity under metric', () => {
    expect(kgToDisplay(60, 'metric')).toBe(60)
    expect(displayToKg(60, 'metric')).toBe(60)
  })

  it('converts to pounds under imperial', () => {
    expect(kgToDisplay(100, 'imperial')).toBeCloseTo(220.462, 2)
    expect(displayToKg(220.462, 'imperial')).toBeCloseTo(100, 3)
  })

  it('round-trips without drift', () => {
    expect(displayToKg(kgToDisplay(72.5, 'imperial'), 'imperial')).toBeCloseTo(72.5, 6)
  })
})

describe('distance conversion', () => {
  it('shows kilometres under metric', () => {
    expect(metersToDisplay(5000, 'metric')).toBe(5)
    expect(displayToMeters(5, 'metric')).toBe(5000)
  })

  it('shows miles under imperial', () => {
    expect(metersToDisplay(1609.344, 'imperial')).toBeCloseTo(1, 6)
    expect(displayToMeters(1, 'imperial')).toBeCloseTo(1609.344, 3)
  })
})

describe('speedFrom', () => {
  it('derives km/h from metres and seconds', () => {
    // 5 km in 28:15 (1695s) = 10.619... km/h
    expect(speedFrom(5000, 1695, 'metric')).toBeCloseTo(10.619, 2)
  })

  it('derives mph under imperial', () => {
    expect(speedFrom(1609.344, 3600, 'imperial')).toBeCloseTo(1, 4)
  })

  it('returns null when duration is zero, rather than dividing by zero', () => {
    expect(speedFrom(5000, 0, 'metric')).toBeNull()
  })

  it('returns null when either input is missing', () => {
    expect(speedFrom(null, 100, 'metric')).toBeNull()
    expect(speedFrom(5000, null, 'metric')).toBeNull()
  })
})

describe('unit labels', () => {
  it('names units per system', () => {
    expect(weightUnit('metric')).toBe('kg')
    expect(weightUnit('imperial')).toBe('lb')
    expect(distanceUnit('metric')).toBe('km')
    expect(distanceUnit('imperial')).toBe('mi')
    expect(speedUnit('metric')).toBe('km/h')
    expect(speedUnit('imperial')).toBe('mph')
  })
})

describe('formatDuration', () => {
  it('formats under an hour as m:ss', () => {
    expect(formatDuration(1695)).toBe('28:15')
    expect(formatDuration(65)).toBe('1:05')
    expect(formatDuration(0)).toBe('0:00')
  })

  it('formats an hour or more as h:mm:ss', () => {
    expect(formatDuration(3661)).toBe('1:01:01')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bunx vitest run lib/workout/units.test.ts`
Expected: FAIL — cannot resolve `./units`.

- [ ] **Step 3: Write the implementation**

Create `lib/workout/units.ts`:

```ts
import type { UnitSystemWire } from './types'

const KG_PER_LB = 0.45359237
const M_PER_KM = 1000
const M_PER_MI = 1609.344

export function kgToDisplay(kg: number, system: UnitSystemWire): number {
  return system === 'metric' ? kg : kg / KG_PER_LB
}

export function displayToKg(value: number, system: UnitSystemWire): number {
  return system === 'metric' ? value : value * KG_PER_LB
}

export function metersToDisplay(m: number, system: UnitSystemWire): number {
  return system === 'metric' ? m / M_PER_KM : m / M_PER_MI
}

export function displayToMeters(value: number, system: UnitSystemWire): number {
  return system === 'metric' ? value * M_PER_KM : value * M_PER_MI
}

/**
 * Speed in the user's distance-unit per hour. Returns null when either input is
 * absent or duration is zero — a zero-duration set is bad data, not infinite speed.
 */
export function speedFrom(
  distanceMeters: number | null,
  durationSeconds: number | null,
  system: UnitSystemWire,
): number | null {
  if (distanceMeters === null || durationSeconds === null) return null
  if (durationSeconds <= 0) return null
  const hours = durationSeconds / 3600
  return metersToDisplay(distanceMeters, system) / hours
}

export function weightUnit(system: UnitSystemWire): string {
  return system === 'metric' ? 'kg' : 'lb'
}

export function distanceUnit(system: UnitSystemWire): string {
  return system === 'metric' ? 'km' : 'mi'
}

export function speedUnit(system: UnitSystemWire): string {
  return system === 'metric' ? 'km/h' : 'mph'
}

/** `m:ss` under an hour, `h:mm:ss` at or above it. */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`
}
```

- [ ] **Step 4: Run the tests**

Run: `bunx vitest run lib/workout/units.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/workout/units.ts lib/workout/units.test.ts
git commit -m "feat: add unit conversion and speed derivation"
```

---

### Task 5: Workout summary stats

**Files:**
- Create: `lib/workout/summary.ts`
- Test: `lib/workout/summary.test.ts`

**Interfaces:**
- Consumes: `MeasurableSet`, `UnitSystemWire` from `types.ts`.
- Produces:
  - `interface WorkoutSummary { totalSets: number; volumeKg: number | null; distanceMeters: number | null; movingSeconds: number | null; avgSpeed: number | null; timeUnderTensionSeconds: number | null }`
  - `summarize(sets: MeasurableSet[], system: UnitSystemWire): WorkoutSummary`

- [ ] **Step 1: Write the failing test**

Create `lib/workout/summary.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { summarize } from './summary'
import type { MeasurableSet } from './types'

const set = (o: Partial<MeasurableSet>): MeasurableSet => ({
  weightKg: null, reps: null, distanceMeters: null, durationSeconds: null, ...o,
})

describe('summarize', () => {
  it('totals volume for a strength-only workout', () => {
    const s = summarize([
      set({ weightKg: 60, reps: 10 }),
      set({ weightKg: 65, reps: 8 }),
    ], 'metric')

    expect(s.totalSets).toBe(2)
    expect(s.volumeKg).toBe(60 * 10 + 65 * 8)
    expect(s.distanceMeters).toBeNull()
    expect(s.timeUnderTensionSeconds).toBeNull()
  })

  it('totals distance and time for a cardio-only workout', () => {
    const s = summarize([
      set({ distanceMeters: 5000, durationSeconds: 1695 }),
      set({ distanceMeters: 2000, durationSeconds: 570 }),
    ], 'metric')

    expect(s.distanceMeters).toBe(7000)
    expect(s.movingSeconds).toBe(2265)
    expect(s.volumeKg).toBeNull()
  })

  it('averages speed over totals, not over per-set speeds', () => {
    // 5 km in 1695s (~10.6 km/h) then 0.2 km in 45s (16 km/h).
    // Mean of per-set speeds would be ~13.3; the correct figure is total/total.
    const s = summarize([
      set({ distanceMeters: 5000, durationSeconds: 1695 }),
      set({ distanceMeters: 200, durationSeconds: 45 }),
    ], 'metric')

    const expected = (5200 / 1000) / (1740 / 3600)
    expect(s.avgSpeed).toBeCloseTo(expected, 6)
    expect(s.avgSpeed).toBeLessThan(13)
  })

  it('reports time under tension for duration-only sets', () => {
    const s = summarize([
      set({ durationSeconds: 60 }),
      set({ durationSeconds: 45 }),
    ], 'metric')

    expect(s.timeUnderTensionSeconds).toBe(105)
    expect(s.movingSeconds).toBeNull()
    expect(s.volumeKg).toBeNull()
  })

  it('reports each applicable stat for a mixed workout', () => {
    const s = summarize([
      set({ weightKg: 60, reps: 10 }),
      set({ distanceMeters: 5000, durationSeconds: 1695 }),
      set({ durationSeconds: 60 }),
    ], 'metric')

    expect(s.totalSets).toBe(3)
    expect(s.volumeKg).toBe(600)
    expect(s.distanceMeters).toBe(5000)
    expect(s.timeUnderTensionSeconds).toBe(60)
  })

  it('returns nulls rather than zeros when nothing qualifies', () => {
    const s = summarize([set({ reps: 12 })], 'metric')

    expect(s.totalSets).toBe(1)
    expect(s.volumeKg).toBeNull()
    expect(s.distanceMeters).toBeNull()
    expect(s.timeUnderTensionSeconds).toBeNull()
    expect(s.avgSpeed).toBeNull()
  })

  it('handles an empty workout', () => {
    const s = summarize([], 'metric')
    expect(s.totalSets).toBe(0)
    expect(s.volumeKg).toBeNull()
  })

  it('does not divide by zero when a distance set has zero duration', () => {
    const s = summarize([set({ distanceMeters: 1000, durationSeconds: 0 })], 'metric')
    expect(s.distanceMeters).toBe(1000)
    expect(s.avgSpeed).toBeNull()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bunx vitest run lib/workout/summary.test.ts`
Expected: FAIL — cannot resolve `./summary`.

- [ ] **Step 3: Write the implementation**

Create `lib/workout/summary.ts`:

```ts
import type { MeasurableSet, UnitSystemWire } from './types'
import { speedFrom } from './units'

export interface WorkoutSummary {
  totalSets: number
  /** Σ(weight × reps) over sets having both. Null when no set qualifies. */
  volumeKg: number | null
  distanceMeters: number | null
  /** Total duration of distance sets. */
  movingSeconds: number | null
  /** Total distance ÷ total moving time, in the user's speed unit. */
  avgSpeed: number | null
  /** Total duration of sets that have duration but no distance. */
  timeUnderTensionSeconds: number | null
}

/**
 * Stats adapt to the set kinds present. Every field is null rather than zero when
 * no set qualifies, so the UI can omit it instead of showing a misleading 0.
 */
export function summarize(sets: MeasurableSet[], system: UnitSystemWire): WorkoutSummary {
  let volumeKg = 0
  let hasVolume = false
  let distanceMeters = 0
  let movingSeconds = 0
  let hasDistance = false
  let tension = 0
  let hasTension = false

  for (const s of sets) {
    if (s.weightKg !== null && s.reps !== null) {
      volumeKg += s.weightKg * s.reps
      hasVolume = true
    }
    if (s.distanceMeters !== null) {
      distanceMeters += s.distanceMeters
      movingSeconds += s.durationSeconds ?? 0
      hasDistance = true
    } else if (s.durationSeconds !== null) {
      tension += s.durationSeconds
      hasTension = true
    }
  }

  return {
    totalSets: sets.length,
    volumeKg: hasVolume ? volumeKg : null,
    distanceMeters: hasDistance ? distanceMeters : null,
    movingSeconds: hasDistance ? movingSeconds : null,
    avgSpeed: hasDistance ? speedFrom(distanceMeters, movingSeconds, system) : null,
    timeUnderTensionSeconds: hasTension ? tension : null,
  }
}
```

- [ ] **Step 4: Run the tests**

Run: `bunx vitest run lib/workout/summary.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/workout/summary.ts lib/workout/summary.test.ts
git commit -m "feat: add workout summary stats that adapt to set kinds"
```

---

### Task 6: Wire serialization (camelCase ↔ snake_case, enum casing)

**Files:**
- Create: `lib/workout/serialize.ts`
- Test: `lib/workout/serialize.test.ts`

**Interfaces:**
- Consumes: types from `types.ts`.
- Produces:
  - `enumToWire(value: string): string` — `WEIGHT_REPS` → `weight_reps`
  - `enumFromWire(value: string): string` — `weight_reps` → `WEIGHT_REPS`
  - `setToWire(set: DbSetLike): WireSet`
  - `setFromWire(set: WireSet): DraftSet`
  - `interface WireSet` — the snake_case shape sent over HTTP

- [ ] **Step 1: Write the failing test**

Create `lib/workout/serialize.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { enumToWire, enumFromWire, setToWire, setFromWire } from './serialize'
import type { DraftSet } from './types'

describe('enum casing', () => {
  it('lowercases Prisma enums for the wire', () => {
    expect(enumToWire('WEIGHT_REPS')).toBe('weight_reps')
    expect(enumToWire('DROPSET')).toBe('dropset')
    expect(enumToWire('UPPER_BACK')).toBe('upper_back')
  })

  it('uppercases wire values for Prisma', () => {
    expect(enumFromWire('weight_reps')).toBe('WEIGHT_REPS')
    expect(enumFromWire('dropset')).toBe('DROPSET')
    expect(enumFromWire('upper_back')).toBe('UPPER_BACK')
  })

  it('round-trips', () => {
    for (const v of ['WEIGHT_REPS', 'NONE', 'RESISTANCE_BAND', 'FULL_BODY']) {
      expect(enumFromWire(enumToWire(v))).toBe(v)
    }
  })
})

describe('set serialization', () => {
  it('maps camelCase fields to snake_case on the wire', () => {
    const wire = setToWire({
      index: 0,
      type: 'NORMAL',
      weightKg: 60,
      reps: 10,
      distanceMeters: null,
      durationSeconds: null,
      rpe: 8.5,
      customMetric: null,
    })

    expect(wire).toEqual({
      index: 0,
      type: 'normal',
      weight_kg: 60,
      reps: 10,
      distance_meters: null,
      duration_seconds: null,
      rpe: 8.5,
      custom_metric: null,
    })
  })

  it('reads a wire set back into draft shape, defaulting completed to false', () => {
    const draft: DraftSet = setFromWire({
      index: 0,
      type: 'dropset',
      weight_kg: 40,
      reps: 12,
      distance_meters: null,
      duration_seconds: null,
      rpe: null,
      custom_metric: null,
    })

    expect(draft.type).toBe('dropset')
    expect(draft.weightKg).toBe(40)
    expect(draft.reps).toBe(12)
    expect(draft.completed).toBe(false)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bunx vitest run lib/workout/serialize.test.ts`
Expected: FAIL — cannot resolve `./serialize`.

- [ ] **Step 3: Write the implementation**

Create `lib/workout/serialize.ts`:

```ts
import type { DraftSet, SetTypeWire } from './types'

/** Prisma enums are UPPER_SNAKE_CASE; the wire format is lowercase. */
export function enumToWire(value: string): string {
  return value.toLowerCase()
}

export function enumFromWire(value: string): string {
  return value.toUpperCase()
}

export interface DbSetLike {
  index: number
  type: string
  weightKg: number | null
  reps: number | null
  distanceMeters: number | null
  durationSeconds: number | null
  rpe: number | null
  customMetric: number | null
}

export interface WireSet {
  index: number
  type: string
  weight_kg: number | null
  reps: number | null
  distance_meters: number | null
  duration_seconds: number | null
  rpe: number | null
  custom_metric: number | null
}

export function setToWire(set: DbSetLike): WireSet {
  return {
    index: set.index,
    type: enumToWire(set.type),
    weight_kg: set.weightKg,
    reps: set.reps,
    distance_meters: set.distanceMeters,
    duration_seconds: set.durationSeconds,
    rpe: set.rpe,
    custom_metric: set.customMetric,
  }
}

/** Wire sets carry no completion state; anything read back starts unticked. */
export function setFromWire(set: WireSet): DraftSet {
  return {
    type: set.type as SetTypeWire,
    weightKg: set.weight_kg,
    reps: set.reps,
    distanceMeters: set.distance_meters,
    durationSeconds: set.duration_seconds,
    rpe: set.rpe,
    completed: false,
  }
}
```

- [ ] **Step 4: Run the tests**

Run: `bunx vitest run lib/workout/serialize.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/workout/serialize.ts lib/workout/serialize.test.ts
git commit -m "feat: add wire serialization for sets and enum casing"
```

---

### Task 7: Draft schema and validation

**Files:**
- Create: `lib/workout/draft.ts`
- Test: `lib/workout/draft.test.ts`

**Interfaces:**
- Consumes: `fieldsFor` from `setKinds.ts`; types from `types.ts`.
- Produces:
  - `workoutDraftSchema: z.ZodType<WorkoutDraft>`
  - `emptyDraft(title: string): WorkoutDraft`
  - `validateAgainstTypes(draft: WorkoutDraft, types: Map<string, ExerciseTypeWire>): string[]` — returns human-readable errors, empty array when valid

- [ ] **Step 1: Write the failing test**

Create `lib/workout/draft.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { workoutDraftSchema, emptyDraft, validateAgainstTypes } from './draft'
import type { WorkoutDraft, ExerciseTypeWire } from './types'

const draftWith = (sets: unknown[]): unknown => ({
  title: 'Chest',
  description: null,
  exercises: [
    { exerciseTemplateId: 'tpl1', notes: null, restSeconds: null, supersetId: null, sets },
  ],
})

describe('workoutDraftSchema', () => {
  it('accepts a well-formed draft', () => {
    const parsed = workoutDraftSchema.safeParse(draftWith([
      { type: 'normal', weightKg: 60, reps: 10, distanceMeters: null, durationSeconds: null, rpe: null, completed: true },
    ]))
    expect(parsed.success).toBe(true)
  })

  it('rejects an unknown set type', () => {
    const parsed = workoutDraftSchema.safeParse(draftWith([
      { type: 'superset', weightKg: 60, reps: 10, distanceMeters: null, durationSeconds: null, rpe: null, completed: true },
    ]))
    expect(parsed.success).toBe(false)
  })

  it('rejects negative weight', () => {
    const parsed = workoutDraftSchema.safeParse(draftWith([
      { type: 'normal', weightKg: -5, reps: 10, distanceMeters: null, durationSeconds: null, rpe: null, completed: true },
    ]))
    expect(parsed.success).toBe(false)
  })

  it('rejects an rpe outside the allowed scale', () => {
    const parsed = workoutDraftSchema.safeParse(draftWith([
      { type: 'normal', weightKg: 60, reps: 10, distanceMeters: null, durationSeconds: null, rpe: 7.2, completed: true },
    ]))
    expect(parsed.success).toBe(false)
  })

  it('accepts a valid rpe', () => {
    const parsed = workoutDraftSchema.safeParse(draftWith([
      { type: 'normal', weightKg: 60, reps: 10, distanceMeters: null, durationSeconds: null, rpe: 8.5, completed: true },
    ]))
    expect(parsed.success).toBe(true)
  })

  it('rejects fractional reps', () => {
    const parsed = workoutDraftSchema.safeParse(draftWith([
      { type: 'normal', weightKg: 60, reps: 10.5, distanceMeters: null, durationSeconds: null, rpe: null, completed: true },
    ]))
    expect(parsed.success).toBe(false)
  })
})

describe('emptyDraft', () => {
  it('starts with a title and no exercises', () => {
    const d = emptyDraft('Morning Workout')
    expect(d.title).toBe('Morning Workout')
    expect(d.exercises).toEqual([])
    expect(workoutDraftSchema.safeParse(d).success).toBe(true)
  })
})

describe('validateAgainstTypes', () => {
  const types = new Map<string, ExerciseTypeWire>([
    ['bench', 'weight_reps'],
    ['treadmill', 'distance_duration'],
  ])

  const draft = (templateId: string, set: Record<string, unknown>): WorkoutDraft => ({
    title: 'T',
    description: null,
    exercises: [{
      exerciseTemplateId: templateId,
      notes: null,
      restSeconds: null,
      supersetId: null,
      sets: [{
        type: 'normal', weightKg: null, reps: null, distanceMeters: null,
        durationSeconds: null, rpe: null, completed: true, ...set,
      } as never],
    }],
  })

  it('passes when populated fields match the exercise type', () => {
    expect(validateAgainstTypes(draft('bench', { weightKg: 60, reps: 10 }), types)).toEqual([])
    expect(validateAgainstTypes(draft('treadmill', { distanceMeters: 5000, durationSeconds: 1695 }), types)).toEqual([])
  })

  it('rejects a field the exercise type does not use', () => {
    const errors = validateAgainstTypes(draft('bench', { weightKg: 60, reps: 10, distanceMeters: 5000 }), types)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('distance')
  })

  it('rejects an unknown exercise template', () => {
    const errors = validateAgainstTypes(draft('ghost', { reps: 10 }), types)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('ghost')
  })

  it('ignores incomplete sets, which are discarded on finish anyway', () => {
    const d = draft('bench', { weightKg: 60, reps: 10, distanceMeters: 5000 })
    d.exercises[0].sets[0].completed = false
    expect(validateAgainstTypes(d, types)).toEqual([])
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bunx vitest run lib/workout/draft.test.ts`
Expected: FAIL — cannot resolve `./draft`.

- [ ] **Step 3: Write the implementation**

Create `lib/workout/draft.ts`:

```ts
import { z } from 'zod'
import { fieldsFor } from './setKinds'
import type { ExerciseTypeWire, SetField, WorkoutDraft } from './types'

const RPE_VALUES = [6, 7, 7.5, 8, 8.5, 9, 9.5, 10] as const

const draftSetSchema = z.object({
  type: z.enum(['warmup', 'normal', 'failure', 'dropset']),
  weightKg: z.number().min(0).nullable(),
  reps: z.number().int().min(0).nullable(),
  distanceMeters: z.number().min(0).nullable(),
  durationSeconds: z.number().int().min(0).nullable(),
  rpe: z.union([z.literal(6), z.literal(7), z.literal(7.5), z.literal(8),
                z.literal(8.5), z.literal(9), z.literal(9.5), z.literal(10)]).nullable(),
  completed: z.boolean(),
})

const draftExerciseSchema = z.object({
  exerciseTemplateId: z.string().min(1),
  notes: z.string().max(2000).nullable(),
  restSeconds: z.number().int().min(0).max(3600).nullable(),
  supersetId: z.number().int().nullable(),
  sets: z.array(draftSetSchema).max(50),
})

export const workoutDraftSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable(),
  exercises: z.array(draftExerciseSchema).max(50),
})

export function emptyDraft(title: string): WorkoutDraft {
  return { title, description: null, exercises: [] }
}

/** Which draft field backs each measurable field. */
const FIELD_TO_KEY: Record<SetField, 'weightKg' | 'reps' | 'distanceMeters' | 'durationSeconds'> = {
  weight: 'weightKg',
  reps: 'reps',
  distance: 'distanceMeters',
  duration: 'durationSeconds',
}

/**
 * Structural validity is not enough: a bench-press set must not carry a distance.
 * Only completed sets are checked, since incomplete ones are discarded on finish.
 */
export function validateAgainstTypes(
  draft: WorkoutDraft,
  types: Map<string, ExerciseTypeWire>,
): string[] {
  const errors: string[] = []

  draft.exercises.forEach((exercise, ei) => {
    const type = types.get(exercise.exerciseTemplateId)
    if (!type) {
      errors.push(`Exercise ${ei + 1}: unknown exercise template "${exercise.exerciseTemplateId}"`)
      return
    }

    const allowed = new Set(fieldsFor(type))

    exercise.sets.forEach((set, si) => {
      if (!set.completed) return
      for (const field of ['weight', 'reps', 'distance', 'duration'] as SetField[]) {
        const value = set[FIELD_TO_KEY[field]]
        if (value !== null && !allowed.has(field)) {
          errors.push(
            `Exercise ${ei + 1}, set ${si + 1}: ${field} is not valid for a ${type} exercise`,
          )
        }
      }
    })
  })

  return errors
}
```

- [ ] **Step 4: Run the tests**

Run: `bunx vitest run lib/workout/draft.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/workout/draft.ts lib/workout/draft.test.ts
git commit -m "feat: add draft schema and per-exercise-type field validation"
```

---

### Task 8: Normalize a draft into relational rows

**Files:**
- Create: `lib/workout/normalize.ts`
- Test: `lib/workout/normalize.test.ts`

**Interfaces:**
- Consumes: `WorkoutDraft`, `DraftSet` from `types.ts`.
- Produces:
  - `interface NormalizedSet { index: number; type: string; weightKg: number | null; reps: number | null; distanceMeters: number | null; durationSeconds: number | null; rpe: number | null }`
  - `interface NormalizedExercise { exerciseTemplateId: string; index: number; notes: string | null; restSeconds: number | null; supersetId: number | null; sets: NormalizedSet[] }`
  - `normalizeDraft(draft: WorkoutDraft): NormalizedExercise[]`

- [ ] **Step 1: Write the failing test**

Create `lib/workout/normalize.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { normalizeDraft } from './normalize'
import type { DraftSet, WorkoutDraft } from './types'

const set = (o: Partial<DraftSet>): DraftSet => ({
  type: 'normal', weightKg: null, reps: null, distanceMeters: null,
  durationSeconds: null, rpe: null, completed: true, ...o,
})

const draft = (exercises: WorkoutDraft['exercises']): WorkoutDraft => ({
  title: 'T', description: null, exercises,
})

const exercise = (id: string, sets: DraftSet[]) => ({
  exerciseTemplateId: id, notes: null, restSeconds: null, supersetId: null, sets,
})

describe('normalizeDraft', () => {
  it('keeps only completed sets', () => {
    const rows = normalizeDraft(draft([
      exercise('bench', [
        set({ weightKg: 60, reps: 10, completed: true }),
        set({ weightKg: 65, reps: 8, completed: false }),
      ]),
    ]))

    expect(rows[0].sets).toHaveLength(1)
    expect(rows[0].sets[0].weightKg).toBe(60)
  })

  it('assigns contiguous set indexes after filtering', () => {
    const rows = normalizeDraft(draft([
      exercise('bench', [
        set({ reps: 1, completed: false }),
        set({ reps: 2, completed: true }),
        set({ reps: 3, completed: false }),
        set({ reps: 4, completed: true }),
      ]),
    ]))

    expect(rows[0].sets.map(s => s.index)).toEqual([0, 1])
    expect(rows[0].sets.map(s => s.reps)).toEqual([2, 4])
  })

  it('drops an exercise left with no completed sets', () => {
    const rows = normalizeDraft(draft([
      exercise('bench', [set({ reps: 10, completed: true })]),
      exercise('curl', [set({ reps: 10, completed: false })]),
      exercise('row', [set({ reps: 10, completed: true })]),
    ]))

    expect(rows.map(r => r.exerciseTemplateId)).toEqual(['bench', 'row'])
  })

  it('assigns contiguous exercise indexes after dropping empties', () => {
    const rows = normalizeDraft(draft([
      exercise('bench', [set({ reps: 10, completed: true })]),
      exercise('curl', [set({ reps: 10, completed: false })]),
      exercise('row', [set({ reps: 10, completed: true })]),
    ]))

    expect(rows.map(r => r.index)).toEqual([0, 1])
  })

  it('drops an exercise with no sets at all', () => {
    const rows = normalizeDraft(draft([exercise('bench', [])]))
    expect(rows).toEqual([])
  })

  it('uppercases the set type for Prisma', () => {
    const rows = normalizeDraft(draft([
      exercise('bench', [set({ type: 'dropset', reps: 10 })]),
    ]))
    expect(rows[0].sets[0].type).toBe('DROPSET')
  })

  it('carries exercise metadata through', () => {
    const rows = normalizeDraft(draft([{
      exerciseTemplateId: 'bench',
      notes: 'felt heavy',
      restSeconds: 180,
      supersetId: 1,
      sets: [set({ reps: 10 })],
    }]))

    expect(rows[0].notes).toBe('felt heavy')
    expect(rows[0].restSeconds).toBe(180)
    expect(rows[0].supersetId).toBe(1)
  })

  it('does not carry the completed flag into rows', () => {
    const rows = normalizeDraft(draft([exercise('bench', [set({ reps: 10 })])]))
    expect('completed' in rows[0].sets[0]).toBe(false)
  })

  it('returns an empty list for an empty draft', () => {
    expect(normalizeDraft(draft([]))).toEqual([])
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bunx vitest run lib/workout/normalize.test.ts`
Expected: FAIL — cannot resolve `./normalize`.

- [ ] **Step 3: Write the implementation**

Create `lib/workout/normalize.ts`:

```ts
import type { WorkoutDraft } from './types'

export interface NormalizedSet {
  index: number
  type: string
  weightKg: number | null
  reps: number | null
  distanceMeters: number | null
  durationSeconds: number | null
  rpe: number | null
}

export interface NormalizedExercise {
  exerciseTemplateId: string
  index: number
  notes: string | null
  restSeconds: number | null
  supersetId: number | null
  sets: NormalizedSet[]
}

/**
 * A finished workout records what was done, not what was planned: unticked sets are
 * dropped, exercises left empty are dropped with them, and indexes are assigned
 * afterwards so they stay contiguous from 0.
 */
export function normalizeDraft(draft: WorkoutDraft): NormalizedExercise[] {
  const rows: NormalizedExercise[] = []

  for (const exercise of draft.exercises) {
    const sets = exercise.sets
      .filter(s => s.completed)
      .map((s, index) => ({
        index,
        type: s.type.toUpperCase(),
        weightKg: s.weightKg,
        reps: s.reps,
        distanceMeters: s.distanceMeters,
        durationSeconds: s.durationSeconds,
        rpe: s.rpe,
      }))

    if (sets.length === 0) continue

    rows.push({
      exerciseTemplateId: exercise.exerciseTemplateId,
      index: rows.length,
      notes: exercise.notes,
      restSeconds: exercise.restSeconds,
      supersetId: exercise.supersetId,
      sets,
    })
  }

  return rows
}
```

- [ ] **Step 4: Run the tests**

Run: `bunx vitest run lib/workout/normalize.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Run the whole suite to check nothing regressed**

Run: `bun run test`
Expected: PASS — all tests from Tasks 1–8.

- [ ] **Step 6: Commit**

```bash
git add lib/workout/normalize.ts lib/workout/normalize.test.ts
git commit -m "feat: normalize drafts into rows, dropping incomplete sets"
```

---

## Phase C — Data and authentication

### Task 9: Seed the exercise library

**Files:**
- Create: `prisma/seed.ts`, `prisma/exercises.ts`
- Test: `prisma/exercises.test.ts`

**Interfaces:**
- Consumes: Prisma enums from Task 2.
- Produces: `SEED_EXERCISES: SeedExercise[]` exported from `prisma/exercises.ts`, where
  `interface SeedExercise { title: string; type: ExerciseType; primaryMuscleGroup: MuscleGroup; secondaryMuscleGroups: MuscleGroup[]; equipmentCategory: EquipmentCategory }`

- [ ] **Step 1: Write the seed data**

Create `prisma/exercises.ts`. Values use Prisma's `UPPER_SNAKE_CASE` enum members.

```ts
import type { ExerciseType, MuscleGroup, EquipmentCategory } from '@prisma/client'

export interface SeedExercise {
  title: string
  type: ExerciseType
  primaryMuscleGroup: MuscleGroup
  secondaryMuscleGroups: MuscleGroup[]
  equipmentCategory: EquipmentCategory
}

const wr = 'WEIGHT_REPS' as ExerciseType
const bw = 'BODYWEIGHT_REPS' as ExerciseType
const bwa = 'BODYWEIGHT_ASSISTED_REPS' as ExerciseType
const dur = 'DURATION' as ExerciseType
const dd = 'DISTANCE_DURATION' as ExerciseType

const BB = 'BARBELL' as EquipmentCategory
const DB = 'DUMBBELL' as EquipmentCategory
const MC = 'MACHINE' as EquipmentCategory
const KB = 'KETTLEBELL' as EquipmentCategory
const NO = 'NONE' as EquipmentCategory
const OTHER_EQUIPMENT = 'OTHER' as EquipmentCategory

const m = (g: string) => g as MuscleGroup

export const SEED_EXERCISES: SeedExercise[] = [
  // Chest
  { title: 'Bench Press (Barbell)', type: wr, primaryMuscleGroup: m('CHEST'), secondaryMuscleGroups: [m('TRICEPS'), m('SHOULDERS')], equipmentCategory: BB },
  { title: 'Bench Press (Dumbbell)', type: wr, primaryMuscleGroup: m('CHEST'), secondaryMuscleGroups: [m('TRICEPS'), m('SHOULDERS')], equipmentCategory: DB },
  { title: 'Incline Bench Press (Barbell)', type: wr, primaryMuscleGroup: m('CHEST'), secondaryMuscleGroups: [m('TRICEPS'), m('SHOULDERS')], equipmentCategory: BB },
  { title: 'Incline Bench Press (Dumbbell)', type: wr, primaryMuscleGroup: m('CHEST'), secondaryMuscleGroups: [m('TRICEPS'), m('SHOULDERS')], equipmentCategory: DB },
  { title: 'Decline Bench Press (Barbell)', type: wr, primaryMuscleGroup: m('CHEST'), secondaryMuscleGroups: [m('TRICEPS')], equipmentCategory: BB },
  { title: 'Chest Fly (Dumbbell)', type: wr, primaryMuscleGroup: m('CHEST'), secondaryMuscleGroups: [m('SHOULDERS')], equipmentCategory: DB },
  { title: 'Chest Fly (Machine)', type: wr, primaryMuscleGroup: m('CHEST'), secondaryMuscleGroups: [m('SHOULDERS')], equipmentCategory: MC },
  { title: 'Cable Fly Crossovers', type: wr, primaryMuscleGroup: m('CHEST'), secondaryMuscleGroups: [m('SHOULDERS')], equipmentCategory: MC },
  { title: 'Chest Press (Machine)', type: wr, primaryMuscleGroup: m('CHEST'), secondaryMuscleGroups: [m('TRICEPS')], equipmentCategory: MC },
  { title: 'Push Up', type: bw, primaryMuscleGroup: m('CHEST'), secondaryMuscleGroups: [m('TRICEPS'), m('SHOULDERS')], equipmentCategory: NO },
  { title: 'Chest Dip', type: bw, primaryMuscleGroup: m('CHEST'), secondaryMuscleGroups: [m('TRICEPS')], equipmentCategory: NO },
  { title: 'Chest Dip (Assisted)', type: bwa, primaryMuscleGroup: m('CHEST'), secondaryMuscleGroups: [m('TRICEPS')], equipmentCategory: MC },

  // Back — lats
  { title: 'Lat Pulldown (Cable)', type: wr, primaryMuscleGroup: m('LATS'), secondaryMuscleGroups: [m('BICEPS'), m('UPPER_BACK')], equipmentCategory: MC },
  { title: 'Lat Pulldown - Close Grip (Cable)', type: wr, primaryMuscleGroup: m('LATS'), secondaryMuscleGroups: [m('BICEPS')], equipmentCategory: MC },
  { title: 'Pull Up', type: bw, primaryMuscleGroup: m('LATS'), secondaryMuscleGroups: [m('BICEPS'), m('UPPER_BACK')], equipmentCategory: NO },
  { title: 'Pull Up (Assisted)', type: bwa, primaryMuscleGroup: m('LATS'), secondaryMuscleGroups: [m('BICEPS')], equipmentCategory: MC },
  { title: 'Chin Up', type: bw, primaryMuscleGroup: m('LATS'), secondaryMuscleGroups: [m('BICEPS')], equipmentCategory: NO },
  { title: 'Dumbbell Row', type: wr, primaryMuscleGroup: m('LATS'), secondaryMuscleGroups: [m('UPPER_BACK'), m('BICEPS')], equipmentCategory: DB },
  { title: 'Straight Arm Lat Pulldown (Cable)', type: wr, primaryMuscleGroup: m('LATS'), secondaryMuscleGroups: [], equipmentCategory: MC },
  { title: 'Pullover (Dumbbell)', type: wr, primaryMuscleGroup: m('LATS'), secondaryMuscleGroups: [m('CHEST')], equipmentCategory: DB },

  // Back — upper
  { title: 'Bent Over Row (Barbell)', type: wr, primaryMuscleGroup: m('UPPER_BACK'), secondaryMuscleGroups: [m('LATS'), m('BICEPS')], equipmentCategory: BB },
  { title: 'Bent Over Row (Dumbbell)', type: wr, primaryMuscleGroup: m('UPPER_BACK'), secondaryMuscleGroups: [m('LATS'), m('BICEPS')], equipmentCategory: DB },
  { title: 'Seated Cable Row - V Grip (Cable)', type: wr, primaryMuscleGroup: m('UPPER_BACK'), secondaryMuscleGroups: [m('LATS'), m('BICEPS')], equipmentCategory: MC },
  { title: 'Seated Row (Machine)', type: wr, primaryMuscleGroup: m('UPPER_BACK'), secondaryMuscleGroups: [m('LATS')], equipmentCategory: MC },
  { title: 'T Bar Row', type: wr, primaryMuscleGroup: m('UPPER_BACK'), secondaryMuscleGroups: [m('LATS'), m('BICEPS')], equipmentCategory: BB },
  { title: 'Face Pull', type: wr, primaryMuscleGroup: m('SHOULDERS'), secondaryMuscleGroups: [m('UPPER_BACK')], equipmentCategory: MC },
  { title: 'Inverted Row', type: bw, primaryMuscleGroup: m('UPPER_BACK'), secondaryMuscleGroups: [m('BICEPS')], equipmentCategory: NO },
  { title: 'Rack Pull', type: wr, primaryMuscleGroup: m('UPPER_BACK'), secondaryMuscleGroups: [m('GLUTES'), m('HAMSTRINGS')], equipmentCategory: BB },

  // Shoulders
  { title: 'Overhead Press (Barbell)', type: wr, primaryMuscleGroup: m('SHOULDERS'), secondaryMuscleGroups: [m('TRICEPS')], equipmentCategory: BB },
  { title: 'Shoulder Press (Dumbbell)', type: wr, primaryMuscleGroup: m('SHOULDERS'), secondaryMuscleGroups: [m('TRICEPS')], equipmentCategory: DB },
  { title: 'Seated Shoulder Press (Machine)', type: wr, primaryMuscleGroup: m('SHOULDERS'), secondaryMuscleGroups: [m('TRICEPS')], equipmentCategory: MC },
  { title: 'Arnold Press (Dumbbell)', type: wr, primaryMuscleGroup: m('SHOULDERS'), secondaryMuscleGroups: [m('TRICEPS')], equipmentCategory: DB },
  { title: 'Lateral Raise (Dumbbell)', type: wr, primaryMuscleGroup: m('SHOULDERS'), secondaryMuscleGroups: [], equipmentCategory: DB },
  { title: 'Lateral Raise (Cable)', type: wr, primaryMuscleGroup: m('SHOULDERS'), secondaryMuscleGroups: [], equipmentCategory: MC },
  { title: 'Front Raise (Dumbbell)', type: wr, primaryMuscleGroup: m('SHOULDERS'), secondaryMuscleGroups: [], equipmentCategory: DB },
  { title: 'Rear Delt Reverse Fly (Dumbbell)', type: wr, primaryMuscleGroup: m('SHOULDERS'), secondaryMuscleGroups: [m('UPPER_BACK')], equipmentCategory: DB },
  { title: 'Upright Row (Barbell)', type: wr, primaryMuscleGroup: m('SHOULDERS'), secondaryMuscleGroups: [m('TRAPS')], equipmentCategory: BB },
  { title: 'Shrug (Barbell)', type: wr, primaryMuscleGroup: m('TRAPS'), secondaryMuscleGroups: [], equipmentCategory: BB },
  { title: 'Shrug (Dumbbell)', type: wr, primaryMuscleGroup: m('TRAPS'), secondaryMuscleGroups: [], equipmentCategory: DB },

  // Arms — biceps
  { title: 'Bicep Curl (Barbell)', type: wr, primaryMuscleGroup: m('BICEPS'), secondaryMuscleGroups: [m('FOREARMS')], equipmentCategory: BB },
  { title: 'Bicep Curl (Dumbbell)', type: wr, primaryMuscleGroup: m('BICEPS'), secondaryMuscleGroups: [m('FOREARMS')], equipmentCategory: DB },
  { title: 'Bicep Curl (Cable)', type: wr, primaryMuscleGroup: m('BICEPS'), secondaryMuscleGroups: [m('FOREARMS')], equipmentCategory: MC },
  { title: 'Hammer Curl (Dumbbell)', type: wr, primaryMuscleGroup: m('BICEPS'), secondaryMuscleGroups: [m('FOREARMS')], equipmentCategory: DB },
  { title: 'Preacher Curl (Barbell)', type: wr, primaryMuscleGroup: m('BICEPS'), secondaryMuscleGroups: [], equipmentCategory: BB },
  { title: 'Concentration Curl', type: wr, primaryMuscleGroup: m('BICEPS'), secondaryMuscleGroups: [], equipmentCategory: DB },
  { title: 'EZ Bar Biceps Curl', type: wr, primaryMuscleGroup: m('BICEPS'), secondaryMuscleGroups: [m('FOREARMS')], equipmentCategory: BB },

  // Arms — triceps
  { title: 'Triceps Pushdown', type: wr, primaryMuscleGroup: m('TRICEPS'), secondaryMuscleGroups: [], equipmentCategory: MC },
  { title: 'Triceps Rope Pushdown', type: wr, primaryMuscleGroup: m('TRICEPS'), secondaryMuscleGroups: [], equipmentCategory: MC },
  { title: 'Skullcrusher (Barbell)', type: wr, primaryMuscleGroup: m('TRICEPS'), secondaryMuscleGroups: [], equipmentCategory: BB },
  { title: 'Overhead Triceps Extension (Cable)', type: wr, primaryMuscleGroup: m('TRICEPS'), secondaryMuscleGroups: [], equipmentCategory: MC },
  { title: 'Triceps Extension (Dumbbell)', type: wr, primaryMuscleGroup: m('TRICEPS'), secondaryMuscleGroups: [], equipmentCategory: DB },
  { title: 'Bench Press - Close Grip (Barbell)', type: wr, primaryMuscleGroup: m('TRICEPS'), secondaryMuscleGroups: [m('CHEST')], equipmentCategory: BB },
  { title: 'Triceps Dip', type: bw, primaryMuscleGroup: m('TRICEPS'), secondaryMuscleGroups: [m('CHEST')], equipmentCategory: NO },
  { title: 'Diamond Push Up', type: bw, primaryMuscleGroup: m('TRICEPS'), secondaryMuscleGroups: [m('CHEST')], equipmentCategory: NO },

  // Legs — quads
  { title: 'Squat (Barbell)', type: wr, primaryMuscleGroup: m('QUADRICEPS'), secondaryMuscleGroups: [m('GLUTES'), m('HAMSTRINGS')], equipmentCategory: BB },
  { title: 'Front Squat', type: wr, primaryMuscleGroup: m('QUADRICEPS'), secondaryMuscleGroups: [m('GLUTES')], equipmentCategory: BB },
  { title: 'Leg Press (Machine)', type: wr, primaryMuscleGroup: m('QUADRICEPS'), secondaryMuscleGroups: [m('GLUTES'), m('HAMSTRINGS')], equipmentCategory: MC },
  { title: 'Leg Extension (Machine)', type: wr, primaryMuscleGroup: m('QUADRICEPS'), secondaryMuscleGroups: [], equipmentCategory: MC },
  { title: 'Hack Squat (Machine)', type: wr, primaryMuscleGroup: m('QUADRICEPS'), secondaryMuscleGroups: [m('GLUTES')], equipmentCategory: MC },
  { title: 'Bulgarian Split Squat', type: wr, primaryMuscleGroup: m('QUADRICEPS'), secondaryMuscleGroups: [m('GLUTES')], equipmentCategory: DB },
  { title: 'Lunge (Dumbbell)', type: wr, primaryMuscleGroup: m('QUADRICEPS'), secondaryMuscleGroups: [m('GLUTES')], equipmentCategory: DB },
  { title: 'Goblet Squat', type: wr, primaryMuscleGroup: m('QUADRICEPS'), secondaryMuscleGroups: [m('GLUTES')], equipmentCategory: KB },
  { title: 'Squat (Bodyweight)', type: bw, primaryMuscleGroup: m('QUADRICEPS'), secondaryMuscleGroups: [m('GLUTES')], equipmentCategory: NO },
  { title: 'Step Up', type: wr, primaryMuscleGroup: m('QUADRICEPS'), secondaryMuscleGroups: [m('GLUTES')], equipmentCategory: DB },

  // Legs — posterior
  { title: 'Deadlift (Barbell)', type: wr, primaryMuscleGroup: m('GLUTES'), secondaryMuscleGroups: [m('HAMSTRINGS'), m('LOWER_BACK'), m('TRAPS')], equipmentCategory: BB },
  { title: 'Romanian Deadlift (Barbell)', type: wr, primaryMuscleGroup: m('HAMSTRINGS'), secondaryMuscleGroups: [m('GLUTES'), m('LOWER_BACK')], equipmentCategory: BB },
  { title: 'Sumo Deadlift', type: wr, primaryMuscleGroup: m('GLUTES'), secondaryMuscleGroups: [m('HAMSTRINGS'), m('QUADRICEPS')], equipmentCategory: BB },
  { title: 'Lying Leg Curl (Machine)', type: wr, primaryMuscleGroup: m('HAMSTRINGS'), secondaryMuscleGroups: [], equipmentCategory: MC },
  { title: 'Seated Leg Curl (Machine)', type: wr, primaryMuscleGroup: m('HAMSTRINGS'), secondaryMuscleGroups: [], equipmentCategory: MC },
  { title: 'Hip Thrust (Barbell)', type: wr, primaryMuscleGroup: m('GLUTES'), secondaryMuscleGroups: [m('HAMSTRINGS')], equipmentCategory: BB },
  { title: 'Glute Bridge', type: bw, primaryMuscleGroup: m('GLUTES'), secondaryMuscleGroups: [m('HAMSTRINGS')], equipmentCategory: NO },
  { title: 'Good Morning (Barbell)', type: wr, primaryMuscleGroup: m('HAMSTRINGS'), secondaryMuscleGroups: [m('LOWER_BACK'), m('GLUTES')], equipmentCategory: BB },
  { title: 'Hip Abduction (Machine)', type: wr, primaryMuscleGroup: m('ABDUCTORS'), secondaryMuscleGroups: [m('GLUTES')], equipmentCategory: MC },
  { title: 'Hip Adduction (Machine)', type: wr, primaryMuscleGroup: m('ADDUCTORS'), secondaryMuscleGroups: [], equipmentCategory: MC },
  { title: 'Standing Calf Raise (Machine)', type: wr, primaryMuscleGroup: m('CALVES'), secondaryMuscleGroups: [], equipmentCategory: MC },
  { title: 'Seated Calf Raise', type: wr, primaryMuscleGroup: m('CALVES'), secondaryMuscleGroups: [], equipmentCategory: MC },
  { title: 'Back Extension (Hyperextension)', type: bw, primaryMuscleGroup: m('LOWER_BACK'), secondaryMuscleGroups: [m('GLUTES')], equipmentCategory: NO },

  // Core — note the duration types
  { title: 'Plank', type: dur, primaryMuscleGroup: m('ABDOMINALS'), secondaryMuscleGroups: [], equipmentCategory: NO },
  { title: 'Side Plank', type: dur, primaryMuscleGroup: m('ABDOMINALS'), secondaryMuscleGroups: [], equipmentCategory: NO },
  { title: 'Dead Hang', type: dur, primaryMuscleGroup: m('UPPER_BACK'), secondaryMuscleGroups: [m('FOREARMS')], equipmentCategory: NO },
  { title: 'Crunch', type: bw, primaryMuscleGroup: m('ABDOMINALS'), secondaryMuscleGroups: [], equipmentCategory: NO },
  { title: 'Hanging Leg Raise', type: bw, primaryMuscleGroup: m('ABDOMINALS'), secondaryMuscleGroups: [], equipmentCategory: NO },
  { title: 'Cable Crunch', type: wr, primaryMuscleGroup: m('ABDOMINALS'), secondaryMuscleGroups: [], equipmentCategory: MC },
  { title: 'Russian Twist (Bodyweight)', type: bw, primaryMuscleGroup: m('ABDOMINALS'), secondaryMuscleGroups: [], equipmentCategory: NO },
  { title: 'Sit Up', type: bw, primaryMuscleGroup: m('ABDOMINALS'), secondaryMuscleGroups: [], equipmentCategory: NO },
  { title: 'Ab Wheel', type: bw, primaryMuscleGroup: m('ABDOMINALS'), secondaryMuscleGroups: [], equipmentCategory: NO },

  // Cardio — note the distance+duration types
  { title: 'Treadmill', type: dd, primaryMuscleGroup: m('CARDIO'), secondaryMuscleGroups: [], equipmentCategory: MC },
  { title: 'Running', type: dd, primaryMuscleGroup: m('CARDIO'), secondaryMuscleGroups: [], equipmentCategory: NO },
  { title: 'Walking', type: dd, primaryMuscleGroup: m('CARDIO'), secondaryMuscleGroups: [], equipmentCategory: NO },
  { title: 'Cycling', type: dd, primaryMuscleGroup: m('CARDIO'), secondaryMuscleGroups: [], equipmentCategory: MC },
  { title: 'Rowing Machine', type: dd, primaryMuscleGroup: m('CARDIO'), secondaryMuscleGroups: [m('UPPER_BACK')], equipmentCategory: MC },
  { title: 'Elliptical Trainer', type: dd, primaryMuscleGroup: m('CARDIO'), secondaryMuscleGroups: [], equipmentCategory: MC },
  { title: 'Swimming', type: dd, primaryMuscleGroup: m('CARDIO'), secondaryMuscleGroups: [m('FULL_BODY')], equipmentCategory: NO },
  { title: 'Jump Rope', type: dur, primaryMuscleGroup: m('CARDIO'), secondaryMuscleGroups: [m('CALVES')], equipmentCategory: OTHER_EQUIPMENT },
  { title: 'Stair Machine', type: dur, primaryMuscleGroup: m('CARDIO'), secondaryMuscleGroups: [m('QUADRICEPS')], equipmentCategory: MC },
  { title: 'Battle Ropes', type: dur, primaryMuscleGroup: m('CARDIO'), secondaryMuscleGroups: [m('SHOULDERS')], equipmentCategory: OTHER_EQUIPMENT },

  // Full body
  { title: 'Burpee', type: bw, primaryMuscleGroup: m('FULL_BODY'), secondaryMuscleGroups: [m('CARDIO')], equipmentCategory: NO },
  { title: 'Kettlebell Swing', type: wr, primaryMuscleGroup: m('FULL_BODY'), secondaryMuscleGroups: [m('GLUTES'), m('HAMSTRINGS')], equipmentCategory: KB },
  { title: 'Clean and Jerk', type: wr, primaryMuscleGroup: m('FULL_BODY'), secondaryMuscleGroups: [m('SHOULDERS'), m('QUADRICEPS')], equipmentCategory: BB },
  { title: 'Farmers Walk', type: dur, primaryMuscleGroup: m('FULL_BODY'), secondaryMuscleGroups: [m('FOREARMS'), m('TRAPS')], equipmentCategory: DB },
  { title: 'Mountain Climber', type: dur, primaryMuscleGroup: m('FULL_BODY'), secondaryMuscleGroups: [m('ABDOMINALS')], equipmentCategory: NO },
]
```

- [ ] **Step 2: Write the failing test**

Create `prisma/exercises.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { SEED_EXERCISES } from './exercises'

const EXERCISE_TYPES = new Set([
  'WEIGHT_REPS', 'REPS_ONLY', 'BODYWEIGHT_REPS', 'BODYWEIGHT_ASSISTED_REPS',
  'DURATION', 'WEIGHT_DURATION', 'DISTANCE_DURATION', 'SHORT_DISTANCE_WEIGHT',
])

const MUSCLE_GROUPS = new Set([
  'ABDOMINALS', 'SHOULDERS', 'BICEPS', 'TRICEPS', 'FOREARMS', 'QUADRICEPS',
  'HAMSTRINGS', 'CALVES', 'GLUTES', 'ABDUCTORS', 'ADDUCTORS', 'LATS',
  'UPPER_BACK', 'TRAPS', 'LOWER_BACK', 'CHEST', 'CARDIO', 'NECK', 'FULL_BODY', 'OTHER',
])

const EQUIPMENT = new Set([
  'NONE', 'BARBELL', 'DUMBBELL', 'KETTLEBELL', 'MACHINE', 'PLATE',
  'RESISTANCE_BAND', 'SUSPENSION', 'OTHER',
])

describe('seed exercises', () => {
  it('ships a usable library', () => {
    expect(SEED_EXERCISES.length).toBeGreaterThanOrEqual(80)
  })

  it('has unique titles', () => {
    const titles = SEED_EXERCISES.map(e => e.title)
    expect(new Set(titles).size).toBe(titles.length)
  })

  it('uses only valid enum values', () => {
    for (const e of SEED_EXERCISES) {
      expect(EXERCISE_TYPES.has(e.type), `${e.title} type`).toBe(true)
      expect(MUSCLE_GROUPS.has(e.primaryMuscleGroup), `${e.title} primary`).toBe(true)
      expect(EQUIPMENT.has(e.equipmentCategory), `${e.title} equipment`).toBe(true)
      for (const s of e.secondaryMuscleGroups) {
        expect(MUSCLE_GROUPS.has(s), `${e.title} secondary`).toBe(true)
      }
    }
  })

  it('never repeats the primary muscle in the secondary list', () => {
    for (const e of SEED_EXERCISES) {
      expect(e.secondaryMuscleGroups, e.title).not.toContain(e.primaryMuscleGroup)
    }
  })

  it('covers every set kind the UI must render', () => {
    const types = new Set(SEED_EXERCISES.map(e => e.type))
    expect(types.has('WEIGHT_REPS')).toBe(true)
    expect(types.has('BODYWEIGHT_REPS')).toBe(true)
    expect(types.has('BODYWEIGHT_ASSISTED_REPS')).toBe(true)
    expect(types.has('DURATION')).toBe(true)
    expect(types.has('DISTANCE_DURATION')).toBe(true)
  })
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `bunx vitest run prisma/exercises.test.ts`
Expected: FAIL — cannot resolve `./exercises`, or (once written) a count/enum assertion fails.

- [ ] **Step 4: Write the seed script**

Create `prisma/seed.ts`:

```ts
import { PrismaClient } from '@prisma/client'
import { SEED_EXERCISES } from './exercises'

const prisma = new PrismaClient()

async function main() {
  // Seeded templates have ownerId null. Upsert on title so re-running is safe.
  for (const exercise of SEED_EXERCISES) {
    const existing = await prisma.exerciseTemplate.findFirst({
      where: { title: exercise.title, ownerId: null },
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
```

- [ ] **Step 5: Run the tests and the seed**

```bash
bunx vitest run prisma/exercises.test.ts
bun run db:seed
```

Expected: 5 tests PASS; seed prints `Seeded 100 exercise templates` (or however many are in the list — at least 80).

- [ ] **Step 6: Verify re-running the seed does not duplicate**

```bash
bun run db:seed
```

Expected: the same count as before, not double.

- [ ] **Step 7: Commit**

```bash
git add prisma/exercises.ts prisma/exercises.test.ts prisma/seed.ts
git commit -m "feat: seed the exercise library with 100 templates"
```

---

### Task 10: Authentication

**Files:**
- Create: `lib/auth.ts`, `lib/password.ts`, `app/api/auth/[...nextauth]/route.ts`, `app/api/auth/register/route.ts`, `middleware.ts`
- Test: `lib/password.test.ts`, `app/api/auth/register/route.test.ts`

**Interfaces:**
- Consumes: `prisma` from `lib/db.ts`.
- Produces:
  - `hashPassword(plain: string): Promise<string>`
  - `verifyPassword(plain: string, hash: string): Promise<boolean>`
  - `auth()` — Auth.js session helper, returns `{ user: { id, email, name } } | null`
  - `requireUserId(): Promise<string>` — throws `UnauthorizedError` when there is no session
  - `class UnauthorizedError extends Error`

- [ ] **Step 1: Write the failing password test**

Create `lib/password.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from './password'

describe('password hashing', () => {
  it('does not store the plaintext', async () => {
    const hash = await hashPassword('correct horse battery staple')
    expect(hash).not.toContain('correct horse')
    expect(hash.length).toBeGreaterThan(50)
  })

  it('verifies the right password', async () => {
    const hash = await hashPassword('s3cret-pass')
    expect(await verifyPassword('s3cret-pass', hash)).toBe(true)
  })

  it('rejects the wrong password', async () => {
    const hash = await hashPassword('s3cret-pass')
    expect(await verifyPassword('wrong-pass', hash)).toBe(false)
  })

  it('produces a different hash each time, so salts differ', async () => {
    const a = await hashPassword('same-password')
    const b = await hashPassword('same-password')
    expect(a).not.toBe(b)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bunx vitest run lib/password.test.ts`
Expected: FAIL — cannot resolve `./password`.

- [ ] **Step 3: Implement password hashing**

Create `lib/password.ts`:

```ts
import bcrypt from 'bcryptjs'

const ROUNDS = 12

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}
```

- [ ] **Step 4: Run the password tests**

Run: `bunx vitest run lib/password.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Configure Auth.js**

Create `lib/auth.ts`:

```ts
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { z } from 'zod'
import { prisma } from './db'
import { verifyPassword } from './password'

export class UnauthorizedError extends Error {
  constructor() {
    super('Not authenticated')
    this.name = 'UnauthorizedError'
  }
}

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw)
        if (!parsed.success) return null

        const user = await prisma.user.findUnique({ where: { email: parsed.data.email } })
        if (!user) return null

        const ok = await verifyPassword(parsed.data.password, user.passwordHash)
        if (!ok) return null

        return { id: user.id, email: user.email, name: user.name }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.sub = user.id
      return token
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub
      return session
    },
  },
})

/** Every API handler calls this instead of trusting a client-supplied id. */
export async function requireUserId(): Promise<string> {
  const session = await auth()
  if (!session?.user?.id) throw new UnauthorizedError()
  return session.user.id
}
```

Create `app/api/auth/[...nextauth]/route.ts`:

```ts
import { handlers } from '@/lib/auth'

export const { GET, POST } = handlers
```

Add the session type augmentation in `types/next-auth.d.ts`:

```ts
import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
    }
  }
}
```

- [ ] **Step 6: Write the failing registration test**

Create `app/api/auth/register/route.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { POST } from './route'
import { prisma } from '@/lib/db'
import { verifyPassword } from '@/lib/password'

const request = (body: unknown) =>
  new Request('http://localhost/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

describe('POST /api/auth/register', () => {
  beforeEach(async () => {
    await prisma.user.deleteMany()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('creates a user and hashes the password', async () => {
    const res = await POST(request({
      email: 'new@example.com', password: 'password123', name: 'New User',
    }))

    expect(res.status).toBe(201)
    const user = await prisma.user.findUnique({ where: { email: 'new@example.com' } })
    expect(user).not.toBeNull()
    expect(user!.passwordHash).not.toBe('password123')
    expect(await verifyPassword('password123', user!.passwordHash)).toBe(true)
  })

  it('never returns the password hash', async () => {
    const res = await POST(request({
      email: 'new@example.com', password: 'password123', name: 'New User',
    }))
    const body = await res.json()
    expect(JSON.stringify(body)).not.toContain('$2')
  })

  it('rejects a duplicate email with 409', async () => {
    const body = { email: 'dupe@example.com', password: 'password123', name: 'A' }
    await POST(request(body))
    const res = await POST(request(body))
    expect(res.status).toBe(409)
  })

  it('rejects a short password with 400', async () => {
    const res = await POST(request({
      email: 'short@example.com', password: 'abc', name: 'A',
    }))
    expect(res.status).toBe(400)
  })

  it('rejects a malformed email with 400', async () => {
    const res = await POST(request({
      email: 'not-an-email', password: 'password123', name: 'A',
    }))
    expect(res.status).toBe(400)
  })

  it('lowercases the email so casing cannot create duplicates', async () => {
    await POST(request({ email: 'Mixed@Example.com', password: 'password123', name: 'A' }))
    const user = await prisma.user.findUnique({ where: { email: 'mixed@example.com' } })
    expect(user).not.toBeNull()
  })
})
```

- [ ] **Step 7: Run it to verify it fails**

Run: `bunx vitest run app/api/auth/register/route.test.ts`
Expected: FAIL — cannot resolve `./route`.

- [ ] **Step 8: Implement registration**

Create `app/api/auth/register/route.ts`:

```ts
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/password'

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  name: z.string().min(1).max(100),
})

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return Response.json({ error: 'Invalid registration details' }, { status: 400 })
  }

  const email = parsed.data.email.toLowerCase()

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return Response.json({ error: 'That email is already registered' }, { status: 409 })
  }

  const user = await prisma.user.create({
    data: {
      email,
      name: parsed.data.name,
      passwordHash: await hashPassword(parsed.data.password),
    },
    select: { id: true, email: true, name: true },
  })

  return Response.json({ user }, { status: 201 })
}
```

- [ ] **Step 9: Run the registration tests**

Run: `bunx vitest run app/api/auth/register/route.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 10: Protect the app routes**

Create `middleware.ts` at the repo root:

```ts
import { auth } from '@/lib/auth'

export default auth((req) => {
  if (!req.auth) {
    const url = new URL('/login', req.nextUrl.origin)
    return Response.redirect(url)
  }
})

export const config = {
  matcher: ['/workout/:path*', '/history/:path*', '/exercises/:path*'],
}
```

- [ ] **Step 11: Commit**

```bash
git add lib/auth.ts lib/password.ts lib/password.test.ts middleware.ts types/next-auth.d.ts app/api/auth
git commit -m "feat: add credentials auth, registration, and route protection"
```

---

## Phase D — API

### Task 11: Live session endpoints (start, autosave, finish, discard)

**Files:**
- Create: `app/api/workouts/start/route.ts`, `app/api/workouts/active/route.ts`, `app/api/workouts/active/finish/route.ts`, `lib/apiError.ts`
- Test: `app/api/workouts/active/route.test.ts`, `app/api/workouts/active/finish/route.test.ts`

**Interfaces:**
- Consumes: `requireUserId`, `UnauthorizedError` from `lib/auth.ts`; `workoutDraftSchema`, `validateAgainstTypes`, `emptyDraft` from `lib/workout/draft.ts`; `normalizeDraft` from `lib/workout/normalize.ts`; `prisma` from `lib/db.ts`.
- Produces: `handleApiError(e: unknown): Response` from `lib/apiError.ts`.

- [ ] **Step 1: Write the shared error handler**

Create `lib/apiError.ts`:

```ts
import { UnauthorizedError } from './auth'

export function handleApiError(e: unknown): Response {
  if (e instanceof UnauthorizedError) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 })
  }
  console.error(e)
  return Response.json({ error: 'Internal server error' }, { status: 500 })
}
```

- [ ] **Step 2: Write the failing test for start and active**

Route handlers resolve the user from the server session, so tests stub that one function
rather than constructing signed JWTs. Each test file defines its own `load()` helper —
`vi.doMock` must run before the module under test is imported, so the mock and the dynamic
import have to live together in the same file.

Create `app/api/workouts/active/route.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/db'

let userId: string
let otherId: string

async function seedUsers() {
  const a = await prisma.user.create({
    data: { email: 'a@example.com', passwordHash: 'x', name: 'A' },
  })
  const b = await prisma.user.create({
    data: { email: 'b@example.com', passwordHash: 'x', name: 'B' },
  })
  userId = a.id
  otherId = b.id
}

async function load(asUser: string | null) {
  vi.resetModules()
  vi.doMock('@/lib/auth', async () => {
    const actual = await vi.importActual<typeof import('@/lib/auth')>('@/lib/auth')
    return {
      ...actual,
      requireUserId: async () => {
        if (asUser === null) throw new actual.UnauthorizedError()
        return asUser
      },
    }
  })
  return {
    start: (await import('../start/route')).POST,
    active: await import('./route'),
  }
}

const req = (body?: unknown) =>
  new Request('http://localhost/api/workouts/active', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

describe('live session endpoints', () => {
  beforeEach(async () => {
    await prisma.workout.deleteMany()
    await prisma.user.deleteMany()
    await seedUsers()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('starts a workout and returns an empty draft', async () => {
    const { start } = await load(userId)
    const res = await start(new Request('http://localhost/api/workouts/start', { method: 'POST' }))

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.draft.exercises).toEqual([])
    expect(body.status).toBe('in_progress')
  })

  it('returns 409 when a session is already live', async () => {
    const { start } = await load(userId)
    await start(new Request('http://localhost/api/workouts/start', { method: 'POST' }))
    const res = await start(new Request('http://localhost/api/workouts/start', { method: 'POST' }))

    expect(res.status).toBe(409)
  })

  it('returns 401 with no session', async () => {
    const { start } = await load(null)
    const res = await start(new Request('http://localhost/api/workouts/start', { method: 'POST' }))
    expect(res.status).toBe(401)
  })

  it('GET returns null when nothing is in progress', async () => {
    const { active } = await load(userId)
    const res = await active.GET()

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ workout: null })
  })

  it('PATCH saves the draft and GET reads it back', async () => {
    const { start, active } = await load(userId)
    await start(new Request('http://localhost/api/workouts/start', { method: 'POST' }))

    const draft = {
      title: 'Chest Day',
      description: null,
      exercises: [{
        exerciseTemplateId: 'tpl-1', notes: null, restSeconds: 180, supersetId: null,
        sets: [{ type: 'normal', weightKg: 60, reps: 10, distanceMeters: null, durationSeconds: null, rpe: null, completed: true }],
      }],
    }

    const patch = await active.PATCH(req({ draft }))
    expect(patch.status).toBe(200)

    const got = await (await active.GET()).json()
    expect(got.workout.draft.title).toBe('Chest Day')
    expect(got.workout.draft.exercises[0].sets[0].weightKg).toBe(60)
  })

  it('PATCH rejects a malformed draft with 400', async () => {
    const { start, active } = await load(userId)
    await start(new Request('http://localhost/api/workouts/start', { method: 'POST' }))

    const res = await active.PATCH(req({ draft: { title: '', description: null, exercises: [] } }))
    expect(res.status).toBe(400)
  })

  it('PATCH returns 404 when no session is live', async () => {
    const { active } = await load(userId)
    const res = await active.PATCH(req({
      draft: { title: 'X', description: null, exercises: [] },
    }))
    expect(res.status).toBe(404)
  })

  it('never exposes another user’s session', async () => {
    const mine = await load(userId)
    await mine.start(new Request('http://localhost/api/workouts/start', { method: 'POST' }))

    const theirs = await load(otherId)
    expect(await (await theirs.active.GET()).json()).toEqual({ workout: null })
  })

  it('DELETE discards the session', async () => {
    const { start, active } = await load(userId)
    await start(new Request('http://localhost/api/workouts/start', { method: 'POST' }))

    const res = await active.DELETE()
    expect(res.status).toBe(204)
    expect(await prisma.workout.count()).toBe(0)
  })
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `bunx vitest run app/api/workouts/active/route.test.ts`
Expected: FAIL — cannot resolve `../start/route`.

- [ ] **Step 4: Implement start**

Create `app/api/workouts/start/route.ts`:

```ts
import { prisma } from '@/lib/db'
import { requireUserId } from '@/lib/auth'
import { handleApiError } from '@/lib/apiError'
import { emptyDraft } from '@/lib/workout/draft'

function defaultTitle(now: Date): string {
  const hour = now.getHours()
  if (hour < 12) return 'Morning Workout'
  if (hour < 17) return 'Afternoon Workout'
  return 'Evening Workout'
}

export async function POST() {
  try {
    const userId = await requireUserId()

    const existing = await prisma.workout.findFirst({
      where: { userId, status: 'IN_PROGRESS' },
    })
    if (existing) {
      return Response.json(
        { error: 'A workout is already in progress', workout_id: existing.id },
        { status: 409 },
      )
    }

    const title = defaultTitle(new Date())
    const workout = await prisma.workout.create({
      data: { userId, title, status: 'IN_PROGRESS', draft: emptyDraft(title) },
    })

    return Response.json(
      {
        id: workout.id,
        status: 'in_progress',
        start_time: workout.startTime.toISOString(),
        draft: workout.draft,
      },
      { status: 201 },
    )
  } catch (e) {
    return handleApiError(e)
  }
}
```

- [ ] **Step 5: Implement the active-session handlers**

Create `app/api/workouts/active/route.ts`:

```ts
import { prisma } from '@/lib/db'
import { requireUserId } from '@/lib/auth'
import { handleApiError } from '@/lib/apiError'
import { workoutDraftSchema } from '@/lib/workout/draft'
import { z } from 'zod'

const patchSchema = z.object({ draft: workoutDraftSchema })

export async function GET() {
  try {
    const userId = await requireUserId()
    const workout = await prisma.workout.findFirst({
      where: { userId, status: 'IN_PROGRESS' },
      select: { id: true, title: true, startTime: true, draft: true, updatedAt: true },
    })

    if (!workout) return Response.json({ workout: null })

    return Response.json({
      workout: {
        id: workout.id,
        title: workout.title,
        start_time: workout.startTime.toISOString(),
        updated_at: workout.updatedAt.toISOString(),
        draft: workout.draft,
      },
    })
  } catch (e) {
    return handleApiError(e)
  }
}

export async function PATCH(request: Request) {
  try {
    const userId = await requireUserId()

    const parsed = patchSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid draft', issues: parsed.error.issues.map(i => i.message) },
        { status: 400 },
      )
    }

    const active = await prisma.workout.findFirst({
      where: { userId, status: 'IN_PROGRESS' },
      select: { id: true },
    })
    if (!active) {
      return Response.json({ error: 'No workout in progress' }, { status: 404 })
    }

    // Last write wins, by design: a single-user tracker with two tabs open
    // resolves on updatedAt rather than carrying conflict machinery.
    const saved = await prisma.workout.update({
      where: { id: active.id },
      data: { draft: parsed.data.draft, title: parsed.data.draft.title },
      select: { updatedAt: true },
    })

    return Response.json({ updated_at: saved.updatedAt.toISOString() })
  } catch (e) {
    return handleApiError(e)
  }
}

export async function DELETE() {
  try {
    const userId = await requireUserId()
    await prisma.workout.deleteMany({ where: { userId, status: 'IN_PROGRESS' } })
    return new Response(null, { status: 204 })
  } catch (e) {
    return handleApiError(e)
  }
}
```

- [ ] **Step 6: Run the tests**

Run: `bunx vitest run app/api/workouts/active/route.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 7: Write the failing finish test**

Create `app/api/workouts/active/finish/route.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/db'

let userId: string
let benchId: string
let treadmillId: string

async function seed() {
  const user = await prisma.user.create({
    data: { email: 'f@example.com', passwordHash: 'x', name: 'F' },
  })
  userId = user.id

  const bench = await prisma.exerciseTemplate.create({
    data: {
      title: 'Bench Press (Barbell)', type: 'WEIGHT_REPS',
      primaryMuscleGroup: 'CHEST', secondaryMuscleGroups: ['TRICEPS'],
      equipmentCategory: 'BARBELL',
    },
  })
  const treadmill = await prisma.exerciseTemplate.create({
    data: {
      title: 'Treadmill', type: 'DISTANCE_DURATION',
      primaryMuscleGroup: 'CARDIO', secondaryMuscleGroups: [],
      equipmentCategory: 'MACHINE',
    },
  })
  benchId = bench.id
  treadmillId = treadmill.id
}

async function loadFinish(asUser: string | null) {
  vi.resetModules()
  vi.doMock('@/lib/auth', async () => {
    const actual = await vi.importActual<typeof import('@/lib/auth')>('@/lib/auth')
    return {
      ...actual,
      requireUserId: async () => {
        if (asUser === null) throw new actual.UnauthorizedError()
        return asUser
      },
    }
  })
  return (await import('./route')).POST
}

const set = (o: Record<string, unknown>) => ({
  type: 'normal', weightKg: null, reps: null, distanceMeters: null,
  durationSeconds: null, rpe: null, completed: true, ...o,
})

async function startWith(draft: unknown) {
  return prisma.workout.create({
    data: { userId, title: 'Session', status: 'IN_PROGRESS', draft: draft as object },
  })
}

const post = () =>
  new Request('http://localhost/api/workouts/active/finish', { method: 'POST' })

describe('POST /api/workouts/active/finish', () => {
  beforeEach(async () => {
    await prisma.workout.deleteMany()
    await prisma.exerciseTemplate.deleteMany()
    await prisma.user.deleteMany()
    await seed()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('normalizes the draft into rows and completes the workout', async () => {
    await startWith({
      title: 'Chest Day',
      description: null,
      exercises: [{
        exerciseTemplateId: benchId, notes: 'felt good', restSeconds: 180, supersetId: null,
        sets: [set({ weightKg: 60, reps: 10 }), set({ weightKg: 65, reps: 8 })],
      }],
    })

    const finish = await loadFinish(userId)
    const res = await finish(post())
    expect(res.status).toBe(200)

    const workout = await prisma.workout.findFirst({
      include: { exercises: { include: { sets: true } } },
    })

    expect(workout!.status).toBe('COMPLETED')
    expect(workout!.endTime).not.toBeNull()
    expect(workout!.draft).toBeNull()
    expect(workout!.exercises).toHaveLength(1)
    expect(workout!.exercises[0].notes).toBe('felt good')
    expect(workout!.exercises[0].sets).toHaveLength(2)
  })

  it('discards incomplete sets', async () => {
    await startWith({
      title: 'T', description: null,
      exercises: [{
        exerciseTemplateId: benchId, notes: null, restSeconds: null, supersetId: null,
        sets: [set({ weightKg: 60, reps: 10 }), set({ weightKg: 65, reps: 8, completed: false })],
      }],
    })

    const finish = await loadFinish(userId)
    await finish(post())

    const sets = await prisma.setEntry.findMany()
    expect(sets).toHaveLength(1)
    expect(sets[0].weightKg).toBe(60)
  })

  it('rejects a set whose fields contradict the exercise type', async () => {
    await startWith({
      title: 'T', description: null,
      exercises: [{
        exerciseTemplateId: benchId, notes: null, restSeconds: null, supersetId: null,
        sets: [set({ weightKg: 60, reps: 10, distanceMeters: 5000 })],
      }],
    })

    const finish = await loadFinish(userId)
    const res = await finish(post())

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(JSON.stringify(body)).toContain('distance')
  })

  it('leaves the workout in progress when validation fails', async () => {
    await startWith({
      title: 'T', description: null,
      exercises: [{
        exerciseTemplateId: benchId, notes: null, restSeconds: null, supersetId: null,
        sets: [set({ weightKg: 60, reps: 10, durationSeconds: 30 })],
      }],
    })

    const finish = await loadFinish(userId)
    await finish(post())

    const workout = await prisma.workout.findFirst()
    expect(workout!.status).toBe('IN_PROGRESS')
    expect(workout!.draft).not.toBeNull()
  })

  it('accepts a cardio set with distance and duration', async () => {
    await startWith({
      title: 'Cardio', description: null,
      exercises: [{
        exerciseTemplateId: treadmillId, notes: null, restSeconds: null, supersetId: null,
        sets: [set({ distanceMeters: 5000, durationSeconds: 1695 })],
      }],
    })

    const finish = await loadFinish(userId)
    expect((await finish(post())).status).toBe(200)

    const sets = await prisma.setEntry.findMany()
    expect(sets[0].distanceMeters).toBe(5000)
  })

  it('rejects finishing an empty workout with 400', async () => {
    await startWith({ title: 'T', description: null, exercises: [] })

    const finish = await loadFinish(userId)
    const res = await finish(post())

    expect(res.status).toBe(400)
    expect(await prisma.workout.count({ where: { status: 'IN_PROGRESS' } })).toBe(1)
  })

  it('returns 404 when no session is live', async () => {
    const finish = await loadFinish(userId)
    expect((await finish(post())).status).toBe(404)
  })

  it('frees the user to start another workout afterwards', async () => {
    await startWith({
      title: 'T', description: null,
      exercises: [{
        exerciseTemplateId: benchId, notes: null, restSeconds: null, supersetId: null,
        sets: [set({ weightKg: 60, reps: 10 })],
      }],
    })

    const finish = await loadFinish(userId)
    await finish(post())

    await expect(prisma.workout.create({
      data: { userId, title: 'Next', status: 'IN_PROGRESS' },
    })).resolves.toBeDefined()
  })
})
```

- [ ] **Step 8: Run it to verify it fails**

Run: `bunx vitest run app/api/workouts/active/finish/route.test.ts`
Expected: FAIL — cannot resolve `./route`.

- [ ] **Step 9: Implement finish**

Create `app/api/workouts/active/finish/route.ts`:

```ts
import { prisma } from '@/lib/db'
import { requireUserId } from '@/lib/auth'
import { handleApiError } from '@/lib/apiError'
import { workoutDraftSchema, validateAgainstTypes } from '@/lib/workout/draft'
import { normalizeDraft } from '@/lib/workout/normalize'
import type { ExerciseTypeWire } from '@/lib/workout/types'

export async function POST() {
  try {
    const userId = await requireUserId()

    const active = await prisma.workout.findFirst({
      where: { userId, status: 'IN_PROGRESS' },
      select: { id: true, draft: true, startTime: true },
    })
    if (!active) {
      return Response.json({ error: 'No workout in progress' }, { status: 404 })
    }

    const parsed = workoutDraftSchema.safeParse(active.draft)
    if (!parsed.success) {
      return Response.json({ error: 'Stored draft is malformed' }, { status: 400 })
    }
    const draft = parsed.data

    // Validate populated fields against each exercise's type before writing anything.
    const templateIds = draft.exercises.map(e => e.exerciseTemplateId)
    const templates = await prisma.exerciseTemplate.findMany({
      where: { id: { in: templateIds }, OR: [{ ownerId: null }, { ownerId: userId }] },
      select: { id: true, type: true },
    })
    const types = new Map<string, ExerciseTypeWire>(
      templates.map(t => [t.id, t.type.toLowerCase() as ExerciseTypeWire]),
    )

    const errors = validateAgainstTypes(draft, types)
    if (errors.length > 0) {
      return Response.json({ error: 'Invalid sets', issues: errors }, { status: 400 })
    }

    const rows = normalizeDraft(draft)
    if (rows.length === 0) {
      return Response.json(
        { error: 'Complete at least one set before finishing' },
        { status: 400 },
      )
    }

    // One transaction: rows in, draft out, status flipped. A partial finish would
    // leave a workout that is neither in progress nor complete.
    const finished = await prisma.$transaction(async (tx) => {
      for (const exercise of rows) {
        await tx.workoutExercise.create({
          data: {
            workoutId: active.id,
            exerciseTemplateId: exercise.exerciseTemplateId,
            index: exercise.index,
            notes: exercise.notes,
            restSeconds: exercise.restSeconds,
            supersetId: exercise.supersetId,
            sets: {
              create: exercise.sets.map(s => ({
                index: s.index,
                type: s.type as 'NORMAL' | 'WARMUP' | 'FAILURE' | 'DROPSET',
                weightKg: s.weightKg,
                reps: s.reps,
                distanceMeters: s.distanceMeters,
                durationSeconds: s.durationSeconds,
                rpe: s.rpe,
              })),
            },
          },
        })
      }

      return tx.workout.update({
        where: { id: active.id },
        data: {
          status: 'COMPLETED',
          endTime: new Date(),
          draft: null,
          title: draft.title,
          description: draft.description,
        },
        select: { id: true, startTime: true, endTime: true },
      })
    })

    return Response.json({
      id: finished.id,
      start_time: finished.startTime.toISOString(),
      end_time: finished.endTime!.toISOString(),
    })
  } catch (e) {
    return handleApiError(e)
  }
}
```

- [ ] **Step 10: Run the finish tests**

Run: `bunx vitest run app/api/workouts/active/finish/route.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 11: Commit**

```bash
git add lib/apiError.ts test/session.ts app/api/workouts
git commit -m "feat: add live session endpoints with transactional finish"
```

---

### Task 12: Read endpoints (history, library, previous performance)

**Files:**
- Create: `app/api/v1/workouts/route.ts`, `app/api/v1/workouts/[id]/route.ts`, `app/api/v1/exercise_templates/route.ts`, `app/api/v1/exercise_history/[templateId]/route.ts`, `lib/workout/present.ts`
- Test: `app/api/v1/exercise_templates/route.test.ts`, `app/api/v1/exercise_history/[templateId]/route.test.ts`

**Interfaces:**
- Consumes: `setToWire`, `enumToWire` from `lib/workout/serialize.ts`; `requireUserId`; `prisma`.
- Produces: `workoutToWire(workout)` and `templateToWire(template)` from `lib/workout/present.ts`.

- [ ] **Step 1: Write the presenter**

Create `lib/workout/present.ts`:

```ts
import { enumToWire, setToWire, type DbSetLike } from './serialize'

interface TemplateRow {
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

interface WorkoutRow {
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
```

- [ ] **Step 2: Write the failing test for exercise templates**

Create `app/api/v1/exercise_templates/route.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/db'

let userId: string
let otherId: string

async function seed() {
  const a = await prisma.user.create({ data: { email: 'a@x.com', passwordHash: 'x', name: 'A' } })
  const b = await prisma.user.create({ data: { email: 'b@x.com', passwordHash: 'x', name: 'B' } })
  userId = a.id
  otherId = b.id

  await prisma.exerciseTemplate.createMany({
    data: [
      { title: 'Bench Press (Barbell)', type: 'WEIGHT_REPS', primaryMuscleGroup: 'CHEST', secondaryMuscleGroups: ['TRICEPS'], equipmentCategory: 'BARBELL' },
      { title: 'Squat (Barbell)', type: 'WEIGHT_REPS', primaryMuscleGroup: 'QUADRICEPS', secondaryMuscleGroups: ['GLUTES'], equipmentCategory: 'BARBELL' },
      { title: 'Treadmill', type: 'DISTANCE_DURATION', primaryMuscleGroup: 'CARDIO', secondaryMuscleGroups: [], equipmentCategory: 'MACHINE' },
      { title: 'My Secret Lift', type: 'WEIGHT_REPS', primaryMuscleGroup: 'CHEST', secondaryMuscleGroups: [], equipmentCategory: 'BARBELL', isCustom: true, ownerId: b.id },
    ],
  })
}

async function load(asUser: string | null) {
  vi.resetModules()
  vi.doMock('@/lib/auth', async () => {
    const actual = await vi.importActual<typeof import('@/lib/auth')>('@/lib/auth')
    return {
      ...actual,
      requireUserId: async () => {
        if (asUser === null) throw new actual.UnauthorizedError()
        return asUser
      },
    }
  })
  return import('./route')
}

const get = (query = '') =>
  new Request(`http://localhost/api/v1/exercise_templates${query}`)

describe('GET /api/v1/exercise_templates', () => {
  beforeEach(async () => {
    await prisma.exerciseTemplate.deleteMany()
    await prisma.user.deleteMany()
    await seed()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('returns seeded templates in snake_case with lowercase enums', async () => {
    const { GET } = await load(userId)
    const body = await (await GET(get())).json()

    const bench = body.exercise_templates.find((t: { title: string }) => t.title === 'Bench Press (Barbell)')
    expect(bench.type).toBe('weight_reps')
    expect(bench.primary_muscle_group).toBe('chest')
    expect(bench.secondary_muscle_groups).toEqual(['triceps'])
    expect(bench.equipment_category).toBe('barbell')
    expect(bench.is_custom).toBe(false)
  })

  it('hides another user’s custom exercises', async () => {
    const { GET } = await load(userId)
    const body = await (await GET(get())).json()
    const titles = body.exercise_templates.map((t: { title: string }) => t.title)
    expect(titles).not.toContain('My Secret Lift')
  })

  it('includes the owner’s own custom exercises', async () => {
    const { GET } = await load(otherId)
    const body = await (await GET(get())).json()
    const titles = body.exercise_templates.map((t: { title: string }) => t.title)
    expect(titles).toContain('My Secret Lift')
  })

  it('searches by title, case-insensitively', async () => {
    const { GET } = await load(userId)
    const body = await (await GET(get('?q=bench'))).json()
    expect(body.exercise_templates).toHaveLength(1)
    expect(body.exercise_templates[0].title).toBe('Bench Press (Barbell)')
  })

  it('filters by muscle group', async () => {
    const { GET } = await load(userId)
    const body = await (await GET(get('?muscle_group=cardio'))).json()
    expect(body.exercise_templates).toHaveLength(1)
    expect(body.exercise_templates[0].title).toBe('Treadmill')
  })

  it('returns 401 with no session', async () => {
    const { GET } = await load(null)
    expect((await GET(get())).status).toBe(401)
  })

  it('creates a custom template owned by the caller', async () => {
    const { POST } = await load(userId)
    const res = await POST(new Request('http://localhost/api/v1/exercise_templates', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'Sandbag Carry',
        type: 'duration',
        primary_muscle_group: 'full_body',
        secondary_muscle_groups: ['forearms'],
        equipment_category: 'other',
      }),
    }))

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.exercise_template.is_custom).toBe(true)

    const row = await prisma.exerciseTemplate.findFirst({ where: { title: 'Sandbag Carry' } })
    expect(row!.ownerId).toBe(userId)
    expect(row!.type).toBe('DURATION')
  })

  it('rejects an invalid enum on create with 400', async () => {
    const { POST } = await load(userId)
    const res = await POST(new Request('http://localhost/api/v1/exercise_templates', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'Nonsense',
        type: 'interpretive_dance',
        primary_muscle_group: 'chest',
        secondary_muscle_groups: [],
        equipment_category: 'none',
      }),
    }))
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `bunx vitest run app/api/v1/exercise_templates/route.test.ts`
Expected: FAIL — cannot resolve `./route`.

- [ ] **Step 4: Implement the exercise-templates endpoint**

Create `app/api/v1/exercise_templates/route.ts`:

```ts
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireUserId } from '@/lib/auth'
import { handleApiError } from '@/lib/apiError'
import { templateToWire } from '@/lib/workout/present'
import { enumFromWire } from '@/lib/workout/serialize'
import type { Prisma } from '@prisma/client'

const EXERCISE_TYPES = [
  'weight_reps', 'reps_only', 'bodyweight_reps', 'bodyweight_assisted_reps',
  'duration', 'weight_duration', 'distance_duration', 'short_distance_weight',
] as const

const MUSCLE_GROUPS = [
  'abdominals', 'shoulders', 'biceps', 'triceps', 'forearms', 'quadriceps',
  'hamstrings', 'calves', 'glutes', 'abductors', 'adductors', 'lats',
  'upper_back', 'traps', 'lower_back', 'chest', 'cardio', 'neck', 'full_body', 'other',
] as const

const EQUIPMENT = [
  'none', 'barbell', 'dumbbell', 'kettlebell', 'machine', 'plate',
  'resistance_band', 'suspension', 'other',
] as const

export async function GET(request: Request) {
  try {
    const userId = await requireUserId()
    const url = new URL(request.url)
    const q = url.searchParams.get('q')?.trim()
    const muscleGroup = url.searchParams.get('muscle_group')?.trim()

    const where: Prisma.ExerciseTemplateWhereInput = {
      // Seeded templates plus the caller's own custom ones — never anyone else's.
      OR: [{ ownerId: null }, { ownerId: userId }],
    }
    if (q) where.title = { contains: q, mode: 'insensitive' }
    if (muscleGroup && (MUSCLE_GROUPS as readonly string[]).includes(muscleGroup)) {
      where.primaryMuscleGroup = enumFromWire(muscleGroup) as never
    }

    const templates = await prisma.exerciseTemplate.findMany({
      where,
      orderBy: { title: 'asc' },
      take: 500,
    })

    return Response.json({ exercise_templates: templates.map(templateToWire) })
  } catch (e) {
    return handleApiError(e)
  }
}

const createSchema = z.object({
  title: z.string().min(1).max(200),
  type: z.enum(EXERCISE_TYPES),
  primary_muscle_group: z.enum(MUSCLE_GROUPS),
  secondary_muscle_groups: z.array(z.enum(MUSCLE_GROUPS)).max(5),
  equipment_category: z.enum(EQUIPMENT),
})

export async function POST(request: Request) {
  try {
    const userId = await requireUserId()

    const parsed = createSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return Response.json({ error: 'Invalid exercise' }, { status: 400 })
    }

    const template = await prisma.exerciseTemplate.create({
      data: {
        title: parsed.data.title,
        type: enumFromWire(parsed.data.type) as never,
        primaryMuscleGroup: enumFromWire(parsed.data.primary_muscle_group) as never,
        secondaryMuscleGroups: parsed.data.secondary_muscle_groups.map(enumFromWire) as never,
        equipmentCategory: enumFromWire(parsed.data.equipment_category) as never,
        isCustom: true,
        ownerId: userId,
      },
    })

    return Response.json({ exercise_template: templateToWire(template) }, { status: 201 })
  } catch (e) {
    return handleApiError(e)
  }
}
```

- [ ] **Step 5: Run the tests**

Run: `bunx vitest run app/api/v1/exercise_templates/route.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 6: Write the failing test for exercise history**

Create `app/api/v1/exercise_history/[templateId]/route.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/db'

let userId: string
let otherId: string
let benchId: string

async function seed() {
  const a = await prisma.user.create({ data: { email: 'a@x.com', passwordHash: 'x', name: 'A' } })
  const b = await prisma.user.create({ data: { email: 'b@x.com', passwordHash: 'x', name: 'B' } })
  userId = a.id
  otherId = b.id

  const bench = await prisma.exerciseTemplate.create({
    data: {
      title: 'Bench Press (Barbell)', type: 'WEIGHT_REPS', primaryMuscleGroup: 'CHEST',
      secondaryMuscleGroups: [], equipmentCategory: 'BARBELL',
    },
  })
  benchId = bench.id
}

async function logWorkout(owner: string, when: Date, weight: number) {
  await prisma.workout.create({
    data: {
      userId: owner, title: 'W', status: 'COMPLETED',
      startTime: when, endTime: new Date(when.getTime() + 3_600_000),
      exercises: {
        create: [{
          exerciseTemplateId: benchId, index: 0,
          sets: { create: [{ index: 0, type: 'NORMAL', weightKg: weight, reps: 10 }] },
        }],
      },
    },
  })
}

async function load(asUser: string | null) {
  vi.resetModules()
  vi.doMock('@/lib/auth', async () => {
    const actual = await vi.importActual<typeof import('@/lib/auth')>('@/lib/auth')
    return {
      ...actual,
      requireUserId: async () => {
        if (asUser === null) throw new actual.UnauthorizedError()
        return asUser
      },
    }
  })
  return (await import('./route')).GET
}

const req = () => new Request('http://localhost/api/v1/exercise_history/x')

describe('GET /api/v1/exercise_history/[templateId]', () => {
  beforeEach(async () => {
    await prisma.workout.deleteMany()
    await prisma.exerciseTemplate.deleteMany()
    await prisma.user.deleteMany()
    await seed()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('returns the most recent performance first', async () => {
    await logWorkout(userId, new Date('2026-08-01T10:00:00Z'), 60)
    await logWorkout(userId, new Date('2026-08-10T10:00:00Z'), 70)

    const GET = await load(userId)
    const body = await (await GET(req(), { params: Promise.resolve({ templateId: benchId }) })).json()

    expect(body.exercise_history[0].weight_kg).toBe(70)
    expect(body.exercise_history[1].weight_kg).toBe(60)
  })

  it('never returns another user’s history', async () => {
    await logWorkout(otherId, new Date('2026-08-10T10:00:00Z'), 100)

    const GET = await load(userId)
    const body = await (await GET(req(), { params: Promise.resolve({ templateId: benchId }) })).json()

    expect(body.exercise_history).toEqual([])
  })

  it('returns an empty list for an exercise never performed', async () => {
    const GET = await load(userId)
    const body = await (await GET(req(), { params: Promise.resolve({ templateId: benchId }) })).json()
    expect(body.exercise_history).toEqual([])
  })

  it('returns 401 with no session', async () => {
    const GET = await load(null)
    const res = await GET(req(), { params: Promise.resolve({ templateId: benchId }) })
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 7: Run it to verify it fails**

Run: `bunx vitest run "app/api/v1/exercise_history/[templateId]/route.test.ts"`
Expected: FAIL — cannot resolve `./route`.

- [ ] **Step 8: Implement exercise history**

Create `app/api/v1/exercise_history/[templateId]/route.ts`:

```ts
import { prisma } from '@/lib/db'
import { requireUserId } from '@/lib/auth'
import { handleApiError } from '@/lib/apiError'
import { enumToWire } from '@/lib/workout/serialize'

/** Powers the PREV column: every set of this exercise the user has completed, newest first. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ templateId: string }> },
) {
  try {
    const userId = await requireUserId()
    const { templateId } = await params

    const rows = await prisma.workoutExercise.findMany({
      where: {
        exerciseTemplateId: templateId,
        workout: { userId, status: 'COMPLETED' },
      },
      orderBy: { workout: { startTime: 'desc' } },
      take: 50,
      select: {
        workout: { select: { id: true, title: true, startTime: true, endTime: true } },
        sets: { orderBy: { index: 'asc' } },
      },
    })

    const history = rows.flatMap(row =>
      row.sets.map(set => ({
        workout_id: row.workout.id,
        workout_title: row.workout.title,
        workout_start_time: row.workout.startTime.toISOString(),
        workout_end_time: row.workout.endTime?.toISOString() ?? null,
        exercise_template_id: templateId,
        set_type: enumToWire(set.type),
        weight_kg: set.weightKg,
        reps: set.reps,
        distance_meters: set.distanceMeters,
        duration_seconds: set.durationSeconds,
        rpe: set.rpe,
      })),
    )

    return Response.json({ exercise_history: history })
  } catch (e) {
    return handleApiError(e)
  }
}
```

- [ ] **Step 9: Run the tests**

Run: `bunx vitest run "app/api/v1/exercise_history/[templateId]/route.test.ts"`
Expected: PASS, 4 tests.

- [ ] **Step 10: Implement the workout read endpoints**

Create `app/api/v1/workouts/route.ts`:

```ts
import { prisma } from '@/lib/db'
import { requireUserId } from '@/lib/auth'
import { handleApiError } from '@/lib/apiError'
import { workoutToWire } from '@/lib/workout/present'

const MAX_PAGE_SIZE = 50

export async function GET(request: Request) {
  try {
    const userId = await requireUserId()
    const url = new URL(request.url)

    const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1)
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Number(url.searchParams.get('pageSize') ?? '10') || 10),
    )

    const [workouts, total] = await Promise.all([
      prisma.workout.findMany({
        where: { userId, status: 'COMPLETED' },
        orderBy: { startTime: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          exercises: {
            orderBy: { index: 'asc' },
            include: {
              template: { select: { title: true } },
              sets: { orderBy: { index: 'asc' } },
            },
          },
        },
      }),
      prisma.workout.count({ where: { userId, status: 'COMPLETED' } }),
    ])

    return Response.json({
      page,
      page_size: pageSize,
      page_count: Math.ceil(total / pageSize),
      workouts: workouts.map(workoutToWire),
    })
  } catch (e) {
    return handleApiError(e)
  }
}
```

Create `app/api/v1/workouts/[id]/route.ts`:

```ts
import { prisma } from '@/lib/db'
import { requireUserId } from '@/lib/auth'
import { handleApiError } from '@/lib/apiError'
import { workoutToWire } from '@/lib/workout/present'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireUserId()
    const { id } = await params

    // Scoped by userId, so another user's id yields 404 rather than their data.
    const workout = await prisma.workout.findFirst({
      where: { id, userId, status: 'COMPLETED' },
      include: {
        exercises: {
          orderBy: { index: 'asc' },
          include: {
            template: { select: { title: true } },
            sets: { orderBy: { index: 'asc' } },
          },
        },
      },
    })

    if (!workout) return Response.json({ error: 'Not found' }, { status: 404 })

    return Response.json({ workout: workoutToWire(workout) })
  } catch (e) {
    return handleApiError(e)
  }
}
```

- [ ] **Step 11: Run the whole suite**

Run: `bun run test`
Expected: PASS — everything from Tasks 1–12.

- [ ] **Step 12: Commit**

```bash
git add lib/workout/present.ts app/api/v1
git commit -m "feat: add read endpoints for history, library, and previous performance"
```

---

## Phase E — UI

### Task 13: Set row and summary presentation

**Files:**
- Create: `components/SummaryStats.tsx`, `app/(app)/workout/SetRow.tsx`
- Test: `components/SummaryStats.test.tsx`, `app/(app)/workout/SetRow.test.tsx`

**Interfaces:**
- Consumes: `fieldsFor`, `isAssistedType` from `setKinds.ts`; `summarize`, `WorkoutSummary` from `summary.ts`; unit helpers from `units.ts`; `DraftSet` from `types.ts`.
- Produces:
  - `<SummaryStats summary={WorkoutSummary} system={UnitSystemWire} />`
  - `<SetRow index={number} set={DraftSet} type={ExerciseTypeWire} system={UnitSystemWire} previous={string | null} onChange={(set: DraftSet) => void} onDelete={() => void} />`

- [ ] **Step 1: Write the failing SummaryStats test**

Create `components/SummaryStats.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SummaryStats } from './SummaryStats'
import type { WorkoutSummary } from '@/lib/workout/summary'

const summary = (o: Partial<WorkoutSummary>): WorkoutSummary => ({
  totalSets: 0, volumeKg: null, distanceMeters: null, movingSeconds: null,
  avgSpeed: null, timeUnderTensionSeconds: null, ...o,
})

describe('SummaryStats', () => {
  it('shows volume for a strength workout', () => {
    render(<SummaryStats summary={summary({ totalSets: 4, volumeKg: 4250 })} system="metric" />)
    expect(screen.getByText(/4,250 kg/)).toBeInTheDocument()
    expect(screen.getByText(/4 sets/)).toBeInTheDocument()
  })

  it('shows distance, time and speed for cardio', () => {
    render(<SummaryStats summary={summary({
      totalSets: 1, distanceMeters: 5000, movingSeconds: 1695, avgSpeed: 10.619,
    })} system="metric" />)

    expect(screen.getByText(/5\.0 km/)).toBeInTheDocument()
    expect(screen.getByText(/28:15/)).toBeInTheDocument()
    expect(screen.getByText(/10\.6 km\/h/)).toBeInTheDocument()
  })

  it('omits stats that do not apply rather than showing zero', () => {
    render(<SummaryStats summary={summary({ totalSets: 2 })} system="metric" />)
    expect(screen.queryByText(/kg/)).not.toBeInTheDocument()
    expect(screen.queryByText(/km/)).not.toBeInTheDocument()
    expect(screen.getByText(/2 sets/)).toBeInTheDocument()
  })

  it('uses imperial labels when asked', () => {
    render(<SummaryStats summary={summary({ totalSets: 1, volumeKg: 100 })} system="imperial" />)
    expect(screen.getByText(/lb/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bunx vitest run components/SummaryStats.test.tsx`
Expected: FAIL — cannot resolve `./SummaryStats`.

- [ ] **Step 3: Implement SummaryStats**

Create `components/SummaryStats.tsx`:

```tsx
import type { WorkoutSummary } from '@/lib/workout/summary'
import type { UnitSystemWire } from '@/lib/workout/types'
import {
  kgToDisplay, metersToDisplay, weightUnit, distanceUnit, speedUnit, formatDuration,
} from '@/lib/workout/units'

export function SummaryStats({
  summary,
  system,
}: {
  summary: WorkoutSummary
  system: UnitSystemWire
}) {
  const parts: string[] = [`${summary.totalSets} sets`]

  if (summary.volumeKg !== null) {
    const v = kgToDisplay(summary.volumeKg, system)
    parts.push(`${Math.round(v).toLocaleString()} ${weightUnit(system)}`)
  }

  if (summary.distanceMeters !== null) {
    parts.push(`${metersToDisplay(summary.distanceMeters, system).toFixed(1)} ${distanceUnit(system)}`)
    if (summary.movingSeconds !== null) parts.push(formatDuration(summary.movingSeconds))
    if (summary.avgSpeed !== null) parts.push(`${summary.avgSpeed.toFixed(1)} ${speedUnit(system)}`)
  }

  if (summary.timeUnderTensionSeconds !== null) {
    parts.push(formatDuration(summary.timeUnderTensionSeconds))
  }

  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-neutral-500">
      {parts.map((p, i) => (
        <span key={i}>{p}</span>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run the SummaryStats tests**

Run: `bunx vitest run components/SummaryStats.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Write the failing SetRow test**

Create `app/(app)/workout/SetRow.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SetRow } from './SetRow'
import type { DraftSet } from '@/lib/workout/types'

const set = (o: Partial<DraftSet> = {}): DraftSet => ({
  type: 'normal', weightKg: null, reps: null, distanceMeters: null,
  durationSeconds: null, rpe: null, completed: false, ...o,
})

const noop = () => {}

describe('SetRow', () => {
  it('renders weight and reps inputs for weight_reps', () => {
    render(<SetRow index={0} set={set()} type="weight_reps" system="metric"
                   previous={null} onChange={noop} onDelete={noop} />)

    expect(screen.getByLabelText(/weight/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/reps/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/distance/i)).not.toBeInTheDocument()
  })

  it('renders only reps for bodyweight_reps', () => {
    render(<SetRow index={0} set={set()} type="bodyweight_reps" system="metric"
                   previous={null} onChange={noop} onDelete={noop} />)

    expect(screen.getByLabelText(/reps/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/weight/i)).not.toBeInTheDocument()
  })

  it('renders distance and duration for distance_duration', () => {
    render(<SetRow index={0} set={set()} type="distance_duration" system="metric"
                   previous={null} onChange={noop} onDelete={noop} />)

    expect(screen.getByLabelText(/distance/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/duration/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/reps/i)).not.toBeInTheDocument()
  })

  it('labels weight as assist for assisted bodyweight', () => {
    render(<SetRow index={0} set={set()} type="bodyweight_assisted_reps" system="metric"
                   previous={null} onChange={noop} onDelete={noop} />)

    expect(screen.getByLabelText(/assist/i)).toBeInTheDocument()
  })

  it('shows derived speed once distance and duration are both present', () => {
    render(<SetRow index={0} set={set({ distanceMeters: 5000, durationSeconds: 1695 })}
                   type="distance_duration" system="metric"
                   previous={null} onChange={noop} onDelete={noop} />)

    expect(screen.getByText(/10\.6 km\/h/)).toBeInTheDocument()
  })

  it('shows no speed when duration is missing', () => {
    render(<SetRow index={0} set={set({ distanceMeters: 5000 })}
                   type="distance_duration" system="metric"
                   previous={null} onChange={noop} onDelete={noop} />)

    expect(screen.queryByText(/km\/h/)).not.toBeInTheDocument()
  })

  it('reports weight edits back in kilograms', () => {
    const onChange = vi.fn()
    render(<SetRow index={0} set={set()} type="weight_reps" system="metric"
                   previous={null} onChange={onChange} onDelete={noop} />)

    fireEvent.change(screen.getByLabelText(/weight/i), { target: { value: '60' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ weightKg: 60 }))
  })

  it('converts pounds back to kilograms under imperial', () => {
    const onChange = vi.fn()
    render(<SetRow index={0} set={set()} type="weight_reps" system="imperial"
                   previous={null} onChange={onChange} onDelete={noop} />)

    fireEvent.change(screen.getByLabelText(/weight/i), { target: { value: '220.462' } })
    const arg = onChange.mock.calls[0][0] as DraftSet
    expect(arg.weightKg).toBeCloseTo(100, 3)
  })

  it('clears a field to null when emptied, not to zero', () => {
    const onChange = vi.fn()
    render(<SetRow index={0} set={set({ reps: 10 })} type="weight_reps" system="metric"
                   previous={null} onChange={onChange} onDelete={noop} />)

    fireEvent.change(screen.getByLabelText(/reps/i), { target: { value: '' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ reps: null }))
  })

  it('toggles completion', () => {
    const onChange = vi.fn()
    render(<SetRow index={0} set={set()} type="weight_reps" system="metric"
                   previous={null} onChange={onChange} onDelete={noop} />)

    fireEvent.click(screen.getByRole('checkbox', { name: /complete set/i }))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ completed: true }))
  })

  it('cycles the set type when the set number is clicked', () => {
    const onChange = vi.fn()
    render(<SetRow index={0} set={set({ type: 'normal' })} type="weight_reps" system="metric"
                   previous={null} onChange={onChange} onDelete={noop} />)

    fireEvent.click(screen.getByRole('button', { name: /set type/i }))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ type: 'warmup' }))
  })

  it('shows previous performance when given', () => {
    render(<SetRow index={0} set={set()} type="weight_reps" system="metric"
                   previous="60 × 10" onChange={noop} onDelete={noop} />)

    expect(screen.getByText('60 × 10')).toBeInTheDocument()
  })
})
```

- [ ] **Step 6: Run it to verify it fails**

Run: `bunx vitest run "app/(app)/workout/SetRow.test.tsx"`
Expected: FAIL — cannot resolve `./SetRow`.

- [ ] **Step 7: Implement SetRow**

Create `app/(app)/workout/SetRow.tsx`:

```tsx
'use client'

import type { DraftSet, ExerciseTypeWire, SetTypeWire, UnitSystemWire } from '@/lib/workout/types'
import { fieldsFor, isAssistedType } from '@/lib/workout/setKinds'
import {
  kgToDisplay, displayToKg, metersToDisplay, displayToMeters,
  speedFrom, weightUnit, distanceUnit, speedUnit,
} from '@/lib/workout/units'

const SET_TYPE_CYCLE: SetTypeWire[] = ['normal', 'warmup', 'failure', 'dropset']

const SET_TYPE_LABEL: Record<SetTypeWire, string> = {
  normal: '', warmup: 'W', failure: 'F', dropset: 'D',
}

/** Empty input means "not recorded", which is null — never 0. */
function toNumberOrNull(raw: string): number | null {
  if (raw.trim() === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

export function SetRow({
  index, set, type, system, previous, onChange, onDelete,
}: {
  index: number
  set: DraftSet
  type: ExerciseTypeWire
  system: UnitSystemWire
  previous: string | null
  onChange: (set: DraftSet) => void
  onDelete: () => void
}) {
  const fields = fieldsFor(type)
  const weightLabel = isAssistedType(type) ? 'Assist' : 'Weight'
  const speed = speedFrom(set.distanceMeters, set.durationSeconds, system)

  const patch = (changes: Partial<DraftSet>) => onChange({ ...set, ...changes })

  const cycleType = () => {
    const next = SET_TYPE_CYCLE[(SET_TYPE_CYCLE.indexOf(set.type) + 1) % SET_TYPE_CYCLE.length]
    patch({ type: next })
  }

  return (
    <div className="flex items-center gap-2 py-1">
      <button
        type="button"
        aria-label={`Set type for set ${index + 1}`}
        onClick={cycleType}
        className="w-8 shrink-0 rounded text-sm tabular-nums"
      >
        {SET_TYPE_LABEL[set.type] || index + 1}
      </button>

      <span className="w-20 shrink-0 text-xs text-neutral-400">{previous ?? '—'}</span>

      {fields.includes('weight') && (
        <label className="flex items-center gap-1 text-sm">
          <span className="sr-only">{weightLabel} ({weightUnit(system)})</span>
          <input
            aria-label={`${weightLabel} (${weightUnit(system)})`}
            inputMode="decimal"
            className="w-20 rounded border px-2 py-1"
            value={set.weightKg === null ? '' : String(round(kgToDisplay(set.weightKg, system)))}
            onChange={(e) => {
              const v = toNumberOrNull(e.target.value)
              patch({ weightKg: v === null ? null : displayToKg(v, system) })
            }}
          />
        </label>
      )}

      {fields.includes('reps') && (
        <label className="flex items-center gap-1 text-sm">
          <span className="sr-only">Reps</span>
          <input
            aria-label="Reps"
            inputMode="numeric"
            className="w-16 rounded border px-2 py-1"
            value={set.reps === null ? '' : String(set.reps)}
            onChange={(e) => {
              const v = toNumberOrNull(e.target.value)
              patch({ reps: v === null ? null : Math.round(v) })
            }}
          />
        </label>
      )}

      {fields.includes('distance') && (
        <label className="flex items-center gap-1 text-sm">
          <span className="sr-only">Distance ({distanceUnit(system)})</span>
          <input
            aria-label={`Distance (${distanceUnit(system)})`}
            inputMode="decimal"
            className="w-20 rounded border px-2 py-1"
            value={set.distanceMeters === null ? '' : String(round(metersToDisplay(set.distanceMeters, system)))}
            onChange={(e) => {
              const v = toNumberOrNull(e.target.value)
              patch({ distanceMeters: v === null ? null : displayToMeters(v, system) })
            }}
          />
        </label>
      )}

      {fields.includes('duration') && (
        <label className="flex items-center gap-1 text-sm">
          <span className="sr-only">Duration (seconds)</span>
          <input
            aria-label="Duration (seconds)"
            inputMode="numeric"
            className="w-20 rounded border px-2 py-1"
            value={set.durationSeconds === null ? '' : String(set.durationSeconds)}
            onChange={(e) => {
              const v = toNumberOrNull(e.target.value)
              patch({ durationSeconds: v === null ? null : Math.round(v) })
            }}
          />
        </label>
      )}

      {speed !== null && (
        <span className="text-xs text-neutral-500">
          {speed.toFixed(1)} {speedUnit(system)}
        </span>
      )}

      <input
        type="checkbox"
        aria-label={`Complete set ${index + 1}`}
        checked={set.completed}
        onChange={(e) => patch({ completed: e.target.checked })}
        className="ml-auto size-5"
      />

      <button type="button" aria-label={`Delete set ${index + 1}`} onClick={onDelete}>
        ×
      </button>
    </div>
  )
}

/** Trim float noise from unit conversion without truncating real precision. */
function round(n: number): number {
  return Math.round(n * 1000) / 1000
}
```

- [ ] **Step 8: Run the SetRow tests**

Run: `bunx vitest run "app/(app)/workout/SetRow.test.tsx"`
Expected: PASS, 12 tests.

- [ ] **Step 9: Commit**

```bash
git add components/SummaryStats.tsx components/SummaryStats.test.tsx "app/(app)/workout/SetRow.tsx" "app/(app)/workout/SetRow.test.tsx"
git commit -m "feat: add set row rendering per exercise type and summary stats"
```

---

### Task 14: Draft state hook with localStorage and debounced autosave

**Files:**
- Create: `app/(app)/workout/useWorkoutDraft.ts`
- Test: `app/(app)/workout/useWorkoutDraft.test.ts`

**Interfaces:**
- Consumes: `WorkoutDraft`, `DraftSet`, `DraftExercise` from `types.ts`.
- Produces:
  - `useWorkoutDraft(initial: WorkoutDraft): { draft, saveState, addExercise, removeExercise, updateExercise, addSet, updateSet, removeSet, setTitle }`
  - `type SaveState = 'saved' | 'saving' | 'unsaved'`
  - `DRAFT_STORAGE_KEY = 'workout-draft'`

- [ ] **Step 1: Write the failing test**

Create `app/(app)/workout/useWorkoutDraft.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useWorkoutDraft, DRAFT_STORAGE_KEY } from './useWorkoutDraft'
import type { WorkoutDraft } from '@/lib/workout/types'

const initial: WorkoutDraft = { title: 'Session', description: null, exercises: [] }

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.stubGlobal('fetch', vi.fn(async () => new Response(
    JSON.stringify({ updated_at: '2026-08-13T00:00:00Z' }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('useWorkoutDraft', () => {
  it('starts from the initial draft', () => {
    const { result } = renderHook(() => useWorkoutDraft(initial))
    expect(result.current.draft.title).toBe('Session')
    expect(result.current.draft.exercises).toEqual([])
  })

  it('adds an exercise with one empty set', () => {
    const { result } = renderHook(() => useWorkoutDraft(initial))
    act(() => result.current.addExercise('tpl-1'))

    expect(result.current.draft.exercises).toHaveLength(1)
    expect(result.current.draft.exercises[0].exerciseTemplateId).toBe('tpl-1')
    expect(result.current.draft.exercises[0].sets).toHaveLength(1)
    expect(result.current.draft.exercises[0].sets[0].completed).toBe(false)
  })

  it('adds a set copying the previous set values but unticked', () => {
    const { result } = renderHook(() => useWorkoutDraft(initial))
    act(() => result.current.addExercise('tpl-1'))
    act(() => result.current.updateSet(0, 0, { weightKg: 60, reps: 10, completed: true }))
    act(() => result.current.addSet(0))

    const sets = result.current.draft.exercises[0].sets
    expect(sets).toHaveLength(2)
    expect(sets[1].weightKg).toBe(60)
    expect(sets[1].reps).toBe(10)
    expect(sets[1].completed).toBe(false)
  })

  it('removes a set', () => {
    const { result } = renderHook(() => useWorkoutDraft(initial))
    act(() => result.current.addExercise('tpl-1'))
    act(() => result.current.addSet(0))
    act(() => result.current.removeSet(0, 0))

    expect(result.current.draft.exercises[0].sets).toHaveLength(1)
  })

  it('removes an exercise', () => {
    const { result } = renderHook(() => useWorkoutDraft(initial))
    act(() => result.current.addExercise('tpl-1'))
    act(() => result.current.addExercise('tpl-2'))
    act(() => result.current.removeExercise(0))

    expect(result.current.draft.exercises).toHaveLength(1)
    expect(result.current.draft.exercises[0].exerciseTemplateId).toBe('tpl-2')
  })

  it('mirrors every change to localStorage immediately', () => {
    const { result } = renderHook(() => useWorkoutDraft(initial))
    act(() => result.current.addExercise('tpl-1'))

    const stored = JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY)!)
    expect(stored.exercises).toHaveLength(1)
  })

  it('prefers a newer localStorage draft over the server copy', () => {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({
      title: 'Recovered', description: null,
      exercises: [{ exerciseTemplateId: 'tpl-9', notes: null, restSeconds: null, supersetId: null, sets: [] }],
    }))

    const { result } = renderHook(() => useWorkoutDraft(initial))
    expect(result.current.draft.title).toBe('Recovered')
  })

  it('ignores a corrupt localStorage draft', () => {
    localStorage.setItem(DRAFT_STORAGE_KEY, 'not json{')
    const { result } = renderHook(() => useWorkoutDraft(initial))
    expect(result.current.draft.title).toBe('Session')
  })

  it('debounces autosave into a single request', async () => {
    const { result } = renderHook(() => useWorkoutDraft(initial))

    act(() => result.current.addExercise('tpl-1'))
    act(() => result.current.addSet(0))
    act(() => result.current.addSet(0))

    expect(fetch).not.toHaveBeenCalled()
    await act(async () => { vi.advanceTimersByTime(3000) })

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  })

  it('reports save state through the cycle', async () => {
    const { result } = renderHook(() => useWorkoutDraft(initial))
    expect(result.current.saveState).toBe('saved')

    act(() => result.current.addExercise('tpl-1'))
    expect(result.current.saveState).toBe('unsaved')

    await act(async () => { vi.advanceTimersByTime(3000) })
    await waitFor(() => expect(result.current.saveState).toBe('saved'))
  })

  it('stays unsaved when the request fails, so the UI can warn', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))

    const { result } = renderHook(() => useWorkoutDraft(initial))
    act(() => result.current.addExercise('tpl-1'))
    await act(async () => { vi.advanceTimersByTime(3000) })

    await waitFor(() => expect(result.current.saveState).toBe('unsaved'))
    // The local copy survives a failed save — that is the point of client-first state.
    expect(result.current.draft.exercises).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bunx vitest run "app/(app)/workout/useWorkoutDraft.test.ts"`
Expected: FAIL — cannot resolve `./useWorkoutDraft`.

- [ ] **Step 3: Implement the hook**

Create `app/(app)/workout/useWorkoutDraft.ts`:

```ts
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { DraftExercise, DraftSet, WorkoutDraft } from '@/lib/workout/types'

export const DRAFT_STORAGE_KEY = 'workout-draft'
const AUTOSAVE_DELAY_MS = 3000

export type SaveState = 'saved' | 'saving' | 'unsaved'

const emptySet = (): DraftSet => ({
  type: 'normal', weightKg: null, reps: null, distanceMeters: null,
  durationSeconds: null, rpe: null, completed: false,
})

function readStored(): WorkoutDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (typeof parsed?.title !== 'string' || !Array.isArray(parsed?.exercises)) return null
    return parsed as WorkoutDraft
  } catch {
    return null
  }
}

/**
 * Client-first session state. Every edit lands in React state and localStorage
 * immediately, so the UI never blocks on the network; the server copy catches up
 * on a debounce. A failed save leaves the local draft intact and the state
 * "unsaved" so the UI can say so.
 */
export function useWorkoutDraft(initial: WorkoutDraft) {
  const [draft, setDraft] = useState<WorkoutDraft>(() => readStored() ?? initial)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const firstRender = useRef(true)

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }

    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft))
    setSaveState('unsaved')

    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      setSaveState('saving')
      try {
        const res = await fetch('/api/workouts/active', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ draft }),
        })
        setSaveState(res.ok ? 'saved' : 'unsaved')
      } catch {
        setSaveState('unsaved')
      }
    }, AUTOSAVE_DELAY_MS)

    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [draft])

  const mutate = useCallback((fn: (d: WorkoutDraft) => WorkoutDraft) => {
    setDraft(prev => fn(prev))
  }, [])

  const setTitle = useCallback((title: string) => {
    mutate(d => ({ ...d, title }))
  }, [mutate])

  const addExercise = useCallback((exerciseTemplateId: string) => {
    const exercise: DraftExercise = {
      exerciseTemplateId, notes: null, restSeconds: null, supersetId: null,
      sets: [emptySet()],
    }
    mutate(d => ({ ...d, exercises: [...d.exercises, exercise] }))
  }, [mutate])

  const removeExercise = useCallback((ei: number) => {
    mutate(d => ({ ...d, exercises: d.exercises.filter((_, i) => i !== ei) }))
  }, [mutate])

  const updateExercise = useCallback((ei: number, changes: Partial<DraftExercise>) => {
    mutate(d => ({
      ...d,
      exercises: d.exercises.map((e, i) => (i === ei ? { ...e, ...changes } : e)),
    }))
  }, [mutate])

  /** New sets inherit the previous set's numbers — you rarely change weight between sets. */
  const addSet = useCallback((ei: number) => {
    mutate(d => ({
      ...d,
      exercises: d.exercises.map((e, i) => {
        if (i !== ei) return e
        const last = e.sets[e.sets.length - 1]
        const next: DraftSet = last
          ? { ...last, completed: false }
          : emptySet()
        return { ...e, sets: [...e.sets, next] }
      }),
    }))
  }, [mutate])

  const updateSet = useCallback((ei: number, si: number, changes: Partial<DraftSet>) => {
    mutate(d => ({
      ...d,
      exercises: d.exercises.map((e, i) => (
        i !== ei ? e : { ...e, sets: e.sets.map((s, j) => (j === si ? { ...s, ...changes } : s)) }
      )),
    }))
  }, [mutate])

  const removeSet = useCallback((ei: number, si: number) => {
    mutate(d => ({
      ...d,
      exercises: d.exercises.map((e, i) => (
        i !== ei ? e : { ...e, sets: e.sets.filter((_, j) => j !== si) }
      )),
    }))
  }, [mutate])

  return {
    draft, saveState, setTitle,
    addExercise, removeExercise, updateExercise,
    addSet, updateSet, removeSet,
  }
}
```

- [ ] **Step 4: Run the tests**

Run: `bunx vitest run "app/(app)/workout/useWorkoutDraft.test.ts"`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/workout/useWorkoutDraft.ts" "app/(app)/workout/useWorkoutDraft.test.ts"
git commit -m "feat: add draft state hook with localStorage mirror and debounced autosave"
```

---

### Task 15: Exercise picker and the active workout screen

**Files:**
- Create: `app/(app)/workout/ExercisePicker.tsx`, `app/(app)/workout/ActiveWorkout.tsx`, `app/(app)/workout/StartWorkoutButton.tsx`, `app/(app)/workout/page.tsx`, `app/(app)/layout.tsx`, `lib/workout/previous.ts`
- Test: `app/(app)/workout/ExercisePicker.test.tsx`, `lib/workout/previous.test.ts`

**Interfaces:**
- Consumes: `useWorkoutDraft` (Task 14), `SetRow` (Task 13), `templateToWire` output shape (Task 12).
- Produces:
  - `interface TemplateSummary { id: string; title: string; type: ExerciseTypeWire; primary_muscle_group: string; equipment_category: string; is_custom: boolean }`
  - `<ExercisePicker templates={TemplateSummary[]} onAdd={(ids: string[]) => void} onClose={() => void} />`
  - `<ActiveWorkout workout={{ id, title, start_time, draft }} templates={TemplateSummary[]} system={UnitSystemWire} />`

- [ ] **Step 1: Write the failing picker test**

Create `app/(app)/workout/ExercisePicker.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ExercisePicker, type TemplateSummary } from './ExercisePicker'

const templates: TemplateSummary[] = [
  { id: '1', title: 'Bench Press (Barbell)', type: 'weight_reps', primary_muscle_group: 'chest', equipment_category: 'barbell', is_custom: false },
  { id: '2', title: 'Squat (Barbell)', type: 'weight_reps', primary_muscle_group: 'quadriceps', equipment_category: 'barbell', is_custom: false },
  { id: '3', title: 'Treadmill', type: 'distance_duration', primary_muscle_group: 'cardio', equipment_category: 'machine', is_custom: false },
]

describe('ExercisePicker', () => {
  it('lists every template', () => {
    render(<ExercisePicker templates={templates} onAdd={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('Bench Press (Barbell)')).toBeInTheDocument()
    expect(screen.getByText('Treadmill')).toBeInTheDocument()
  })

  it('filters by search text, case-insensitively', () => {
    render(<ExercisePicker templates={templates} onAdd={vi.fn()} onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/search/i), { target: { value: 'bench' } })

    expect(screen.getByText('Bench Press (Barbell)')).toBeInTheDocument()
    expect(screen.queryByText('Treadmill')).not.toBeInTheDocument()
  })

  it('filters by muscle group', () => {
    render(<ExercisePicker templates={templates} onAdd={vi.fn()} onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/muscle/i), { target: { value: 'cardio' } })

    expect(screen.getByText('Treadmill')).toBeInTheDocument()
    expect(screen.queryByText('Squat (Barbell)')).not.toBeInTheDocument()
  })

  it('adds several selected exercises at once', () => {
    const onAdd = vi.fn()
    render(<ExercisePicker templates={templates} onAdd={onAdd} onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('checkbox', { name: /Bench Press/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Treadmill/ }))
    fireEvent.click(screen.getByRole('button', { name: /add 2 exercises/i }))

    expect(onAdd).toHaveBeenCalledWith(['1', '3'])
  })

  it('disables the add button until something is selected', () => {
    render(<ExercisePicker templates={templates} onAdd={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: /add/i })).toBeDisabled()
  })

  it('says so when nothing matches', () => {
    render(<ExercisePicker templates={templates} onAdd={vi.fn()} onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/search/i), { target: { value: 'zzzz' } })
    expect(screen.getByText(/no exercises match/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bunx vitest run "app/(app)/workout/ExercisePicker.test.tsx"`
Expected: FAIL — cannot resolve `./ExercisePicker`.

- [ ] **Step 3: Implement the picker**

Create `app/(app)/workout/ExercisePicker.tsx`:

```tsx
'use client'

import { useMemo, useState } from 'react'
import type { ExerciseTypeWire } from '@/lib/workout/types'

export interface TemplateSummary {
  id: string
  title: string
  type: ExerciseTypeWire
  primary_muscle_group: string
  equipment_category: string
  is_custom: boolean
}

export function ExercisePicker({
  templates, onAdd, onClose,
}: {
  templates: TemplateSummary[]
  onAdd: (ids: string[]) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState('')
  const [selected, setSelected] = useState<string[]>([])

  const muscles = useMemo(
    () => [...new Set(templates.map(t => t.primary_muscle_group))].sort(),
    [templates],
  )

  const visible = useMemo(() => templates.filter(t => {
    const matchesQuery = t.title.toLowerCase().includes(query.trim().toLowerCase())
    const matchesMuscle = muscle === '' || t.primary_muscle_group === muscle
    return matchesQuery && matchesMuscle
  }), [templates, query, muscle])

  const toggle = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  return (
    <div role="dialog" aria-label="Add exercises" className="fixed inset-0 z-50 bg-white p-4 overflow-auto">
      <div className="mb-3 flex gap-2">
        <input
          aria-label="Search exercises"
          placeholder="Search exercises"
          className="flex-1 rounded border px-3 py-2"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="Muscle group"
          className="rounded border px-2 py-2"
          value={muscle}
          onChange={(e) => setMuscle(e.target.value)}
        >
          <option value="">All muscles</option>
          {muscles.map(m => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {visible.length === 0 ? (
        <p className="py-8 text-center text-neutral-500">No exercises match that search.</p>
      ) : (
        <ul>
          {visible.map(t => (
            <li key={t.id} className="border-b py-2">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  aria-label={t.title}
                  checked={selected.includes(t.id)}
                  onChange={() => toggle(t.id)}
                />
                <span>
                  <span className="block">{t.title}</span>
                  <span className="block text-xs text-neutral-500">
                    {t.primary_muscle_group.replace(/_/g, ' ')}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}

      <div className="sticky bottom-0 mt-4 flex gap-2 bg-white py-3">
        <button type="button" onClick={onClose} className="rounded border px-4 py-2">
          Cancel
        </button>
        <button
          type="button"
          disabled={selected.length === 0}
          onClick={() => { onAdd(selected); onClose() }}
          className="flex-1 rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-40"
        >
          {selected.length === 0
            ? 'Add exercises'
            : `Add ${selected.length} exercise${selected.length === 1 ? '' : 's'}`}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the picker tests**

Run: `bunx vitest run "app/(app)/workout/ExercisePicker.test.tsx"`
Expected: PASS, 6 tests.

- [ ] **Step 5: Write the failing test for previous performance**

Create `lib/workout/previous.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { previousBySetIndex, type HistoryEntry } from './previous'

const entry = (o: Partial<HistoryEntry>): HistoryEntry => ({
  workout_start_time: '2026-08-10T10:00:00Z',
  weight_kg: null, reps: null, distance_meters: null, duration_seconds: null, ...o,
})

describe('previousBySetIndex', () => {
  it('formats weight and reps per set', () => {
    const rows = previousBySetIndex([
      entry({ weight_kg: 60, reps: 10 }),
      entry({ weight_kg: 65, reps: 8 }),
    ], 'metric')

    expect(rows).toEqual(['60 × 10', '65 × 8'])
  })

  it('uses only the most recent session, not every past set', () => {
    const rows = previousBySetIndex([
      entry({ workout_start_time: '2026-08-10T10:00:00Z', weight_kg: 70, reps: 8 }),
      entry({ workout_start_time: '2026-08-01T10:00:00Z', weight_kg: 60, reps: 10 }),
      entry({ workout_start_time: '2026-08-01T10:00:00Z', weight_kg: 60, reps: 9 }),
    ], 'metric')

    expect(rows).toEqual(['70 × 8'])
  })

  it('formats cardio as distance and time', () => {
    const rows = previousBySetIndex([
      entry({ distance_meters: 5000, duration_seconds: 1695 }),
    ], 'metric')

    expect(rows).toEqual(['5.00 km / 28:15'])
  })

  it('formats duration-only sets', () => {
    expect(previousBySetIndex([entry({ duration_seconds: 60 })], 'metric')).toEqual(['1:00'])
  })

  it('formats reps-only sets', () => {
    expect(previousBySetIndex([entry({ reps: 12 })], 'metric')).toEqual(['12'])
  })

  it('converts to imperial when asked', () => {
    const rows = previousBySetIndex([entry({ weight_kg: 100, reps: 5 })], 'imperial')
    expect(rows[0]).toMatch(/220\.5 × 5/)
  })

  it('returns an empty list when the exercise has never been done', () => {
    expect(previousBySetIndex([], 'metric')).toEqual([])
  })
})
```

- [ ] **Step 6: Run it to verify it fails**

Run: `bunx vitest run lib/workout/previous.test.ts`
Expected: FAIL — cannot resolve `./previous`.

- [ ] **Step 7: Implement previous performance**

Create `lib/workout/previous.ts`:

```ts
import { kgToDisplay, metersToDisplay, formatDuration, distanceUnit } from './units'
import type { UnitSystemWire } from './types'

export interface HistoryEntry {
  workout_start_time: string
  weight_kg: number | null
  reps: number | null
  distance_meters: number | null
  duration_seconds: number | null
}

function format(entry: HistoryEntry, system: UnitSystemWire): string {
  const parts: string[] = []

  if (entry.weight_kg !== null) {
    const w = kgToDisplay(entry.weight_kg, system)
    parts.push(entry.reps !== null ? `${trim(w)} × ${entry.reps}` : `${trim(w)}`)
  } else if (entry.reps !== null) {
    parts.push(String(entry.reps))
  }

  if (entry.distance_meters !== null) {
    const d = metersToDisplay(entry.distance_meters, system)
    const label = `${d.toFixed(2)} ${distanceUnit(system)}`
    parts.push(entry.duration_seconds !== null
      ? `${label} / ${formatDuration(entry.duration_seconds)}`
      : label)
  } else if (entry.duration_seconds !== null && entry.weight_kg === null && entry.reps === null) {
    parts.push(formatDuration(entry.duration_seconds))
  }

  return parts.join(' ')
}

function trim(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

/**
 * The PREV column shows what you did *last time*, so only the most recent session
 * counts — the API returns every past set newest-first, across all workouts.
 */
export function previousBySetIndex(
  entries: HistoryEntry[],
  system: UnitSystemWire,
): string[] {
  if (entries.length === 0) return []
  const mostRecent = entries[0].workout_start_time
  return entries
    .filter(e => e.workout_start_time === mostRecent)
    .map(e => format(e, system))
}
```

- [ ] **Step 8: Run the tests**

Run: `bunx vitest run lib/workout/previous.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 9: Implement the active workout screen**

Create `app/(app)/workout/ActiveWorkout.tsx`:

```tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useWorkoutDraft } from './useWorkoutDraft'
import { SetRow } from './SetRow'
import { ExercisePicker, type TemplateSummary } from './ExercisePicker'
import { SummaryStats } from '@/components/SummaryStats'
import { summarize } from '@/lib/workout/summary'
import { formatDuration } from '@/lib/workout/units'
import { previousBySetIndex } from '@/lib/workout/previous'
import type { UnitSystemWire, WorkoutDraft } from '@/lib/workout/types'

const SAVE_LABEL = { saved: 'Saved', saving: 'Saving…', unsaved: 'Unsaved' } as const

export function ActiveWorkout({
  workout, templates, system,
}: {
  workout: { id: string; title: string; start_time: string; draft: WorkoutDraft }
  templates: TemplateSummary[]
  system: UnitSystemWire
}) {
  const router = useRouter()
  const [picking, setPicking] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [previous, setPrevious] = useState<Record<string, string[]>>({})

  const {
    draft, saveState, setTitle,
    addExercise, removeExercise, addSet, updateSet, removeSet,
  } = useWorkoutDraft(workout.draft)

  const byId = useMemo(
    () => new Map(templates.map(t => [t.id, t])),
    [templates],
  )

  useEffect(() => {
    const started = new Date(workout.start_time).getTime()
    const tick = () => setElapsed(Math.floor((Date.now() - started) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [workout.start_time])

  // Fetch last time's numbers for each exercise, once per template id.
  useEffect(() => {
    const ids = [...new Set(draft.exercises.map(e => e.exerciseTemplateId))]
    const missing = ids.filter(id => !(id in previous))
    if (missing.length === 0) return

    let cancelled = false
    Promise.all(missing.map(async (id) => {
      try {
        const res = await fetch(`/api/v1/exercise_history/${id}`)
        if (!res.ok) return [id, [] as string[]] as const
        const body = await res.json()
        return [id, previousBySetIndex(body.exercise_history, system)] as const
      } catch {
        // The PREV column is a convenience; failing to load it must never block logging.
        return [id, [] as string[]] as const
      }
    })).then((pairs) => {
      if (!cancelled) setPrevious(prev => ({ ...prev, ...Object.fromEntries(pairs) }))
    })

    return () => { cancelled = true }
  }, [draft.exercises, previous, system])

  const allSets = draft.exercises.flatMap(e => e.sets.filter(s => s.completed))
  const summary = summarize(allSets, system)

  async function finish() {
    setFinishing(true)
    setError(null)
    try {
      const res = await fetch('/api/workouts/active/finish', { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        // Keep the draft: losing a completed session to a failed request is the worst bug here.
        setError(body.issues?.join('; ') ?? body.error ?? 'Could not finish the workout')
        setFinishing(false)
        return
      }
      localStorage.removeItem('workout-draft')
      router.push('/history')
    } catch {
      setError('Could not reach the server. Your workout is still saved on this device.')
      setFinishing(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-4">
      <header className="mb-4 flex items-center gap-3">
        <input
          aria-label="Workout title"
          className="flex-1 rounded border px-2 py-1 text-lg font-semibold"
          value={draft.title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <span className="tabular-nums text-neutral-600">{formatDuration(elapsed)}</span>
        <span className="text-xs text-neutral-400">{SAVE_LABEL[saveState]}</span>
      </header>

      <SummaryStats summary={summary} system={system} />

      {error && (
        <p role="alert" className="my-3 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      {draft.exercises.map((exercise, ei) => {
        const template = byId.get(exercise.exerciseTemplateId)
        return (
          <section key={ei} className="my-4 rounded border p-3">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-medium">{template?.title ?? 'Unknown exercise'}</h2>
              <button type="button" onClick={() => removeExercise(ei)}
                      aria-label={`Remove ${template?.title ?? 'exercise'}`}>
                Remove
              </button>
            </div>

            {exercise.sets.map((set, si) => (
              <SetRow
                key={si}
                index={si}
                set={set}
                type={template?.type ?? 'weight_reps'}
                system={system}
                previous={previous[exercise.exerciseTemplateId]?.[si] ?? null}
                onChange={(next) => updateSet(ei, si, next)}
                onDelete={() => removeSet(ei, si)}
              />
            ))}

            <button type="button" onClick={() => addSet(ei)}
                    className="mt-2 w-full rounded bg-neutral-100 py-2 text-sm">
              + Add Set
            </button>
          </section>
        )
      })}

      <button type="button" onClick={() => setPicking(true)}
              className="w-full rounded bg-neutral-100 py-3">
        + Add Exercise
      </button>

      <button type="button" onClick={finish} disabled={finishing}
              className="mt-3 w-full rounded bg-blue-600 py-3 text-white disabled:opacity-50">
        {finishing ? 'Finishing…' : 'Finish'}
      </button>

      {picking && (
        <ExercisePicker
          templates={templates}
          onAdd={(ids) => ids.forEach(addExercise)}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 10: Implement the workout page and app layout**

Create `app/(app)/layout.tsx`:

```tsx
import Link from 'next/link'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav className="border-b px-4 py-3">
        <ul className="mx-auto flex max-w-2xl gap-4 text-sm">
          <li><Link href="/workout">Workout</Link></li>
          <li><Link href="/history">History</Link></li>
          <li><Link href="/exercises">Exercises</Link></li>
        </ul>
      </nav>
      {children}
    </div>
  )
}
```

Create `app/(app)/workout/page.tsx`:

```tsx
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
```

Create `app/(app)/workout/StartWorkoutButton.tsx`:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function StartWorkoutButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function start() {
    setBusy(true)
    // Clear any stale local draft before starting fresh.
    localStorage.removeItem('workout-draft')
    await fetch('/api/workouts/start', { method: 'POST' })
    router.refresh()
  }

  return (
    <div className="mx-auto max-w-2xl p-8 text-center">
      <button type="button" onClick={start} disabled={busy}
              className="w-full rounded bg-blue-600 py-4 text-white disabled:opacity-50">
        {busy ? 'Starting…' : 'Start Empty Workout'}
      </button>
    </div>
  )
}
```

- [ ] **Step 11: Verify the screen renders in the browser**

```bash
bun run dev
```

Visit `http://localhost:3000/workout`. Expected: redirected to `/login` (middleware from Task 10). After Task 16 adds the login page, this becomes the real check.

- [ ] **Step 12: Run the whole suite**

Run: `bun run test`
Expected: PASS.

- [ ] **Step 13: Commit**

```bash
git add "app/(app)" lib/workout/previous.ts lib/workout/previous.test.ts
git commit -m "feat: add exercise picker, previous-performance column, and active workout screen"
```

---

### Task 16: Auth pages, history, and the exercise library

**Files:**
- Create: `app/(auth)/login/page.tsx`, `app/(auth)/register/page.tsx`, `app/(app)/history/page.tsx`, `app/(app)/history/[id]/page.tsx`, `app/(app)/exercises/page.tsx`, `lib/workout/historyRows.ts`
- Modify: `app/layout.tsx` (wrap in `SessionProvider`)
- Test: `lib/workout/historyRows.test.ts`

**Interfaces:**
- Consumes: `summarize` from `summary.ts`, `SummaryStats` from Task 13.
- Produces: `toHistoryRow(workout)` from `lib/workout/historyRows.ts`, returning `{ id, title, startTime, durationSeconds, summary }`.

- [ ] **Step 1: Write the failing test for history rows**

Create `lib/workout/historyRows.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { toHistoryRow } from './historyRows'

const workout = {
  id: 'w1',
  title: 'Chest Day',
  startTime: new Date('2026-08-13T10:00:00Z'),
  endTime: new Date('2026-08-13T11:02:00Z'),
  exercises: [{
    sets: [
      { weightKg: 60, reps: 10, distanceMeters: null, durationSeconds: null },
      { weightKg: 65, reps: 8, distanceMeters: null, durationSeconds: null },
    ],
  }],
}

describe('toHistoryRow', () => {
  it('derives duration from start and end time', () => {
    expect(toHistoryRow(workout, 'metric').durationSeconds).toBe(3720)
  })

  it('summarises every set across every exercise', () => {
    const row = toHistoryRow(workout, 'metric')
    expect(row.summary.totalSets).toBe(2)
    expect(row.summary.volumeKg).toBe(60 * 10 + 65 * 8)
  })

  it('reports zero duration when endTime is missing', () => {
    expect(toHistoryRow({ ...workout, endTime: null }, 'metric').durationSeconds).toBe(0)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bunx vitest run lib/workout/historyRows.test.ts`
Expected: FAIL — cannot resolve `./historyRows`.

- [ ] **Step 3: Implement history rows**

Create `lib/workout/historyRows.ts`:

```ts
import { summarize, type WorkoutSummary } from './summary'
import type { MeasurableSet, UnitSystemWire } from './types'

interface WorkoutLike {
  id: string
  title: string
  startTime: Date
  endTime: Date | null
  exercises: { sets: MeasurableSet[] }[]
}

export interface HistoryRow {
  id: string
  title: string
  startTime: Date
  durationSeconds: number
  summary: WorkoutSummary
}

export function toHistoryRow(workout: WorkoutLike, system: UnitSystemWire): HistoryRow {
  const sets = workout.exercises.flatMap(e => e.sets)
  const durationSeconds = workout.endTime
    ? Math.round((workout.endTime.getTime() - workout.startTime.getTime()) / 1000)
    : 0

  return {
    id: workout.id,
    title: workout.title,
    startTime: workout.startTime,
    durationSeconds,
    summary: summarize(sets, system),
  }
}
```

- [ ] **Step 4: Run the tests**

Run: `bunx vitest run lib/workout/historyRows.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Build the auth pages**

Create `app/(auth)/login/page.tsx`:

```tsx
'use client'

import { signIn } from 'next-auth/react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  async function submit(formData: FormData) {
    setError(null)
    const res = await signIn('credentials', {
      email: String(formData.get('email')),
      password: String(formData.get('password')),
      redirect: false,
    })
    if (res?.error) setError('Wrong email or password')
    else router.push('/workout')
  }

  return (
    <form action={submit} className="mx-auto mt-16 max-w-sm space-y-3 p-4">
      <h1 className="text-xl font-semibold">Log in</h1>
      <input name="email" type="email" required aria-label="Email" placeholder="Email"
             className="w-full rounded border px-3 py-2" />
      <input name="password" type="password" required aria-label="Password" placeholder="Password"
             className="w-full rounded border px-3 py-2" />
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button type="submit" className="w-full rounded bg-blue-600 py-2 text-white">Log in</button>
      <p className="text-sm">No account? <Link href="/register" className="underline">Register</Link></p>
    </form>
  )
}
```

Create `app/(auth)/register/page.tsx`:

```tsx
'use client'

import { signIn } from 'next-auth/react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function RegisterPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  async function submit(formData: FormData) {
    setError(null)
    const email = String(formData.get('email'))
    const password = String(formData.get('password'))

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password, name: String(formData.get('name')) }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? 'Could not create the account')
      return
    }

    await signIn('credentials', { email, password, redirect: false })
    router.push('/workout')
  }

  return (
    <form action={submit} className="mx-auto mt-16 max-w-sm space-y-3 p-4">
      <h1 className="text-xl font-semibold">Create an account</h1>
      <input name="name" required aria-label="Name" placeholder="Name"
             className="w-full rounded border px-3 py-2" />
      <input name="email" type="email" required aria-label="Email" placeholder="Email"
             className="w-full rounded border px-3 py-2" />
      <input name="password" type="password" required minLength={8} aria-label="Password"
             placeholder="Password (min 8 characters)" className="w-full rounded border px-3 py-2" />
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button type="submit" className="w-full rounded bg-blue-600 py-2 text-white">Register</button>
      <p className="text-sm">Have an account? <Link href="/login" className="underline">Log in</Link></p>
    </form>
  )
}
```

Wrap the app in the Auth.js session provider — replace `app/layout.tsx` body with:

```tsx
import { SessionProvider } from 'next-auth/react'
import './globals.css'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 6: Build the history pages**

Create `app/(app)/history/page.tsx`:

```tsx
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
      <p className="mx-auto max-w-2xl p-8 text-center text-neutral-500">
        No workouts yet. <Link href="/workout" className="underline">Start one.</Link>
      </p>
    )
  }

  return (
    <ul className="mx-auto max-w-2xl p-4">
      {workouts.map(w => {
        const row = toHistoryRow(w, system)
        return (
          <li key={row.id} className="border-b py-3">
            <Link href={`/history/${row.id}`} className="block">
              <div className="flex items-baseline justify-between">
                <h2 className="font-medium">{row.title}</h2>
                <time className="text-xs text-neutral-500">
                  {row.startTime.toLocaleDateString()}
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
```

Create `app/(app)/history/[id]/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { requireUserId } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { toHistoryRow } from '@/lib/workout/historyRows'
import { SummaryStats } from '@/components/SummaryStats'
import { formatDuration, kgToDisplay, metersToDisplay, weightUnit, distanceUnit } from '@/lib/workout/units'
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
      <h1 className="text-xl font-semibold">{workout.title}</h1>
      <p className="text-sm text-neutral-500">
        {workout.startTime.toLocaleString()} · {formatDuration(row.durationSeconds)}
      </p>
      <SummaryStats summary={row.summary} system={system} />

      {workout.exercises.map(exercise => (
        <section key={exercise.id} className="my-4 rounded border p-3">
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
```

- [ ] **Step 7: Build the exercise library page**

Create `app/(app)/exercises/page.tsx`:

```tsx
import { requireUserId } from '@/lib/auth'
import { prisma } from '@/lib/db'

export default async function ExercisesPage() {
  const userId = await requireUserId()

  const templates = await prisma.exerciseTemplate.findMany({
    where: { OR: [{ ownerId: null }, { ownerId: userId }] },
    orderBy: [{ primaryMuscleGroup: 'asc' }, { title: 'asc' }],
  })

  return (
    <ul className="mx-auto max-w-2xl p-4">
      {templates.map(t => (
        <li key={t.id} className="flex items-baseline justify-between border-b py-2">
          <span>
            {t.title}
            {t.isCustom && <span className="ml-2 text-xs text-blue-600">custom</span>}
          </span>
          <span className="text-xs text-neutral-500">
            {t.primaryMuscleGroup.toLowerCase().replace(/_/g, ' ')}
          </span>
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 8: Run the whole suite and the dev server**

```bash
bun run test
bun run dev
```

Register at `http://localhost:3000/register`, then confirm `/workout`, `/history`, and `/exercises` all load.

- [ ] **Step 9: Commit**

```bash
git add "app/(auth)" "app/(app)" app/layout.tsx lib/workout/historyRows.ts lib/workout/historyRows.test.ts
git commit -m "feat: add auth pages, workout history, and exercise library"
```

---

### Task 17: End-to-end test of the money path

**Files:**
- Create: `playwright.config.ts`, `e2e/log-workout.spec.ts`
- Modify: `package.json` (add `test:e2e` script)

**Interfaces:**
- Consumes: the running app from Tasks 1–16.
- Produces: `bun run test:e2e`.

- [ ] **Step 1: Install Playwright**

```bash
bun add -d @playwright/test
bunx playwright install chromium
```

- [ ] **Step 2: Configure it**

Create `playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: { baseURL: 'http://localhost:3000' },
  webServer: {
    command: 'bun run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
```

Add to `package.json` scripts:

```json
"test:e2e": "playwright test"
```

- [ ] **Step 3: Write the end-to-end test**

Create `e2e/log-workout.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

test('register, log a workout, and see it in history', async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`

  await page.goto('/register')
  await page.getByLabel('Name').fill('E2E User')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('password123')
  await page.getByRole('button', { name: 'Register' }).click()

  await expect(page).toHaveURL(/\/workout/)

  await page.getByRole('button', { name: /start empty workout/i }).click()

  await page.getByRole('button', { name: '+ Add Exercise' }).click()
  await page.getByLabel('Search exercises').fill('Bench Press (Barbell)')
  await page.getByRole('checkbox', { name: 'Bench Press (Barbell)' }).click()
  await page.getByRole('button', { name: /add 1 exercise/i }).click()

  await page.getByLabel('Weight (kg)').fill('60')
  await page.getByLabel('Reps').fill('10')
  await page.getByRole('checkbox', { name: 'Complete set 1' }).check()

  await page.getByRole('button', { name: 'Finish' }).click()

  await expect(page).toHaveURL(/\/history/)
  await expect(page.getByText(/600 kg/)).toBeVisible()
})

test('a draft survives a page reload', async ({ page }) => {
  const email = `e2e-reload-${Date.now()}@example.com`

  await page.goto('/register')
  await page.getByLabel('Name').fill('Reload User')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('password123')
  await page.getByRole('button', { name: 'Register' }).click()

  await page.getByRole('button', { name: /start empty workout/i }).click()
  await page.getByRole('button', { name: '+ Add Exercise' }).click()
  await page.getByLabel('Search exercises').fill('Squat (Barbell)')
  await page.getByRole('checkbox', { name: 'Squat (Barbell)' }).click()
  await page.getByRole('button', { name: /add 1 exercise/i }).click()

  await page.getByLabel('Weight (kg)').fill('100')
  await page.reload()

  await expect(page.getByText('Squat (Barbell)')).toBeVisible()
  await expect(page.getByLabel('Weight (kg)')).toHaveValue('100')
})
```

- [ ] **Step 4: Run it**

```bash
bun run db:up
bun run db:seed
bun run test:e2e
```

Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts e2e package.json
git commit -m "test: add end-to-end coverage of logging and draft recovery"
```

---

## Done

At this point the app supports: register, log in, start a workout, add exercises from a
seeded library, log sets whose inputs match each exercise's type, see derived speed for
cardio, autosave that survives refresh and network loss, finish into normalized rows, and
browse history with stats that adapt to what was actually done.

Deferred by design, each additive against this schema: routines and the rest-timer
countdown, supersets UI, RPE input, personal records, charts, and body measurements.
