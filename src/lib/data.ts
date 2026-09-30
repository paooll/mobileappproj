import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as fbSignOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  query,
  where,
  limit,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  orderBy,
  type Unsubscribe,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import { ensureExerciseCatalog, type Exercise } from "./exerciseDb";

export type { Exercise };

/* ---------- Types ---------- */

export interface Workout {
  id: string;
  userId: string;
  name: string;
  date: string; // YYYY-MM-DD
  completed: boolean;
  completedAt: number | null;
}

export interface WorkoutSet {
  id: string;
  exerciseName: string;
  weight: number;
  reps: number;
  order: number;
}

export interface Stats {
  totalWorkouts: number;
  totalSets: number;
  totalVolume: number;
  streak: number;
  weekWorkouts: number;
}

export interface PersonalRecord {
  weight: number;
  date: string;
}

/* ---------- Auth ---------- */

export function observeUser(cb: (u: User | null) => void) {
  return onAuthStateChanged(auth, cb);
}

export async function signUp(email: string, password: string) {
  return createUserWithEmailAndPassword(auth, email, password);
}

export async function signIn(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signOut() {
  return fbSignOut(auth);
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return signInWithPopup(auth, provider);
}

/* ---------- Friendly Firebase error messages (shared by auth pages) ---------- */

export function friendlyAuthError(err: unknown, mode: "signin" | "signup" | "google"): string {
  const code = (err as { code?: string }).code ?? "";
  if (code.includes("popup-closed-by-user") || code.includes("cancelled-popup-request"))
    return "Google sign-in was cancelled.";
  if (code.includes("popup-blocked"))
    return "Your browser blocked the Google popup — allow popups and try again.";
  if (code.includes("account-exists-with-different-credential"))
    return "That email is registered with a password. Sign in with email instead.";
  if (code.includes("email-already-in-use"))
    return "That email already has an account. Sign in instead.";
  if (code.includes("invalid-email"))
    return "That email doesn't look right.";
  if (code.includes("weak-password"))
    return "Password should be at least 6 characters.";
  if (code.includes("too-many-requests"))
    return "Too many attempts. Wait a moment and try again.";
  if (code.includes("network-request-failed"))
    return "Network problem — check your connection.";
  if (
    code.includes("invalid-credential") ||
    code.includes("wrong-password") ||
    code.includes("user-not-found") ||
    code.includes("invalid-login-credentials")
  )
    return "That email and password don't match.";
  if (code.includes("operation-not-allowed"))
    return "This sign-in method isn't enabled yet. Contact support.";
  return mode === "signup"
    ? "Couldn't create the account. Try again."
    : mode === "google"
      ? "Google sign-in failed. Try again."
      : "Sign-in failed. Try again.";
}

/* ---------- Exercises ---------- */

export async function loadExercises(): Promise<Exercise[]> {
  return ensureExerciseCatalog();
}

/* ---------- Workouts: realtime ---------- */

export function subscribeActiveWorkout(
  userId: string,
  cb: (w: Workout | null) => void
): Unsubscribe {
  const q = query(
    collection(db, "workouts"),
    where("userId", "==", userId),
    where("completed", "==", false),
    limit(1)
  );
  return onSnapshot(q, (snap) => {
    cb(snap.empty ? null : ({ id: snap.docs[0].id, ...snap.docs[0].data() } as Workout));
  });
}

export function subscribeWorkouts(
  userId: string,
  cb: (workouts: Workout[]) => void
): Unsubscribe {
  const q = query(
    collection(db, "workouts"),
    where("userId", "==", userId)
  );
  return onSnapshot(q, (snap) => {
    const workouts = snap.docs.map(
      (d) => ({ id: d.id, ...d.data() }) as Workout
    );
    workouts.sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
    cb(workouts);
  });
}

export function subscribeSets(
  workoutId: string,
  cb: (sets: WorkoutSet[]) => void
): Unsubscribe {
  const q = query(collection(db, "workouts", workoutId, "sets"), orderBy("order"));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as WorkoutSet));
  });
}

/* ---------- Workout actions ---------- */

function today() {
  return new Date().toISOString().slice(0, 10);
}

