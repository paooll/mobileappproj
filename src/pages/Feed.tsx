import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Copy, Trophy, UserPlus, UsersThree, X } from "@phosphor-icons/react";
import ThemeToggle from "../components/ThemeToggle";
import ConfirmSheet from "../components/ConfirmSheet";
import ReactionRow from "../components/ReactionRow";
import PostSheet from "../components/PostSheet";
import NotificationBell from "../components/NotificationBell";
import Sheet from "../components/Sheet";
import { ChatCircle } from "@phosphor-icons/react";
import { useToast } from "../components/Toast";
import { useAuthUser } from "../hooks/useAuthUser";
import {
  CHEER_MAX,
  REACTIONS,
  acceptFollow,
  authorNameOf,
  countReaction,
  declineFollow,
  findByHandle,
  gaveReaction,
  loadNamesFor,
  postVolume,
  requestFollow,
  subscribeFeed,
  subscribeFollowing,
  subscribeRequestsForMe,
  subscribeRequestsSent,
  syncHandle,
  toggleReaction,
  unfollow,
  type FeedPost,
  type Follow,
  type FollowRequest,
  type ReactionKey,
} from "../lib/social";
import { useUnit } from "../lib/units";
import { friendlyDate } from "../lib/progress";
import type { UserProfile } from "../lib/profile";

/** Requests waiting to be answered, highest first so the newest is in reach. */
function Requests({
  rows,
  busyId,
  nameOf,
  onAccept,
  onDecline,
}: {
  rows: FollowRequest[];
  busyId: string | null;
  nameOf: (uid: string, fallback: string) => string;
  onAccept: (row: FollowRequest) => void;
  onDecline: (row: FollowRequest) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <>
      <h2 className="label mt-10 mb-3">Wants to follow you</h2>
      <div className="panel divide-y divide-[var(--line)]">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-medium">
                {nameOf(r.followerUid, r.followerName)}
              </p>
              <p className="mt-0.5 text-[12px] text-[var(--ink-3)]">
                Sees the name, sets and volume of what you finish.
              </p>
            </div>
            <button
              onClick={() => onDecline(r)}
              disabled={busyId === r.id}
              aria-label={`Ignore ${nameOf(r.followerUid, r.followerName)}`}
              className="icon-btn h-11 w-11 shrink-0 text-[var(--ink-3)]"
            >
              <X size={17} />
            </button>
            <button
              onClick={() => onAccept(r)}
              disabled={busyId === r.id}
              className="btn-quiet min-h-[44px] shrink-0 gap-1.5"
            >
              <Check size={15} weight="bold" />
              {busyId === r.id ? "…" : "Accept"}
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

/** The code that lets somebody find this account, and the field that takes theirs. */
function FindPeople({
  code,
  uid,
  myName,
  onRequested,
}: {
  code: string | null;
  uid: string;
  myName: string;
  onRequested: (name: string) => void;
}) {
  const { toast } = useToast();
  const [entry, setEntry] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access is refused in plenty of ordinary places. The code is
      // on screen and selectable, so saying so beats a button that does nothing.
      toast(`Your code is ${code}. Copy it from here.`, "info");
    }
  };

  const send = async () => {
    const typed = entry.trim().toUpperCase();
    if (busy) return;
    if (typed.length !== 6) {
      toast("A code is six characters.", "error");
      return;
    }
    setBusy(true);
    try {
      const hit = await findByHandle(typed);
      if (!hit) {
        toast("No account with that code. Check it and try again.", "error");
        return;
      }
      if (hit.uid === uid) {
        toast("That is your own code.", "error");
        return;
      }
      await requestFollow(uid, myName, hit);
      toast(`Request sent to ${hit.name}.`, "success");
      setEntry("");
      onRequested(hit.name);
    } catch (err) {
      console.error(err);
      toast("Couldn't send that request. Try again.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h2 className="label mt-10 mb-3">Find people</h2>
      <div className="panel p-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[14px] text-[var(--ink-2)]">Your code</span>
          <span className="num text-[17px] font-bold tracking-[0.14em]">{code ?? "…"}</span>
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--ink-3)]">
          Read it out to somebody at the rack. It only ever shows your name.
        </p>
        <button onClick={copy} disabled={!code} className="btn-line mt-3 w-full gap-2">
          {copied ? <Check size={16} weight="bold" /> : <Copy size={16} />}
          {copied ? "Copied" : "Copy code"}
        </button>

        <div className="mt-4 border-t border-[var(--line)] pt-4">
          <label htmlFor="feed-code" className="text-[14px] text-[var(--ink-2)]">
            Their code
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="feed-code"
              className="field num flex-1 tracking-[0.14em] uppercase"
              value={entry}
              onChange={(e) => setEntry(e.target.value.toUpperCase().slice(0, 6))}
              placeholder="ABC123"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              inputMode="text"
              maxLength={6}
              onKeyDown={(e) => {
                if (e.key === "Enter") send();
              }}
            />
            <button
              onClick={send}
              disabled={busy || entry.length !== 6}
              className="btn-quiet min-h-[44px] shrink-0 gap-1.5"
            >
              <UserPlus size={15} />
              {busy ? "…" : "Ask"}
            </button>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-[var(--ink-3)]">
            Nothing reaches their feed until they say yes.
          </p>
        </div>
      </div>
    </>
  );
}

