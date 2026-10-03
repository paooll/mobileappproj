import { useEffect, useState } from "react";
import { Trash } from "@phosphor-icons/react";
import ConfirmSheet from "./ConfirmSheet";
import { useToast } from "./Toast";
import { useUnit } from "../lib/units";
import { friendlyDate } from "../lib/progress";
import { deletePost, postVolume, subscribeOwnPosts, type FeedPost } from "../lib/social";

/**
 * Everything this account has put on other people's feeds, and the one place
 * to take it back down. A summary is small, but it is the only part of a
 * session that leaves the account, so it needs to be retractable.
 */
export default function SharedPosts({ uid }: { uid: string }) {
  const { toast } = useToast();
  const [unit] = useUnit();
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [pending, setPending] = useState<FeedPost | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribeOwnPosts(uid, setPosts), [uid]);

  const remove = async () => {
    if (!pending || busy) return;
    setBusy(true);
    try {
      await deletePost(pending.id);
      toast("Removed from everyone's feed.", "success");
      setPending(null);
    } catch (err) {
      console.error(err);
      toast("Couldn't take that down. Try again.", "error");
    } finally {
      setBusy(false);
    }
  };

  const shared = posts ?? [];

  return (
    <>
      <h2 className="label mt-10 mb-3">Shared from here</h2>
      {posts === null ? (
        <div className="h-[64px] animate-pulse rounded-[14px] bg-[var(--fill)]" />
      ) : shared.length === 0 ? (
        <div className="panel px-4 py-4">
          <p className="text-[15px] font-medium">Nothing shared</p>
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--ink-2)]">
            Every session you finish adds a summary here: the name, how many
            sets, the volume and the date. The exercises, the weights and the
            reps stay on this account.
          </p>
        </div>
      ) : (
        <div className="panel divide-y divide-[var(--line)]">
          {shared.map((p) => (
            <div key={p.id} className="flex items-center gap-1 pr-1">
              <div className="min-w-0 flex-1 px-4 py-3">
                <p className="truncate text-[15px] font-medium">{p.workoutName}</p>
                <p className="num label mt-0.5 normal-case">
                  {friendlyDate(p.date)} · {p.sets} sets · {postVolume(p, unit)}
                </p>
              </div>
              <button
                onClick={() => setPending(p)}
                className="tab flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--ink-3)] transition-colors active:bg-[var(--fill)] active:text-[var(--danger)]"
                aria-label={`Remove ${p.workoutName} from the feed`}
              >
                <Trash size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      <ConfirmSheet
        open={pending !== null}
        title="Take this off the feed?"
        body="It disappears from everyone's feed. The session itself stays in your history, sets and all."
        confirmLabel="Remove it"
        busy={busy}
        onConfirm={remove}
        onCancel={() => setPending(null)}
      />
    </>
  );
}
