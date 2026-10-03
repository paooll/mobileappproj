import { useMemo, useState } from "react";
import { MagnifyingGlass, X } from "@phosphor-icons/react";
import type { Exercise } from "../lib/data";

export interface PickerLastSet {
  weight: number;
  reps: number;
}

interface Props {
  exercises: Exercise[];
  /** Equipment the athlete owns. Anything they cannot do is hidden behind a filter. */
  equipment: string[];
  /** Heaviest set on record per exercise name, used for the "last" line. */
  lastFor: (name: string) => PickerLastSet | null;
  /**
   * Exercises from the most recent session. During a workout these are almost
   * always the ones wanted, and finding them in 876 names is the slowest part
   * of logging.
   */
  recentNames?: string[];
  recentLabel?: string;
  formatWeight: (kg: number) => string;
  unit: string;
  onChoose: (exercise: Exercise) => void;
  onInspect?: (exercise: Exercise) => void;
}

const PAGE = 40;

export default function ExercisePicker({
  exercises,
  equipment,
  lastFor,
  recentNames = [],
  recentLabel = "Last session",
  formatWeight,
  unit,
  onChoose,
  onInspect,
}: Props) {
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState<string | null>(null);
  const [onlyMine, setOnlyMine] = useState(false);

  const groups = useMemo(
    () => Array.from(new Set(exercises.map((e) => e.muscleGroup))).sort(),
    [exercises]
  );

  const q = search.trim().toLowerCase();
  const owned = useMemo(
    () => new Set(equipment.map((e) => e.toLowerCase())),
    [equipment]
  );

  // Equipment the athlete ticked at setup is a real constraint: a rack pull is
  // useless to someone with no rack. Unowned gear stays reachable behind a
  // filter rather than disappearing, since gym equipment gets borrowed.
  const results = useMemo(
    () =>
      exercises.filter((e) => {
        if (q && !e.name.toLowerCase().includes(q)) return false;
        if (group && e.muscleGroup !== group) return false;
        if (onlyMine && e.equipment && !owned.has(e.equipment.toLowerCase())) return false;
        return true;
      }),
    [exercises, q, group, onlyMine, owned]
  );

  const recent = useMemo(() => {
    if (q || group || onlyMine) return [];
    const wanted = new Set(recentNames);
    return recentNames
      .map((n) => exercises.find((e) => e.name === n))
      .filter((e): e is Exercise => Boolean(e) && wanted.has(e!.name))
      .slice(0, 6);
  }, [exercises, recentNames, q, group, onlyMine]);

  const Row = ({ e }: { e: Exercise }) => {
    const last = lastFor(e.name);
    return (
      <div className="flex items-center justify-between rounded-lg px-3 transition-colors active:bg-[var(--fill)]">
        <button onClick={() => onChoose(e)} className="tab min-h-[56px] min-w-0 flex-1 py-2.5 text-left">
          <span className="block truncate text-[15px]">{e.name}</span>
          {last && (
            <span className="num block text-[12px] text-[var(--ink-3)]">
              last {formatWeight(last.weight)} {unit} × {last.reps}
            </span>
          )}
        </button>
        <span className="label ml-2 shrink-0">{e.muscleGroup}</span>
        {onInspect && (
          <button
            onClick={() => onInspect(e)}
            className="tab ml-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--ink-3)] transition-colors active:bg-[var(--fill)] active:text-[var(--ink)]"
            aria-label={`How to do ${e.name}`}
          >
            <span aria-hidden className="text-[13px] font-semibold">?</span>
          </button>
        )}
      </div>
    );
  };

  const filtersOn = group !== null || onlyMine;
  const equipmentLabel =
    equipment.length === 0 ? "Add equipment" : `My equipment (${equipment.length})`;

  return (
    <div>
      <div className="relative">
        <MagnifyingGlass
          size={16}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--ink-3)]"
        />
        <input
          // No autofocus on touch: the keyboard would cover the list the picker
          // just opened to show.
          autoFocus={false}
          className="field pl-10 pr-10"
          placeholder={`Search ${exercises.length} exercises`}
          enterKeyHint="search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search exercises"
        />
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

      {/* Muscle group is how a lifter actually browses. Searching 876 names by
          muscle is the reason this list was unusable. */}
      <div className="-mx-5 mt-2 overflow-x-auto overscroll-x-contain px-5 pb-1">
        <div className="flex w-max gap-1.5">
          <button
            onClick={() => setGroup(null)}
            aria-pressed={group === null}
            className="btn-quiet shrink-0"
            style={group === null ? { background: "var(--ink)", color: "var(--bg)" } : undefined}
          >
            All
          </button>
          {groups.map((g) => (
            <button
              key={g}
              onClick={() => setGroup(group === g ? null : g)}
              aria-pressed={group === g}
              className="btn-quiet shrink-0"
              style={group === g ? { background: "var(--ink)", color: "var(--bg)" } : undefined}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={() => setOnlyMine((v) => !v)}
        aria-pressed={onlyMine}
        className="mt-1.5 text-[13px] font-medium transition-opacity active:opacity-60"
        style={{ color: onlyMine ? "var(--ink)" : "var(--ink-2)" }}
      >
        {onlyMine ? "✓ " : ""}
        {equipmentLabel}
      </button>

      <div className="mt-1 max-h-56 overflow-y-auto overscroll-contain">
        {recent.length > 0 && (
          <div className="mb-1">
            <p className="label px-3 pt-1">{recentLabel}</p>
            {recent.map((e) => (
              <Row key={`recent-${e.id}`} e={e} />
            ))}
            <div className="mx-3 my-1 border-t border-[var(--line)]" />
          </div>
        )}

        {results.slice(0, PAGE).map((e) => (
          <Row key={e.id} e={e} />
        ))}

        {results.length === 0 && (
          <div className="py-6 text-center">
            <p className="text-[14px] text-[var(--ink-3)]">
              {q ? `No exercises match “${search}”` : "Nothing matches those filters"}
            </p>
            {filtersOn && (
              <button
                onClick={() => {
                  setGroup(null);
                  setOnlyMine(false);
                }}
                className="mt-2 text-[14px] font-semibold"
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {results.length > PAGE && (
          <p className="px-3 py-2 text-center text-[12px] text-[var(--ink-3)]">
            {PAGE} of {results.length}. Keep typing to narrow it down.
          </p>
        )}
      </div>
    </div>
  );
}
