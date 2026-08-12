# Workout Logging — Design

**Date:** 2026-08-13
**Status:** Approved
**Scope:** v1 of 53_Fitness_Tracker — a set-based workout logger

## Problem

Log what you did in the gym today: which exercises, and for each one, the sets you
completed. Everything else a full tracker does — routines, social feed, charts, PRs — is
out of scope for v1, but the data model must not have to change to accommodate them later.

## Product model

The core loop is: start a workout → pick exercises from a library → log each set → finish →
it lands in history. The data nests `Workout → Exercise → Set`, where a set is a flat
record of nullable measurements — weight, reps, distance, duration — of which only the ones
relevant to that exercise are populated.

That nesting is the load-bearing decision. It is what makes personal records, progress
charts, and reusable routines additive later rather than a rewrite, because each is a query
over sets rather than a new shape of data.

**Interoperability.** Field names, enum values, and payload shapes follow an established
third-party workout-tracking API format. This is a deliberate choice: it means an export
from an existing tracker can be imported later as a mapping exercise rather than a rewrite,
and it avoids inventing vocabulary for a domain that already has settled terms. Only
functional identifiers are adopted — no exercise descriptions, media, copy, or branding.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Depth | Full `Workout → Exercise → Set` nesting | Scales to PRs and charts without a redesign |
| Stack | Next.js (App Router) + TypeScript + Prisma + Postgres | One codebase, shared types, one deploy |
| Backend | Inside Next.js (`app/api/` + `lib/`) | No CORS, no duplicated types, no second server |
| Auth | Accounts from day one | Retrofitting auth means migrating every table and query |
| Exercise library | ~80 seeded templates + user-created custom | Usable on first run, extensible by the user |
| Set kinds | All 8 `ExerciseType` values | They reduce to combinations of 4 fields — nearly free |
| Logging flow | Live session with timer, draft survives refresh | Makes it a gym tool, not a data-entry form |
| Draft persistence | Client-first + debounced autosave (approach C) | Instant and offline-safe, plus server durability |
| Wire format | Standard field names and enums; our own routes | Cheap import later, without contorting the live-session UX |
| Units | Canonical kg and meters in DB, convert at UI edge | Mixed units in a database is a bug factory |
| Unit preference | One `unitSystem` (METRIC/IMPERIAL) driving weight *and* distance | Two independent settings is a preference nobody wants to manage |
| Cardio display | Derive speed from distance ÷ duration; never store it | A stored speed can contradict the two fields it came from |
| Workout summary | Stats adapt to the set kinds present, not one "volume" number | Volume silently ignores a run; it is the wrong single number for a mixed workout |

### Approach C, and the alternatives rejected

The in-progress workout is the one genuinely load-bearing architectural choice.

- **A. Server-authoritative** — every set tick is an API call. Simple, cross-device, but
  chatty and fragile on gym wifi.
- **B. Client-only** — session in `localStorage`, one save on Finish. Instant and offline,
  but a closed tab loses the workout.
- **C. Client-first with debounced autosave (chosen)** — session lives in React state
  mirrored to `localStorage`; a debounced call (~3s after changes settle) PATCHes the
  whole draft as a single JSON blob. Reads as more complex than it is: it is *one*
  endpoint taking the whole draft, not per-set mutations, so the backend is simpler than
  A while the UX matches B.

Accepted cost: two tabs open for the same user resolve last-write-wins on `updatedAt`.
Acceptable for a single-person tracker; revisit if multi-device editing becomes real.

## Architecture

Server Components render history and library pages directly from the DB. The active
workout screen is a Client Component holding session state. Auth is Auth.js (NextAuth v5)
with a credentials provider and bcrypt-hashed passwords, session in a JWT cookie. Postgres
runs in Docker for dev; Neon or Supabase for deploy.

```
app/
  (auth)/login, /register
  (app)/workout          ← active session (client component)
  (app)/history          ← list + detail (server components)
  (app)/exercises        ← library + create custom
  api/workouts/…         ← draft autosave, finish
  api/v1/…               ← read endpoints, standard wire format
lib/
  db.ts, auth.ts
  workout/               ← domain logic, framework-free
    draft.ts             ← draft shape + validation
    normalize.ts         ← draft → rows
    units.ts             ← kg/lb, m/km conversion, speed derivation
    summary.ts           ← per-workout stats from set kinds present
    setKinds.ts          ← ExerciseType → which fields render
    serialize.ts         ← camelCase ↔ snake_case wire format
prisma/
  schema.prisma, seed.ts
```

`lib/workout/` imports neither Next.js nor Prisma. It is plain functions over plain data,
which is what makes the tricky logic testable without a server or a database.

## Data model

Two naming conventions, both handled by `lib/workout/serialize.ts`, which is also the seam
for importing third-party exports later:

- **Field names** — DB and TypeScript use camelCase (`weightKg`); API JSON uses the
  standard snake_case wire names (`weight_kg`).
- **Enum values** — Prisma enums are `UPPER_SNAKE_CASE` (`WEIGHT_REPS`, `DROPSET`,
  `UPPER_BACK`), serialized to lowercase (`weight_reps`, `dropset`, `upper_back`) in API
  JSON. Enum sections below list the wire values.

