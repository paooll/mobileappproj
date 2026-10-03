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
| `haptics`      | boolean    | vibrate on a logged set and when rest ends (default true) |
| `coach`        | boolean    | show the progressive overload coach (default true) |
| `roundTo`      | number     | weight increment weights snap to: 0.5, 1 or 2.5 kg (default 2.5) |
| `weeklyDigest` | boolean    | send the Monday progress email (default false) |
| `digestDay`    | number     | weekday the digest goes out, 0 = Sunday (default 1) |
| `tzOffset`     | number     | hours east of UTC, used to send on the athlete's weekday (default 0) |
| `displayName`  | string     | name shown instead of the email (default "")   |
| `email`        | string     | where the digest goes; copied from Firebase Auth on opt-in (default "") |
| `onboardedAt`  | timestamp  | server time, set on creation                  |

Everything from `restSeconds` down is written separately from the onboarding
fields, so re-running setup never resets it. Missing fields fall back to
defaults on read, which keeps older documents valid.

`tzOffset` is captured from the athlete's device when setup is saved and when
the digest is switched on. The scheduled digest job needs it because "Monday"
has to mean the athlete's Monday, not the server's.

### `users/{uid}/avatar`

One document holding the profile photo.

| Field   | Type     | Description                                    |
| ------- | -------- | ---------------------------------------------- |
| `bytes` | bytes    | a 256px JPEG, resized in the browser (~15-25 KB) |

The image is stored in Firestore rather than Cloud Storage because Cloud Storage
has required a billing-enabled project since February 2026, and this app is
meant to run entirely on the free plan. A resized photo is well inside
Firestore's 1 MiB document limit, and a read is billed once per document
regardless of size. It lives in its own document so the profile that the route
guard reads on every navigation stays small.

### Weekly digest job

`scripts/weekly-digest.ts`, run daily at 15:00 UTC by
`.github/workflows/weekly-digest.yml`. It picks the athletes whose `digestDay`
matches today in their own `tzOffset` and sends the `weekly-digest` workflow
through [Knock](https://knock.app). The email template, sending domain and
unsubscribe handling live in the Knock dashboard. The workflow can also be run by
hand from the Actions tab, which is the only practical way to test it without
waiting for the right weekday.

The job has no Firebase session, so `email` has to be on the profile document:
Firebase Auth owns the real address and the app copies it across when the athlete
switches the digest on. Every athlete the job passes over is logged with the
reason (no email on file, wrong weekday, or nothing logged this week), so a run
reporting zero sends is never unexplained.

It runs on GitHub Actions rather than Firebase Cloud Functions because scheduled
functions need Cloud Scheduler, which also requires a billing-enabled project.

### `users/{uid}/routines/{routineId}`

One session of the athlete's own training split.

| Field       | Type     | Description                                              |
| ----------- | -------- | -------------------------------------------------------- |
| `name`      | string   | their name for it, e.g. "Push" or "Legs heavy"           |
| `days`      | number[] | weekdays it is for, 0 = Sunday. Empty means any day      |
| `exercises` | string[] | exercise names, in the order they want to do them       |
| `createdAt` | string   | ISO timestamp, used for a stable order                   |

The app ships no split of its own. Push/legs, upper/lower, a full-body rotation
and a bro split are all common, and which one somebody runs changes over time,
so the athlete names their own days and order. `Today` offers the routines whose
`days` include today, plus any with no days set.

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
