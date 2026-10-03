import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { CaretLeft, X, Check, MagnifyingGlass, Info, Timer } from "@phosphor-icons/react";
import {
  getWorkout,
  loadExercises,
  loadRecentArchive,
  addSet,
  removeSet,
  finishWorkout,
  subscribeSets,
  type Workout,
  type WorkoutSet,
  type Exercise,
} from "../lib/data";
import {
  buildCoachIndex,
  referenceWeight,
  suggestNext,
  type CoachSession,
  type RecentArchive,
} from "../lib/coach";
import { clampReps, loadStep, quickReps } from "../lib/setEntry";
import type { UserProfile } from "../lib/profile";
import { useAuthUser } from "../hooks/useAuthUser";
import { useToast } from "../components/Toast";
import { useRestTimer } from "../hooks/useRestTimer";
import { DEFAULT_REST, formatRest, loadRestSettings, type RestSettings } from "../lib/restTimer";
import CoachHint from "../components/CoachHint";
import RepeatSet from "../components/RepeatSet";
import Stepper from "../components/Stepper";
import RestTimerStrip from "../components/RestTimer";
import ExerciseDetail from "../components/ExerciseDetail";
import { fromDisplay, toDisplay, useUnit } from "../lib/units";

// Resolved once at module load so render stays free of impure calls.
const TODAY = new Date().toISOString().slice(0, 10);

