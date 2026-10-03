import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Plus, Trash, ArrowUp, ArrowDown, X } from "@phosphor-icons/react";
import {
  DAY_NAMES,
  ROUTINE_NAMES,
  createRoutine,
  deleteRoutine,
  loadRoutines,
  move,
  scheduleLabel,
  setRoutineExercises,
  updateRoutine,
  type Routine,
} from "../lib/routines";
import { loadExercises, type Exercise } from "../lib/data";
import ExercisePicker from "./ExercisePicker";
import ConfirmSheet from "./ConfirmSheet";
import { useToast } from "./Toast";

interface Props {
  uid: string;
  equipment: string[];
}

/**
 * The athlete's own split. Names, days and exercise order are all theirs,
 * because the four templates the app used to offer covered a fraction of the
 * ways people actually train.
 */
export default function RoutinesSection({ uid, equipment }: Props) {
  const { toast } = useToast();
  const reduce = useReducedMotion();
  const [routines, setRoutines] = useState<Routine[] | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Routine | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const list = await loadRoutines(uid);
    setRoutines(list);
  }, [uid]);

  useEffect(() => {
    let cancelled = false;
    loadRoutines(uid).then((r) => !cancelled && setRoutines(r));
    loadExercises().then((e) => !cancelled && setExercises(e));
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const add = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await createRoutine(uid, "New session", [], []);
      await refresh();
    } catch (err) {
      console.error(err);
      toast("Couldn't add that. Try again.", "error");
    } finally {
      setBusy(false);
    }
  };

  // A local draft so reordering feels instant; the server write follows.
  const [draft, setDraft] = useState<Routine | null>(null);
  const open = draft ?? routines?.find((r) => r.id === openId) ?? null;
  const setOpen = setDraft;

  const addExercise = async (ex: Exercise) => {
    if (!open) return;
    if (open.exercises.includes(ex.name)) {
      toast("Already in this session.", "error");
      return;
    }
    const next = [...open.exercises, ex.name];
    setOpen({ ...open, exercises: next });
    await setRoutineExercises(uid, open.id, next);
    setPicking(false);
  };

  const reorder = async (from: number, to: number) => {
    if (!open) return;
    const next = move(open.exercises, from, to);
    if (next === open.exercises) return;
    setOpen({ ...open, exercises: next });
    await setRoutineExercises(uid, open.id, next);
  };

  const removeExercise = async (index: number) => {
    if (!open) return;
    const next = open.exercises.filter((_, i) => i !== index);
    setOpen({ ...open, exercises: next });
    await setRoutineExercises(uid, open.id, next);
  };

  const toggleDay = async (r: Routine, day: number) => {
    const days = r.days.includes(day) ? r.days.filter((d) => d !== day) : [...r.days, day];
    setRoutines((prev) => prev?.map((x) => (x.id === r.id ? { ...x, days } : x)) ?? null);
    await updateRoutine(uid, r.id, { days });
  };

  const rename = async (r: Routine, name: string) => {
    const clean = name.trim().slice(0, 40);
    if (!clean || clean === r.name) return;
    setRoutines((prev) => prev?.map((x) => (x.id === r.id ? { ...x, name: clean } : x)) ?? null);
    await updateRoutine(uid, r.id, { name: clean });
  };

  const remove = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      await deleteRoutine(uid, confirmDelete.id);
      if (openId === confirmDelete.id) setOpenId(null);
      setConfirmDelete(null);
      await refresh();
    } catch (err) {
      console.error(err);
      toast("Couldn't delete that. Try again.", "error");
    } finally {
      setBusy(false);
    }
  };

  const collapse = reduce ? {} : { initial: { height: 0 }, animate: { height: "auto" }, exit: { height: 0 } };

  return (
    <div>
      <p className="mb-1 text-[14px] leading-relaxed text-[var(--ink-2)]">
        Your own split. Name each session, pick the days, and list the moves in
        the order you want them.
      </p>

      {routines === null ? (
        <div className="mt-3 space-y-2">
          <div className="h-16 animate-pulse rounded-[14px] bg-[var(--fill)]" />
        </div>
      ) : routines.length === 0 ? (
        <button onClick={add} disabled={busy} className="btn-line mt-3 w-full">
          <Plus size={15} weight="bold" />
          {busy ? "Adding…" : "Add your first session"}
        </button>
      ) : (
        <>
          <div className="mt-3 flex flex-col gap-2">
            {routines.map((r) => {
              const isOpen = openId === r.id;
              return (
                <div key={r.id} className="panel overflow-hidden">
                  <button
                    onClick={() => {
                      setDraft(null);
                      setOpenId(isOpen ? null : r.id);
                    }}
                    aria-expanded={isOpen}
                    className="tab flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-semibold">{r.name}</span>
                      <span className="block text-[12px] text-[var(--ink-3)]">
                        {scheduleLabel(r)}
                        {r.exercises.length > 0 && ` · ${r.exercises.length} moves`}
                      </span>
                    </span>
                    <Plus
                      size={15}
                      weight="bold"
                      className={`shrink-0 text-[var(--ink-3)] transition-transform ${isOpen ? "rotate-45" : ""}`}
                    />
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div {...collapse} className="overflow-hidden">
                        <div className="border-t border-[var(--line)] px-4 py-3">
                          <label className="label mb-1.5 block" htmlFor={`rn-${r.id}`}>
                            Name
                          </label>
                          <input
                            id={`rn-${r.id}`}
                            className="field"
                            defaultValue={r.name}
                            list={`rn-suggest-${r.id}`}
                            onBlur={(e) => rename(r, e.target.value)}
                          />
                          <datalist id={`rn-suggest-${r.id}`}>
                            {ROUTINE_NAMES.map((n) => (
                              <option key={n} value={n} />
                            ))}
                          </datalist>

                          <p className="label mb-1.5 mt-3">Repeat on</p>
                          <div className="flex flex-wrap gap-1.5">
                            {DAY_NAMES.map((d, i) => (
                              <button
                                key={d}
                                onClick={() => toggleDay(r, i)}
                                aria-pressed={r.days.includes(i)}
                                aria-label={`Repeat on ${d}`}
                                className="btn-quiet shrink-0 px-3"
                                style={
                                  r.days.includes(i)
                                    ? { background: "var(--ink)", color: "var(--bg)" }
                                    : undefined
                                }
                              >
                                {d}
                              </button>
                            ))}
                          </div>
                          <p className="mt-1.5 text-[12px] text-[var(--ink-3)]">
                            {r.days.length === 0
                              ? "No days picked, so this shows every day."
                              : `Shows on ${scheduleLabel(r)}.`}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

          <button onClick={add} disabled={busy} className="btn-quiet mt-3 w-full">
            <Plus size={14} weight="bold" />
            {busy ? "Adding…" : "Add another session"}
          </button>
        </>
      )}

      {open && (
        <div className="mt-4 border-t border-[var(--line)] pt-4">
          <p className="label mb-2">Moves in {open.name}</p>
          {open.exercises.length === 0 ? (
            <p className="mb-2 text-[13px] text-[var(--ink-3)]">Nothing added yet.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {open.exercises.map((name, i) => (
                <div key={`${name}-${i}`} className="flex items-center gap-1 rounded-lg bg-[var(--fill)] px-3 py-2">
                  <span className="num w-4 shrink-0 text-[12px] text-[var(--ink-3)]">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-[14px]">{name}</span>
                  <button
                    onClick={() => reorder(i, i - 1)}
                    disabled={i === 0}
                    aria-label={`Move ${name} up`}
                    className="tab flex h-11 w-11 items-center justify-center rounded-full text-[var(--ink-3)] disabled:opacity-25"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    onClick={() => reorder(i, i + 1)}
                    disabled={i === open.exercises.length - 1}
                    aria-label={`Move ${name} down`}
                    className="tab flex h-11 w-11 items-center justify-center rounded-full text-[var(--ink-3)] disabled:opacity-25"
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    onClick={() => removeExercise(i)}
                    aria-label={`Remove ${name}`}
                    className="tab flex h-11 w-11 items-center justify-center rounded-full text-[var(--ink-3)]"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => setPicking((v) => !v)}
            className="btn-line mt-3 w-full"
          >
            {picking ? "Close picker" : "Add a move"}
          </button>

          {picking && (
            <div className="mt-2">
              <ExercisePicker
                exercises={exercises}
                equipment={equipment}
                lastFor={() => null}
                formatWeight={(kg) => String(kg)}
                unit="kg"
                onChoose={addExercise}
              />
            </div>
          )}

          <button onClick={() => setConfirmDelete(open)} className="btn-quiet mt-3 w-full">
            <Trash size={14} />
            Delete this session
          </button>
        </div>
      )}

      <ConfirmSheet
        open={!!confirmDelete}
        title={`Delete ${confirmDelete?.name ?? "this session"}?`}
        body="Workouts you already logged are kept. Only the plan is removed."
        confirmLabel="Delete"
        busy={busy}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
