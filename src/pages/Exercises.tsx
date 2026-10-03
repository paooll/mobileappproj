import { useEffect, useMemo, useState } from "react";
import { MagnifyingGlass, ArrowClockwise, FunnelSimple, X } from "@phosphor-icons/react";
import { loadExercises, type Exercise } from "../lib/data";
import ThemeToggle from "../components/ThemeToggle";
import ExerciseDetail from "../components/ExerciseDetail";
import ChipRow from "../components/ChipRow";
import { AnimatePresence } from "framer-motion";

const GROUPS = ["All", "Chest", "Back", "Shoulders", "Arms", "Legs", "Abs", "Other"];

const CORE_GROUPS = ["Chest", "Back", "Shoulders", "Arms", "Legs", "Abs"];

/** Rows rendered before the "show more" control appears. */
const PAGE = 80;

export default function Exercises() {
  const [exercises, setExercises] = useState<Exercise[] | null>(null);
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("All");
  const [equipment, setEquipment] = useState("All");
  const [detail, setDetail] = useState<Exercise | null>(null);
  const [failed, setFailed] = useState(false);
  // 876 rows is a lot of DOM for a phone. Render a page at a time instead.
  const [shown, setShown] = useState(PAGE);

  const load = () => {
    setFailed(false);
    setExercises(null);
    loadExercises()
      .then(setExercises)
      .catch((err) => {
        console.error("Exercise catalog failed to load:", err);
        setFailed(true);
      });
  };

  useEffect(load, []);

  // A new search or filter starts from the top of the list again
  useEffect(() => {
    setShown(PAGE);
  }, [search, group, equipment]);

  // Equipment options come from the catalog itself, so new equipment types
  // appear automatically as the dataset grows.
  const equipmentOptions = useMemo(() => {
    const found = new Set<string>();
    for (const e of exercises ?? []) if (e.equipment) found.add(e.equipment);
    return ["All", ...[...found].sort()];
  }, [exercises]);

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = (exercises ?? []).filter((e) => {
      const matchesSearch = !q || e.name.toLowerCase().includes(q);
      const matchesGroup =
        group === "All" ||
        (group === "Other" && !CORE_GROUPS.includes(e.muscleGroup)) ||
        e.muscleGroup === group;
      const matchesEquipment = equipment === "All" || e.equipment === equipment;
      return matchesSearch && matchesGroup && matchesEquipment;
    });

    const map = new Map<string, Exercise[]>();
    for (const e of filtered) {
      const arr = map.get(e.muscleGroup) ?? [];
      arr.push(e);
      map.set(e.muscleGroup, arr);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [exercises, search, group, equipment]);

  const total = exercises?.length ?? 0;
  const matchCount = useMemo(
    () => grouped.reduce((n, [, list]) => n + list.length, 0),
    [grouped]
  );

  /** The groups that fit in the current page, and how many rows are hidden. */
  const paged = useMemo(() => {
    let budget = shown;
    const out: [string, Exercise[]][] = [];
    for (const entry of grouped) {
      if (budget <= 0) break;
      out.push([entry[0], entry[1].slice(0, budget)]);
      budget -= entry[1].length;
    }
    return { rows: out, hidden: Math.max(0, matchCount - shown) };
  }, [grouped, shown, matchCount]);

  return (
    <div className="px-5 pt-[max(env(safe-area-inset-top),48px)]">
      <div className="flex items-start justify-between">
        <h1 className="text-[30px] font-bold tracking-[-0.02em]">Library</h1>
        <ThemeToggle />
      </div>
      <p className="label mt-1 normal-case">{total} exercises</p>

      <div className="relative mt-5">
        <MagnifyingGlass
          size={16}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--ink-3)]"
        />
        <input
          className="field pl-10 pr-12"
          placeholder="Search exercises"
          enterKeyHint="search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search exercises"
        />
        {/* Clear sits inside the field so the text never has to be selected by hand */}
        {search && (
          <button
            onClick={() => setSearch("")}
            aria-label="Clear search"
            className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-[var(--ink-3)] transition-colors active:text-[var(--ink)]"
          >
            <X size={15} weight="bold" />
          </button>
        )}
      </div>

      {/* Muscle group chips */}
      <div className="mt-3">
        <ChipRow options={GROUPS} value={group} onChange={setGroup} label="All muscles" />
      </div>

      {/* Equipment chips — only useful once the catalog has loaded */}
      {equipmentOptions.length > 1 && (
        <div className="mt-2">
          <ChipRow
            options={equipmentOptions}
            value={equipment}
            onChange={setEquipment}
            label="All equipment"
          />
        </div>
      )}

      {(group !== "All" || equipment !== "All") && (
        <button
          onClick={() => {
            setGroup("All");
            setEquipment("All");
          }}
          className="tab mt-2 text-[13px] font-medium text-[var(--ink-2)] underline underline-offset-4 active:opacity-60"
        >
          Reset filters
        </button>
      )}

      {failed && (
        <div className="panel mt-8 flex flex-col items-center gap-3 p-6 text-center">
          <p className="text-[15px] font-medium">Couldn't load the exercise library</p>
          <p className="text-[13px] text-[var(--ink-2)]">
            Check your connection and try again. The first load may take a moment.
          </p>
          <button onClick={load} className="btn-line">
            <ArrowClockwise size={16} weight="bold" /> Try again
          </button>
        </div>
      )}

      {exercises === null && !failed ? (
        <div className="mt-8 flex flex-col gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-[var(--fill)]" />
          ))}
        </div>
      ) : exercises !== null ? grouped.length === 0 ? (
        <div className="panel mt-8 flex flex-col items-center gap-3 px-6 py-12 text-center">
          <FunnelSimple size={24} className="text-[var(--ink-3)]" />
          <p className="text-[15px] font-medium">No exercises match</p>
          <p className="max-w-[28ch] text-[13px] leading-relaxed text-[var(--ink-2)]">
            Try a different muscle group or clear the equipment filter.
          </p>
          <button
            onClick={() => {
              setSearch("");
              setGroup("All");
              setEquipment("All");
            }}
            className="btn-line"
          >
            Clear filters
          </button>
        </div>
      ) : (
        paged.rows.map(([muscle, list]) => (
          <div key={muscle} className="mt-8">
            <h2 className="label mb-2">{muscle}</h2>
            <div className="panel divide-y divide-[var(--line)]">
              {list.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setDetail(e)}
                  className="tab flex min-h-[48px] w-full items-center justify-between px-4 py-3 text-left text-[15px] transition-opacity active:opacity-60"
                >
                  <span className="truncate pr-2">{e.name}</span>
                  <span className="label ml-2 shrink-0">{e.equipment}</span>
                </button>
              ))}
            </div>
          </div>
        ))
      ) : null}

      {paged.hidden > 0 && (
        <button
          onClick={() => setShown((n) => n + PAGE)}
          className="btn-line mt-6 w-full"
        >
          Show {Math.min(paged.hidden, PAGE)} more of {matchCount}
        </button>
      )}

      <AnimatePresence>
        {detail && <ExerciseDetail exercise={detail} onClose={() => setDetail(null)} />}
      </AnimatePresence>
    </div>
  );
}
