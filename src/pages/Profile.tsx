import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useNavigate } from "react-router-dom";
import { api } from "../convex/_generated/api";
import { SignOut, Fire } from "@phosphor-icons/react";

export default function Profile() {
  const userId = useQuery(api.users.loggedInUser);
  const stats = useQuery(api.workouts.stats);
  const { signOut } = useAuthActions();
  const navigate = useNavigate();

  const doSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="px-5 pt-12">
      <h1 className="text-[30px] font-semibold tracking-[-0.02em]">Profile</h1>

      <div className="panel mt-6 flex items-center gap-4 p-5">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ink text-[18px] font-semibold text-white">
          R
        </div>
        <div>
          <p className="text-[15px] font-semibold">Athlete</p>
          <p className="meta mt-0.5 normal-case">Reprange member</p>
        </div>
      </div>

      <div className="panel mt-3 flex items-center gap-3 p-5">
        <Fire size={20} weight="duotone" className="text-spot" />
        <div>
          <p className="font-mono text-[15px] font-medium">
            {stats?.streak ?? 0} day streak
          </p>
          <p className="meta mt-0.5 normal-case">Keep it going</p>
        </div>
      </div>

      <button
        onClick={doSignOut}
        className="btn-line mt-8 w-full text-pale-redtext"
        disabled={!userId}
      >
        <SignOut size={16} /> Sign out
      </button>

      <p className="mt-12 text-center text-[13px] text-ink-3">Reprange</p>
    </div>
  );
}