/** One shared session, or a rank crossing the app posted on your behalf. */
function PostRow({
  post,
  uid,
  onReact,
  onCheer,
  onOpen,
}: {
  post: FeedPost;
  uid: string;
  onReact: (post: FeedPost, key: ReactionKey) => void;
  onCheer: (post: FeedPost, key: ReactionKey) => void;
  onOpen: (post: FeedPost) => void;
}) {
  const [unit] = useUnit();
  const counts = useMemo(() => {
    const out = {} as Record<ReactionKey, number>;
    for (const r of REACTIONS) out[r.key] = countReaction(post, r.key);
    return out;
  }, [post]);
  const mine = useMemo(() => {
    const out = {} as Record<ReactionKey, boolean>;
    for (const r of REACTIONS) out[r.key] = gaveReaction(post, uid, r.key);
    return out;
  }, [post, uid]);
  const [busy, setBusy] = useState(false);
  const milestone = post.kind === "milestone";

  return (
    <article className={milestone ? "px-4 py-4" : "px-4 py-4"}>
      {milestone && (
        <span
          className="tab mb-2 inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-bold uppercase tracking-[0.06em]"
          style={{ background: "var(--fill)", color: "var(--ink)" }}
        >
          <Trophy size={13} weight="fill" />
          Rank up
        </span>
      )}
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="truncate text-[15px] font-semibold tracking-[-0.01em]">
          {post.authorName}
        </h3>
        <span className="label shrink-0 normal-case">{friendlyDate(post.date)}</span>
      </div>
      <p className="mt-1 text-[17px] font-bold leading-tight tracking-[-0.02em]">
        {post.workoutName}
      </p>
      <p className="num mt-1 text-[13px] text-[var(--ink-2)]">
        {post.sets} {post.sets === 1 ? "set" : "sets"}
        <span className="px-1.5 text-[var(--ink-3)]">·</span>
        {postVolume(post, unit)}
      </p>
      <div className="mt-3 flex items-center gap-2">
        <ReactionRow
          counts={counts}
          mine={mine}
          notes={post.notes ?? {}}
          busy={busy}
          onReact={async (key) => {
            if (busy) return;
            setBusy(true);
            try {
              await onReact(post, key);
            } finally {
              setBusy(false);
            }
          }}
          onCheer={(key) => onCheer(post, key)}
        />
        <button
          onClick={() => onOpen(post)}
          aria-label={
            post.commentCount === 0
              ? "Comment on this"
              : `Comments, ${post.commentCount} so far`
          }
          className="tab ml-auto flex h-11 shrink-0 items-center gap-1.5 px-3 text-[13px] font-semibold"
          style={{ background: "var(--fill)", color: "var(--ink-2)" }}
        >
          <ChatCircle size={16} />
          <span className="num">{post.commentCount}</span>
        </button>
      </div>
    </article>
  );
}

