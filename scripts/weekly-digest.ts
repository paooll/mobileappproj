/**
 * Sends the weekly progress digest to everyone who asked for one.
 *
 * Runs from GitHub Actions rather than Firebase Cloud Functions: scheduled
 * functions need Cloud Scheduler, which requires a billing-enabled project, and
 * this app is meant to stay on the free plan. GitHub Actions cron and the
 * Firestore and Knock free tiers cover the same work at no cost.
 *
 * Required in the environment:
 *   GOOGLE_APPLICATION_CREDENTIALS  path to a Firebase service account JSON key
 *   KNOCK_API_KEY                   Knock secret API key
 */

import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import Knock from "@knocklabs/node";
import {
  isoDaysAgo,
  isDigestDay,
  summarize,
  type SetLite,
  type WorkoutLite,
} from "../src/lib/digest.js";

initializeApp();

const db = getFirestore();

/** Must match the workflow slug in the Knock dashboard. */
const WORKFLOW = "weekly-digest";

/**
 * Seven days of history plus the week before it, so the email can say what
 * changed rather than only what happened.
 */
const LOOKBACK_DAYS = 13;
/** A fortnight of daily training is already an unusual week. Caps the read. */
const MAX_WORKOUTS = 20;

interface DigestPrefs {
  email?: string;
  displayName?: string;
  digestDay?: number;
  tzOffset?: number;
}

async function main() {
  const apiKey = process.env.KNOCK_API_KEY;
  if (!apiKey) {
    console.error("KNOCK_API_KEY is not set. No digest was sent.");
    process.exitCode = 1;
    return;
  }
  const knock = new Knock({ apiKey });

  const now = new Date();
  const toISO = isoDaysAgo(0, now);
  const fromISO = isoDaysAgo(6, now);
  const previousFromISO = isoDaysAgo(LOOKBACK_DAYS, now);

  const optedIn = await db.collection("users").where("weeklyDigest", "==", true).get();
  console.log(`${optedIn.size} athlete(s) opted in to the weekly digest.`);

  let sent = 0;
  const failures: string[] = [];

  for (const doc of optedIn.docs) {
    const uid = doc.id;
    const data = doc.data() as DigestPrefs;
    if (!data.email) continue;

    const digestDay = typeof data.digestDay === "number" ? data.digestDay : 1;
    const tzHours = typeof data.tzOffset === "number" ? data.tzOffset : 0;
    if (!isDigestDay(now, digestDay, tzHours)) continue;

    try {
      const digest = await buildDigest(uid, fromISO, toISO, previousFromISO);
      // Someone who stopped training should not be chased by an email that only
      // ever says "nothing logged". The setting is theirs to turn back on.
      if (!digest || digest.sessions === 0) continue;

      // users.update is Knock's upsert: a re-run must not fail just because the
      // recipient is already known.
      await knock.users.update(uid, {
        email: data.email,
        name: data.displayName?.trim() || undefined,
      });
      await knock.workflows.trigger(WORKFLOW, {
        recipients: [uid],
        data: { ...digest },
      });
      sent += 1;
    } catch (err) {
      // One unreachable recipient must not cost the others their digest.
      console.error(`Weekly digest failed for ${uid}`, err);
      failures.push(uid);
    }
  }

  console.log(`Weekly digest finished. Sent ${sent}, failed ${failures.length}.`, failures);
  if (failures.length > 0) process.exitCode = 1;
}

async function buildDigest(
  uid: string,
  fromISO: string,
  toISO: string,
  previousFromISO: string
) {
  // Deliberately no server-side range filter on date. Equality on userId plus
  // orderBy date desc is the query the app already runs in loadRecentArchive, so
  // the (userId ASC, date DESC) index is known to exist and serve it. Adding
  // `where("date", ">=")` would pair a range filter with an opposite-direction
  // sort, which needs a second index. The read is capped either way, and the
  // window is applied below before a single set is read.
  const snapshot = await db
    .collection("workouts")
    .where("userId", "==", uid)
    .orderBy("date", "desc")
    .limit(MAX_WORKOUTS)
    .get();

  if (snapshot.empty) return null;

  // Sorted newest first, so an athlete who has not trained in weeks falls out
  // here, before a single subcollection read.
  const workouts: WorkoutLite[] = snapshot.docs
    .map((d) => {
      const data = d.data() as { name: string; date: string; completed: boolean };
      return { id: d.id, name: data.name, date: data.date, completed: data.completed === true };
    })
    .filter((w) => w.date >= previousFromISO);

  if (workouts.length === 0) return null;

  const setsByWorkout = new Map<string, SetLite[]>();
  await Promise.all(
    workouts.map(async (w) => {
      const sets = await db.collection("workouts").doc(w.id).collection("sets").get();
      setsByWorkout.set(
        w.id,
        sets.docs.map((s) => {
          const data = s.data() as { exerciseName: string; weight: number; reps: number };
          return { exerciseName: data.exerciseName, weight: data.weight, reps: data.reps };
        })
      );
    })
  );

  return summarize(workouts, setsByWorkout, fromISO, toISO, previousFromISO);
}

main().catch((err) => {
  console.error("Weekly digest crashed", err);
  process.exitCode = 1;
});