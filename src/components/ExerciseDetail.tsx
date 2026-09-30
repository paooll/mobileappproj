import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CaretLeft, CaretRight, X, ImageSquare } from "@phosphor-icons/react";
import type { Exercise } from "../lib/data";

/**
 * Bottom sheet with demonstration images (swipeable) and step-by-step
 * instructions from the free-exercise-db dataset.
 */
export default function ExerciseDetail({
  exercise,
  onClose,
}: {
  exercise: Exercise;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const [img, setImg] = useState(0);
  const imgs = exercise.images ?? [];

  const step = (dir: 1 | -1) =>
    setImg((i) => Math.min(Math.max(i + dir, 0), imgs.length - 1));

  return (
    <motion.div
      className="fixed inset-0 z-[90] flex items-end justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Scrim */}
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
        style={{ backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}
      />

      <motion.div
        role="dialog"
        aria-modal="true"
        initial={reduce ? { opacity: 0 } : { y: "100%" }}
        animate={reduce ? { opacity: 1 } : { y: 0 }}
        exit={reduce ? { opacity: 0 } : { y: "100%" }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="glass relative mx-4 mb-[max(env(safe-area-inset-bottom),12px)] w-full max-w-md overflow-hidden rounded-3xl shadow-[var(--shadow-panel)]"
      >
        {/* Grabber */}
        <div className="flex justify-center pt-2.5">
          <span className="h-1 w-9 rounded-full bg-[var(--ink-3)] opacity-50" />
        </div>

        <div className="max-h-[78dvh] overflow-y-auto overscroll-contain px-5 pb-[max(env(safe-area-inset-bottom),20px)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-[20px] font-bold tracking-[-0.02em]">
                {exercise.name}
              </h2>
              <p className="label mt-0.5 normal-case">
                {exercise.muscleGroup} · {exercise.equipment}
              </p>
            </div>
            <button
              onClick={onClose}
              className="icon-btn shrink-0"
              aria-label="Close"
            >
              <X size={16} weight="bold" />
            </button>
          </div>

          {/* Demo images carousel */}
          {imgs.length > 0 ? (
            <div className="mt-4">
              <div className="relative overflow-hidden rounded-2xl bg-[var(--fill)]">
                <div
                  className="flex transition-transform duration-300 ease-out"
                  style={{ transform: `translateX(-${img * 100}%)` }}
                >
                  {imgs.map((src, i) => (
                    <img
                      key={src}
                      src={src}
                      alt={`${exercise.name} demonstration ${i + 1}`}
                      loading="lazy"
                      draggable={false}
                      className="aspect-square w-full shrink-0 select-none object-contain p-2"
                    />
                  ))}
                </div>

                {imgs.length > 1 && (
                  <>
                    {img > 0 && (
                      <button
                        onClick={() => step(-1)}
                        className="glass absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full"
                        aria-label="Previous image"
                      >
                        <CaretLeft size={14} weight="bold" />
                      </button>
                    )}
                    {img < imgs.length - 1 && (
                      <button
                        onClick={() => step(1)}
                        className="glass absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full"
                        aria-label="Next image"
                      >
                        <CaretRight size={14} weight="bold" />
                      </button>
                    )}
                    <div className="absolute bottom-2.5 left-1/2 flex -translate-x-1/2 gap-1.5">
                      {imgs.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setImg(i)}
                          aria-label={`Image ${i + 1}`}
                          className="h-1.5 rounded-full transition-all"
                          style={{
                            width: i === img ? 14 : 5,
                            background:
                              i === img ? "var(--ink)" : "var(--ink-3)",
                            opacity: i === img ? 1 : 0.4,
                          }}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-4 flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-2xl bg-[var(--fill)] text-[var(--ink-3)]">
              <ImageSquare size={28} weight="duotone" />
              <p className="text-[13px]">No demonstration image</p>
            </div>
          )}

          {/* Instructions */}
          {exercise.instructions.length > 0 && (
            <>
              <h3 className="label mt-6 mb-2">How to do it</h3>
              <ol className="flex flex-col gap-2.5">
                {exercise.instructions.map((text, i) => (
                  <li key={i} className="flex gap-3">
                    <span
                      className="num mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
                      style={{ background: "var(--fill)" }}
                    >
                      {i + 1}
                    </span>
                    <p className="text-[14px] leading-relaxed text-[var(--ink-2)]">
                      {text}
                    </p>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
