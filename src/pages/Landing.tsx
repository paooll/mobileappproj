import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Barbell,
  Timer,
  ChartLine,
  Brain,
  BowlFood,
  UsersThree,
  Ranking,
} from "@phosphor-icons/react";
import ThemeToggle from "../components/ThemeToggle";
import { RANKS } from "../lib/ranks";

const ease = [0.16, 1, 0.3, 1] as const;

/**
 * A real component preview rather than a picture of one: the same panels,
 * buttons and numerals the app itself renders. Every colour comes from a token,
 * so the preview reads correctly in whichever theme the visitor is in.
 */
function AppPreview() {
  const sets = [
    ["1", "70 kg × 8"],
    ["2", "72.5 kg × 8"],
    ["3", "72.5 kg × 6"],
  ];

  return (
    <div className="panel p-4 shadow-[var(--shadow-panel)] sm:p-5">
      <p className="label">Monday · Push Day</p>

      <div className="mt-2 flex items-end gap-2">
        <span className="num text-[44px] font-bold leading-none tracking-[-0.03em]">
          12
        </span>
        <span className="pb-1.5 text-[13px] font-medium text-[var(--ink-2)]">
          days in a row
        </span>
      </div>

      <div className="panel mt-4 p-3">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-semibold">Bench Press</p>
          <p className="label">3 sets</p>
        </div>
        <div className="mt-2.5 flex flex-col gap-1.5">
          {sets.map(([n, v]) => (
            <div
              key={n}
              className="flex items-center justify-between rounded-[10px] px-3 py-2"
              style={{ background: "var(--fill)" }}
            >
              <span className="num text-[12px] text-[var(--ink-2)]">{n}</span>
              <span className="num text-[14px] font-semibold">{v}</span>
              <span className="w-3" />
            </div>
          ))}
        </div>
      </div>

      <p className="mt-3 text-[13px] leading-relaxed text-[var(--ink-2)]">
        Last time you hit 70 kg for 8. Add 2.5 and take 8 again.
      </p>

      <div className="btn-solid mt-3 w-full">Log set</div>
    </div>
  );
}

/**
 * The ladder the app actually awards, imported rather than retyped so the page
 * cannot drift from the tiers in `ranks.ts`. Held tiers are filled, the rest are
 * drawn as the empty rungs they are until you reach them, because that is what
 * the board in the app looks like on day one.
 */
