import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: string;
}

const DATASET_URL =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";

const MUSCLE_LABELS: Record<string, string> = {
  abdominals: "Abs",
  abductors: "Hips",
  adductors: "Hips",
  biceps: "Arms",
  calves: "Legs",
  chest: "Chest",
  forearms: "Arms",
  glutes: "Legs",
  hamstrings: "Legs",
  lats: "Back",
  "lower back": "Back",
  "middle back": "Back",
  neck: "Neck",
  quadriceps: "Legs",
  shoulders: "Shoulders",
  traps: "Back",
  triceps: "Arms",
};

const EQUIPMENT_LABELS: Record<string, string> = {
  barbell: "Barbell",
  dumbbell: "Dumbbell",
  "body only": "Bodyweight",
  cable: "Cable",
  machine: "Machine",
  kettlebells: "Kettlebell",
  bands: "Bands",
  "medicine ball": "Medicine Ball",
  "exercise ball": "Exercise Ball",
  "e-z curl bar": "EZ Bar",
  "foam roll": "Foam Roll",
  other: "Other",
};

function label(map: Record<string, string>, raw: string | null): string {
  if (!raw) return "Other";
  return map[raw] ?? raw.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Returns the exercise catalog, fetching the open free-exercise-db dataset
 (876 exercises, public domain) on first run and caching it in Firestore.
 */
export async function ensureExerciseCatalog(): Promise<Exercise[]> {
  const metaRef = doc(db, "meta", "exerciseCatalog");
  const meta = await getDoc(metaRef);

  if (meta.exists()) {
    // Cached — read from Firestore (source of truth after first seed)
    const snap = await getDocs(collection(db, "exercises"));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Exercise);
  }

  // First run: fetch the open dataset
  const res = await fetch(DATASET_URL);
  if (!res.ok) throw new Error("Failed to load exercise dataset");
  const raw: {
    id: string;
    name: string;
    equipment: string | null;
    primaryMuscles: string[];
  }[] = await res.json();

  const exercises: Exercise[] = raw
    .map((e) => ({
      id: e.id,
      name: e.name,
      equipment: label(EQUIPMENT_LABELS, e.equipment),
      muscleGroup:
        e.primaryMuscles.length > 0
          ? label(MUSCLE_LABELS, e.primaryMuscles[0])
          : "Full Body",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Batch-write (500 docs per batch limit)
  for (let i = 0; i < exercises.length; i += 400) {
    const batch = writeBatch(db);
    for (const ex of exercises.slice(i, i + 400)) {
      batch.set(doc(collection(db, "exercises"), ex.id), ex);
    }
    await batch.commit();
  }
  await setDoc(metaRef, { seeded: true, count: exercises.length });
  return exercises;
}
