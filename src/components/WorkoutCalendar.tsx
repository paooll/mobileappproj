import { useMemo, useState } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

function toKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Month grid of completed workout days. Tapping a day with a workout
 * selects it; tapping it again (or the clear button) clears the filter.
 */
export default function WorkoutCalendar({
  dates,
  selected,
  onSelect,
}: {
  /** Set of YYYY-MM-DD keys that have at least one completed workout. */
  dates: Set<string>;
  selected: string | null;
  onSelect: (key: string | null) => void;
}) {
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState({
    year: today.getFullYear(),
    month: today.getMonth(),
  });

  const cells = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1);
    const leading = first.getDay();
    const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
    const out: (string | null)[] = [];
    for (let i = 0; i < leading; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) out.push(toKey(cursor.year, cursor.month, d));
    // Pad to whole weeks so the grid keeps a stable height
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [cursor]);

  const shift = (delta: number) =>
    setCursor(({ year, month }) => {
      const d = new Date(year, month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  const monthCount = useMemo(() => {
    let n = 0;
    for (const key of dates) {
      if (
        key.startsWith(`${cursor.year}-${String(cursor.month + 1).padStart(2, "0")}`)
      )
        n += 1;
    }
    return n;
  }, [dates, cursor]);

  const todayKey = toKey(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <section className="panel mt-6 p-4" aria-label="Workout calendar">
      <div className="flex items-center justify-between">
        <button
          onClick={() => shift(-1)}
          className="icon-btn"
          style={{ width: 34, height: 34 }}
          aria-label="Previous month"
        >
          <CaretLeft size={15} weight="bold" />
        </button>
        <div className="text-center">
          <p className="text-[15px] font-semibold">
            {new Date(cursor.year, cursor.month, 1).toLocaleDateString(undefined, {
              month: "long",
              year: "numeric",
            })}
          </p>
          <p className="label mt-0.5 normal-case">
            {monthCount === 0
              ? "No sessions"
              : `${monthCount} session${monthCount === 1 ? "" : "s"}`}
          </p>
        </div>
        <button
          onClick={() => shift(1)}
          className="icon-btn"
          style={{ width: 34, height: 34 }}
          aria-label="Next month"
        >
          <CaretRight size={15} weight="bold" />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w, i) => (
          <div key={i} className="label pb-1 text-center">
            {w}
          </div>
        ))}
        {cells.map((key, i) => {
          if (!key) return <div key={`pad-${i}`} />;
          const day = Number(key.slice(-2));
          const has = dates.has(key);
          const isSelected = selected === key;
          const isToday = key === todayKey;
          return (
            <button
              key={key}
              onClick={() => (has ? onSelect(isSelected ? null : key) : onSelect(null))}
              disabled={!has}
              aria-pressed={isSelected}
              aria-label={`${key}${has ? ", workout logged" : ""}`}
              className="flex flex-col items-center justify-center rounded-xl py-1.5 transition-transform active:scale-[0.94]"
              style={{
                background: isSelected
                  ? "var(--ink)"
                  : has
                    ? "var(--fill)"
                    : "transparent",
                color: isSelected
                  ? "var(--bg)"
                  : has
                    ? "var(--ink)"
                    : "var(--ink-3)",
                opacity: has || isToday ? 1 : 0.55,
                height: 40,
              }}
            >
              <span className="num text-[13px] font-semibold">{day}</span>
              {has && !isSelected && (
                <span
                  className="mt-0.5 h-1 w-1 rounded-full"
                  style={{ background: "var(--ink)" }}
                />
              )}
            </button>
          );
        })}
      </div>

      {selected && (
        <button
          onClick={() => onSelect(null)}
          className="tab mt-4 w-full text-[13px] font-medium text-[var(--ink-2)] underline underline-offset-4 active:opacity-60"
        >
          Clear day filter
        </button>
      )}
    </section>
  );
}