```
User              id, email, passwordHash, name, unitSystem(METRIC|IMPERIAL), createdAt

ExerciseTemplate  id, title, type(ExerciseType),
                  primaryMuscleGroup(MuscleGroup),
                  secondaryMuscleGroups(MuscleGroup[]),   → sets count against both
                                                            for per-muscle volume later
                  equipmentCategory(EquipmentCategory),
                  isCustom, ownerId?          → null = seeded, set = user's custom

Workout           id, userId, title, description?,
                  status(IN_PROGRESS|COMPLETED),
                  startTime, endTime?, draft(Json?), createdAt, updatedAt

WorkoutExercise   id, workoutId, exerciseTemplateId, index, notes?,
                  supersetId?, restSeconds?

SetEntry          id, workoutExerciseId, index,
                  type(NORMAL|WARMUP|FAILURE|DROPSET),
                  weightKg?, reps?, distanceMeters?, durationSeconds?,
                  rpe?, customMetric?
```

### The central rule

**A draft is a JSON blob; a finished workout is normalized rows.**

While training, the session is one `Workout` row with `status = IN_PROGRESS` and the whole
session in `draft` — so autosave is a single-row write regardless of how many sets are
logged. On Finish, the blob is normalized into `WorkoutExercise` and `SetEntry` rows in one
transaction, `draft` is nulled, `endTime` is set, and status flips to `COMPLETED`. History
and every future feature query clean relational data and never touch JSON.

**Completion is draft-only.** Each draft set carries a `completed` flag so the UI can tick
sets off during the session, but there is no `completed` column on `SetEntry`. On finish,
only completed sets are normalized; unticked sets are discarded, and an exercise left with
no completed sets is dropped entirely. A finished workout therefore records what you *did*,
not what you planned — which is what every history query wants. `index` on both
`WorkoutExercise` and `SetEntry` is assigned from array position at normalization time,
after the incomplete entries are filtered out, so indexes are always contiguous from 0.

### Enums

**`ExerciseType`** — `weight_reps`, `reps_only`, `bodyweight_reps`,
`bodyweight_assisted_reps`, `duration`, `weight_duration`, `distance_duration`,
`short_distance_weight`

These are combinations of four measurable fields. `lib/workout/setKinds.ts` holds the
lookup driving which inputs a set row renders and which columns may be non-null:

| Type | weight | reps | duration | distance |
|---|:-:|:-:|:-:|:-:|
| `weight_reps` | ● | ● | | |
| `reps_only` | | ● | | |
| `bodyweight_reps` | | ● | | |
| `bodyweight_assisted_reps` | ● (assist) | ● | | |
| `duration` | | | ● | |
| `weight_duration` | ● | | ● | |
| `distance_duration` | | | ● | ● |
| `short_distance_weight` | ● | | | ● |

**`MuscleGroup`** — `abdominals`, `shoulders`, `biceps`, `triceps`, `forearms`,
`quadriceps`, `hamstrings`, `calves`, `glutes`, `abductors`, `adductors`, `lats`,
`upper_back`, `traps`, `lower_back`, `chest`, `cardio`, `neck`, `full_body`, `other`

**`EquipmentCategory`** — `none`, `barbell`, `dumbbell`, `kettlebell`, `machine`, `plate`,
`resistance_band`, `suspension`, `other`

**`SetType`** — `warmup`, `normal`, `failure`, `dropset`

**`rpe`** — nullable, constrained to `6, 7, 7.5, 8, 8.5, 9, 9.5, 10`

### Deliberate deviations from the standard format

- **No stored duration on `Workout`** — derived from `startTime`/`endTime`.
- **`ownerId` instead of only `isCustom`** — required for multi-user; `is_custom` is still
  exposed in API responses.
- **One in-progress workout per user**, enforced by a partial unique index on
  `(userId)` where `status = 'IN_PROGRESS'`. Removes a class of "which draft is live?"
  questions. Prisma cannot express partial indexes in `schema.prisma`, so this ships as
  hand-written SQL in the migration.
- **`customMetric` is stored but unused in v1.** An escape hatch for user-defined
  measurements; the column exists so third-party exports import cleanly, but no v1 exercise
  type populates it and no UI reads it.
- **`supersetId` column exists, superset UI does not.** One nullable field now beats a
  migration later.
- **`restSeconds` column exists, the countdown does not.** Rest is a per-exercise value
  (not global, not per-set), and `null` means *off* rather than zero — a zero would start a
  timer that immediately fires. Its natural home is a routine: you configure it once in the
  plan and the live session inherits it. Since routines are out of scope, building the
  countdown now would mean re-picking a duration every single workout — more friction than
  the feature removes. The column ships now so the timer can arrive with routines without a
  migration on a table that by then holds real rows.

## Screens

**Register / Login** — email + password; on success, land on Workout.

**Workout** — with no live session, a single *Start Empty Workout* button. Once started: a
running timer in the header, each exercise with its set table, `+ Add Set` per exercise,
`+ Add Exercise` at the bottom, and *Finish*.

