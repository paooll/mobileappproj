import { Fire, Barbell, HandsClapping, PencilSimple } from "@phosphor-icons/react";
import { REACTIONS, type ReactionKey } from "../lib/social";

const ICONS: Record<ReactionKey, typeof Fire> = {
  fire: Fire,
  barbell: Barbell,
  clap: HandsClapping,
};

interface Props {
  counts: Record<ReactionKey, number>;
  mine: Record<ReactionKey, boolean>;
  /** Reaction key to the word somebody sent with it. */
  notes: Partial<Record<ReactionKey, string>>;
  /** True while a write is in flight, so the row cannot be tapped twice. */
  busy: boolean;
  onReact: (key: ReactionKey) => void;
  /** Opens the one-word composer for a reaction. */
  onCheer: (key: ReactionKey) => void;
}

/**
 * Reactions are marks, not a like button: three different things somebody can
 * say about a session, and every one of them stays put at zero so the row never
 * reflows under the thumb that just hit it.
 *
 * The pencil is how a mark grows a word. It is a separate target on purpose:
 * folding it into the reaction button would make every cheer a two-tap
 * accident, and long press is invisible on a phone.
 */
export default function ReactionRow({ counts, mine, notes, busy, onReact, onCheer }: Props) {
  return (
    <div className="flex items-center gap-2">
      {REACTIONS.map(({ key, label }) => {
        const Icon = ICONS[key];
        const given = mine[key];
        const count = counts[key];
        const note = notes[key];
        return (
          <div key={key} className="flex min-w-0 items-center">
            <button
              onClick={() => onReact(key)}
              disabled={busy}
              aria-pressed={given}
              // One label for the whole control. The visible count alone would
              // read as a bare number with no idea what it counts.
              aria-label={
                note ? `${label}${given ? ", given" : ""}, ${count} so far, ${note}` : `${label}${given ? ", given" : ""}, ${count} so far`
              }
              className="tab flex h-11 min-w-0 items-center gap-1.5 rounded-l-full px-3 text-[13px] font-semibold transition-transform active:scale-[0.94] disabled:opacity-60"
              style={
                given
                  ? { background: "var(--ink)", color: "var(--bg)" }
                  : { background: "var(--fill)", color: "var(--ink-2)" }
              }
            >
              <Icon size={17} weight={given ? "fill" : "regular"} className="shrink-0" />
              <span className="num">{count}</span>
            </button>
            <button
              onClick={() => onCheer(key)}
              disabled={busy}
              aria-label={`Add a word to ${label}`}
              className="tab flex h-11 w-11 shrink-0 items-center justify-center rounded-r-full border-l disabled:opacity-60"
              style={
                given
                  ? { background: "var(--ink)", color: "var(--bg)" }
                  : { background: "var(--fill)", color: "var(--ink-2)" }
              }
            >
              <PencilSimple size={14} weight={note ? "bold" : "regular"} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
