import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check } from "@phosphor-icons/react";
import { useAuthUser } from "../hooks/useAuthUser";
import { useToast } from "../components/Toast";
import {
  EXPERIENCE_OPTIONS,
  GOAL_OPTIONS,
  EQUIPMENT_OPTIONS,
  DEFAULT_PREFS,
  loadProfile,
  pickPrefs,
  saveProfile,
  type Experience,
  type Goal,
  type UserPrefs,
} from "../lib/profile";
import { useUnit } from "../lib/units";

const DAYS = [2, 3, 4, 5, 6];

const STEPS = ["Experience", "Goal", "Schedule", "Setup"] as const;

export default function Onboarding() {
  const user = useAuthUser();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [unit, setUnit] = useUnit();
  const reduce = useReducedMotion();

  const [step, setStep] = useState(0);
  const [experience, setExperience] = useState<Experience | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [days, setDays] = useState<number | null>(null);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  // Edit mode, reached from Profile. Setup starts with the answers already given.
  const [editing, setEditing] = useState(false);
  // Preferences chosen in Settings must survive an edit of the setup answers
  const [existing, setExisting] = useState<Partial<UserPrefs> | null>(null);

  // Prefill from the stored profile so editing never means retyping everything
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    loadProfile(user.uid).then((p) => {
      if (cancelled || !p) return;
      setEditing(true);
      setExperience(p.experience);
      setGoal(p.goal);
      setDays(p.daysPerWeek);
      setEquipment(p.equipment);
      setExisting(pickPrefs(p));
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const slide = reduce
    ? {}
    : {
        initial: { opacity: 0, x: 18 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -18 },
        transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] as const },
      };

  // A step is complete once it has an answer. Equipment and unit always have one.
  const canAdvance = useMemo(() => {
    if (step === 0) return experience !== null;
    if (step === 1) return goal !== null;
    if (step === 2) return days !== null;
    return true;
  }, [step, experience, goal, days]);

  const toggleEquipment = (e: string) =>
    setEquipment((prev) =>
      prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]
    );

  const finish = async () => {
    if (!user || !experience || !goal || !days || saving) return;
    setSaving(true);
    try {
      await saveProfile(user.uid, {
        experience,
        goal,
        daysPerWeek: days,
        equipment,
        unit,
        ...DEFAULT_PREFS,
        // Preferences already chosen in Settings survive a setup edit
        ...(existing ?? {}),
      }, user.email ?? "");
      // A finished cold start belongs in the app, not on the settings screen it
      // just wrote. Editing setup was reached from Profile, so put them back there.
      navigate(editing ? "/app/profile" : "/app", { replace: true });
    } catch (err) {
      console.error(err);
      toast("Couldn't save your setup. Try again.", "error");
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col px-5 pt-[max(env(safe-area-inset-top),32px)] pb-[max(env(safe-area-inset-bottom),24px)]">
      {/* Progress rail — four segments, filled as far as you have got */}
      <div className="flex items-center gap-2">
        {/* Step 0 has nowhere to go back to, and leaving mid-setup would
            strand the account without a profile, so the control is absent */}
        {step > 0 ? (
          <button
            onClick={() => setStep(step - 1)}
            className="tab -ml-2 flex h-11 w-11 items-center justify-center rounded-full text-[var(--ink-2)] transition-opacity active:opacity-50"
            aria-label="Go back a step"
          >
            <ArrowLeft size={17} weight="bold" />
          </button>
        ) : (
          <span className="w-3" />
        )}
        <div
          className="flex flex-1 gap-1.5"
          role="progressbar"
          aria-label={`Setup step ${step + 1} of ${STEPS.length}`}
          aria-valuenow={step + 1}
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
        >
          {STEPS.map((s, i) => (
            <div
              key={s}
              className="h-1 flex-1 rounded-full transition-colors duration-300"
              style={{ background: i <= step ? "var(--ink)" : "var(--line)" }}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-center py-10">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={step} {...slide}>
            {step === 0 && (
              <>
                <p className="label">Step 1 of 4</p>
                <h1 className="mt-2 text-[32px] font-bold leading-[1.08] tracking-[-0.025em]">
                  Where are you starting from?
                </h1>
                <p className="mt-2 max-w-[34ch] text-[15px] leading-relaxed text-[var(--ink-2)]">
                  {editing
                    ? "Change anything here and it applies to future sessions."
                    : "This tunes the starting weights and how much detail you see."}
                </p>
                <div className="mt-7 flex flex-col gap-2">
                  {EXPERIENCE_OPTIONS.map((o) => {
                    const on = experience === o.value;
                    return (
                      <button
                        key={o.value}
                        onClick={() => setExperience(o.value)}
                        aria-pressed={on}
                        className="panel flex items-center justify-between gap-3 p-4 text-left transition-transform active:scale-[0.98]"
                        style={
                          on
                            ? { borderColor: "var(--ink)", background: "var(--fill)" }
                            : undefined
                        }
                      >
                        <span className="min-w-0">
                          <span className="block text-[16px] font-semibold">{o.label}</span>
                          <span className="mt-0.5 block text-[13px] leading-snug text-[var(--ink-2)]">
                            {o.hint}
                          </span>
                        </span>
                        {on && <Check size={18} weight="bold" className="shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <p className="label">Step 2 of 4</p>
                <h1 className="mt-2 text-[32px] font-bold leading-[1.08] tracking-[-0.025em]">
                  What are you training for?
                </h1>
                <p className="mt-2 max-w-[34ch] text-[15px] leading-relaxed text-[var(--ink-2)]">
                  You can change this later. It shapes the daily hint on Today.
                </p>
                <div className="mt-7 grid grid-cols-2 gap-2">
                  {GOAL_OPTIONS.map((o) => {
                    const on = goal === o.value;
                    return (
                      <button
                        key={o.value}
                        onClick={() => setGoal(o.value)}
                        aria-pressed={on}
                        className="panel flex flex-col justify-between gap-6 p-4 text-left transition-transform active:scale-[0.97]"
                        style={
                          on
                            ? { borderColor: "var(--ink)", background: "var(--fill)" }
                            : undefined
                        }
                      >
                        <span className="text-[16px] font-semibold leading-snug">{o.label}</span>
                        {on && <Check size={17} weight="bold" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <p className="label">Step 3 of 4</p>
                <h1 className="mt-2 text-[32px] font-bold leading-[1.08] tracking-[-0.025em]">
                  How many days a week?
                </h1>
                <p className="mt-2 max-w-[34ch] text-[15px] leading-relaxed text-[var(--ink-2)]">
                  Used as a weekly target so Today can tell you where you stand.
                </p>
                <div className="mt-7 flex flex-col gap-2">
                  {DAYS.map((d) => {
                    const on = days === d;
                    return (
                      <button
                        key={d}
                        onClick={() => setDays(d)}
                        aria-pressed={on}
                        className="panel flex items-center gap-4 p-4 text-left transition-transform active:scale-[0.98]"
                        style={
                          on
                            ? { borderColor: "var(--ink)", background: "var(--fill)" }
                            : undefined
                        }
                      >
                        <span
                          className="num w-8 shrink-0 text-[28px] font-bold leading-none"
                        >
                          {d}
                        </span>
                        <span className="flex-1 text-[16px] font-semibold">
                          {d === 2 ? "Twice a week" : d === 6 ? "Most days" : `${d} days a week`}
                        </span>
                        {on && <Check size={18} weight="bold" className="shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <p className="label">Step 4 of 4</p>
                <h1 className="mt-2 text-[32px] font-bold leading-[1.08] tracking-[-0.025em]">
                  What do you train with?
                </h1>
                <p className="mt-2 max-w-[34ch] text-[15px] leading-relaxed text-[var(--ink-2)]">
                  Pick what you have. Skip it if you are not sure, you can add gear later.
                </p>

                <div className="mt-7 flex flex-wrap gap-2">
                  {EQUIPMENT_OPTIONS.map((e) => {
                    const on = equipment.includes(e);
                    return (
                      <button
                        key={e}
                        onClick={() => toggleEquipment(e)}
                        aria-pressed={on}
                        className="btn-quiet shrink-0"
                        style={on ? { background: "var(--ink)", color: "var(--bg)" } : undefined}
                      >
                        {e}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-8">
                  <p className="label mb-2">Weight unit</p>
                  <div
                    className="flex rounded-xl p-1"
                    style={{ background: "var(--fill)" }}
                    role="group"
                    aria-label="Weight unit"
                  >
                    {(["kg", "lb"] as const).map((u) => (
                      <button
                        key={u}
                        onClick={() => setUnit(u)}
                        aria-pressed={unit === u}
                        className="tab flex h-11 flex-1 items-center justify-center rounded-lg text-[15px] font-semibold transition-colors"
                        style={{
                          background: unit === u ? "var(--ink)" : "transparent",
                          color: unit === u ? "var(--bg)" : "var(--ink-2)",
                        }}
                      >
                        {u === "kg" ? "Kilograms" : "Pounds"}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex gap-2">
        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep(step + 1)}
            disabled={!canAdvance}
            className="btn-solid flex-1"
            style={canAdvance ? undefined : { opacity: 0.4 }}
          >
            Continue
            <ArrowRight size={16} weight="bold" />
          </button>
        ) : (
          <button
            onClick={finish}
            disabled={saving}
            className="btn-solid flex-1"
            style={saving ? { opacity: 0.6 } : undefined}
          >
            {saving ? "Saving…" : editing ? "Save changes" : "Start training"}
          </button>
        )}
      </div>
    </div>
  );
}
