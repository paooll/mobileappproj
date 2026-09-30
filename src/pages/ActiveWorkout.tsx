import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { useNavigate, useParams } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { CaretLeft, X, Plus, Check } from "@phosphor-icons/react";

export default function ActiveWorkout() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const workoutId = id as import("../convex/_generated/dataModel").Id<"workouts">;
  const workout = useQuery(api.workouts.get, { id: workoutId });
  const exercises = useQuery(api.exercises.list);
  const addSet = useMutation(api.workouts.addSet);
  const removeSet = useMutation(api.workouts.removeSet);
  const finish = useMutation(api.workouts.finish);
  const reduce = useReducedMotion();

  const [exerciseName, setExerciseName] = useState("");
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [picker, setPicker] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () =>
      (exercises ?? []).filter((e) =>
        e.name.toLowerCase().includes(search.toLowerCase())
      ),
    [exercises, search]
  );

  const grouped = useMemo(() => {
    const map = new Map<string, NonNullable<typeof workout>["sets"]>();
    for (const s of workout?.sets ?? []) {
      const arr = map.get(s.exerciseName) ?? [];
      arr.push(s);
      map.set(s.exerciseName, arr);
    }
    return [...map.entries()];
  }, [workout]);

  if (!workout) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-line border-t-ink" />
      </div>
    );
  }

  const add = async () => {
    if (!exerciseName || !weight || !reps) return;
    await addSet({
      workoutId,
      exerciseName,
      weight: parseFloat(weight),
      reps: parseInt(reps, 10),
    });
    setReps("");
  };

  const finishWorkout = async () => {
    await finish({ workoutId });
    navigate("/app", { replace: true });
  };

  return (
    <div className="min-h-[100dvh] px-5 pb-32 pt-12">
      <header className="flex items-center justify-between">
        <button
          onClick={() => navigate("/app")}
          className="flex items-center gap-0.5 text-[15px] font-medium text-spot"
        >
          <CaretLeft size={18} weight="bold" /> Today
        </button>
        <button
          onClick={finishWorkout}
          className="flex items-center gap-1.5 rounded-md bg-[#111111] px-4 py-2 text-[14px] font-medium text-white transition-transform active:scale-[0.98]"
        >
          <Check size={15} weight="bold" /> Finish
        </button>
      </header>

      <h1 className="mt-5 text-[28px] font-semibold tracking-[-0.02em]">
        {workout.name}
      </h1>
      <p className="meta mt-1 normal-case">
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
              <h3 className="text-[15px] font-semibold">{name}</h3>
              <span className="meta">{sets.length} sets</span>
            </div>
            <div className="mt-3 flex flex-col gap-1">
              {sets.map((s, i) => (
                <div
                  key={s._id}
                  className="flex items-center justify-between rounded-lg bg-bone px-3 py-2"
                >
                  <span className="meta w-6">{i + 1}</span>
                  <span className="font-mono text-[14px] font-medium">
                    {s.weight} kg × {s.reps}
                  </span>
                  <button
                    onClick={() => removeSet({ setId: s._id })}
                    className="text-ink-3 transition-colors hover:text-pale-redtext"
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

      <div className="panel mt-4 p-4">
        {picker ? (
          <div>
            <input
              autoFocus
              className="field"
              placeholder="Search exercises"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="mt-2 max-h-64 overflow-y-auto">
              {filtered.map((e) => (
                <button
                  key={e._id}
                  onClick={() => {
                    setExerciseName(e.name);
                    setPicker(false);
                    setSearch("");
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-[15px] transition-colors hover:bg-bone"
                >
                  <span>{e.name}</span>
                  <span className="meta">{e.muscleGroup}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <span className="meta">Exercise</span>
              <button
                onClick={() => setPicker(true)}
                className="flex items-center justify-between rounded-lg bg-bone px-3.5 py-3 text-left"
              >
                <span
                  className={`text-[15px] ${exerciseName ? "font-medium text-ink" : "text-ink-3"}`}
                >
                  {exerciseName || "Choose exercise"}
                </span>
                <span className="text-[13px] font-medium text-spot">Change</span>
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <span className="meta">Weight, kg</span>
                <input
                  className="field font-mono"
                  type="number"
                  inputMode="decimal"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="meta">Reps</span>
                <input
                  className="field font-mono"
                  type="number"
                  inputMode="numeric"
                  value={reps}
                  onChange={(e) => setReps(e.target.value)}
                />
              </div>
            </div>
            <button
              className="btn-solid mt-4 w-full"
              disabled={!exerciseName || !weight || !reps}
              onClick={add}
            >
              <Plus size={16} weight="bold" /> Add set
            </button>
          </>
        )}
      </div>
    </div>
  );
}
