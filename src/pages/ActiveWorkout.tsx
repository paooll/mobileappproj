import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { CaretLeft, X, Plus, Check } from "@phosphor-icons/react";
import {
  getWorkout,
  listExercises,
  addSet,
  removeSet,
  finishWorkout,
  type Workout,
  type WorkoutSet,
  type Exercise,
} from "../lib/data";

export default function ActiveWorkout() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  const [workout, setWorkout] = useState<(Workout & { sets: WorkoutSet[] }) | null>(
    null
  );
  const [exercises, setExercises] = useState<Exercise[]>([]);

  const [exerciseName, setExerciseName] = useState("");
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [picker, setPicker] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!id) return;
    getWorkout(id).then((w) => w && setWorkout(w));
    listExercises().then(setExercises);
  }, [id]);

  const filtered = useMemo(
    () =>
      exercises.filter((e) =>
        e.name.toLowerCase().includes(search.toLowerCase())
      ),
    [exercises, search]
  );

  const grouped = useMemo(() => {
    const map = new Map<string, WorkoutSet[]>();
    for (const s of workout?.sets ?? []) {
      const arr = map.get(s.exerciseName) ?? [];
      arr.push(s);
      map.set(s.exerciseName, arr);
    }
    return [...map.entries()];
  }, [workout]);

  if (!workout) {
    return (
      <div className="px-5 pt-[max(env(safe-area-inset-top),48px)]">
        <div className="h-9 w-44 animate-pulse rounded-xl bg-[var(--fill)]" />
        <div className="mt-6 h-32 animate-pulse rounded-[14px] bg-[var(--fill)]" />
      </div>
    );
  }

  const refresh = async () => {
    if (!id) return;
    const w = await getWorkout(id);
    if (w) setWorkout(w);
  };

  const add = async () => {
    if (!id || !exerciseName || !weight || !reps) return;
    await addSet(id, exerciseName, parseFloat(weight), parseInt(reps, 10));
    setReps("");
    await refresh();
  };

  const remove = async (setId: string) => {
    if (!id) return;
    await removeSet(id, setId);
    await refresh();
  };

  const finish = async () => {
    if (!id) return;
    await finishWorkout(id);
    navigate("/app", { replace: true });
  };

  return (
    <div className="min-h-[100dvh] px-5 pb-40 pt-[max(env(safe-area-inset-top),24px)]">
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

      <h1 className="mt-5 text-[30px] font-bold tracking-[-0.02em]">
        {workout.name}
      </h1>
      <p className="label mt-1 normal-case">
        {workout.sets.length} {workout.sets.length === 1 ? "set" : "sets"} logged
      </p>

      <div className="mt-7 flex flex-col gap-4">
        {grouped.map(([name, sets]) => (
          <motion.div
            key={name}
            {...(reduce
              ? {}
              : {
                  initial: { opacity: 0, y: 10 },
                  animate: { opacity: 1, y: 0 },
                  transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const },
                })}
            className="panel p-4"
          >
            <div className="flex items-baseline justify-between">
              <h3 className="text-[16px] font-semibold">{name}</h3>
              <span className="label">{sets.length} sets</span>
            </div>
            <div className="mt-3 flex flex-col gap-1.5">
              {sets.map((s, i) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-xl bg-[var(--fill)] px-4"
                  style={{ height: 48 }}
                >
                  <span className="label w-6">{i + 1}</span>
                  <span className="num text-[17px] font-semibold">
                    {s.weight}
                    <span className="ml-0.5 text-[12px] font-medium text-[var(--ink-3)]">
                      kg
                    </span>
                    <span className="mx-2 text-[var(--ink-3)]">×</span>
                    {s.reps}
                    <span className="ml-0.5 text-[12px] font-medium text-[var(--ink-3)]">
                      reps
                    </span>
                  </span>
                  <button
                    onClick={() => remove(s.id)}
                    className="tab p-2 text-[var(--ink-3)] transition-colors active:text-[var(--ink)]"
                    aria-label="Remove set"
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+84px)] z-30 px-5">
        <div className="panel mx-auto w-full max-w-md p-3 shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
          {picker ? (
            <div>
              <input
                autoFocus
                className="field"
                placeholder="Search exercises"
                enterKeyHint="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="mt-2 max-h-56 overflow-y-auto overscroll-contain">
                {filtered.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => {
                      setExerciseName(e.name);
                      setPicker(false);
                      setSearch("");
                    }}
                    className="tab flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-[15px] transition-colors active:bg-[var(--fill)]"
                  >
                    <span>{e.name}</span>
                    <span className="label">{e.muscleGroup}</span>
                  </button>
                ))}
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
                  className={`text-[15px] ${exerciseName ? "font-medium" : "text-[var(--ink-3)]"}`}
                >
                  {exerciseName || "Choose exercise"}
                </span>
                <span className="text-[13px] font-medium">Change</span>
              </button>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <input
                  className="field num"
                  type="number"
                  inputMode="decimal"
                  placeholder="kg"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                />
                <input
                  className="field num"
                  type="number"
                  inputMode="numeric"
                  placeholder="reps"
                  value={reps}
                  onChange={(e) => setReps(e.target.value)}
                />
              </div>
              <button
                className="btn-solid mt-2 w-full"
                disabled={!exerciseName || !weight || !reps}
                style={
                  exerciseName && weight && reps ? undefined : { opacity: 0.4 }
                }
                onClick={add}
              >
                <Plus size={17} weight="bold" /> Add set
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
