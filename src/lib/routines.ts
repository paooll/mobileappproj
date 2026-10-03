import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";

/**
 * A routine is one session of somebody's own split.
 *
 * There is no house split here on purpose. Push/legs, upper/lower, a full-body
 * three-day rotation and a five-day bro split are all common, and which one you
 * run changes week to week. So nothing is assumed: the athlete names their own
 * days, in their own order, and the app only offers them on the days they said.
 */
export interface Routine {
  id: string;
  name: string;
  /** Weekdays this routine is for, 0 = Sunday. Empty means "any day". */
  days: number[];
  /** Exercise names in the order they want to do them. */
  exercises: string[];
  createdAt?: unknown;
}

export const ROUTINE_NAMES = [
  "Push",
  "Pull",
  "Legs",
  "Upper",
  "Lower",
  "Full body",
  "Chest and triceps",
  "Back and biceps",
  "Shoulders",
  "Arms",
];

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Same convention as Date#getDay, which is what the profile already stores. */
export function weekdayName(day: number): string {
  return DAY_NAMES[day] ?? "Any day";
}

/** Short label for a routine's schedule, e.g. "Mon Wed Fri" or "Any day". */
export function scheduleLabel(routine: Pick<Routine, "days">): string {
  if (routine.days.length === 0) return "Any day";
  return [...routine.days]
    .sort((a, b) => a - b)
    .map((d) => DAY_NAMES[d] ?? "?")
    .join(" ");
}

/** Routines offered today: ones that named this weekday, plus the unscheduled. */
export function routinesForDay(routines: Routine[], day: number): Routine[] {
  return routines.filter((r) => r.days.length === 0 || r.days.includes(day));
}

export async function loadRoutines(uid: string): Promise<Routine[]> {
  const snap = await getDocs(
    query(collection(db, "users", uid, "routines"), orderBy("createdAt", "asc"))
  );
  return snap.docs.map((d) => {
    const data = d.data() as Partial<Routine>;
    return {
      id: d.id,
      name: typeof data.name === "string" ? data.name : "Session",
      days: Array.isArray(data.days)
        ? data.days.filter((n): n is number => typeof n === "number")
        : [],
      exercises: Array.isArray(data.exercises)
        ? data.exercises.filter((n): n is string => typeof n === "string")
        : [],
      createdAt: data.createdAt,
    };
  });
}

/**
 * A short random id keeps a routine readable in the Firestore console without
 * needing a document counter, which would cost a read on every creation.
 */
function routineId(): string {
  const alphabet = "abcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 12; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export async function createRoutine(
  uid: string,
  name: string,
  days: number[],
  exercises: string[] = []
): Promise<string> {
  const id = routineId();
  await setDoc(doc(db, "users", uid, "routines", id), {
    name: name.trim().slice(0, 40),
    days,
    exercises,
    createdAt: new Date().toISOString(),
  });
  return id;
}

export async function updateRoutine(
  uid: string,
  id: string,
  patch: Partial<Pick<Routine, "name" | "days" | "exercises">>
) {
  await setDoc(doc(db, "users", uid, "routines", id), patch, { merge: true });
}

/** Replaces the whole exercise list in one write so ordering is never torn. */
export async function setRoutineExercises(
  uid: string,
  id: string,
  exercises: string[]
) {
  await updateRoutine(uid, id, { exercises });
}

export async function deleteRoutine(uid: string, id: string) {
  await deleteDoc(doc(db, "users", uid, "routines", id));
}

/**
 * Reordering by hand is fiddly on a phone, so the common moves are offered
 * directly instead: up, down, and a tap to drop one.
 */
export function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** Wipes every routine. Used by account deletion. */
export async function deleteAllRoutines(uid: string) {
  const snap = await getDocs(collection(db, "users", uid, "routines"));
  if (snap.empty) return;
  // 500 is the Firestore write ceiling per batch.
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = writeBatch(db);
    for (const d of snap.docs.slice(i, i + 400)) batch.delete(d.ref);
    await batch.commit();
  }
}
