import { useEffect, useMemo, useState } from "react";
import { MagnifyingGlass, ArrowClockwise, FunnelSimple } from "@phosphor-icons/react";
import { loadExercises, type Exercise } from "../lib/data";
import ThemeToggle from "../components/ThemeToggle";
import ExerciseDetail from "../components/ExerciseDetail";
import { AnimatePresence } from "framer-motion";

const GROUPS = ["All", "Chest", "Back", "Shoulders", "Arms", "Legs", "Abs", "Other"];

const CORE_GROUPS = ["Chest", "Back", "Shoulders", "Arms", "Legs", "Abs"];

/** Horizontal scroll-snap row of filter chips, matching the app's quiet-button style. */
function ChipRow({
  options,
  value,
  onChange,
  label,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          aria-pressed={value === o}
          className="btn-quiet shrink-0"
          style={value === o ? { background: "var(--ink)", color: "var(--bg)" } : undefined}
        >
          {o === "All" ? label : o}
        </button>
      ))}
    </div>
  );
}

export default function Exercises() {
  const [exercises, setExercises] = useState<Exercise[] | null>(null);
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("All");
  const [equipment, setEquipment] = useState("All");
  const [detail, setDetail] = useState<Exercise | null>(null);
  const [failed, setFailed] = useState(false);

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
  }, [exercises, search, group]);

  const total = exercises?.length ?? 0;

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
          className="field pl-10"
          placeholder="Search exercises"
          enterKeyHint="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search exercises"
        />
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
        grouped.map(([muscle, list]) => (
          <div key={muscle} className="mt-8">
            <h2 className="label mb-2">{muscle}</h2>
            <div className="panel divide-y divide-[var(--line)]">
              {list.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setDetail(e)}
                  className="tab flex w-full items-center justify-between px-4 py-3 text-left text-[15px] transition-opacity active:opacity-60"
                >
                  <span className="truncate pr-2">{e.name}</span>
                  <span className="label ml-2 shrink-0">{e.equipment}</span>
                </button>
              ))}
            </div>
          </div>
        ))
      ) : null}

      <AnimatePresence>
        {detail && <ExerciseDetail exercise={detail} onClose={() => setDetail(null)} />}
      </AnimatePresence>
    </div>
  );
}
