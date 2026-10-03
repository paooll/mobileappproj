import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { CaretLeft, X, Check, Timer } from "@phosphor-icons/react";
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
import { clampReps, loadStep, quickReps, snapWeight } from "../lib/setEntry";
import { createPost } from "../lib/social";
import { setHapticsEnabled, tick } from "../lib/haptics";
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
import ExercisePicker from "../components/ExercisePicker";
import { fromDisplay, toDisplay, useUnit } from "../lib/units";
import { friendlyDate } from "../lib/progress";

// Resolved once at module load so render stays free of impure calls.
const TODAY = new Date().toISOString().slice(0, 10);

export default function ActiveWorkout({ profile }: { profile: UserProfile }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  // Moves the athlete planned on their routine, handed over by Today. Optional:
  // a session started by hand simply arrives without them.
  const planned = (location.state as { planned?: string[] } | null)?.planned ?? [];
  const [plannedDone, setPlannedDone] = useState<number[]>([]);
  const user = useAuthUser();

  const [workout, setWorkout] = useState<(Workout & { sets: WorkoutSet[] }) | null>(
    null
  );
  const [liveSets, setLiveSets] = useState<WorkoutSet[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);

  const [picker, setPicker] = useState(false);
  // Finish is not idempotent: two taps would post the same session twice.
  const [finishing, setFinishing] = useState(false);
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
  // The athlete can turn the coach off for good, not just this session
  const coachOff = coachHidden || !profile.coach;
  const [rest, setRest] = useState<RestSettings>(DEFAULT_REST);
  // Which set the clock is resting from, kept out of the timer itself
  const [restFrom, setRestFrom] = useState("");
  const { toast } = useToast();
  const [unit] = useUnit();

  const ready = !!user && loaded?.uid === user.uid;
  const historyLoading = !!user && !ready;
  const archive = ready ? loaded.archive : null;

  // Haptics and coach visibility are preferences, so the whole screen reads them
  useEffect(() => {
    setHapticsEnabled(profile.haptics);
  }, [profile.haptics]);

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
    tick([180, 90, 180]);
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

  // Exercises already logged this session. Surfaced at the top of the picker
  // because repeating a move is the most common thing done mid-session.
  const loggedNames = useMemo(() => {
    const names = new Set<string>();
    for (const s of [...(workout?.sets ?? []), ...liveSets]) names.add(s.exerciseName);
    return Array.from(names).reverse();
  }, [workout, liveSets]);

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

  /** A finished workout is a record to read, not an editor to poke at. */
  const readOnly = !!workout?.completed;

  const startRest = (context: string) => {
    setRestFrom(context);
    timer.start();
  };

  const applySuggestion = () => {
    if (!suggestion) return;
    setWeightKg(snapWeight(suggestion.weight, profile.roundTo, unit));
    setRepsCount(suggestion.reps);
  };

  const chooseExercise = (ex: Exercise) => {
    setSelected(ex);
    setPicker(false);
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
    setWeightKg(prefill ? snapWeight(prefill.weight, profile.roundTo, unit) : 0);
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
      tick(12);
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

  const removeSetWithUndo = async (set: WorkoutSet) => {
    if (!id) return;
    try {
      await removeSet(id, set.id);
      toast(`${set.weight ? toDisplay(set.weight, unit) + " kg " : ""}${set.reps} reps removed.`, "info", {
        label: "Undo",
        onClick: () => {
          addSet(id, set.exerciseName, set.weight, set.reps, set.order).catch((err) => {
            console.error(err);
            toast("Couldn't restore that set.", "error");
          });
        },
      });
    } catch (err) {
      console.error(err);
      toast("Couldn't remove the set. Try again.", "error");
    }
  };

  const finish = async () => {
    if (!id || finishing) return;
    setFinishing(true);
    try {
      await finishWorkout(id);
    } catch (err) {
      console.error(err);
      toast("Couldn't finish the workout. Try again.", "error");
      setFinishing(false);
      return;
    }
    // Sharing never blocks the finish. The session is already saved, so a
    // failed post is a feed that stays quiet rather than a lost workout.
    try {
      await createPost({
        authorUid: user?.uid ?? "",
        authorName: profile.displayName,
        workoutName: workout?.name ?? "Workout",
        sets: sets.length,
        volumeKg: sets.reduce((sum, s) => sum + s.weight * s.reps, 0),
        date: workout?.date ?? TODAY,
      });
    } catch (err) {
      console.error(err);
    }
    toast("Workout finished. Nice work.", "success");
    navigate("/app", { replace: true });
  };

  return (
    <div
      className="min-h-[100dvh] px-5 pt-[max(env(safe-area-inset-top),24px)]"
      // Leave room for the sticky logging bar, measured live so the coach strip,
      // rest clock and picker can all change height without covering the list
      style={{
        paddingBottom: readOnly
          ? "calc(84px + env(safe-area-inset-bottom) + 24px)"
          : `calc(${barHeight}px + 84px + env(safe-area-inset-bottom) + 24px)`,
      }}
    >
      <header className="flex items-center justify-between">
        <button
          onClick={() => {
            // Always lands somewhere real, even if opened straight from a link
            if (window.history.length > 1) navigate(-1);
            else navigate("/app");
          }}
          className="tab -ml-2 flex min-h-[44px] items-center gap-0.5 rounded-xl pr-2 text-[15px] font-medium text-[var(--ink-2)] transition-opacity active:opacity-60"
        >
          <CaretLeft size={18} weight="bold" /> Back
        </button>
        {!readOnly && (
          <button
            onClick={finish}
            disabled={finishing}
            className="tab flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[var(--ink)] px-4 text-[14px] font-semibold text-[var(--bg)] transition-transform active:scale-[0.97] disabled:opacity-60"
          >
            <Check size={15} weight="bold" /> {finishing ? "Finishing…" : "Finish"}
          </button>
        )}
      </header>

      <h1 className="mt-3 text-[30px] font-bold tracking-[-0.02em]">{name}</h1>
      <p className="label mt-1 normal-case">
        {readOnly
          ? `${friendlyDate(workout?.date ?? TODAY)} · ${sets.length} ${
              sets.length === 1 ? "set" : "sets"
            } logged`
          : `${sets.length} ${sets.length === 1 ? "set" : "sets"} · updates live`}
      </p><div className="mt-7 flex flex-col gap-4">
        {grouped.map(([exName, exSets]) => (
          <div key={exName} className="panel p-4">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="min-w-0 truncate text-[16px] font-semibold">{exName}</h3>
              <span className="label shrink-0">{exSets.length} sets</span>
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
                      {s.weight > 0 ? (
                        <>
                          {toDisplay(s.weight, unit)}
                          <span className="ml-0.5 text-[12px] font-medium text-[var(--ink-3)]">
                            {unit}
                          </span>
                          <span className="mx-2 text-[var(--ink-3)]">×</span>
                        </>
                      ) : (
                        <span className="mr-2 text-[var(--ink-3)]">Bodyweight</span>
                      )}
                      {s.reps}
                      <span className="ml-0.5 text-[12px] font-medium text-[var(--ink-3)]">
                        reps
                      </span>
                    </span>
                    {!readOnly && (
                      <button
                        onClick={() => removeSetWithUndo(s)}
                        className="tab flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--ink-3)] transition-colors active:bg-[var(--line)] active:text-[var(--ink)]"
                        aria-label={`Remove set ${i + 1} of ${exName}`}
                      >
                        <X size={15} />
                      </button>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        ))}
      </div>

      {readOnly && sets.length === 0 && (
        <div className="panel mt-7 px-6 py-10 text-center">
          <p className="max-w-[28ch] text-[14px] leading-relaxed text-[var(--ink-2)]">
            This session was finished without any sets logged.
          </p>
        </div>
      )}

      {/* Sticky logging bar, with the rest clock stacked above it. A finished
          session has nothing to log, so the bar is not rendered at all. */}
      {!readOnly && (
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
            <ExercisePicker
              exercises={exercises}
              equipment={profile.equipment}
              lastFor={lastFor}
              recentNames={loggedNames}
              recentLabel="Already in this workout"
              formatWeight={(kg) => String(toDisplay(kg, unit))}
              unit={unit}
              onChoose={chooseExercise}
              onInspect={setDetailEx}
            />
          ) : (
            <>
              {planned.length > 0 && (
                <div className="mb-3">
                  <div className="mb-1.5 flex items-baseline justify-between gap-2">
                    <p className="label">Planned</p>
                    <p className="num text-[12px] text-[var(--ink-3)]">
                      {plannedDone.length} of {planned.length}
                    </p>
                  </div>
                  <div className="-mx-1 flex gap-1.5 overflow-x-auto overscroll-x-contain px-1 pb-1">
                    {planned.map((name, i) => {
                      const ex = exercises.find((e) => e.name === name) ?? null;
                      const done = plannedDone.includes(i);
                      return (
                        <button
                          key={`${name}-${i}`}
                          disabled={!ex}
                          onClick={() => {
                            if (!ex) return;
                            setPlannedDone((prev) =>
                              prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]
                            );
                            chooseExercise(ex);
                          }}
                          aria-pressed={done}
                          className="btn-quiet shrink-0"
                          style={
                            done ? { background: "var(--ink)", color: "var(--bg)" } : undefined
                          }
                        >
                          {ex ? name : `${name} (not in catalog)`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
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
              {selected && !coachOff && (
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
                  onChange={(v) =>
                    setWeightKg(snapWeight(fromDisplay(v, unit), profile.roundTo, unit))
                  }
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
                      aria-label={`${r} reps`}
                      className={`btn-quiet num px-0 ${lastSet ? "w-11 shrink-0" : "flex-1"}`}
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
      )}

      <AnimatePresence>
        {detailEx && <ExerciseDetail exercise={detailEx} onClose={() => setDetailEx(null)} />}
      </AnimatePresence>
    </div>
  );
}
