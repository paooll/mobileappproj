import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { useNavigate } from "react-router-dom";
import { Trash } from "@phosphor-icons/react";

export default function History() {
  const workouts = useQuery(api.workouts.list);
  const remove = useMutation(api.workouts.remove);
  const navigate = useNavigate();

  if (!workouts) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-line border-t-ink" />
      </div>
    );
  }

  const completed = workouts.filter((w) => w.completedAt);

  return (
    <div className="px-5 pt-12">
      <h1 className="text-[30px] font-semibold tracking-[-0.02em]">History</h1>
      <p className="meta mt-1 normal-case">
        {completed.length} completed {completed.length === 1 ? "workout" : "workouts"}
      </p>

      {completed.length === 0 ? (
        <div className="panel mt-8 p-8 text-center">
          <p className="text-[15px] text-ink-2">
            No workouts yet. Log your first session and it will appear here.
          </p>
        </div>
      ) : (
        <div className="panel mt-6 divide-y divide-line p-0">
          {completed.map((w) => (
            <div key={w._id} className="flex items-center justify-between px-4 py-3.5">
              <button className="flex-1 text-left" onClick={() => navigate(`/app/workout/${w._id}`)}>
                <p className="text-[15px] font-medium">{w.name}</p>
                <p className="meta mt-0.5 normal-case">{w.date}</p>
              </button>
              <button
                onClick={() => remove({ workoutId: w._id })}
                className="text-ink-3 transition-colors hover:text-pale-redtext"
                aria-label="Delete workout"
              >
                <Trash size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