/** One word attached to a reaction. Forty characters is the whole budget. */
function CheerSheet({
  post,
  cheerKey,
  onClose,
  onSend,
}: {
  post: FeedPost;
  cheerKey: ReactionKey;
  onClose: () => void;
  onSend: (note: string) => void;
}) {
  // Mounted only while a cheer is open, so the word already on the reaction
  // arrives as the initial value rather than through a setState in an effect.
  const [note, setNote] = useState(() => post.notes?.[cheerKey] ?? "");
  const label = REACTIONS.find((r) => r.key === cheerKey)?.label ?? "";

  return (
    <Sheet open title={`${label} it`} onClose={onClose}>
      <div className="px-5 pb-5">
        <label htmlFor="cheer-note" className="text-[14px] text-[var(--ink-2)]">
          One word about this session
        </label>
        <input
          id="cheer-note"
          className="field mt-2"
          value={note}
          maxLength={CHEER_MAX}
          placeholder="that bench moved"
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && note.trim()) onSend(note);
          }}
        />
        <p className="mt-1.5 text-[12px] text-[var(--ink-3)]">
          Optional. The word goes away when you take the reaction back.
        </p>
        <button
          onClick={() => onSend(note)}
          disabled={!note.trim()}
          className="btn-solid mt-4 w-full disabled:opacity-60"
          style={{ background: "var(--ink)", color: "var(--bg)" }}
        >
          Send
        </button>
      </div>
    </Sheet>
  );
}