export default function ActiveWorkout({ profile }: { profile: UserProfile }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthUser();

  const [workout, setWorkout] = useState<(Workout & { sets: WorkoutSet[] }) | null>(
    null
  );
  const [liveSets, setLiveSets] = useState<WorkoutSet[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);

  const [picker, setPicker] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Exercise | null>(null);
  // Weight is kept in kilograms, the same unit Firestore stores. Reps are a count.
  const [weightKg, setWeightKg] = useState(0);
  const [repsCount, setRepsCount] = useState(0);
  // Measured so the page always clears the logging bar, whatever it currently holds
  const barRef = useRef<HTMLDivElement>(null);
  const [barHeight, setBarHeight] = useState(180);
  const [detailEx, setDetailEx] = useState<Exercise | null>(null);
  // Keyed by uid so a sign-out or account switch shows the loading state again
  const [loaded, setLoaded] = useState<{ uid: string; archive: RecentArchive | null } | null>(null);
  const [coachHidden, setCoachHidden] = useState(false);
  const [rest, setRest] = useState<RestSettings>(DEFAULT_REST);
  // Which set the clock is resting from, kept out of the timer itself
  const [restFrom, setRestFrom] = useState("");
  const { toast } = useToast();
  const [unit] = useUnit();

  const ready = !!user && loaded?.uid === user.uid;
  const historyLoading = !!user && !ready;
  const archive = ready ? loaded.archive : null;

  // The logging bar changes height as the coach strip and picker come and go, so
  // measure it rather than guessing with a stack of magic numbers.
  useEffect(() => {
    const el = barRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const next = el.getBoundingClientRect().height;
      if (next > 0) setBarHeight(Math.round(next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Coach history: one bounded, cached read, then derived in memory
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    loadRecentArchive(user.uid)
      .then((a) => {
        if (!cancelled) setLoaded({ uid: user.uid, archive: a });
      })
      .catch(() => {
        // The coach is an assist, never a blocker. Without history it just asks for a baseline.
        if (!cancelled) setLoaded({ uid: user.uid, archive: null });
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Rest preferences: one cached read, then local
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

  const onRestDone = useCallback(() => {
    // A buzz plus a toast, because the screen may be face down mid set
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate?.([180, 90, 180]);
      } catch {
        /* vibration is a nicety, never a failure */
      }
    }
    toast("Rest over. Next set when you're ready.", "success");
  }, [toast]);

  const timer = useRestTimer(rest.seconds, onRestDone);

  // Load workout + exercise catalog once
  useEffect(() => {
    if (!id) return;
    getWorkout(id).then((w) => w && setWorkout(w));
    loadExercises().then(setExercises);
  }, [id]);

  // Realtime sets — updates the moment a set is added from any device
  useEffect(() => {
    if (!id) return;
    return subscribeSets(id, setLiveSets);
  }, [id]);

  // Stable identity keeps the derived memos below from re-running every render
  const sets = useMemo(
    () => (liveSets.length > 0 ? liveSets : (workout?.sets ?? [])),
    [liveSets, workout]
  );

  const grouped = useMemo(() => {
    const map = new Map<string, WorkoutSet[]>();
    for (const s of sets) {
      const arr = map.get(s.exerciseName) ?? [];
      arr.push(s);
      map.set(s.exerciseName, arr);
    }
    return [...map.entries()];
  }, [sets]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return exercises.slice(0, 40);
    return exercises
      .filter((e) => e.name.toLowerCase().includes(q))
      .slice(0, 40);
  }, [exercises, search]);

  // One pass over the archive: heaviest set per exercise + per exercise sessions
  const coachIndex = useMemo(() => buildCoachIndex(archive), [archive]);

  const lastFor = (name: string) => coachIndex.last.get(name) ?? null;

  /** Past sessions for the selected exercise, most recent first, this session on top. */
  const history = useMemo<CoachSession[]>(() => {
    if (!selected) return [];
    const past = coachIndex.history.get(selected.name) ?? [];
    const today: CoachSession = {
      date: workout?.date ?? TODAY,
      sets: sets
        .filter((s) => s.exerciseName === selected.name)
        .map((s) => ({ weight: s.weight, reps: s.reps })),
    };
    return today.sets.length > 0 ? [today, ...past] : past;
  }, [selected, coachIndex, sets, workout?.date]);

  const suggestion = useMemo(() => {
    if (!selected) return null;
    return suggestNext({
      history,
      goal: profile.goal,
      experience: profile.experience,
      equipment: selected.equipment,
    });
  }, [selected, history, profile.goal, profile.experience]);

  /** Smallest jump that means something on this bar, in the unit being read. */
  const step = useMemo(
    () => loadStep(selected?.equipment, profile.experience, unit),
    [selected, profile.experience, unit]
  );

  /** Reps worth one tap, from the athlete's goal window. */
  const repChips = useMemo(() => quickReps(profile.goal), [profile.goal]);

  /** Newest set for the selected exercise: this session first, then the gym record. */
  const lastSet = useMemo(() => {
    if (!selected) return null;
    const inSession = sets.filter((s) => s.exerciseName === selected.name);
    return inSession.length > 0
      ? { weight: inSession[inSession.length - 1].weight, reps: inSession[inSession.length - 1].reps }
      : (coachIndex.last.get(selected.name) ?? null);
  }, [selected, sets, coachIndex]);

  const startRest = (context: string) => {
    setRestFrom(context);
    timer.start();
  };

  const applySuggestion = () => {
    if (!suggestion) return;
    setWeightKg(suggestion.weight);
    setRepsCount(suggestion.reps);
  };

  const chooseExercise = (ex: Exercise) => {
    setSelected(ex);
    setPicker(false);
    setSearch("");
    setCoachHidden(false);
    // Prefill from the coach when it has something to say, else the best on record
    const next = suggestNext({
      history: coachIndex.history.get(ex.name) ?? [],
      goal: profile.goal,
      experience: profile.experience,
      equipment: ex.equipment,
    });
    const fallback = coachIndex.last.get(ex.name) ?? null;
    const prefill = next ?? fallback;
    setWeightKg(prefill ? prefill.weight : 0);
    setRepsCount(prefill ? prefill.reps : (repChips[1] ?? 8));
  };

  if (!workout && liveSets.length === 0) {
    return (
      <div className="px-5 pt-[max(env(safe-area-inset-top),48px)]">
        <div className="h-9 w-44 animate-pulse rounded-xl bg-[var(--fill)]" />
        <div className="mt-6 h-32 animate-pulse rounded-[14px] bg-[var(--fill)]" />
      </div>
    );
  }

  const name = workout?.name ?? "Workout";

  const add = async () => {
    if (!id || !selected) return;
    const r = Math.round(repsCount);
    if (!isFinite(weightKg) || weightKg < 0 || !Number.isFinite(r) || r < 1) {
      toast("Enter a valid weight and at least 1 rep.", "error");
      return;
    }
    try {
      await addSet(id, selected.name, weightKg, r);
      // The steppers stay put: the next set is usually the same or one jump up,
      // and the coach recalculates against what was just logged
      if (rest.autoStart) {
        startRest(
          `${selected.name} · set ${sets.filter((s) => s.exerciseName === selected.name).length + 1}`
        );
      }
    } catch (err) {
      console.error(err);
      toast("Couldn't save the set. Check your connection.", "error");
    }
  };

  const finish = async () => {
    if (!id) return;
    try {
      await finishWorkout(id);
      toast("Workout finished. Nice work! 💪", "success");
      navigate("/app", { replace: true });
    } catch (err) {
      console.error(err);
      toast("Couldn't finish the workout. Try again.", "error");
    }
  };

  return (
    <div
      className="min-h-[100dvh] px-5 pt-[max(env(safe-area-inset-top),24px)]"
      // Leave room for the sticky logging bar, measured live so the coach strip,
      // rest clock and picker can all change height without covering the list
      style={{
        paddingBottom: `calc(${barHeight}px + 84px + env(safe-area-inset-bottom) + 24px)`,
      }}
    >
      <header className="flex items-center justify-between">
        <button
          onClick={() => navigate("/app")}
          className="tab flex items-center gap-0.5 text-[15px] font-medium text-[var(--ink-2)] transition-opacity active:opacity-60"
        >
          <CaretLeft size={18} weight="bold" /> Today
        </button>
        <button
          onClick={finish}
          className="tab flex items-center gap-1.5 rounded-xl bg-[var(--ink)] px-4 text-[14px] font-semibold text-[var(--bg)] transition-transform active:scale-[0.97]"
          style={{ height: 40 }}
        >
          <Check size={15} weight="bold" /> Finish
        </button>
      </header>

      <h1 className="mt-5 text-[30px] font-bold tracking-[-0.02em]">{name}</h1>
      <p className="label mt-1 normal-case">
        {sets.length} {sets.length === 1 ? "set" : "sets"} · updates live
      </p>

      <div className="mt-7 flex flex-col gap-4">
        {grouped.map(([exName, exSets]) => (
          <div key={exName} className="panel p-4">
            <div className="flex items-baseline justify-between">
              <h3 className="text-[16px] font-semibold">{exName}</h3>
              <span className="label">{exSets.length} sets</span>
            </div>
            <div className="mt-3 flex flex-col gap-1.5">
              <AnimatePresence initial={false}>
                {exSets.map((s, i) => (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 48 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25 }}
                    className="flex items-center justify-between overflow-hidden rounded-xl bg-[var(--fill)] px-4"
                  >
                    <span className="label w-6">{i + 1}</span>
                    <span className="num text-[17px] font-semibold">
                      {toDisplay(s.weight, unit)}
                      <span className="ml-0.5 text-[12px] font-medium text-[var(--ink-3)]">
                        {unit}
                      </span>
                      <span className="mx-2 text-[var(--ink-3)]">×</span>
                      {s.reps}
                      <span className="ml-0.5 text-[12px] font-medium text-[var(--ink-3)]">reps</span>
                    </span>
                    <button
                      onClick={() => {
                        if (id)
                          removeSet(id, s.id).catch(() =>
                            toast("Couldn't remove the set. Try again.", "error")
                          );
                      }}
                      className="tab p-2 text-[var(--ink-3)] transition-colors active:text-[var(--ink)]"
                      aria-label="Remove set"
                    >
                      <X size={15} />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        ))}
      </div>

      {/* Sticky logging bar, with the rest clock stacked above it */}
      <div
        ref={barRef}
        className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+84px)] z-30 px-5"
      >
        <AnimatePresence>
          {timer.totalMs > 0 && (
            <RestTimerStrip
              remainingMs={timer.remainingMs}
              totalMs={timer.totalMs}
              running={timer.running}
              context={restFrom || "Rest between sets"}
              onPause={timer.pause}
              onResume={timer.resume}
              onAdd={() => timer.addSeconds(30)}
              onDismiss={timer.dismiss}
            />
          )}
        </AnimatePresence>
        <div className="glass mx-auto w-full max-w-md p-3 shadow-[var(--shadow-panel)]">
          {picker ? (
            <div>
              <div className="relative">
                <MagnifyingGlass
                  size={16}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--ink-3)]"
                />
                <input
                  autoFocus
                  className="field pl-10"
                  placeholder="Search 876 exercises"
                  enterKeyHint="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="mt-2 max-h-56 overflow-y-auto overscroll-contain">
                {filtered.map((e) => {
                  const last = lastFor(e.name);
                  return (
                    <div
                      key={e.id}
                      className="flex items-center justify-between rounded-lg px-3 transition-colors active:bg-[var(--fill)]"
                    >
                      <button
                        onClick={() => chooseExercise(e)}
                        className="tab min-w-0 flex-1 py-2.5 text-left"
                      >
                        <span className="block truncate text-[15px]">{e.name}</span>
                        {last && (
                          <span className="num block text-[12px] text-[var(--ink-3)]">
                            last {toDisplay(last.weight, unit)} {unit} × {last.reps}
                          </span>
                        )}
                      </button>
                      <span className="label ml-2 shrink-0">{e.muscleGroup}</span>
                      <button
                        onClick={() => setDetailEx(e)}
                        className="tab shrink-0 p-2 text-[var(--ink-3)] transition-colors active:text-[var(--ink)]"
                        aria-label={`How to do ${e.name}`}
                      >
                        <Info size={15} />
                      </button>
                    </div>
                  );
                })}
                {filtered.length === 0 && (
                  <p className="py-6 text-center text-[14px] text-[var(--ink-3)]">
                    No exercises match “{search}”
                  </p>
                )}
              </div>
            </div>
          ) : (
            <>
              <button
                onClick={() => setPicker(true)}
                className="tab flex w-full items-center justify-between rounded-xl bg-[var(--fill)] px-4 text-left"
                style={{ height: 44 }}
              >
                <span
                  className={`truncate pr-2 text-[15px] ${selected ? "font-medium" : "text-[var(--ink-3)]"}`}
                >
                  {selected ? selected.name : "Choose exercise"}
                </span>
                <span className="label ml-2 shrink-0">
                  {selected?.muscleGroup ?? "Tap to pick"}
                </span>
              </button>
              {selected && !coachHidden && (
                <div className="mt-2">
                  <CoachHint
                    loading={historyLoading}
                    hasHistory={history.length > 0}
                    suggestion={suggestion}
                    unit={unit}
                    compareWeight={referenceWeight(history)}
                    onUse={applySuggestion}
                    onDismiss={() => setCoachHidden(true)}
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Stepper
                  label="Weight"
                  value={toDisplay(weightKg, unit)}
                  step={step}
                  onChange={(v) => setWeightKg(fromDisplay(v, unit))}
                  suffix={unit}
                  disabled={!selected}
                />
                <Stepper
                  label="Reps"
                  value={repsCount}
                  step={1}
                  onChange={(v) => setRepsCount(clampReps(v))}
                  disabled={!selected}
                />
              </div>
              {selected && (
                <div className="mt-2 flex items-center gap-2">
                  <RepeatSet
                    last={lastSet}
                    unit={unit}
                    onRepeat={(w, r) => {
                      setWeightKg(w);
                      setRepsCount(r);
                    }}
                  />
                  {repChips.map((r) => (
                    <button
                      key={r}
                      onClick={() => setRepsCount(r)}
                      aria-pressed={repsCount === r}
                      className={`btn-quiet num px-0 ${lastSet ? "w-10 shrink-0" : "flex-1"}`}
                      style={repsCount === r ? { background: "var(--ink)", color: "var(--bg)" } : undefined}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              )}
              <button
                className="btn-solid mt-2 w-full"
                disabled={!selected || repsCount < 1}
                style={selected && repsCount >= 1 ? undefined : { opacity: 0.4 }}
                onClick={add}
              >
                Log set
              </button>
              {/* With auto start off the clock needs somewhere to be started by hand */}
              {!rest.autoStart && (
                <button
                  onClick={() => startRest(selected?.name ?? "Rest between sets")}
                  className="btn-quiet mx-auto mt-2"
                >
                  <Timer size={14} weight="bold" /> Rest {formatRest(rest.seconds * 1000)}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <AnimatePresence>
        {detailEx && <ExerciseDetail exercise={detailEx} onClose={() => setDetailEx(null)} />}
      </AnimatePresence>
    </div>
  );
}
