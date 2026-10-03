import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";

/** How long the athlete has been training seriously. */
export type Experience = "new" | "some" | "regular" | "years";

/** What they are training for. Drives the copy on Today. */
export type Goal = "strength" | "muscle" | "endurance" | "general";

/** Smallest plate increment the athlete actually owns. */
export const ROUNDING_OPTIONS = [0.5, 1, 2.5] as const;
export type Rounding = (typeof ROUNDING_OPTIONS)[number];

/** Preferences that tune how the app behaves, kept apart from the setup answers. */
export interface UserPrefs {
  /** Buzz on step taps and when rest ends. */
  haptics: boolean;
  /** Show the progressive overload coach above the logging bar. */
  coach: boolean;
  /** Snap weights to the nearest increment when they are typed or logged. */
  roundTo: Rounding;
  /** Send the Monday progress digest by email. */
  weeklyDigest: boolean;
  /** 0 = Sunday. Only meaningful when weeklyDigest is on. */
  digestDay: number;
  /** Name shown instead of the email address where there is room. */
  displayName: string;
}

export interface UserProfile extends UserPrefs {
  experience: Experience;
  goal: Goal;
  daysPerWeek: number;
  equipment: string[];
  unit: "kg" | "lb";
  /**
   * Hours east of UTC where the athlete was when they set it up. The digest job
   * needs it because "Monday" means the athlete's Monday, not the server's.
   */
  tzOffset: number;
  onboardedAt: unknown;
}

/** Whole hours east of UTC on this device, e.g. -5 in New York, +13 in Auckland. */
export function localTimezoneOffset(): number {
  return -new Date().getTimezoneOffset() / 60;
}

export const DEFAULT_PREFS: UserPrefs = {
  haptics: true,
  coach: true,
  roundTo: 2.5,
  weeklyDigest: false,
  digestDay: 1,
  displayName: "",
};

export const EXPERIENCE_OPTIONS: { value: Experience; label: string; hint: string }[] = [
  { value: "new", label: "Just starting", hint: "New to lifting, or returning after a long break" },
  { value: "some", label: "A few months in", hint: "You know the basics and can control the weight" },
  { value: "regular", label: "Consistently training", hint: "Weeks are programmed and you track your numbers" },
  { value: "years", label: "Years of it", hint: "You read programs and think in progressions" },
];

/** Weekday the progress digest goes out, matching Date#getDay (0 = Sunday). */
export const DIGEST_DAYS: { value: number; label: string; name: string }[] = [
  { value: 1, label: "Mon", name: "Monday" },
  { value: 2, label: "Tue", name: "Tuesday" },
  { value: 3, label: "Wed", name: "Wednesday" },
  { value: 4, label: "Thu", name: "Thursday" },
  { value: 5, label: "Fri", name: "Friday" },
  { value: 6, label: "Sat", name: "Saturday" },
  { value: 0, label: "Sun", name: "Sunday" },
];

export function digestDayName(day: number): string {
  return DIGEST_DAYS.find((d) => d.value === day)?.name ?? "Monday";
}

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
 * The route guard hands the profile down to every screen, so it is cached in
 * one place and kept honest by the write helpers below. Without this a setting
 * changed on Profile would be stale everywhere else.
 */
let cache: { uid: string; profile: UserProfile } | null = null;

function primeProfileCache(uid: string, profile: UserProfile | null) {
  cache = profile ? { uid, profile } : null;
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
  const profile: UserProfile = {
    experience: d.experience as Experience,
    goal: d.goal as Goal,
    daysPerWeek: typeof d.daysPerWeek === "number" ? d.daysPerWeek : 3,
    equipment: Array.isArray(d.equipment) ? (d.equipment as string[]) : [],
    unit: d.unit === "lb" ? "lb" : "kg",
    tzOffset:
      typeof d.tzOffset === "number" && d.tzOffset >= -12 && d.tzOffset <= 14
        ? d.tzOffset
        : 0,
    onboardedAt: d.onboardedAt,
    // Every preference falls back, so documents written before a field existed
    // keep working instead of arriving as undefined
    haptics: typeof d.haptics === "boolean" ? d.haptics : DEFAULT_PREFS.haptics,
    coach: typeof d.coach === "boolean" ? d.coach : DEFAULT_PREFS.coach,
    roundTo: ROUNDING_OPTIONS.includes(d.roundTo)
      ? (d.roundTo as Rounding)
      : DEFAULT_PREFS.roundTo,
    weeklyDigest: d.weeklyDigest === true,
    digestDay:
      typeof d.digestDay === "number" && d.digestDay >= 0 && d.digestDay <= 6
        ? Math.round(d.digestDay)
        : DEFAULT_PREFS.digestDay,
    displayName: typeof d.displayName === "string" ? d.displayName : "",
  };
  primeProfileCache(uid, profile);
  return profile;
}

/**
 * Merges a slice of the profile. Everything here is a separate write so the
 * route guard's cached profile and the setup answers are never clobbered by a
 * settings toggle.
 */
export async function updateProfile(uid: string, patch: Partial<UserProfile>) {
  await setDoc(doc(db, "users", uid), patch, { merge: true });
  // Keep the shared copy current so other screens see the change immediately
  if (cache?.uid === uid) cache = { uid, profile: { ...cache.profile, ...patch } };
}

/** Just the behaviour preferences, for writes that must not touch setup answers. */
export function pickPrefs(profile: UserProfile): UserPrefs {
  return {
    haptics: profile.haptics,
    coach: profile.coach,
    roundTo: profile.roundTo,
    weeklyDigest: profile.weeklyDigest,
    digestDay: profile.digestDay,
    displayName: profile.displayName,
  };
}

/** Removes the profile document. Firebase Auth is cleared separately. */
export async function deleteProfile(uid: string) {
  await deleteDoc(doc(db, "users", uid));
}

export async function saveProfile(
  uid: string,
  profile: Omit<UserProfile, "onboardedAt" | "tzOffset">
) {
  const tzOffset = localTimezoneOffset();
  await setDoc(
    doc(db, "users", uid),
    { ...profile, tzOffset, onboardedAt: serverTimestamp() },
    { merge: true }
  );
  primeProfileCache(uid, { ...profile, tzOffset, onboardedAt: null } as UserProfile);
}

/** Initials for the avatar fallback: "Sam Smith" -> "SS", "sam@" -> "S". */
export function initialsOf(name: string, email: string): string {
  // Without a name, the email's domain is noise: "sam@x.com" should read "S".
  const source = name.trim() || email.split("@")[0] || "";
  const words = source.split(/[\s._-]+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 1).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
