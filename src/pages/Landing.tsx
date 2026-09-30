import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  Barbell,
  FireSimple,
  ChartLineUp,
  ArrowRight,
  Barbell as Dumbbell,
} from "@phosphor-icons/react";

const features = [
  {
    icon: Barbell,
    title: "Log in seconds",
    body: "Two taps and a number. A set is recorded before your rest clock finishes.",
    seed: "reprange-barbell-plates",
  },
  {
    icon: FireSimple,
    title: "Streaks that stick",
    body: "Show up, tap the day. The count does the motivating for you.",
    seed: "reprange-athlete-morning",
  },
  {
    icon: ChartLineUp,
    title: "See strength grow",
    body: "Every set adds to your total volume. Progress you can point at.",
    seed: "reprange-gym-quiet",
  },
];

const ease = [0.16, 1, 0.3, 1] as const;

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
    <div className="min-h-[100dvh] bg-canvas">
      {/* Nav — single line, hairline bottom */}
      <nav className="sticky top-0 z-40 border-b border-line bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between px-5">
          <div className="flex items-center gap-2">
            <Dumbbell size={20} weight="bold" />
            <span className="text-[16px] font-semibold tracking-tight">
              Reprange
            </span>
          </div>
          <Link
            to="/auth"
            className="text-[14px] font-medium text-ink-2 transition-colors hover:text-ink"
          >
            Sign in
          </Link>
        </div>
      </nav>

      <main className="mx-auto w-full max-w-3xl px-5">
        {/* Hero — asymmetric: text left, photo right. Max 4 text elements. */}
        <section className="grid min-h-[82dvh] grid-cols-1 items-center gap-10 py-14 md:grid-cols-[1.1fr_1fr] md:py-0">
          <div className="order-2 md:order-1">
            <motion.h1
              {...(reduce
                ? {}
                : {
                    initial: { opacity: 0, y: 20 },
                    animate: { opacity: 1, y: 0 },
                    transition: { duration: 0.7, ease },
                  })}
              className="text-[44px] font-semibold leading-[1.05] tracking-[-0.03em] md:text-[56px]"
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
              className="mt-4 max-w-[38ch] text-[16px] leading-relaxed text-ink-2"
            >
              A workout tracker that stays out of the way of the work.
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
              <Link
                to="/auth?returnTo=%2Fapp"
                className="btn-solid w-full sm:w-auto"
              >
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
                  initial: { opacity: 0, scale: 0.97 },
                  animate: { opacity: 1, scale: 1 },
                  transition: { duration: 0.8, delay: 0.15, ease },
                })}
            className="order-1 md:order-2"
          >
            <img
              src="https://picsum.photos/seed/reprange-hero-barbell/720/900"
              alt="Loaded barbell resting on a gym floor"
              width={720}
              height={900}
              loading="eager"
              className="aspect-[4/5] w-full rounded-xl border border-line object-cover grayscale-[0.35] contrast-[0.96]"
            />
          </motion.div>
        </section>

        {/* Features — bento 1+2 split, image inside two cells */}
        <section className="grid grid-cols-1 gap-4 py-24 md:grid-cols-2">
          {features.map(({ icon: Icon, title, body, seed }, i) => (
            <motion.div
              key={title}
              {...fade(i * 0.08)}
              className={`panel flex flex-col gap-3 p-8 ${
                i === 0 ? "md:col-span-2 md:flex-row md:items-center md:gap-10" : ""
              }`}
            >
              <div className={i === 0 ? "md:max-w-[22rem]" : ""}>
                <Icon size={24} weight="duotone" className="text-spot" />
                <h3 className="mt-4 text-[19px] font-semibold tracking-tight">
                  {title}
                </h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-ink-2">
                  {body}
                </p>
              </div>
              <img
                src={`https://picsum.photos/seed/${seed}/640/420`}
                alt=""
                width={640}
                height={420}
                loading="lazy"
                className={`mt-2 w-full rounded-lg border border-line object-cover grayscale-[0.35] ${
                  i === 0 ? "md:ml-auto md:max-w-[280px]" : ""
                }`}
              />
            </motion.div>
          ))}
        </section>

        {/* Closing CTA — plain, hairline top, no dark block */}
        <section className="border-t border-line py-24 text-center">
          <motion.h2
            {...fade()}
            className="mx-auto max-w-[16ch] text-[30px] font-semibold leading-tight tracking-[-0.02em]"
          >
            Your next session starts now.
          </motion.h2>
          <motion.div {...fade(0.1)} className="mt-7">
            <Link
              to="/auth?returnTo=%2Fapp"
              className="btn-solid mx-auto inline-flex"
            >
              Start training
              <ArrowRight size={16} weight="bold" />
            </Link>
          </motion.div>
        </section>

        <footer className="border-t border-line py-8">
          <p className="text-center text-[13px] text-ink-3">Reprange</p>
        </footer>
      </main>
    </div>
  );
}
