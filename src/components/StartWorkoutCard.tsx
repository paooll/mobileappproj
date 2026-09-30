import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Play } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "framer-motion";
import { startWorkout } from "../lib/data";
import { useAuthUser } from "../hooks/useAuthUser";

const SUGGESTIONS = ["Push Day", "Pull Day", "Leg Day", "Full Body"];

export default function StartWorkoutCard({
  activeId,
}: {
  activeId?: string;
  onStarted?: () => void;
}) {
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const user = useAuthUser();
  const reduce = useReducedMotion();
  const rise = reduce
    ? {}
    : {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const },
      };

  const begin = async (workoutName: string) => {
    if (!user || busy) return;
    setBusy(true);
    try {
      const id = await startWorkout(user.uid, workoutName);
      navigate(`/app/workout/${id}`);
    } finally {
      setBusy(false);
    }
  };

  if (activeId) {
    return (
      <motion.button
        {...rise}
        onClick={() => navigate(`/app/workout/${activeId}`)}
        className="btn-solid mt-6 w-full"
      >
        <Play size={17} weight="fill" /> Resume workout
      </motion.button>
    );
  }

  if (!open) {
    return (
      <motion.button
        {...rise}
        onClick={() => setOpen(true)}
        className="btn-solid mt-8 w-full"
      >
        <Plus size={18} weight="bold" /> Start workout
      </motion.button>
    );
  }

  return (
    <motion.div {...rise} className="panel mt-8 p-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="workout-name" className="label">
          Workout name
        </label>
        <input
          id="workout-name"
          autoFocus
          className="field"
          enterKeyHint="done"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) begin(name.trim());
          }}
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button key={s} className="btn-quiet" onClick={() => begin(s)}>
            {s}
          </button>
        ))}
      </div>
      <button
        className="btn-solid mt-4 w-full"
        disabled={!name.trim()}
        style={name.trim() ? undefined : { opacity: 0.4 }}
        onClick={() => name.trim() && begin(name.trim())}
      >
        Begin
      </button>
    </motion.div>
  );
}
