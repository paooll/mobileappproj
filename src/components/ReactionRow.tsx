import { Fire, Barbell, HandsClapping } from "@phosphor-icons/react";
import { REACTIONS, type ReactionKey } from "../lib/social";

const ICONS: Record<ReactionKey, typeof Fire> = {
  fire: Fire,
  barbell: Barbell,
  clap: HandsClapping,
};

interface Props {
  counts: Record<ReactionKey, number>;
  mine: Record<ReactionKey, boolean>;
  /** True while a write is in flight, so the row cannot be tapped twice. */
  busy: boolean;
  onReact: (key: ReactionKey) => void;
}

/**
 * Reactions are marks, not a like button: three different things somebody can
 * say about a session, and every one of them stays put at zero so the row never
 * reflows under the thumb that just hit it.
 */
export default function ReactionRow({ counts, mine, busy, onReact }: Props) {
  return (
    <div className="flex items-center gap-2">
      {REACTIONS.map(({ key, label }) => {
        const Icon = ICONS[key];
        const given = mine[key];
        const count = counts[key];
        return (
          <button
            key={key}
            onClick={() => onReact(key)}
            disabled={busy}
            aria-pressed={given}
            // One label for the whole control. The visible count alone would
            // read as a bare number with no idea what it counts.
            aria-label={`${label}${given ? ", given" : ""}, ${count} so far`}
            className="tab flex h-11 min-w-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold transition-transform active:scale-[0.94] disabled:opacity-60"
            style={
              given
                ? { background: "var(--ink)", color: "var(--bg)" }
                : { background: "var(--fill)", color: "var(--ink-2)" }
            }
          >
            <Icon size={17} weight={given ? "fill" : "regular"} className="shrink-0" />
            <span className="num">{count}</span>
          </button>
        );
      })}
    </div>
  );
}
