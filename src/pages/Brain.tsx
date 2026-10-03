import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useReducedMotion } from "framer-motion";
import { ArrowUp, Brain as BrainIcon, CaretLeft, X } from "@phosphor-icons/react";
import { loadArchive, loadExercises, type Workout, type WorkoutSet } from "../lib/data";
import {
  SUGGESTED_QUESTIONS,
  ask,
  type BrainAnswer,
  type Catalog,
  type CatalogEntry,
} from "../lib/brain";
import type { UserProfile } from "../lib/profile";
import { useUnit } from "../lib/units";
import { useAuthUser } from "../hooks/useAuthUser";
import { useToast } from "../components/Toast";
import ThemeToggle from "../components/ThemeToggle";
import BrainAnswerCard from "../components/BrainAnswerCard";

interface Turn {
  question: string;
  answer: BrainAnswer;
}

type CatalogRow = CatalogEntry & { name: string };

/** Indexes the shared catalog by name, and groups it for the muscle answers. */
function makeCatalog(rows: CatalogRow[]): Catalog {
  const byName = new Map<string, CatalogEntry>();
  for (const row of rows) {
    byName.set(row.name.toLowerCase(), {
      muscleGroup: row.muscleGroup,
      equipment: row.equipment,
    });
  }
  const groups = [...new Set(rows.map((r) => r.muscleGroup))];
  const byGroup = new Map<string, string[]>();
  for (const row of rows) {
    const list = byGroup.get(row.muscleGroup) ?? [];
    list.push(row.name);
    byGroup.set(row.muscleGroup, list);
  }
  return {
    of: (name) => byName.get(name.toLowerCase()),
    groups: () => groups,
    picksFor: (group) => byGroup.get(group) ?? [],
  };
}

