import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";

/** How long the athlete has been training seriously. */
export type Experience = "new" | "some" | "regular" | "years";

/** What they are training for. Drives the copy on Today. */
export type Goal = "strength" | "muscle" | "endurance" | "general";

export interface UserProfile {
  experience: Experience;
  goal: Goal;
  daysPerWeek: number;
  equipment: string[];
  unit: "kg" | "lb";
  onboardedAt: unknown;
}

export const EXPERIENCE_OPTIONS: { value: Experience; label: string; hint: string }[] = [
  { value: "new", label: "Just starting", hint: "New to lifting, or returning after a long break" },
  { value: "some", label: "A few months in", hint: "You know the basics and can control the weight" },
  { value: "regular", label: "Consistently training", hint: "Weeks are programmed and you track your numbers" },
  { value: "years", label: "Years of it", hint: "You read programs and think in progressions" },
];

export const GOAL_OPTIONS: { value: Goal; label: string }[] = [
  { value: "strength", label: "Get stronger" },
  { value: "muscle", label: "Build muscle" },
  { value: "endurance", label: "Build endurance" },
  { value: "general", label: "Stay in shape" },
];

export const EQUIPMENT_OPTIONS = [
  "Barbell",
  "Dumbbell",
  "Machine",
  "Cable",
  "Bodyweight",
  "Bands",
  "Kettlebell",
];

const GOAL_COPY: Record<Goal, string> = {
  strength: "Heavy triples, lower reps, more on the bar.",
  muscle: "More sets, fuller ranges, slower on the way down.",
  endurance: "Higher reps, shorter rests, keep the pace honest.",
  general: "Balanced sessions, nothing fancy.",
};

/** Line shown on Today, derived from the athlete's stated goal. */
export function goalHint(goal: Goal | undefined): string {
  return goal ? GOAL_COPY[goal] : GOAL_COPY.general;
}

/**
 * Profiles live at users/{uid}. Returns null until onboarding is completed,
 * which is what the route guard keys off.
 */
export async function loadProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  const d = snap.data();
  if (typeof d.experience !== "string") return null;
  return {
    experience: d.experience as Experience,
    goal: d.goal as Goal,
    daysPerWeek: typeof d.daysPerWeek === "number" ? d.daysPerWeek : 3,
    equipment: Array.isArray(d.equipment) ? (d.equipment as string[]) : [],
    unit: d.unit === "lb" ? "lb" : "kg",
    onboardedAt: d.onboardedAt,
  };
}

export async function saveProfile(uid: string, profile: Omit<UserProfile, "onboardedAt">) {
  await setDoc(
    doc(db, "users", uid),
    { ...profile, onboardedAt: serverTimestamp() },
    { merge: true }
  );
}
