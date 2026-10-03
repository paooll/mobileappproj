import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  SignOut,
  DownloadSimple,
  Trophy,
  Check,
  PencilSimple,
  ChartLine,
  Camera,
  Trash,
  EnvelopeSimple,
  Key,
  ShieldCheck,
  FloppyDisk,
  GoogleLogo,
} from "@phosphor-icons/react";
import ThemeToggle from "../components/ThemeToggle";
import Switch from "../components/Switch";
import SegmentedControl from "../components/SegmentedControl";
import Avatar from "../components/Avatar";
import ConfirmSheet from "../components/ConfirmSheet";
import PasswordSheet from "../components/PasswordSheet";
import {
  signOut,
  computeStats,
  computePersonalRecords,
  loadArchive,
  type Workout,
  type WorkoutSet,
} from "../lib/data";
import { useAuthUser } from "../hooks/useAuthUser";
import { useToast } from "../components/Toast";
import { formatVolume, toDisplay, useUnit, type Unit } from "../lib/units";
import {
  DEFAULT_REST,
  REST_PRESETS,
  formatRest,
  loadRestSettings,
  saveRestSettings,
  type RestSettings,
} from "../lib/restTimer";
import {
  DIGEST_DAYS,
  EXPERIENCE_OPTIONS,
  GOAL_OPTIONS,
  ROUNDING_OPTIONS,
  digestDayName,
  initialsOf,
  localTimezoneOffset,
  updateProfile,
  type UserProfile,
} from "../lib/profile";
import { setHapticsEnabled } from "../lib/haptics";
import {
  authMethodOf,
  deleteAccount,
  friendlyAccountError,
  sendReset,
} from "../lib/account";
import { loadAvatar, removeAvatar, uploadAvatar } from "../lib/avatar";
import { friendlyDate } from "../lib/progress";
import RoutinesSection from "../components/RoutinesSection";

const UNIT_OPTIONS: Unit[] = ["kg", "lb"];

/** "45s", "2m", "1m 30s". Reads better than "1.5m" on a small chip. */
function restLabel(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <h2 className="label mt-10 mb-3">{title}</h2>
      {children}
    </>
  );
}

/** A setting with its explanation on the left and the control on the right. */
function SettingRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="panel flex items-center justify-between gap-4 p-4">
      <div className="min-w-0">
        <p className="text-[15px] font-medium">{label}</p>
        <p className="mt-0.5 text-[13px] leading-snug text-[var(--ink-2)]">{hint}</p>
      </div>
      {children}
    </div>
  );
}

