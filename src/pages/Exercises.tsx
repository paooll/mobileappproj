import { useEffect, useMemo, useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import ThemeToggle from "../components/ThemeToggle";
import { listExercises, type Exercise } from "../lib/data";

export default function Exercises() {
  const [exercises, setExercises] = useState<Exercise[] | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    listExercises().then(setExercises);
  }, []);

  const grouped = useMemo(() => {
    const filtered = (exercises ?? []).filter((e) =>
      e.name.toLowerCase().includes(search.toLowerCase())
    );
    const map = new Map<string, Exercise[]>();
    for (const e of filtered) {
      const arr = map.get(e.muscleGroup) ?? [];
      arr.push(e);
      map.set(e.muscleGroup, arr);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [exercises, search]);

  return (
    <div className="px-5 pt-[max(env(safe-area-inset-top),48px)]">
      <div className="flex items-start justify-between">
        <h1 className="text-[30px] font-bold tracking-[-0.02em]">Library</h1>
        <ThemeToggle />
      </div>
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

      {exercises === null ? (
        <div className="mt-8 flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-[var(--fill)]" />
          ))}
        </div>
      ) : (
        grouped.map(([group, list]) => (
          <div key={group} className="mt-8">
            <h2 className="label mb-2">{group}</h2>
            <div className="panel divide-y divide-[var(--line)]">
              {list.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between px-4 py-3 text-[15px]"
                >
                  <span>{e.name}</span>
                  <span className="label">{e.equipment}</span>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
