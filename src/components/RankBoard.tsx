import { RANKS, buildRanks, rankProgress, type LiftRank } from "../lib/ranks";
import type { WorkoutSet } from "../lib/data";
import { toDisplay, useUnit, type Unit } from "../lib/units";

/**
 * The ladder for the compound lifts, strongest result first.
 *
 * Ordered by what has actually been achieved rather than by a fixed list, so the
 * top of the board is always the thing the athlete is working on.
 */
function order(board: LiftRank[]): LiftRank[] {
  return board.slice().sort((a, b) => {
    if (a.e1rm === null && b.e1rm === null) return 0;
    if (a.e1rm === null) return 1;
    if (b.e1rm === null) return -1;
    return b.e1rm - a.e1rm;
  });
}

function kg(value: number, unit: Unit): string {
  const n = toDisplay(value, unit);
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export default function RankBoard({ sets }: { sets: Iterable<WorkoutSet> }) {
  const [unit] = useUnit();
  const board = order(buildRanks(sets));
  const started = board.filter((r) => r.e1rm !== null);

  return (
    <div>
      {/* The whole ladder, so the climb is visible rather than implied. */}
      <div className="-mx-5 mb-4 overflow-x-auto overscroll-x-contain px-5">
        <ol className="flex w-max items-center gap-1.5">
          {RANKS.map((r, i) => {
            const held = started.some((x) => x.tier >= i);
            return (
              <li
                key={r.name}
                className="flex items-center gap-1.5"
                aria-current={held ? "true" : undefined}
              >
                <span
                  className="shrink-0 rounded-lg px-2 py-1 text-[12px] font-semibold"
                  style={
                    held
                      ? { background: "var(--ink)", color: "var(--bg)" }
                      : { background: "var(--fill)", color: "var(--ink-3)" }
                  }
                >
                  {r.name}
                </span>
                {i < RANKS.length - 1 && (
                  <span aria-hidden className="h-px w-3 bg-[var(--line)]" />
                )}
              </li>
            );
          })}
        </ol>
      </div>

      <div className="flex flex-col gap-2">
        {board.map((row) => {
          const progress = rankProgress(row);
          const unranked = row.e1rm === null;
          return (
            <div key={row.lift} className="panel p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="label">{row.lift}</p>
                <p className="text-[13px] font-semibold">{row.rank}</p>
              </div>

              {/* Progress between this rank and the next. */}
              <div
                className="mt-2.5 h-2 overflow-hidden rounded-full"
                style={{ background: "var(--fill)" }}
                role="progressbar"
                aria-label={`${row.lift} rank progress`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress === null ? 0 : Math.round(progress * 100)}
              >
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{
                    width: `${progress === null ? 0 : Math.max(3, progress * 100)}%`,
                    background: "var(--ink)",
                  }}
                />
              </div>

              <p className="mt-2.5 text-[13px] leading-snug text-[var(--ink-2)]">
                {unranked ? (
                  row.blurb
                ) : row.remainingKg === null ? (
                  row.blurb
                ) : (
                  <>
                    <span className="num">
                      {kg(row.e1rm ?? 0, unit)} {unit} best
                    </span>
                    {" · "}
                    {row.remainingKg <= 1
                      ? `${kg(Math.max(0, row.remainingKg), unit)} ${unit} from ${row.nextRank}`
                      : `${kg(row.remainingKg, unit)} ${unit} to ${row.nextRank}`}
                  </>
                )}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