export default function Brain({ profile }: { profile: UserProfile }) {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const user = useAuthUser();
  const { toast } = useToast();
  const [unit] = useUnit();

  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [setsByWorkout, setSetsByWorkout] = useState<Map<string, WorkoutSet[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState<Catalog>(() => ({ of: () => undefined, groups: () => [], picksFor: () => [] }));
  const [catalogLoading, setCatalogLoading] = useState(false);

  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [thinking, setThinking] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    loadArchive(user.uid)
      .then(({ workouts: w, setsByWorkout: s }) => {
        if (cancelled) return;
        setWorkouts(w);
        setSetsByWorkout(s);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) toast("Couldn't load your history.", "error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, toast]);

  useEffect(() => {
    endRef.current?.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "end",
    });
  }, [turns, thinking, reduce]);

  const submit = useCallback(
    async (raw: string) => {
      const q = raw.trim();
      if (!q || thinking) return;

      setQuestion("");
      setThinking(true);
      try {
        // Muscle and equipment questions need the shared catalog, which is
        // cached after the first read so this is normally free
        let active = catalog;
        const needsCatalog = /muscle|today|train|neglect|ignor/i.test(q);
        if (needsCatalog) {
          setCatalogLoading(true);
          const rows = await loadExercises().catch(() => null);
          if (rows) {
            active = makeCatalog(rows);
            setCatalog(active);
          }
          setCatalogLoading(false);
        }

        const answer = ask({
          question: q,
          workouts,
          setsByWorkout,
          profile,
          unit,
          today: new Date(),
          catalog: active,
        });
        setTurns((prev) => [...prev, { question: q, answer }]);
      } catch (err) {
        console.error(err);
        toast("Couldn't work that out. Try rephrasing.", "error");
      } finally {
        setThinking(false);
      }
    },
    [thinking, catalog, workouts, setsByWorkout, profile, unit, toast]
  );

  const empty = useMemo(() => turns.length === 0, [turns]);

  return (
    <div className="flex min-h-[100dvh] flex-col px-5 pt-[max(env(safe-area-inset-top),48px)]">
      <button
        onClick={() => {
          // Always lands somewhere real, even if opened straight from a link
          if (window.history.length > 1) navigate(-1);
          else navigate("/app");
        }}
        className="tab -ml-2 flex min-h-[44px] items-center gap-0.5 rounded-xl pr-2 text-[15px] font-medium text-[var(--ink-2)] transition-opacity active:opacity-60"
      >
        <CaretLeft size={18} weight="bold" /> Back
      </button>

      <div className="mt-4 flex items-start justify-between">
        <div className="min-w-0">
          <h1 className="text-[30px] font-bold tracking-[-0.02em]">Training brain</h1>
          <p className="label mt-1 normal-case">Answers from your own logged sets</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {!empty && (
            <button
              onClick={() => setTurns([])}
              className="tab flex h-11 items-center gap-1 rounded-xl px-2.5 text-[13px] font-medium text-[var(--ink-2)] transition-transform active:scale-[0.97]"
            >
              <X size={14} weight="bold" /> Clear
            </button>
          )}
          <ThemeToggle />
        </div>
      </div>

      {loading ? (
        <div className="mt-6 flex flex-col gap-3">
          <div className="h-24 animate-pulse rounded-[14px] bg-[var(--fill)]" />
          <div className="h-56 animate-pulse rounded-[14px] bg-[var(--fill)]" />
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-1 flex-col gap-3">
            {empty && (
              <div className="panel flex flex-col items-center px-6 py-9 text-center">
                <BrainIcon size={22} className="text-[var(--ink-3)]" />
                <p className="mt-3 max-w-[30ch] text-[15px] leading-snug text-[var(--ink-2)]">
                  Ask about your training and it reads your history to answer. Nothing is sent
                  anywhere, it all runs on your device.
                </p>
              </div>
            )}

            {turns.map((turn, i) => (
              <div key={`${turn.question}-${i}`} className="flex flex-col gap-2">
                <div className="ml-auto max-w-[85%] rounded-[14px] bg-[var(--ink)] px-3.5 py-2.5 text-[14px] leading-snug text-[var(--bg)]">
                  {turn.question}
                </div>
                <BrainAnswerCard answer={turn.answer} unit={unit} />
              </div>
            ))}

            {thinking && (
              <div className="panel flex items-center gap-2 p-4">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--ink-3)]" />
                <span className="text-[14px] text-[var(--ink-2)]">
                  {catalogLoading ? "Checking your exercise history…" : "Reading your history…"}
                </span>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Suggestions, useful until the thread gets going */}
          {empty && (
            <div className="mt-4 flex flex-col gap-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => submit(q)}
                  className="panel flex items-center justify-between px-4 py-3 text-left text-[14px] transition-transform active:scale-[0.99]"
                >
                  <span className="min-w-0">{q}</span>
                  <ArrowUp size={14} className="ml-3 shrink-0 rotate-45 text-[var(--ink-3)]" />
                </button>
              ))}
            </div>
          )}

          {/* Ask bar */}
          <form
            className="sticky bottom-[calc(env(safe-area-inset-bottom)+64px)] -mx-5 mt-4 px-5 py-3"
            style={{
              // Fades the thread out under the composer instead of cutting it
              // with a hard rule, and matches the glass used by the tab bar
              background: "var(--glass-bg)",
              backdropFilter: "blur(20px) saturate(1.8)",
              WebkitBackdropFilter: "blur(20px) saturate(1.8)",
              borderTop: "1px solid var(--glass-border)",
            }}
            onSubmit={(e) => {
              e.preventDefault();
              submit(question);
            }}
          >
            <div className="flex items-center gap-2">
              <input
                className="field"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask about your training"
                enterKeyHint="send"
                aria-label="Ask about your training"
              />
              <button
                type="submit"
                className="btn-solid shrink-0 !px-0"
                style={{ width: 48 }}
                disabled={!question.trim() || thinking}
                aria-label="Ask"
              >
                <ArrowUp size={18} weight="bold" />
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}