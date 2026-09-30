import { useEffect, useMemo, useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { loadExercises, type Exercise } from "../lib/data";
import ThemeToggle from "../components/ThemeToggle";

const GROUPS = ["All", "Chest", "Back", "Shoulders", "Arms", "Legs", "Abs", "Other"];

export default function Exercises() {
  const [exercises, setExercises] = useState<Exercise[] | null>(null);
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("All");

  useEffect(() => {
    loadExercises()
      .then(setExercises)
      .catch(() => setExercises([]));
  }, []);

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = (exercises ?? []).filter((e) => {
      const matchesSearch = !q || e.name.toLowerCase().includes(q);
      const matchesGroup =
        group === "All" ||
        (group === "Other" &&
          !["Chest", "Back", "Shoulders", "Arms", "Legs", "Abs"].includes(e.muscleGroup)) ||
        e.muscleGroup === group;
      return matchesSearch && matchesGroup;
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
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {GROUPS.map((g) => (
          <button
            key={g}
            onClick={() => setGroup(g)}
            className="btn-quiet shrink-0"
            style={
              group === g
                ? { background: "var(--ink)", color: "var(--bg)" }
                : undefined
            }
          >
            {g}
          </button>
        ))}
      </div>

      {exercises === null ? (
        <div className="mt-8 flex flex-col gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-[var(--fill)]" />
          ))}
        </div>
      ) : (
        grouped.map(([muscle, list]) => (
          <div key={muscle} className="mt-8">
            <h2 className="label mb-2">{muscle}</h2>
            <div className="panel divide-y divide-[var(--line)]">
              {list.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between px-4 py-3 text-[15px]"
                >
                  <span className="truncate pr-2">{e.name}</span>
                  <span className="label ml-2 shrink-0">{e.equipment}</span>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
