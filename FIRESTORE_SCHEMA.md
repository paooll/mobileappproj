# Firestore Database Schema

Reprange stores all data in Firestore. This file documents every collection —
the "tables" of the database. No manual setup is required beyond creating the
Firestore database itself; the exercise catalog seeds itself on first app load.

## Collections

### `users` (implicit)

Firebase Auth manages accounts — there is no `users` collection unless you
extend the app. Each authenticated user has a UID (`request.auth.uid`) used
to scope all data below.

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

`firestore.rules` scopes everything: a signed-in user can only read/write
their own workouts and sets; `exercises` is readable by all signed-in users.

## Indexes

`firestore.indexes.json` defines composite indexes for user-scoped workout
queries. Deploy with `firebase deploy --only firestore`.