/** A setting whose control sits under its explanation, because it is wide. */
function SettingBlock({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="panel p-4">
      <p className="text-[15px] font-medium">{label}</p>
      <p className="mt-0.5 text-[13px] leading-snug text-[var(--ink-2)]">{hint}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

export default function Profile({ profile }: { profile: UserProfile }) {
  const user = useAuthUser();
  const navigate = useNavigate();
  const { toast } = useToast();
  const reduce = useReducedMotion();
  const [unit, setUnit] = useUnit();

  const [prefs, setPrefs] = useState<UserProfile>(profile);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [setsByWorkout, setSetsByWorkout] = useState<Map<string, WorkoutSet[]>>(
    new Map()
  );
  const [loading, setLoading] = useState(true);
  const [archiveError, setArchiveError] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [rest, setRest] = useState<RestSettings>(DEFAULT_REST);

  const [nameDraft, setNameDraft] = useState(profile.displayName);
  const [savingName, setSavingName] = useState(false);

  // Rest timer preferences, stored on the same profile doc
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    loadRestSettings(user.uid).then((s) => {
      if (!cancelled) setRest(s);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const [photo, setPhoto] = useState<Uint8Array | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // The photo lives in its own document, so it is fetched separately from the
  // profile the route guard already has in hand.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    loadAvatar(user.uid).then((bytes) => {
      if (!cancelled) setPhoto(bytes);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const fileRef = useRef<HTMLInputElement>(null);

  /**
   * Every preference writes optimistically and reverts on failure, so a switch
   * never sits there claiming a change the server did not accept.
   */
  const updatePref = useCallback(
    async (patch: Partial<UserProfile>) => {
      if (!user) return;
      const previous = prefs;
      setPrefs((p) => ({ ...p, ...patch }));
      try {
        await updateProfile(user.uid, patch);
        if (patch.haptics !== undefined) setHapticsEnabled(patch.haptics);
      } catch (err) {
        console.error(err);
        setPrefs(previous);
        toast("Couldn't save that setting. Try again.", "error");
      }
    },
    [prefs, user, toast]
  );

  /**
   * The digest job has no session and can only read Firestore, so the address
   * has to be on the profile document. Athletes who opted in before it was
   * stored get it written the next time they open this screen.
   */
  useEffect(() => {
    const address = user?.email;
    if (!address || !prefs.weeklyDigest || prefs.email === address) return;
    updateProfile(user.uid, { email: address })
      .then(() => {
        // updateProfile only refreshes the shared cache, so without this the
        // guard above never becomes true and the write repeats on every auth
        // token refresh.
        setPrefs((p) => (p.email === address ? p : { ...p, email: address }));
      })
      .catch((err) => {
        console.error(err);
      });
  }, [user, prefs.weeklyDigest, prefs.email]);

  const updateRest = useCallback(
    async (patch: Partial<RestSettings>) => {
      if (!user) return;
      const previous = rest;
      setRest((prev) => ({ ...prev, ...patch })); // instant feedback, revert on failure
      try {
        await saveRestSettings(user.uid, patch);
      } catch (err) {
        console.error(err);
        setRest(previous);
        toast("Couldn't save that rest setting. Try again.", "error");
      }
    },
    [rest, user, toast]
  );

  // Load the full archive once — needed for accurate stats, PRs, and export.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    setArchiveError(false);
    loadArchive(user.uid)
      .then(({ workouts: w, setsByWorkout: s }) => {
        if (cancelled) return;
        setWorkouts(w);
        setSetsByWorkout(s);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        if (cancelled) return;
        setLoading(false);
        setArchiveError(true);
        toast("Couldn't load your stats.", "error");
      });
    return () => {
      cancelled = true;
    };
  }, [user, toast]);

  const stats = useMemo(
    () => computeStats(workouts, setsByWorkout),
    [workouts, setsByWorkout]
  );
  const records = useMemo(
    () => computePersonalRecords(workouts, setsByWorkout).slice(0, 8),
    [workouts, setsByWorkout]
  );
  const volume = formatVolume(stats.totalVolume, unit);

  const displayName = prefs.displayName.trim();
  const nameLabel = displayName || user?.email || "Athlete";
  const nameDirty = nameDraft.trim() !== displayName;

  const saveName = useCallback(async () => {
    if (!user || !nameDirty) return;
    const next = nameDraft.trim().slice(0, 60);
    setSavingName(true);
    try {
      await updateProfile(user.uid, { displayName: next });
      setPrefs((p) => ({ ...p, displayName: next }));
      setNameDraft(next);
      toast("Name saved.", "success");
    } catch (err) {
      console.error(err);
      toast("Couldn't save your name. Try again.", "error");
    } finally {
      setSavingName(false);
    }
  }, [user, nameDirty, nameDraft, toast]);

  const handlePhoto = useCallback(
    async (file: File | undefined) => {
      if (!user || !file) return;
      setPhotoBusy(true);
      try {
        setPhoto(await uploadAvatar(user.uid, file));
        toast("Photo updated.", "success");
      } catch (err) {
        console.error(err);
        toast(err instanceof Error ? err.message : "Couldn't save that photo.", "error");
      } finally {
        setPhotoBusy(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    },
    [user, toast]
  );

  const clearPhoto = useCallback(async () => {
    if (!user) return;
    setPhotoBusy(true);
    try {
      await removeAvatar(user.uid);
      setPhoto(null);
      toast("Photo removed.", "success");
    } catch (err) {
      console.error(err);
      toast("Couldn't remove that photo. Try again.", "error");
    } finally {
      setPhotoBusy(false);
    }
  }, [user, toast]);

  const mailReset = useCallback(async () => {
    if (!user?.email) return;
    setResetBusy(true);
    try {
      await sendReset(user.email);
      toast(`Reset link sent to ${user.email}.`, "success");
    } catch (err) {
      console.error(err);
      toast(friendlyAccountError(err), "error");
    } finally {
      setResetBusy(false);
    }
  }, [user, toast]);

  const doDelete = useCallback(async () => {
    if (!user) return;
    setDeleteBusy(true);
    try {
      // Firestore rules need the caller to still own the document, so the photo goes
      // while the session that can delete it is still alive.
      await removeAvatar(user.uid);
      await deleteAccount();
      navigate("/", { replace: true });
    } catch (err) {
      console.error(err);
      toast(friendlyAccountError(err), "error");
      setDeleteBusy(false);
      setConfirmDelete(false);
    }
  }, [user, navigate, toast]);

  const exportData = useCallback(() => {
    if (exporting) return;
    setExporting(true);
    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        account: user?.email ?? null,
        displayName: displayName || null,
        unit,
        stats,
        workouts: workouts
          .filter((w) => w.completed)
          .map((w) => ({
            name: w.name,
            date: w.date,
            completedAt: w.completedAt,
            sets: (setsByWorkout.get(w.id) ?? []).map((s) => ({
              exercise: s.exerciseName,
              weightKg: s.weight,
              reps: s.reps,
            })),
          })),
        personalRecords: computePersonalRecords(workouts, setsByWorkout),
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reprange-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast("Export downloaded.", "success");
    } catch (err) {
      console.error(err);
      toast("Couldn't export your data. Try again.", "error");
    } finally {
      setExporting(false);
    }
  }, [exporting, user, displayName, unit, stats, workouts, setsByWorkout, toast]);

  const retryArchive = useCallback(() => {
    if (!user) return;
    setLoading(true);
    setArchiveError(false);
    loadArchive(user.uid)
      .then(({ workouts: w, setsByWorkout: s }) => {
        setWorkouts(w);
        setSetsByWorkout(s);
      })
      .catch((err) => {
        console.error(err);
        setArchiveError(true);
      })
      .finally(() => setLoading(false));
  }, [user]);

  const doSignOut = async () => {
    try {
      await signOut();
      navigate("/");
    } catch (err) {
      console.error(err);
      toast("Couldn't sign out. Try again.", "error");
    }
  };

  const isGoogle = user ? authMethodOf(user) === "google" : false;

  return (
    <div className="px-5 pt-[max(env(safe-area-inset-top),48px)]">
      <div className="flex items-start justify-between">
        <h1 className="text-[30px] font-bold tracking-[-0.02em]">Profile</h1>
        <ThemeToggle />
      </div>

      {/* Photo, name, and the headline numbers */}
      <div className="panel mt-6 p-5">
        <div className="flex items-center gap-4">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={photoBusy || !user}
            aria-label={photo ? "Change profile photo" : "Add a profile photo"}
            className="relative shrink-0 rounded-full transition-transform active:scale-[0.94] disabled:opacity-50"
          >
            <Avatar
              bytes={photo}
              initials={initialsOf(displayName, user?.email ?? "")}
              name={nameLabel}
            />
            <span
              className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full"
              style={{ background: "var(--surface)", color: "var(--ink-2)" }}
              aria-hidden="true"
            >
              <Camera size={13} weight="fill" />
            </span>
          </button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-semibold">{nameLabel}</p>
            {displayName && user?.email && (
              <p className="mt-0.5 truncate text-[13px] text-[var(--ink-2)]">
                {user.email}
              </p>
            )}
            <div className="mt-2 flex items-center gap-1.5">
              <button
                onClick={() => fileRef.current?.click()}
                disabled={photoBusy || !user}
                className="btn-quiet"
              >
                {photoBusy ? "Working…" : photo ? "Change" : "Add photo"}
              </button>
              {photo && (
                <button
                  onClick={clearPhoto}
                  disabled={photoBusy || !user}
                  aria-label="Remove profile photo"
                  className="btn-quiet"
                >
                  {/* Keeps the icon while disabled, so the button's accessible
                      name stays true while an upload is in flight. */}
                  <Trash size={14} weight="bold" /> Remove
                </button>
              )}
            </div>
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => handlePhoto(e.target.files?.[0])}
        />

        {loading ? (
          <div className="mt-5 grid grid-cols-3 gap-3 border-t border-[var(--line)] pt-4">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-12 animate-pulse rounded-xl bg-[var(--fill)]"
                style={{ animationDelay: `${i * 90}ms` }}
              />
            ))}
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-3 divide-x divide-[var(--line)] border-t border-[var(--line)] pt-4 text-center">
            <div>
              <p className="num text-[20px] font-semibold">{stats.streak}</p>
              <p className="label mt-0.5">Streak</p>
            </div>
            <div>
              <p className="num text-[20px] font-semibold">{stats.totalWorkouts}</p>
              <p className="label mt-0.5">Workouts</p>
            </div>
            <div>
              <p className="num text-[20px] font-semibold">
                {volume.value}
                <span className="ml-0.5 text-[11px] font-medium text-[var(--ink-3)]">
                  {volume.suffix}
                </span>
              </p>
              <p className="label mt-0.5">Volume</p>
            </div>
          </div>
        )}
      </div>

      {/* What they told us at setup */}
      <Section title="Your setup">
        <div className="panel divide-y divide-[var(--line)]">
          <div className="flex items-center justify-between px-4 py-3.5">
            <div>
              <p className="text-[15px] font-medium">
                {EXPERIENCE_OPTIONS.find((e) => e.value === profile.experience)?.label ??
                  "Experience"}
              </p>
              <p className="label mt-0.5 normal-case">Training background</p>
            </div>
          </div>
          <div className="flex items-center justify-between px-4 py-3.5">
            <div>
              <p className="text-[15px] font-medium">
                {GOAL_OPTIONS.find((g) => g.value === profile.goal)?.label ?? "Goal"}
              </p>
              <p className="label mt-0.5 normal-case">Training goal</p>
            </div>
          </div>
          <div className="flex items-center justify-between px-4 py-3.5">
            <div>
              <p className="num text-[15px] font-medium">{profile.daysPerWeek} days</p>
              <p className="label mt-0.5 normal-case">Weekly target</p>
            </div>
          </div>
          {profile.equipment.length > 0 && (
            <div className="px-4 py-3.5">
              <p className="text-[15px] font-medium">Equipment</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {profile.equipment.map((e) => (
                  <span
                    key={e}
                    className="rounded-lg px-2.5 py-1 text-[12px] font-medium"
                    style={{ background: "var(--fill)", color: "var(--ink-2)" }}
                  >
                    {e}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
        <button onClick={() => navigate("/onboarding")} className="btn-line mt-3 w-full">
          <PencilSimple size={16} /> Edit setup
        </button>
      </Section>

      {/* How logging feels, set once and then forgotten */}
      <Section title="Training defaults">
        <div className="flex flex-col gap-2">
          <div className="panel p-4">
            <label className="text-[15px] font-medium" htmlFor="display-name">
              Display name
            </label>
            <p className="mt-0.5 text-[13px] leading-snug text-[var(--ink-2)]">
              Shown instead of your email. Leave it blank to use your address.
            </p>
            <div className="mt-3 flex gap-2">
              <input
                id="display-name"
                type="text"
                value={nameDraft}
                maxLength={60}
                autoComplete="nickname"
                placeholder="e.g. Sam"
                onChange={(e) => setNameDraft(e.target.value)}
                className="field min-w-0 flex-1"
              />
              <button
                onClick={saveName}
                disabled={!nameDirty || savingName || !user}
                aria-label="Save display name"
                className="icon-btn shrink-0 disabled:opacity-40"
              >
                {savingName ? (
                  <Check size={18} className="animate-pulse" />
                ) : (
                  <FloppyDisk size={18} weight="fill" />
                )}
              </button>
            </div>
          </div>

          <SettingBlock
            label="Weight unit"
            hint="Applies everywhere, including past sessions and your export."
          >
            <SegmentedControl
              label="Weight unit"
              options={UNIT_OPTIONS.map((u) => ({ value: u, label: u }))}
              value={unit}
              onChange={setUnit}
            />
          </SettingBlock>

          <SettingBlock
            label="Round weights to"
            hint="Weights snap to the nearest increment as you log them. Match it to the smallest plate you own."
          >
            <SegmentedControl
              label="Weight increment"
              options={ROUNDING_OPTIONS.map((r) => ({ value: r, label: `${r} kg` }))}
              value={prefs.roundTo}
              onChange={(roundTo) => updatePref({ roundTo })}
            />
          </SettingBlock>

          <SettingRow
            label="Rest timer"
            hint={`Starts after every set you log. Currently ${formatRest(
              rest.seconds * 1000
            )}.`}
          >
            <Switch
              checked={rest.autoStart}
              onChange={(next) => updateRest({ autoStart: next })}
              label="Start the rest timer after every set"
            />
          </SettingRow>

          <SettingBlock
            label="Rest between sets"
            hint="Longer for heavy compounds, shorter for accessories and circuits."
          >
            <SegmentedControl
              label="Rest duration"
              options={REST_PRESETS.map((s) => ({ value: s, label: restLabel(s) }))}
              value={rest.seconds}
              onChange={(seconds) => updateRest({ seconds })}
            />
          </SettingBlock>

          <SettingRow
            label="Overload coach"
            hint="Suggests the next weight when a set goes well. Works best with a settled rest time."
          >
            <Switch
              checked={prefs.coach}
              onChange={(coach) => updatePref({ coach })}
              label="Show the progressive overload coach"
            />
          </SettingRow>

          <SettingRow
            label="Vibration"
            hint="A short buzz when a set is logged and when rest runs out."
          >
            <Switch
              checked={prefs.haptics}
              onChange={(haptics) => updatePref({ haptics })}
              label="Vibrate when a set is logged"
            />
          </SettingRow>
        </div>
      </Section>

      {/* Something to come back to on a quiet week */}
      <Section title="Reminders">
        <div className="flex flex-col gap-2">
          <SettingRow
            label="Weekly progress email"
            hint="Sessions, volume, how it compares to the week before, and your strongest sets."
          >
            <Switch
              checked={prefs.weeklyDigest}
              onChange={(weeklyDigest) =>
                updatePref({
                  weeklyDigest,
                  // The job sends on the athlete's weekday, so record where this
                  // device is the moment they ask to start hearing from us.
                  ...(weeklyDigest ? { tzOffset: localTimezoneOffset() } : {}),
                  // The job runs without a session and can only read Firestore,
                  // so the address has to travel with the opt-in.
                  ...(weeklyDigest && user?.email ? { email: user.email } : {}),
                })
              }
              label="Email me a weekly progress summary"
            />
          </SettingRow>

          <AnimatePresence initial={false}>
            {prefs.weeklyDigest && (
              <motion.div
                initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                animate={reduce ? { opacity: 1 } : { opacity: 1, height: "auto" }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                transition={{ duration: reduce ? 0 : 0.24, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden"
              >
                <div className="panel p-4">
                  <p className="text-[15px] font-medium">Send it on</p>
                  <p className="mt-0.5 text-[13px] leading-snug text-[var(--ink-2)]">
                    Sent in the morning, covering the seven days before.
                  </p>
                  <div className="mt-3">
                    <SegmentedControl
                      label="Day to send the weekly summary"
                      options={DIGEST_DAYS.map((d) => ({ value: d.value, label: d.label }))}
                      value={prefs.digestDay}
                      onChange={(digestDay) => updatePref({ digestDay })}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Section>

      <Section title="Account & security">
        <div className="flex flex-col gap-2">
          <div className="panel flex items-center justify-between gap-4 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                style={{ background: "var(--fill)", color: "var(--ink-2)" }}
                aria-hidden="true"
              >
                {isGoogle ? <GoogleLogo size={17} weight="bold" /> : <EnvelopeSimple size={17} weight="fill" />}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-medium">{user?.email ?? "Athlete"}</p>
                <p className="label mt-0.5 normal-case">
                  {isGoogle ? "Signed in with Google" : "Email and password"}
                </p>
              </div>
            </div>
          </div>

          {!isGoogle && (
            <SettingRow
              label="Change password"
              hint="Confirm your current password, then pick a new one."
            >
              <button onClick={() => setPasswordOpen(true)} className="btn-quiet shrink-0">
                <Key size={14} weight="bold" /> Change
              </button>
            </SettingRow>
          )}

          <SettingRow
            label="Password reset email"
            hint={
              isGoogle
                ? "Your Google account handles sign-in, so this link has nothing to reset."
                : `Sends a sign-in link to ${user?.email ?? "your address"}.`
            }
          >
            <button
              onClick={mailReset}
              disabled={resetBusy || !user?.email || isGoogle}
              className="btn-quiet shrink-0 disabled:opacity-40"
            >
              {resetBusy ? "Sending…" : "Send link"}
            </button>
          </SettingRow>

          <div className="panel flex items-start gap-3 p-4">
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-[var(--ink-3)]" />
            <p className="text-[13px] leading-snug text-[var(--ink-2)]">
              Your sessions live in your own account and are never shared. Export a
              copy of everything at any time.
            </p>
          </div>
        </div>
      </Section>

      {/* Their own split, not a house one */}
      <Section title="Your split">
        {user && <RoutinesSection uid={user.uid} equipment={profile.equipment} />}
      </Section>

      {/* Personal records */}
      <Section title="Personal records">
        <button
          onClick={() => navigate("/app/progress")}
          className="btn-line mb-3 w-full"
          disabled={loading}
        >
          <ChartLine size={16} /> See progress
        </button>
        {loading ? (
          <div className="panel flex flex-col gap-2 p-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-8 animate-pulse rounded-lg bg-[var(--fill)]" />
            ))}
          </div>
        ) : archiveError ? (
          <div className="panel flex flex-col items-center gap-3 px-6 py-9 text-center">
            <p className="text-[15px] font-medium">Records didn't load</p>
            <p className="max-w-[28ch] text-[13px] text-[var(--ink-2)]">
              Check your connection and try again.
            </p>
            <button onClick={retryArchive} disabled={!user} className="btn-line">
              Try again
            </button>
          </div>
        ) : records.length === 0 ? (
          <div className="panel flex flex-col items-center px-6 py-10 text-center">
            <Trophy size={22} className="text-[var(--ink-3)]" />
            <p className="mt-3 max-w-[26ch] text-[15px] text-[var(--ink-2)]">
              Log a weighted set and your heaviest lifts will show up here.
            </p>
          </div>
        ) : (
          <div className="panel divide-y divide-[var(--line)]">
            {records.map((r) => (
              <div key={r.exerciseName} className="flex items-center justify-between px-4 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-medium">{r.exerciseName}</p>
                  <p className="label mt-0.5 normal-case">
                    {friendlyDate(r.date)}
                    <span className="mx-1.5 inline-flex items-center gap-0.5 align-middle">
                      <Check size={10} weight="bold" />
                      {r.reps} reps
                    </span>
                  </p>
                </div>
                <span className="num shrink-0 text-[15px] font-semibold">
                  {toDisplay(r.weight, unit)}
                  <span className="ml-0.5 text-[11px] font-medium text-[var(--ink-3)]">
                    {unit}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Your data">
        <SettingRow
          label="Export my data"
          hint={`Download every session and set as JSON${
            unit === "kg" ? ", in kilograms" : ""
          }.`}
        >
          <button onClick={exportData} disabled={exporting || loading} className="btn-quiet shrink-0">
            {exporting ? (
              "Working…"
            ) : (
              <>
                <DownloadSimple size={15} weight="bold" /> Export
              </>
            )}
          </button>
        </SettingRow>
      </Section>

      <button
        onClick={doSignOut}
        className="btn-line mt-8 w-full text-[var(--ink-2)]"
        disabled={!user}
      >
        <SignOut size={16} /> Sign out
      </button>

      <button
        onClick={() => setConfirmDelete(true)}
        disabled={!user}
        className="mt-2 w-full py-3 text-[13px] font-medium text-[var(--danger)] disabled:opacity-40"
      >
        Delete account and data
      </button>

      <p className="mt-4 text-center text-[12px] leading-relaxed text-[var(--ink-3)]">
        {prefs.weeklyDigest
          ? `Your summary lands every ${digestDayName(prefs.digestDay).toLowerCase()} morning.`
          : "Nothing leaves this device unless you turn the weekly email on."}
      </p>

      <p className="mt-12 text-center text-[13px] text-[var(--ink-3)]">Reprange</p>

      <PasswordSheet open={passwordOpen} onClose={() => setPasswordOpen(false)} />

      <ConfirmSheet
        open={confirmDelete}
        title="Delete your account?"
        body="Every session, set and personal record goes with it, and this cannot be undone. Export first if you want a copy."
        confirmLabel="Delete it all"
        busy={deleteBusy}
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
