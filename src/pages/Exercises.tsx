import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { MagnifyingGlass } from "@phosphor-icons/react";

export default function Exercises() {
  const exercises = useQuery(api.exercises.list);
  const [search, setSearch] = useState("");

  const grouped = useMemo(() => {
    const filtered = (exercises ?? []).filter((e) =>
      e.name.toLowerCase().includes(search.toLowerCase())
    );
    const map = new Map<string, typeof filtered>();
    for (const e of filtered) {
      const arr = map.get(e.muscleGroup) ?? [];
      arr.push(e);
      map.set(e.muscleGroup, arr);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [exercises, search]);

  return (
    <div className="px-5 pt-12">
      <h1 className="text-[30px] font-semibold tracking-[-0.02em]">Library</h1>
      <div className="relative mt-5">
        <MagnifyingGlass
          size={16}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3"
        />
        <input
          className="field pl-9"
          placeholder="Search exercises"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search exercises"
        />
      </div>

      {!exercises ? (
        <div className="mt-10 flex justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-line border-t-ink" />
        </div>
      ) : (
        grouped.map(([group, list]) => (
          <div key={group} className="mt-8">
            <h2 className="meta mb-2">{group}</h2>
            <div className="panel divide-y divide-line p-0">
              {list.map((e) => (
                <div
                  key={e._id}
                  className="flex items-center justify-between px-4 py-3 text-[15px]"
                >
                  <span>{e.name}</span>
                  <span className="meta">{e.equipment}</span>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