function RankLadder() {
  // Where a real beginner lands. Chosen to be true rather than flattering.
  const held = 3;
  return (
    <div>
      <div className="flex items-center gap-2">
        <Ranking size={20} weight="bold" className="text-[var(--ink-2)]" />
        <p className="text-[15px] font-semibold">Every compound lift earns a tier</p>
      </div>
      <ol className="mt-4 flex flex-wrap gap-1.5">
        {RANKS.map((r, i) => (
          <li key={r.name}>
            <span
              className="rounded-lg px-2.5 py-1 text-[12px] font-semibold"
              style={
                i < held
                  ? { background: "var(--ink)", color: "var(--bg)" }
                  : { background: "var(--fill)", color: "var(--ink-2)" }
              }
            >
              {r.name}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-3 max-w-[46ch] text-[14px] leading-relaxed text-[var(--ink-2)]">
        Estimated one rep max decides the tier, per lift, so the climb is yours
        rather than a badge for showing up.
      </p>
    </div>
  );
}

/**
 * Grouped by when the feature is actually used, because a flat run of six
 * identical icon-title-body rows is a list rather than a page: it tells the
 * visitor nothing about which part of their week a thing belongs to.
 *
 * Every entry is checked against the source before it is claimed. The nutrition
 * group exists because the protein target is a real per-goal figure in
 * `nutrition.ts`, not because food tracking sounds like a fitness app. The
 * social group exists because the feed, the follow requests and the reactions
 * are shipped. An earlier draft sold a solo logger while the app had quietly
 * become a social one.
 */
const GROUPS = [
  {
    heading: "Under the bar",
    note: "The two things you need mid-session, when your hands are busy and nobody is thinking.",
    items: [
      {
        icon: Barbell,
        title: "A coach that reads your history",
        body: "Before every set it tells you what you lifted last time, and by how much to go up, rounded to a jump your equipment can actually make.",
      },
      {
        icon: Timer,
        title: "Rest that starts itself",
        body: "The timer begins the moment a set is logged and keeps counting if you leave the workout. You never come back wondering how long is left.",
      },
    ],
  },
  {
    heading: "Afterwards",
    note: "What the log adds up to once the session is over.",
    items: [
      {
        icon: ChartLine,
        title: "Progress you can point at",
        body: "Estimated one rep max per lift, drawn against every session since you started.",
      },
      {
        icon: Brain,
        title: "Ask it about your own training",
        body: "What you trained last week, when a lift stalled, and whether the numbers behind that stall say fatigue or too little frequency.",
      },
    ],
  },
  {
    heading: "If you want it",
    note: "Off by default. A log that only tracks weight works fine on its own.",
    items: [
      {
        icon: BowlFood,
        title: "Protein from the goal you picked",
        body: "Log a meal against a target set at setup, searched from a food database that needs no account.",
      },
      {
        icon: UsersThree,
        title: "Other people, optionally",
        body: "Share a finished session to the people who follow you, answer the ones who answer back. Leave it off and the log stays private.",
      },
    ],
  },
];

export default function Landing() {
  const reduce = useReducedMotion();

  // One authored moment. The rest of the page is still on arrival, which is
  // cheaper to render and stops every section arriving the same way.
  const rise = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 18 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.7, delay, ease },
        };

  return (
    <div className="min-h-[100dvh] bg-[var(--bg)] text-[var(--ink)]">
      <nav className="glass sticky top-0 z-40">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between px-5">
          <span className="text-[16px] font-semibold tracking-tight">Reprange</span>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              to="/auth"
              className="tab flex h-11 items-center px-1 text-[14px] font-medium text-[var(--ink-2)] transition-opacity active:opacity-60"
            >
              Sign in
            </Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto w-full max-w-3xl px-5">
        <section className="grid min-h-[80dvh] grid-cols-1 items-center gap-12 py-16 md:grid-cols-[1.05fr_1fr] md:py-0">
          {/* Copy leads at every width. With the preview stacked on top, the
              measured CTA landed at 837px on an 844px phone, which is below the
              fold by any honest reading. Source order now carries it. */}
          <div>
            <motion.h1
              {...rise(0)}
              className="text-[42px] font-bold leading-[1.05] tracking-[-0.03em] md:text-[56px]"
            >
              Know what to lift
              <br />
              before you lift it.
            </motion.h1>

            <motion.p
              {...rise(0.08)}
              className="mt-5 max-w-[46ch] text-[16px] leading-relaxed text-[var(--ink-2)]"
            >
              Reprange remembers every set you have logged and turns it into the
              next one. Logging takes two taps, and the thinking happens while
              the bar is still loaded.
            </motion.p>

            <motion.div
              {...rise(0.16)}
              className="mt-8 flex flex-col gap-3 sm:flex-row"
            >
              <Link to="/auth?returnTo=%2Fapp" className="btn-solid w-full sm:w-auto">
                Start training
                <ArrowRight size={16} weight="bold" />
              </Link>
              <Link to="/auth" className="btn-line w-full sm:w-auto">
                I have an account
              </Link>
            </motion.div>
          </div>

          <motion.div {...rise(0.12)}>
            <AppPreview />
          </motion.div>
        </section>

        {/* What it does, grouped by when it happens. Rules carry the
            separation rather than boxes, and the heading carries the weight on
            its own: no eyebrow above it. */}
        <section className="border-t border-[var(--line)]">
          <h2 className="sr-only">What Reprange does</h2>
          {GROUPS.map(({ heading, note, items }) => (
            <div key={heading} className="border-b border-[var(--line)] py-12 last:border-b-0">
              <div className="max-w-[46ch]">
                <h3 className="text-[22px] font-bold leading-tight tracking-[-0.02em]">
                  {heading}
                </h3>
                <p className="mt-2 text-[14px] leading-relaxed text-[var(--ink-2)]">
                  {note}
                </p>
              </div>
              <div className="mt-7 flex flex-col gap-7">
                {items.map(({ icon: Icon, title, body }) => (
                  <div key={title} className="grid grid-cols-[26px_1fr] gap-x-4">
                    <Icon size={21} weight="bold" className="mt-0.5 text-[var(--ink-2)]" />
                    <div className="min-w-0">
                      <h4 className="text-[17px] font-semibold leading-snug">{title}</h4>
                      <p className="mt-1.5 max-w-[52ch] text-[15px] leading-relaxed text-[var(--ink-2)]">
                        {body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>

        <section className="border-t border-[var(--line)] py-16">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            {[
              ["876", "exercises, searchable by name or muscle group"],
              ["Two taps", "from the bar to a logged set"],
              ["No account", "needed to search the food database"],
            ].map(([head, body]) => (
              <div key={head}>
                <p className="text-[24px] font-bold tracking-[-0.02em]">{head}</p>
                <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--ink-2)]">
                  {body}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-14 border-t border-[var(--line)] pt-10">
            <RankLadder />
          </div>
        </section>

        <section className="border-t border-[var(--line)] py-20">
          <div className="max-w-[30ch]">
            <h2 className="text-[30px] font-bold leading-[1.1] tracking-[-0.025em] md:text-[38px]">
              Your next session starts now.
            </h2>
            <p className="mt-4 max-w-[46ch] text-[15px] leading-relaxed text-[var(--ink-2)]">
              Setup asks five things, one screen each. Nothing to import,
              nothing to configure before you can log a set.
            </p>
          </div>
          <div className="mt-8">
            <Link to="/auth?returnTo=%2Fapp" className="btn-solid">
              Start training
              <ArrowRight size={16} weight="bold" />
            </Link>
          </div>
        </section>

        <footer className="border-t border-[var(--line)] py-8">
          {/* ink-2, not ink-3: measured on this background ink-3 lands at
              4.35:1 in light, under the 4.5:1 body-text floor. */}
          <p className="text-center text-[13px] text-[var(--ink-2)]">
            Reprange · tracks what you lift, nothing else
          </p>
        </footer>
      </main>
    </div>
  );
}
