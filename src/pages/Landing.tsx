import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "@phosphor-icons/react";
import ThemeToggle from "../components/ThemeToggle";

const ease = [0.16, 1, 0.3, 1] as const;

/* Real component preview of the dark app — not a fake div screenshot */
function AppPreview() {
  return (
    <div
      className="w-full rounded-[2rem] border border-[#262629] p-5 text-left"
      style={{ background: "#0c0c0d", color: "#f5f5f5" }}
    >
      <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#2c2c30]" />
      <p
        className="text-[10px] uppercase tracking-[0.08em]"
        style={{ color: "#636368", fontFamily: "ui-monospace, monospace" }}
      >
        Monday · Push Day
      </p>
      <div className="mt-2 flex items-end gap-2">
        <span className="num text-[44px] font-bold leading-none tracking-[-0.04em]">
          12
        </span>
        <span className="pb-1 text-[12px] font-medium" style={{ color: "#a0a0a5" }}>
          days in a row
        </span>
      </div>
      <div className="mt-4 rounded-2xl border border-[#262629] p-3" style={{ background: "#161618" }}>
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-semibold">Bench Press</p>
          <p
            className="text-[10px] uppercase tracking-[0.08em]"
            style={{ color: "#636368", fontFamily: "ui-monospace, monospace" }}
          >
            3 sets
          </p>
        </div>
        <div className="mt-2 flex flex-col gap-1.5">
          {[
            ["1", "70 kg × 8"],
            ["2", "72.5 kg × 8"],
            ["3", "72.5 kg × 6"],
          ].map(([n, v]) => (
            <div
              key={n}
              className="flex items-center justify-between rounded-xl px-3 py-2"
              style={{ background: "#232326" }}
            >
              <span
                className="text-[10px]"
                style={{ color: "#636368", fontFamily: "ui-monospace, monospace" }}
              >
                {n}
              </span>
              <span className="num text-[14px] font-semibold">{v}</span>
              <span className="w-3" />
            </div>
          ))}
        </div>
      </div>
      <div
        className="mt-3 flex h-11 items-center justify-center gap-2 rounded-xl text-[13px] font-semibold"
        style={{ background: "#f5f5f5", color: "#0c0c0d" }}
      >
        Log set
      </div>
    </div>
  );
}

export default function Landing() {
  const reduce = useReducedMotion();
  const fade = (delay = 0) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 16 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, margin: "-60px" },
          transition: { duration: 0.6, delay, ease },
        };

  return (
    <div className="min-h-[100dvh] bg-[var(--bg)] text-[var(--ink)]">
      <nav className="sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--bg)]/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between px-5">
          <span className="text-[16px] font-semibold tracking-tight">Reprange</span>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              to="/auth"
              className="tab text-[14px] font-medium text-[var(--ink-2)] transition-opacity active:opacity-60"
            >
              Sign in
            </Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto w-full max-w-3xl px-5">
        {/* Asymmetric hero: copy left, real app preview right */}
        <section className="grid min-h-[80dvh] grid-cols-1 items-center gap-12 py-16 md:grid-cols-[1.15fr_1fr] md:py-0">
          <div className="order-2 md:order-1">
            <motion.h1
              {...(reduce
                ? {}
                : {
                    initial: { opacity: 0, y: 20 },
                    animate: { opacity: 1, y: 0 },
                    transition: { duration: 0.7, ease },
                  })}
              className="text-[46px] font-bold leading-[1.02] tracking-[-0.035em] md:text-[58px]"
            >
              Train. Log.
              <br />
              Repeat.
            </motion.h1>
            <motion.p
              {...(reduce
                ? {}
                : {
                    initial: { opacity: 0, y: 20 },
                    animate: { opacity: 1, y: 0 },
                    transition: { duration: 0.7, delay: 0.1, ease },
                  })}
              className="mt-4 max-w-[36ch] text-[16px] leading-relaxed text-[var(--ink-2)]">
              A workout tracker that stays out of the way of the work. Two taps
              per set, one number that keeps you honest.
            </motion.p>
            <motion.div
              {...(reduce
                ? {}
                : {
                    initial: { opacity: 0, y: 20 },
                    animate: { opacity: 1, y: 0 },
                    transition: { duration: 0.7, delay: 0.2, ease },
                  })}
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
          <motion.div
            {...(reduce
              ? {}
              : {
                  initial: { opacity: 0, y: 24 },
                  animate: { opacity: 1, y: 0 },
                  transition: { duration: 0.8, delay: 0.15, ease },
                })}
            className="order-1 md:order-2"
          >
            <AppPreview />
          </motion.div>
        </section>

        {/* Three numbers, not three cards */}
        <section className="border-t border-[var(--line)] py-20">
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-3">
            {[
              ["2 taps", "to log a set. Steppers for weight and reps, then Log set."],
              ["1 number", "your streak. Show up and it grows. Miss a day, start over."],
              ["0 clutter", "no feeds, no badges, no noise. Sets and progress only."],
            ].map(([head, body], i) => (
              <motion.div key={head} {...fade(i * 0.08)}>
                <p className="text-[28px] font-bold tracking-[-0.02em]">{head}</p>
                <p className="mt-2 text-[14px] leading-relaxed text-[var(--ink-2)]">
                  {body}
                </p>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="border-t border-[var(--line)] py-20 text-center">
          <motion.h2
            {...fade()}
            className="mx-auto max-w-[18ch] text-[30px] font-bold leading-tight tracking-[-0.02em]"
          >
            Your next session starts now.
          </motion.h2>
          <motion.div {...fade(0.1)} className="mt-7">
            <Link to="/auth?returnTo=%2Fapp" className="btn-solid mx-auto inline-flex">
              Start training
              <ArrowRight size={16} weight="bold" />
            </Link>
          </motion.div>
        </section>

        <footer className="border-t border-[var(--line)] py-8">
          <p className="text-center text-[13px] text-[var(--ink-3)]">Reprange</p>
        </footer>
      </main>
    </div>
  );
}
