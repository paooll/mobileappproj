import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
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
  orderBy,
  limit,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "./firebase";

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

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: string;
}

export interface Stats {
  totalWorkouts: number;
  totalSets: number;
  totalVolume: number;
  streak: number;
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

/* ---------- Exercise catalog ---------- */

const CATALOG: [string, string, string][] = [
  ["Bench Press", "Chest", "Barbell"],
  ["Incline Dumbbell Press", "Chest", "Dumbbell"],
  ["Push-Up", "Chest", "Bodyweight"],
  ["Cable Fly", "Chest", "Cable"],
  ["Deadlift", "Back", "Barbell"],
  ["Barbell Row", "Back", "Barbell"],
  ["Lat Pulldown", "Back", "Cable"],
  ["Pull-Up", "Back", "Bodyweight"],
  ["Overhead Press", "Shoulders", "Barbell"],
  ["Lateral Raise", "Shoulders", "Dumbbell"],
  ["Face Pull", "Shoulders", "Cable"],
  ["Squat", "Legs", "Barbell"],
  ["Leg Press", "Legs", "Machine"],
  ["Romanian Deadlift", "Legs", "Barbell"],
  ["Lunge", "Legs", "Dumbbell"],
  ["Leg Curl", "Legs", "Machine"],
  ["Calf Raise", "Legs", "Machine"],
  ["Barbell Curl", "Arms", "Barbell"],
  ["Hammer Curl", "Arms", "Dumbbell"],
  ["Tricep Pushdown", "Arms", "Cable"],
  ["Skullcrusher", "Arms", "Barbell"],
  ["Plank", "Core", "Bodyweight"],
  ["Hanging Leg Raise", "Core", "Bodyweight"],
  ["Cable Crunch", "Core", "Cable"],
  ["Russian Twist", "Core", "Bodyweight"],
];

/** Idempotent: fills the catalog doc once per project. */
export async function ensureExerciseCatalog() {
  const metaRef = doc(db, "meta", "exerciseCatalog");
  const meta = await getDoc(metaRef);
  if (meta.exists()) return;
  const batch = [...CATALOG.map(async ([name, muscleGroup, equipment]) => {
    await addDoc(collection(db, "exercises"), { name, muscleGroup, equipment });
  })];
  await Promise.all(batch);
  await setDoc(metaRef, { seeded: true });
}

export async function listExercises(): Promise<Exercise[]> {
  const snap = await getDocs(collection(db, "exercises"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Exercise);
}

/* ---------- Workouts ---------- */

function today() {
  return new Date().toISOString().slice(0, 10);
}

export async function startWorkout(userId: string, name: string): Promise<string> {
  // Resume if an unfinished workout exists
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

export async function getWorkout(id: string): Promise<(Workout & { sets: WorkoutSet[] }) | null> {
  const ref = doc(db, "workouts", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() as Omit<Workout, "id">;
  const setsSnap = await getDocs(
    query(collection(db, "workouts", id, "sets"), orderBy("order"))
  );
  const sets = setsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as WorkoutSet);
  return { id: snap.id, ...data, sets };
}

export async function listWorkouts(userId: string): Promise<Workout[]> {
  const snap = await getDocs(
    query(
      collection(db, "workouts"),
      where("userId", "==", userId),
      orderBy("createdAt", "desc")
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Workout);
}

export async function getActiveWorkout(userId: string): Promise<Workout | null> {
  const snap = await getDocs(
    query(
      collection(db, "workouts"),
      where("userId", "==", userId),
      where("completed", "==", false),
      limit(1)
    )
  );
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as Workout;
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

export async function getStats(userId: string): Promise<Stats> {
  const workouts = await listWorkouts(userId);
  const completed = workouts.filter((w) => w.completed);
  let totalSets = 0;
  let totalVolume = 0;
  await Promise.all(
    completed.map(async (w) => {
      const setsSnap = await getDocs(collection(db, "workouts", w.id, "sets"));
      for (const d of setsSnap.docs) {
        const s = d.data() as { weight: number; reps: number };
        totalSets += 1;
        totalVolume += s.weight * s.reps;
      }
    })
  );
  const dates = new Set(completed.map((w) => w.date));
  let streak = 0;
  const d = new Date();
  if (!dates.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1);
  while (dates.has(d.toISOString().slice(0, 10))) {
    streak += 1;
    d.setDate(d.getDate() - 1);
  }
  return {
    totalWorkouts: completed.length,
    totalSets,
    totalVolume,
    streak,
  };
}
