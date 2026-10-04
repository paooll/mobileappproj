import { useEffect, useMemo, useRef, useState } from "react";
import { ChatCircle, PaperPlaneTilt } from "@phosphor-icons/react";
import Sheet from "./Sheet";
import {
  COMMENT_MAX,
  addComment,
  authorNameOf,
  notifyMention,
  parseMentions,
  postVolume,
  subscribeComments,
  type FeedPost,
  type PostComment,
} from "../lib/social";
import { friendlyDate } from "../lib/progress";
import { useUnit } from "../lib/units";

/**
 * Quick replies. Typing on a phone is the main reason a comment box goes
 * unused, so the common things are one tap and the keyboard is optional.
 */
const QUICK = ["Strong session", "Let's go", "Beastly", "Same here", "Proud of you"];

interface Props {
  post: FeedPost;
  uid: string;
  myName: string;
  /** Everybody the writer could name: themselves plus who they follow. */
  mentionable: { uid: string; name: string }[];
  onClose: () => void;
}

export default function PostSheet({ post, uid, myName, mentionable, onClose }: Props) {
  const [unit] = useUnit();
  const [comments, setComments] = useState<PostComment[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const open = post !== null;

  // The thread is only read while the sheet is open. Opening a post is one
  // subcollection read, which is the whole reason comments do not sit inline.
  // No reset here: the page mounts this only while a post is open, so every
  // open starts from clean state rather than from a setState in an effect.
  useEffect(() => subscribeComments(post.id, setComments), [post.id]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [comments.length]);

  const remaining = COMMENT_MAX - draft.length;

  const send = async (text: string) => {
    if (busy) return;
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    setError(null);
    try {
      const mentioned = parseMentions(body, mentionable);
      await addComment(post.id, uid, myName, body, mentioned);
      // The bell is written by this device, because there is no server to do
      // it. One failure must not lose a comment that already landed.
      await Promise.all(
        mentioned.map((toUid) =>
          notifyMention(toUid, uid, myName, post.id, body).catch((err) => console.error(err))
        )
      );
      setDraft("");
    } catch (err) {
      console.error(err);
      setError("Couldn't send that. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const mine = useMemo(
    () => comments.filter((c) => c.authorUid === uid).length,
    [comments, uid]
  );const capped = post.commentCount > comments.length;

  return (
    <Sheet open={open} title={post.authorName} onClose={onClose}>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-2">
        <p className="text-[17px] font-bold leading-tight tracking-[-0.02em]">
          {post.workoutName}
        </p>
        <p className="mt-1 text-[13px] text-[var(--ink-2)]">
          {post.sets} {post.sets === 1 ? "set" : "sets"}
          <span className="px-1.5 text-[var(--ink-3)]">·</span>
          {postVolume(post, unit)}
          <span className="px-1.5 text-[var(--ink-3)]">·</span>
          {friendlyDate(post.date)}
        </p>

        {post.detail && post.detail.length > 0 && (
          <ul className="panel mt-3 divide-y divide-[var(--line)]">
            {post.detail.map((d, i) => (
              <li key={`${d.name}-${i}`} className="flex items-baseline justify-between gap-3 px-4 py-2">
                <span className="truncate text-[14px] text-[var(--ink-2)]">{d.name}</span>
                <span className="num shrink-0 text-[14px] font-semibold">
                  {d.weight} × {d.reps}
                </span>
              </li>
            ))}
          </ul>
        )}

        <h3 className="label mt-5 mb-2">
          {comments.length === 0
            ? "No comments yet"
            : `${comments.length}${capped ? "+" : ""} ${comments.length === 1 ? "comment" : "comments"}`}
        </h3>

        {comments.length === 0 ? (
          <p className="text-[14px] leading-relaxed text-[var(--ink-3)]">
            Say the first thing. A tap on one of the buttons below is enough.
          </p>
        ) : (
          <ul ref={listRef} className="panel divide-y divide-[var(--line)]">
            {comments.map((c) => (
              <li key={c.id} className="px-4 py-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-[14px] font-semibold">{authorNameOf(c.authorName)}</span>
                  {c.mentions.includes(uid) && (
                    <span className="tab px-1.5 py-0.5 text-[11px] font-semibold">mentioned you</span>
                  )}
                  <span className="ml-auto shrink-0 text-[11px] text-[var(--ink-3)]">
                    {friendlyDate(new Date(c.createdAt).toISOString().slice(0, 10))}
                  </span>
                </div>
                <p className="mt-1 text-[14px] leading-relaxed">{c.body}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="shrink-0 border-t border-[var(--line)] px-5 pb-4 pt-3">
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-2">
          {QUICK.map((q) => (
            <button
              key={q}
              onClick={() => send(q)}
              disabled={busy}
              className="tab min-h-[44px] shrink-0 px-3 text-[13px] font-semibold disabled:opacity-60"
            >
              {q}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <label className="sr-only" htmlFor="comment-body">
            Comment
          </label>
          <textarea
            id="comment-body"
            className="field max-h-28 min-h-[44px] flex-1 resize-none py-2.5"
            rows={1}
            value={draft}
            maxLength={COMMENT_MAX}
            placeholder={`Comment as ${authorNameOf(myName)}`}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button
            onClick={() => send(draft)}
            disabled={busy || draft.trim().length === 0}
            aria-label="Send comment"
            className="btn-solid h-11 w-11 shrink-0 disabled:opacity-60"
            style={{ background: "var(--ink)", color: "var(--bg)" }}
          >
            <PaperPlaneTilt size={18} weight="fill" />
          </button>
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          <span className="text-[12px] text-[var(--ink-3)]">
            Use @Name to pull somebody into it
          </span>
          {draft.length > COMMENT_MAX - 40 && (
            <span className="num text-[12px] text-[var(--ink-3)]">{remaining}</span>
          )}
        </div>
        {error && (
          <p role="alert" className="mt-2 text-[13px]" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        )}
        {mine > 0 && (
          <p className="mt-2 flex items-center gap-1.5 text-[12px] text-[var(--ink-3)]">
            <ChatCircle size={13} />
            {mine} of these are yours
          </p>
        )}
      </div>
    </Sheet>
  );
}