The set row renders from the `setKinds` lookup — `60 kg × 10 reps` for a bench press,
`5.0 km / 28:15` for a treadmill, from one component. Distance sets show derived speed
live beside the inputs: enter `5.0 km` and `28:15` and the row displays `10.6 km/h`
(`mph` under IMPERIAL). Speed is display-only — never an input, never stored. Each row has
a completion checkbox, a delete affordance, and a tap-to-cycle set type. A **PREV** column
shows the same exercise's last performance — the single feature that makes a lifting
tracker useful.

**Exercise picker** — modal off `+ Add Exercise`. Search by title, filter by muscle group,
multi-select to add several at once, and *Create custom exercise* taking title, type,
primary muscle group, and equipment category.

**History** — reverse-chronological finished workouts with title, date, duration, total
sets, and a summary; tap through to a read-only detail of every exercise and set.

### Workout summary stats

There is no single "total volume" number, because it is meaningless for half the set kinds.
The summary shows only the stats the workout actually contains, computed in
`lib/workout/summary.ts`:

| Workout contains | Summary shows |
|---|---|
| Sets with weight and reps | Total volume — `Σ(weightKg × reps)` over sets where both are non-null |
| Sets with distance | Total distance, total moving time, average speed |
| Duration-only sets | Total time under tension |
| A mix | Each applicable stat, side by side |

So a bench-and-treadmill day reads `4,250 kg · 5.0 km · 28:15` rather than a volume figure
that silently ignores the run. Average speed is `total distance ÷ total duration` across
distance sets — not the mean of per-set speeds, which would over-weight short intervals.
A workout with no qualifying sets shows set count only, never a `0` that reads as data.

**Exercise library** — browse seeded templates, manage custom ones.

## API

Live-session routes are ours; the standard format has no concept of an in-progress workout.

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/workouts/start` | Create the `IN_PROGRESS` row. `409` if one exists. |
| `GET` | `/api/workouts/active` | Rehydrate the draft on load or new device. |
| `PATCH` | `/api/workouts/active` | Debounced autosave of the whole draft blob. |
| `POST` | `/api/workouts/active/finish` | Validate, normalize to rows, flip to `COMPLETED`. |
| `DELETE` | `/api/workouts/active` | Discard the session. |

Read routes use the standard resource shape and payload field names.

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/v1/workouts?page=&pageSize=` | Paginated finished workouts. |
| `GET` | `/api/v1/workouts/:id` | One workout with exercises and sets. |
| `GET` | `/api/v1/exercise_templates` | Search/filter the library. |
| `POST` | `/api/v1/exercise_templates` | Create a custom template. |
| `GET` | `/api/v1/exercise_history/:templateId` | Powers the PREV column. |

Every handler resolves `userId` from the session server-side and scopes its queries by it.
The client never sends a user id. History and library pages read via Server Components and
skip this layer entirely.

## Error handling

- **Autosave fails** — the UI keeps working from local state and shows an unobtrusive
  "unsaved" indicator; the saver retries with backoff. The workout is never blocked on the
  network. This is the entire point of approach C.
- **Finish fails** — the local draft is *not* cleared and the button re-enables. Losing a
  completed session to a failed request would be the worst bug in the app.
- **Two tabs** — last write wins on `updatedAt`. Accepted for v1.
- **Start with a session live** — `409`, and the UI routes to the existing session.
- **Validation** — Zod at every route boundary. A set whose populated fields contradict its
  exercise's `type` is rejected server-side, not merely hidden in the UI.
- **Auth** — API returns `401` unauthenticated; pages redirect to login. Because every
  query filters by session `userId`, a wrong id yields `404`, never another user's data.

## Testing

- **Vitest over `lib/workout/`** — draft validation, the `setKinds` lookup, unit
  conversion, speed derivation, summary stats, serialization round-trips, and draft→rows
  normalization. Pure functions, so fast and meaningful. This is where the real logic
  lives. Summary stats get explicit cases for a strength-only workout, a cardio-only
  workout, a mixed one, and a zero-distance set (which must not divide by zero).
- **Integration tests** against a test Postgres for auth scoping, the `409` on double
  start, and the finish transaction.
- **One Playwright end-to-end run** on the money path: register → start → add exercise →
  log sets → finish → see it in history.

## Out of scope for v1

Routines, routine folders, body measurements, superset UI, RPE input, rest-timer countdown,
PRs, charts, social feed, and incremental-sync endpoints. Each slots into this schema
without a migration — that is why the standard enums and shapes were adopted now.

**Rest timers ship with routines.** They are a plan-level value the live session inherits;
delivering them before routines exist means re-picking a duration every workout. The
`restSeconds` column is in place so that work is additive.

**Routines also unlock per-muscle set counts and estimated duration.** Set counts attribute
to an exercise's primary *and* secondary muscle groups, and estimated duration is
`Σ(set execution) + Σ(rest gaps)` — which is why `secondaryMuscleGroups` and `restSeconds`
both exist in the v1 schema despite having no v1 UI.