export default function Feed({ profile }: { profile: UserProfile }) {
  const user = useAuthUser();
  const { toast } = useToast();
  const reduce = useReducedMotion();
  const uid = user?.uid ?? "";
  const myName = authorNameOf(profile.displayName);

  const [requests, setRequests] = useState<FollowRequest[]>([]);
  const [requestsSent, setRequestsSent] = useState<FollowRequest[]>([]);
  const [following, setFollowing] = useState<Follow[] | null>(null);
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<Follow | null>(null);
  const [leavingBusy, setLeavingBusy] = useState(false);
  // Names asked for in this session. Firestore will echo them back in a beat,
  // but until it does the list would silently not change and the button reads
  // as broken rather than as sent.
  const [asked, setAsked] = useState<string[]>([]);
  const [openPost, setOpenPost] = useState<FeedPost | null>(null);
  const [cheering, setCheering] = useState<{ post: FeedPost; key: ReactionKey } | null>(null);
  // Declared here because the mention list below reads it, and a hook cannot be
  // used before it exists.
  const [liveNames, setLiveNames] = useState<Map<string, string>>(() => new Map());

  // Whoever can be named in a comment: the athlete plus everybody they follow.
  // The Feed already has the follow list in memory, so a mention costs no read.
  const mentionable = useMemo(
    () => [
      { uid, name: myName },
      ...(following ?? []).map((f) => ({
        uid: f.followeeUid,
        name: liveNames.get(f.followeeUid) ?? authorNameOf(f.followeeName),
      })),
    ],
    [uid, myName, following, liveNames]
  );

  const rise = reduce
    ? {}
    : {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
      };

  useEffect(() => {
    if (!user) return;
    syncHandle(user.uid, profile.displayName).then(setCode).catch((err) => {
      console.error(err);
      setCode(null);
    });
  }, [user, profile.displayName]);

  useEffect(() => {
    if (!user) return;
    return subscribeRequestsForMe(user.uid, setRequests);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return subscribeRequestsSent(user.uid, setRequestsSent);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return subscribeFollowing(user.uid, setFollowing);
  }, [user]);

  // Every edge carries a copy of the name from the day it was made, so the copy
  // goes stale the moment somebody renames. One query resolves the current
  // names for the whole list; the copies stay as the fallback for an account
  // whose handle has not been written yet.
  // Keyed on the uids themselves, not on the arrays. onSnapshot hands back a
  // fresh array on every delivery, so depending on those would re-query the
  // handles collection each time a post arrived, which is precisely the read
  // spend this page already struggles to justify.
  const namesKey = useMemo(
    () =>
      Array.from(
        new Set([
          ...(following ?? []).map((f) => f.followeeUid),
          ...(following ?? []).map((f) => f.followerUid),
          ...requests.map((r) => r.followerUid),
        ])
      )
        .filter(Boolean)
        .sort()
        .join(","),
    [following, requests]
  );
  useEffect(() => {
    let cancelled = false;
    if (!namesKey) return;
    loadNamesFor(namesKey.split(","))
      .then((names) => {
        if (!cancelled) setLiveNames(names);
      })
      .catch((err) => console.error("Could not resolve names:", err));
    return () => {
      cancelled = true;
    };
  }, [namesKey]);

  const nameOf = useCallback(
    (uid: string, fallback: string) => liveNames.get(uid) ?? authorNameOf(fallback),
    [liveNames]
  );

  // The feed cannot be asked for until the follow list has arrived, otherwise
  // the first query would run against nobody and show an empty page for good.
  const followeeKey = (following ?? []).map((f) => f.followeeUid).join(",");
  useEffect(() => {
    if (!user || following === null) return;
    const ids = followeeKey ? followeeKey.split(",") : [];
    return subscribeFeed(user.uid, ids, setPosts);
  }, [user, following, followeeKey]);

  const answer = async (row: FollowRequest, accept: boolean) => {
    if (busyId) return;
    setBusyId(row.id);
    try {
      if (accept) {
        await acceptFollow(row);
        toast(`${nameOf(row.followerUid, row.followerName)} can see your sessions now.`, "success");
      } else {
        await declineFollow(row.id);
      }
    } catch (err) {
      console.error(err);
      toast("Couldn't answer that request. Try again.", "error");
    } finally {
      setBusyId(null);
    }
  };

  const react = useCallback(
    async (post: FeedPost, key: ReactionKey, note = "") => {
      const giving = !post.reactions?.[key]?.includes(uid);
      const trimmed = note.trim().slice(0, CHEER_MAX);
      const nextNotes = giving
        ? { ...(post.notes ?? {}), [key]: trimmed }
        : Object.fromEntries(Object.entries(post.notes ?? {}).filter(([k]) => k !== key));
      // Applied before the write so the mark lands under the finger. The
      // snapshot puts it right either way.
      setPosts((prev) =>
        prev
          ? prev.map((p) =>
              p.id === post.id
                ? {
                    ...p,
                    notes: nextNotes,
                    reactions: {
                      ...p.reactions,
                      [key]: giving
                        ? [...(p.reactions?.[key] ?? []), uid]
                        : (p.reactions[key] ?? []).filter((u) => u !== uid),
                    },
                  }
                : p
            )
          : prev
      );
      try {
        await toggleReaction(post.id, uid, key, trimmed);
      } catch (err) {
        console.error(err);
        // Nothing arrives on a failed write, so the optimistic mark would sit
        // there claiming something the database never recorded.
        setPosts((prev) =>
          prev ? prev.map((p) => (p.id === post.id ? post : p)) : prev
        );
        toast("Couldn't save that. Try again.", "error");
      }
    },
    [uid, toast]
  );

  const sendCheer = useCallback(
    async (note: string) => {
      if (!cheering) return;
      const { post, key } = cheering;
      setCheering(null);
      // The same write the plain reaction does, carrying the word with it.
      await react(post, key, note);
    },
    [cheering, react]
  );

  const confirmLeave = async () => {
    if (!leaving || leavingBusy) return;
    setLeavingBusy(true);
    try {
      await unfollow(leaving.id);
      toast(`You stopped following ${nameOf(leaving.followeeUid, leaving.followeeName)}.`, "info");
      setLeaving(null);
    } catch (err) {
      console.error(err);
      toast("Couldn't leave that follow. Try again.", "error");
    } finally {
      setLeavingBusy(false);
    }
  };

  const follows = following ?? [];
  // Both sets are keyed on the name actually shown, so a rename does not leave
  // a row that reads "waiting" beside the same person under two names.
  const followNames = new Set(follows.map((f) => nameOf(f.followeeUid, f.followeeName)));
  // An ask stops being pending the moment it is accepted or declined, so a name
  // from this session is only still waiting if Firestore has not moved it into
  // either list yet. Without that check it would sit there saying "waiting"
  // after the very request it referred to had been answered.
  const askedNames = new Set<string>([
    ...requestsSent.map((r) => nameOf(r.followeeUid, r.followeeName)),
    ...asked.filter((n) => !followNames.has(n)),
  ]);
  const loading = following === null || posts === null;

  return (
    <div className="px-5 pt-[max(env(safe-area-inset-top),48px)]">
      <div className="flex items-start justify-between">
        <motion.h1 {...rise} className="text-[30px] font-bold tracking-[-0.02em]">
          Feed
        </motion.h1>
        <div className="flex items-center gap-1">
          <NotificationBell uid={uid} />
          <ThemeToggle />
        </div>
      </div>
      <p className="mt-1 text-[14px] text-[var(--ink-2)]">
        {follows.length === 0
          ? "Sessions from the people you follow."
          : `Following ${follows.length} ${follows.length === 1 ? "person" : "people"}.`}
      </p>

      <Requests
        rows={requests}
        busyId={busyId}
        nameOf={nameOf}
        onAccept={(r) => answer(r, true)}
        onDecline={(r) => answer(r, false)}
      />

      {loading ? (
        <div className="mt-8 flex flex-col gap-2" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[132px] animate-pulse rounded-[14px] bg-[var(--fill)]" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="panel mt-8 flex flex-col items-center px-6 py-11 text-center">
          <UsersThree size={30} className="text-[var(--ink-3)]" />
          <p className="mt-3 text-[16px] font-semibold tracking-[-0.01em]">
            {follows.length === 0 ? "Nobody here yet" : "Nothing logged yet"}
          </p>
          <p className="mt-2 max-w-[30ch] text-[14px] leading-relaxed text-[var(--ink-2)]">
            {follows.length === 0
              ? "Ask somebody for their code with the box below. Once they say yes, every session they finish shows up here."
              : "When the people you follow finish a session, the name, the sets and the volume turn up here."}
          </p>
        </div>
      ) : (
        <>
          <h2 className="label mt-10 mb-3">Recent sessions</h2>
          <div className="panel divide-y divide-[var(--line)]">
            {posts.map((p) => (
              <PostRow
                key={p.id}
                post={p}
                uid={uid}
                onReact={react}
                onCheer={(post, key) => setCheering({ post, key })}
                onOpen={setOpenPost}
              />
            ))}
          </div>
        </>
      )}

      <FindPeople
        code={code}
        uid={uid}
        myName={myName}
        onRequested={(name) => setAsked((prev) => (prev.includes(name) ? prev : [...prev, name]))}
      />

      {(follows.length > 0 || askedNames.size > 0) && (
        <>
          <h2 className="label mt-10 mb-3">Following</h2>
          <div className="panel divide-y divide-[var(--line)]">
            {follows.map((f) => (
              <div key={f.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium">
                    {nameOf(f.followeeUid, f.followeeName)}
                  </p>
                </div>
                <button
                  onClick={() => setLeaving(f)}
                  className="btn-quiet min-h-[44px] shrink-0"
                >
                  Unfollow
                </button>
              </div>
            ))}
            {askedNames.size > 0 && (
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium">
                    {[...askedNames].join(", ")}
                  </p>
                  <p className="mt-0.5 text-[12px] text-[var(--ink-3)]">
                    Waiting for them to say yes
                  </p>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {openPost && (
        <PostSheet
          post={openPost}
          uid={uid}
          myName={myName}
          mentionable={mentionable}
          onClose={() => setOpenPost(null)}
        />
      )}

      {cheering && (
        <CheerSheet
          post={cheering.post}
          cheerKey={cheering.key}
          onClose={() => setCheering(null)}
          onSend={sendCheer}
        />
      )}

      <ConfirmSheet
        open={leaving !== null}
        title={`Stop following ${leaving ? nameOf(leaving.followeeUid, leaving.followeeName) : "this person"}?`}
        body="Their sessions leave your feed. They keep following you, and you can ask again whenever you like."
        confirmLabel="Unfollow"
        cancelLabel="Stay following"
        tone="neutral"
        busy={leavingBusy}
        onConfirm={confirmLeave}
        onCancel={() => setLeaving(null)}
      />
    </div>
  );
}
