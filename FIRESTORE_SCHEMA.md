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

### `handles/{code}`

A short public code per account, and the only way one account can find
another.

| Field   | Type   | Description                          |
| ------- | ------ | ------------------------------------ |
| `uid`   | string | owner (Firebase Auth)                |
| `name`  | string | display name, kept in step with the profile |

The code is the document id, so two accounts can never end up with the same
one. It is six characters from an alphabet with no I, O, 0 or 1, because it
gets read aloud across a gym floor. The document holds nothing else: a read
resolves a code to a uid and a name, never to an email address.

### `requests/{followerUid}__{followeeUid}`

One ask to follow. Nothing is shared until it is answered.

| Field          | Type   | Description                     |
| -------------- | ------ | ------------------------------- |
| `followerUid`  | string | who is asking                   |
| `followeeUid`  | string | who is being asked               |
| `followerName` | string | name at the time of the ask     |
| `followeeName` | string | name of the person being asked  |
| `createdAt`    | number | epoch ms, newest request first   |

### `follows/{followerUid}__{followeeUid}`

One accepted, one-directional follow.

| Field          | Type   | Description                     |
| -------------- | ------ | ------------------------------- |
| `followerUid`  | string | who follows                     |
| `followeeUid`  | string | who is followed                 |
| `followerName` | string | name at the time of the request |
| `followeeName` | string | name of the person followed     |
| `acceptedAt`   | number | epoch ms the request was answered |

A request and a follow live in separate collections on purpose. Accepting is
one batch that writes the follow and deletes the request, so a half-accepted
follow is not a state the database can be in. Splitting them also means a
rules check costs one `exists()` rather than an `exists()` plus a `get()`:
Firestore allows at most 10 document access calls per request, and a feed
query arrives with dozens of rows to check.

### `posts/{postId}`

One finished session, as a summary. This is the only part of a workout that
ever leaves the account.

| Field         | Type              | Description                              |
| ------------- | ----------------- | ---------------------------------------- |
| `authorUid`   | string            | whose session this is                    |
| `authorName`  | string            | display name at the time of posting      |
| `workoutName` | string            | e.g. "Push Day"                          |
| `sets`        | number            | how many sets were logged                |
| `volumeKg`    | number            | total kg across those sets               |
| `date`        | string            | `YYYY-MM-DD`                             |
| `createdAt`   | number            | epoch ms, the feed order                  |
| `reactions`   | map<string, uid[]> | reaction key to the uids who gave it    |
| `notes`       | map<string, string> | reaction key to the one word sent with it |
| `commentCount`| number            | denormalised thread size, 0 at post time |
| `kind`        | string            | `session`, or `milestone` when the app posted a rank crossing |
| `detail`      | {name,weight,reps}[] | every set, only when the athlete's `postDetail` is `full` |
| `thumb`       | bytes             | optional 160px JPEG of the athlete's photo for this session, capped at 24 KB |

`detail` is the athlete's own choice and it lives on their profile as
`postDetail` (`summary` or `full`, defaulting to `summary`). The create rule
reads that profile and refuses a post carrying `detail` unless the setting says
`full`, so the choice cannot be bypassed by an edited client. A profile written
before the setting existed has no `postDetail`, and a missing field reads as
summary rather than as full.

`commentCount` is denormalised rather than counted on read, because counting it
would mean opening the subcollection behind every one of the feed's 25 rows. It
is bumped inside the same transaction that writes the comment, so two comments
landing at once cannot both read the same count. Deleting a comment does not
decrement it: the delete and the count would race, and an over-count is a
smaller lie than a count that drops to a wrong number.

Milestones are ordinary posts with a different `kind`, which is why they cost
the feed query nothing extra and render as their own card.

`thumb` rides on the post itself, and that is the only reason a feed can render
a picture without opening anything else. It is small on purpose: the feed reads
25 posts at once, so every byte here is paid on every feed load. The full image
lives at `posts/{postId}/photo` and is read once, when the post is opened.
Cloud Storage is unavailable on the free plan, which is why both are bytes in
Firestore rather than URLs, and why Firestore's 1 MiB document ceiling is the
real limit on the size of a picture this app can store.

A post without a picture has no `thumb` field at all rather than an empty one.
The create rule allows the key, caps it at 24 KB, and refuses any other shape,
and the update rule does not list it, so a picture cannot be swapped after the
fact by the author or by anyone else.

### `posts/{postId}/comments/{commentId}`

One reply on a session or milestone.