export async function startWorkout(userId: string, name: string): Promise<string> {
  const activeSnap = await getDocs(
    query(
      collection(db, "workouts"),
      where("userId", "==", userId),
      where("completed", "==", false),
      limit(1)
    )
  );
  if (!activeSnap.empty) return activeSnap.docs[0].id;
  const ref = await addDoc(collection(db, "workouts"), {
    userId,
    name,
    date: today(),
    completed: false,
    completedAt: null,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getWorkout(
  id: string
): Promise<(Workout & { sets: WorkoutSet[] }) | null> {
  const snap = await getDoc(doc(db, "workouts", id));
  if (!snap.exists()) return null;
  const data = snap.data() as Omit<Workout, "id">;
  const setsSnap = await getDocs(
    query(collection(db, "workouts", id, "sets"), orderBy("order"))
  );
  const sets = setsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as WorkoutSet);
  return { id: snap.id, ...data, sets };
}

export async function addSet(
  workoutId: string,
  exerciseName: string,
  weight: number,
  reps: number
) {
  const setsRef = collection(db, "workouts", workoutId, "sets");
  const existing = await getDocs(setsRef);
  await addDoc(setsRef, {
    exerciseName,
    weight,
    reps,
    order: existing.size,
  });
}

export async function removeSet(workoutId: string, setId: string) {
  await deleteDoc(doc(db, "workouts", workoutId, "sets", setId));
}

export async function finishWorkout(workoutId: string) {
  await setDoc(
    doc(db, "workouts", workoutId),
    { completed: true, completedAt: Date.now() },
    { merge: true }
  );
}

export async function deleteWorkout(workoutId: string) {
  const setsSnap = await getDocs(collection(db, "workouts", workoutId, "sets"));
  await Promise.all(setsSnap.docs.map((d) => deleteDoc(d.ref)));
  await deleteDoc(doc(db, "workouts", workoutId));
}

/* ---------- Last-set memory: prefill weight/reps per exercise ---------- */

export async function getLastSetFor(
  userId: string,
  exerciseName: string
): Promise<{ weight: number; reps: number } | null> {
  const workoutsSnap = await getDocs(
    query(collection(db, "workouts"), where("userId", "==", userId))
  );
  const completedIds = workoutsSnap.docs
    .filter((d) => d.data().completed)
    .map((d) => d.id);
  if (completedIds.length === 0) return null;

  let best: { weight: number; reps: number } | null = null;
  // Check the 8 most recent workouts for this exercise
  for (const wid of completedIds.slice(0, 8)) {
    const setsSnap = await getDocs(collection(db, "workouts", wid, "sets"));
    for (const d of setsSnap.docs) {
      const s = d.data() as { exerciseName: string; weight: number; reps: number };
      if (s.exerciseName === exerciseName) {
        if (!best || s.weight > best.weight) best = { weight: s.weight, reps: s.reps };
      }
    }
  }
  return best;
}

/* ---------- Personal record for an exercise ---------- */

export async function getPersonalRecord(
  userId: string,
  exerciseName: string
): Promise<{ weight: number; reps: number } | null> {
  return getLastSetFor(userId, exerciseName); // same lookup: heaviest set
}

/* ---------- Stats ---------- */

export function computeStats(workouts: Workout[], setsByWorkout: Map<string, WorkoutSet[]>): Stats {
  const completed = workouts.filter((w) => w.completed);
  let totalSets = 0;
  let totalVolume = 0;
  for (const w of completed) {
    const sets = setsByWorkout.get(w.id) ?? [];
    for (const s of sets) {
      totalSets += 1;
      totalVolume += s.weight * s.reps;
    }
  }
  const dates = new Set(completed.map((w) => w.date));
  let streak = 0;
  const d = new Date();
  if (!dates.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1);
  while (dates.has(d.toISOString().slice(0, 10))) {
    streak += 1;
    d.setDate(d.getDate() - 1);
  }
  // Workouts in the last 7 days
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekWorkouts = completed.filter((w) => new Date(w.date) >= weekAgo).length;

  return { totalWorkouts: completed.length, totalSets, totalVolume, streak, weekWorkouts };
}

/* ---------- Workout templates: one-tap start ---------- */

export interface Template {
  name: string;
  exercises: string[];
}

export const TEMPLATES: Template[] = [
  { name: "Push Day", exercises: ["Bench Press", "Overhead Press", "Triceps Pushdown"] },
  { name: "Pull Day", exercises: ["Deadlift", "Lat Pulldown", "Barbell Curl"] },
  { name: "Leg Day", exercises: ["Squat", "Leg Press", "Leg Curl"] },
  { name: "Full Body", exercises: ["Squat", "Bench Press", "Barbell Row"] },
];
