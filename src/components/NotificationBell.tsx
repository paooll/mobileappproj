import { useEffect, useState } from "react";
import { Bell, BellSimple } from "@phosphor-icons/react";
import Sheet from "./Sheet";
import {
  markNotificationsRead,
  subscribeNotifications,
  type AppNotification,
} from "../lib/social";
import { friendlyDate } from "../lib/progress";
import { useToast } from "./Toast";

/**
 * The bell. No Cloud Functions run on the free plan, so there is no push to be
 * had and nothing to poll in the background: the list is a live subscription on
 * the athlete's own collection, which costs no document access calls at all.
 */
export default function NotificationBell({ uid }: { uid: string }) {
  const { toast } = useToast();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!uid) return;
    return subscribeNotifications(uid, setItems);
  }, [uid]);

  const unread = items.filter((n) => !n.read).length;

  const show = async () => {
    setOpen(true);
    // Only what is already on screen is cleared. Clearing by query rather than
    // by id would also swallow anything that arrived while the sheet was open,
    // which is how a mention could land and be marked read without ever being
    // seen.
    const seen = items.map((n) => n.id);
    if (seen.length === 0) return;
    try {
      await markNotificationsRead(uid, seen);
    } catch (err) {
      // Nothing arrives on a failed write, so the dot would sit claiming there
      // is something unread that the list has already shown.
      console.error(err);
      toast("Couldn't clear that. Try again.", "error");
    }
  };

  return (
    <>
      <button
        onClick={show}
        aria-label={
          unread === 0
            ? "Mentions"
            : `Mentions, ${unread} unread`
        }
        className="icon-btn relative h-11 w-11 text-[var(--ink-2)]"
      >
        {unread > 0 ? <BellSimple size={20} weight="fill" /> : <Bell size={20} />}
        {unread > 0 && (
          <span
            className="num absolute right-1.5 top-1.5 min-w-[16px] rounded-full px-1 text-[10px] font-bold leading-4"
            style={{ background: "var(--danger)", color: "var(--bg)" }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      <Sheet open={open} title="Mentions" onClose={() => setOpen(false)}>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
          {items.length === 0 ? (
            <p className="text-[14px] leading-relaxed text-[var(--ink-3)]">
              Nobody has pulled you into a comment yet. Type @Name in a comment and
              it turns up here.
            </p>
          ) : (
            <ul className="panel divide-y divide-[var(--line)]">
              {items.map((n) => (
                <li key={n.id} className="px-4 py-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[14px] font-semibold">{n.fromName}</span>
                    <span className="text-[13px] text-[var(--ink-2)]">mentioned you</span>
                    <span className="ml-auto shrink-0 text-[11px] text-[var(--ink-3)]">
                      {friendlyDate(new Date(n.createdAt).toISOString().slice(0, 10))}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-3 text-[14px] leading-relaxed text-[var(--ink-2)]">
                    {n.body}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Sheet>
    </>
  );
}
