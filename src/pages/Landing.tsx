import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Barbell, Timer, ChartLine, Brain } from "@phosphor-icons/react";
import ThemeToggle from "../components/ThemeToggle";

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
              <span className="num text-[12px] text-[var(--ink-3)]">{n}</span>
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
 * An editorial index rather than a grid of identical cards. Each row is a real
 * feature of the shipped app, separated by rules instead of boxed.
 */
const FEATURES = [
  {
    icon: Barbell,
    title: "A coach that reads your history",
    body: "Before every set it tells you what you lifted last time, and by how much to go up. No guessing from memory between sets.",
  },
  {
    icon: Timer,
    title: "Rest that starts itself",
    body: "The timer begins the moment a set is logged and tells you when it is over. You never stand there wondering how long is left.",
  },
  {
    icon: ChartLine,
    title: "Progress you can actually see",
    body: "Estimated one rep max per lift, drawn against every session since you started. The line moves for reasons you can point at.",
  },
  {
    icon: Brain,
    title: "Ask it about your own training",
    body: "A short answer from your log: what you trained last week, when you plateaued, whether you have been adding weight.",
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
          <div className="order-2 md:order-1">
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

          <motion.div {...rise(0.12)} className="order-1 md:order-2">
            <AppPreview />
          </motion.div>
        </section>

        {/* What it does, as an index. Rules carry the separation, not boxes. */}
        <section className="border-t border-[var(--line)]">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="grid grid-cols-[28px_1fr] gap-x-4 gap-y-2 border-b border-[var(--line)] py-8 sm:grid-cols-[28px_15ch_1fr] sm:gap-x-6"
            >
              <Icon size={22} weight="bold" className="mt-0.5 text-[var(--ink-2)]" />
              <h2 className="text-[17px] font-semibold leading-snug sm:col-start-2">
                {title}
              </h2>
              <p className="col-start-2 max-w-[52ch] text-[15px] leading-relaxed text-[var(--ink-2)] sm:col-start-3">
                {body}
              </p>
            </div>
          ))}
        </section>

        <section className="border-t border-[var(--line)] py-16">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            {[
              ["876", "exercises ready, with instructions"],
              ["Two taps", "to log a set"],
              ["One screen", "to see where you are"],
            ].map(([head, body]) => (
              <div key={head}>
                <p className="text-[24px] font-bold tracking-[-0.02em]">{head}</p>
                <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--ink-2)]">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-[var(--line)] py-20">
          <div className="max-w-[30ch]">
            <h2 className="text-[30px] font-bold leading-[1.1] tracking-[-0.025em] md:text-[38px]">
              Your next session starts now.
            </h2>
            <p className="mt-4 max-w-[46ch] text-[15px] leading-relaxed text-[var(--ink-2)]">
              Setup takes four questions. Nothing to import, nothing to
              configure before you can log a set.
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
          <p className="text-center text-[13px] text-[var(--ink-3)]">
            Reprange · tracks what you lift, nothing else
          </p>
        </footer>
      </main>
    </div>
  );
}
