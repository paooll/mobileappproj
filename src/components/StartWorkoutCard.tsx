import { useState } from "react";
import { useMutation } from "convex/react";
import { useNavigate } from "react-router-dom";
import { api } from "../convex/_generated/api";
import { Plus, Play } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "framer-motion";

const SUGGESTIONS = ["Push Day", "Pull Day", "Leg Day", "Full Body"];

export default function StartWorkoutCard({
  activeId,
}: {
  activeId?: import("../convex/_generated/dataModel").Id<"workouts">;
}) {
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);
  const start = useMutation(api.workouts.start);
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const rise = reduce
    ? {}
    : {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
      };

  const begin = async (workoutName: string) => {
    const id = await start({ name: workoutName });
    navigate(`/app/workout/${id}`);
  };

  if (activeId) {
    return (
      <motion.button
        {...rise}
        onClick={() => navigate(`/app/workout/${activeId}`)}
        className="btn-solid mt-6 w-full"
      >
        <Play size={16} weight="fill" /> Resume workout
      </motion.button>
    );
  }

  if (!open) {
    return (
      <motion.button
        {...rise}
        onClick={() => setOpen(true)}
        className="btn-solid mt-6 w-full"
      >
        <Plus size={16} weight="bold" /> Start workout
      </motion.button>
    );
  }

  return (
    <motion.div {...rise} className="panel mt-6 p-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="workout-name" className="meta">
          Workout name
        </label>
        <input
          id="workout-name"
          autoFocus
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) begin(name.trim());
          }}
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            className="btn-quiet text-[13px]"
            onClick={() => begin(s)}
          >
            {s}
          </button>
        ))}
      </div>
      <button
        className="btn-solid mt-4 w-full"
        disabled={!name.trim()}
        onClick={() => name.trim() && begin(name.trim())}
      >
        Begin
      </button>
    </motion.div>
  );
}