| Field         | Type     | Description                          |
| ------------- | -------- | ------------------------------------ |
| `authorUid`   | string   | who wrote it                         |
| `authorName`  | string   | name at the time                     |
| `body`        | string   | the comment, 280 characters at most  |
| `mentions`    | string[] | uids named with `@`, for the badge   |
| `createdAt`   | number   | epoch ms                             |

A thread lives in a subcollection rather than on the post because a post is
read by up to 25 people at once and a thread is read by one person at a time.
Inlining it would put a comment query behind every row of the feed. Reads are
capped at 50 and sorted oldest first.

A comment is readable exactly when the post above it is, which the rule decides
with one `get()` on the parent and, for somebody who does not own it, one
`exists()` for the follow. That is the canonical Firestore subcollection pattern
and it costs three document access calls at worst, inside the ten a rules
evaluation is allowed.

A comment is never editable once written, only deletable, and only by whoever
wrote it or by the owner of the post.

### `posts/{postId}/photo`

The full-size picture behind a post, at most one per post.

| Field   | Type  | Description                          |
| ------- | ----- | ------------------------------------ |
| `bytes` | bytes | a 1024px JPEG, resized in the browser |

A picture is chosen deliberately on the workout, before the post is written,
because the thumbnail can only be set on create. Both resolutions are produced
by one resize in the browser and then written: the thumbnail onto the post
itself, and this one afterwards, because it needs the post id.

Read access is exactly the post's own, answered by the same `canSeePost` the
post rule and the comment rule use: one `get()` on the parent, plus one
`exists()` for the follow when the reader does not own the post. That is two
document access calls against the ten an evaluation allows, and it is spent
only on a post somebody deliberately opened, never per row of a feed. It is
written separately rather than inline because the feed reads 25 posts at a
time and 25 full images would be megabytes on every load.

Creating and deleting are the post author's own, and there is no update rule at
all, so the same document can never be written twice. Bytes are capped at
900 KB, under Firestore's 1 MiB ceiling. Deleting a post drops this document
too: Firestore does not cascade, and the rules make it unreadable the moment
the parent is gone either way.

### `notifications/{uid}/items/{itemId}`

One mention, delivered to the account named.

| Field       | Type   | Description                            |
| ----------- | ------ | -------------------------------------- |
| `fromUid`   | string | who wrote the comment                  |
| `fromName`  | string | their name at the time                 |
| `postId`    | string | the post the comment sits under        |
| `body`      | string | the comment as written, 280 at most    |
| `createdAt` | number | epoch ms                               |
| `read`      | boolean | false until the bell is opened        |

Cloud Functions cannot run on the free plan, so nothing exists to notice a
mention and forward it. The device that wrote the comment drops the
notification in instead. That is sound rather than a shortcut: the writer is
already permitted to write the comment, and the create rule additionally proves
the writer could read the post the comment sits under. Without that proof any
account could ring any other account's bell with a link to a post they have
never been allowed to see.

Reading costs nothing: the collection path is `notifications/{uid}/items`, so
the recipient owns the documents outright and the rule is a single comparison.
This is the only collection in the app whose rule needs no document access at
all. Reads are capped at 30, newest first.

No exercise name, no weight, no rep count is written here unless the athlete has
chosen `postDetail: "full"`, and the create rule refuses a document carrying one
otherwise. `hasOnly([...])` on the create rule, together with the profile read,
is what makes that a choice rather than a claim.

The feed is one query over this collection, narrowed to `authorUid in [...]`,
and the rules narrow it again: a post is readable by its author and by
accounts that follow the author, so a query that asks for more than the reader
is entitled to gets those documents dropped rather than an error. Reactions,
the word attached to one, and the comment count are the only fields anyone may
write, on your own post or one from an account you follow, enforced with
`diff().affectedKeys().hasOnly([...])`, so no client can rewrite another
athlete's numbers.

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

The social rules are written to be safe on their own rather than relying on the
query that happens to be running, because any client can be modified. A follow
or a request is readable only by the two people on it, `handles` holds nothing
but a uid and a name, and a post is readable only by its author and its
followers.

Ownership on an edge is read off `followerUid`/`followeeUid`, never off the
path. The document id is `{followerUid}__{followeeUid}`, so a rule that
compared the path variable to `request.auth.uid` would compare
`uidAlice__uidBob` with `uidAlice`, never match, and quietly deny both people
access to their own edge. That failure is invisible: reads return empty rather
than erroring, so the following list comes back empty and the feed collapses
to just the reader.

## Indexes

`firestore.indexes.json` defines composite indexes for the user-scoped workout
queries and for the feed, which orders posts across many authors. Deploy with
`firebase deploy --only firestore`.
