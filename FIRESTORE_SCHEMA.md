# Firestore Database Schema

Reprange stores all data in Firestore. This file documents every collection —
the "tables" of the database. No manual setup is required beyond creating the
Firestore database itself; the exercise catalog seeds itself on first app load.

## Collections

### `users`

One document per account, at `users/{uid}`. Firebase Auth owns the credentials;
this document holds preferences only, and is created during onboarding.

| Field          | Type       | Description                                  |
| -------------- | ---------- | -------------------------------------------- |
| `experience`   | string     | new, some, regular, years                    |
| `goal`         | string     | strength, muscle, endurance, general          |
| `daysPerWeek`  | number     | weekly training target                        |
| `equipment`    | string[]   | equipment the athlete has                     |
| `unit`         | string     | kg or lb                                      |
| `restSeconds`  | number     | rest timer length after a set (default 90)    |
| `restAutoStart`| boolean    | start the timer on every logged set (default true) |
| `onboardedAt`  | timestamp  | server time, set on creation                  |

`restSeconds` and `restAutoStart` are written separately from the onboarding
fields, so re-running setup never resets them. Missing fields fall back to
defaults on read, which keeps older documents valid.

### `workouts`

One document per workout session.

| Field         | Type      | Description                              |
| ------------- | --------- | ---------------------------------------- |
| `userId`      | string    | Owner UID (Firebase Auth)                |
| `name`        | string    | e.g. "Push Day"                          |
| `date`        | string    | `YYYY-MM-DD`                             |
| `completed`   | boolean   | false while active, true after finishing |
| `completedAt` | number?\ | epoch ms when finished (null if active)  |
| `createdAt`   | timestamp | server time, set on creation             |

Subcollection: **`sets`**

| Field           | Type   | Description            |
| --------------- | ------ | ---------------------- |
| `exerciseName`  | string | denormalized from catalog |
| `weight`        | number | kg                     |
| `reps`          | number | rep count              |
| `order`         | number | position in the workout |

### `exercises`

Shared, read-only catalog seeded automatically on first authenticated load.

| Field         | Type   | Values                                     |
| ------------- | ------ | ------------------------------------------ |
| `name`        | string | e.g. "Bench Press"                         |
| `muscleGroup` | string | Chest, Back, Shoulders, Legs, Arms, Core   |
| `equipment`   | string | Barbell, Dumbbell, Machine, Cable, Bodyweight |

### `meta`

Housekeeping documents.

| Doc               | Fields       | Purpose                       |
| ----------------- | ------------ | ----------------------------- |
| `exerciseCatalog` | `seeded: true` | guards the one-time seed    |

## Security

`firestore.rules` scopes everything: a signed-in user can only read/write their
own profile document, workouts and sets; `exercises` is readable by all
signed-in users.

## Indexes

`firestore.indexes.json` defines composite indexes for user-scoped workout
queries. Deploy with `firebase deploy --only firestore`.
