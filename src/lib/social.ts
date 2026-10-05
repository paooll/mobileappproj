import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentReference,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";

/**
 * The social layer.
 *
 * Two rules shape everything here. A workout is a personal record, so only a
 * summary ever leaves the account: the session name, how many sets, the volume
 * and the date. Which exercises, what weight, what reps stays private. And
 * following is one-directional and revocable at any moment.
 */

/** Reaction keys, in the order they are offered. */
export const REACTIONS = [
  { key: "fire", label: "Fire" },
  { key: "barbell", label: "Strong" },
  { key: "clap", label: "Clap" },
] as const;

export type ReactionKey = (typeof REACTIONS)[number]["key"];

/**
 * How much of a session leaves the account. Chosen per athlete on Profile, so
 * the feed can be as revealing or as discreet as the person logging wants.
 */
export type PostDetail = "summary" | "full";

export interface LiftDetail {
  name: string;
  weight: number;
  reps: number;
}

export interface FeedPost {
  id: string;
  authorUid: string;
  authorName: string;
  workoutName: string;
  sets: number;
  volumeKg: number;
  /** YYYY-MM-DD */
  date: string;
  createdAt: number;
  /** Reaction key to the uids who gave it. */
  reactions: Record<string, string[]>;
  /** session, or milestone when the app posted it for a rank crossing. */
  kind: PostKind;
  /** Denormalised so the feed never has to read the subcollection. */
  commentCount: number;
  /** Reaction key to the short word that came with it. */
  notes: Record<string, string>;
  /** Present only when the author shares full detail. */
  detail?: LiftDetail[];
}

export type PostKind = "session" | "milestone";

/** Somebody this account follows, and has been accepted by. */
export interface Follow {
  id: string;
  followerUid: string;
  followeeUid: string;
  followerName: string;
  followeeName: string;
  acceptedAt: number;
}

/** A request that has not been answered yet. Nothing follows from it yet. */
export interface FollowRequest {
  id: string;
  followerUid: string;
  followeeUid: string;
  followerName: string;
  followeeName: string;
  createdAt: number;
}

/**
 * A pending request and a live follow are two different documents in two
 * different collections. Keeping them apart is what lets a rules check cost a
 * single exists(): if a `follows` document is there, the follow is real, so
 * nothing has to be read out of it to prove that.
 *
 * The rules rebuild this id by string concatenation and cannot validate it, so
 * the separator has to be something a Firebase uid cannot contain. Auth uids
 * are alphanumeric, which makes a double underscore safe. If that ever changes,
 * this is the line that breaks first.
 */
function edgeId(follower: string, followee: string): string {
  return `${follower}__${followee}`;
}

// No I, O, 0 or 1: a code gets read aloud across a gym floor.
const HANDLE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function makeCode(): string {
  return Array.from(
    { length: 6 },
    () => HANDLE_ALPHABET[Math.floor(Math.random() * HANDLE_ALPHABET.length)]
  ).join("");
}

/** Nobody should be nameless on a feed. This is what shows when it is blank. */
export function authorNameOf(displayName: string): string {
  return displayName.trim() || "Athlete";
}

/** Volume shown on a post, in the reader's unit rather than the author's. */
export function postVolume(post: FeedPost, unit: "kg" | "lb"): string {
  const v = unit === "lb" ? post.volumeKg * 2.20462262 : post.volumeKg;
  if (v >= 1000) return `${(v / 1000).toFixed(1)} t`;
  return `${Math.round(v)} ${unit}`;
}

/* ---------- Handles: the only way to find another account ---------- */

/**
 * The code is the document id, so two accounts can never land on the same one.
 * An account is not searchable any other way, and a code can be read out in a
 * room without exposing an email address or a uid.
 */
export async function syncHandle(uid: string, displayName: string): Promise<string> {
  const name = authorNameOf(displayName);
  const mine = await getDocs(
    query(collection(db, "handles"), where("uid", "==", uid), limit(1))
  );
  const found = mine.docs[0];
  if (found) {
    if (found.data().name !== name) await updateDoc(found.ref, { name });
    return found.id;
  }
  // A taken code is never overwritten: whoever holds it keeps it. The odds are
  // around one in a billion, so the retry is a safety net rather than a path.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeCode();
    const ref = doc(db, "handles", code);
    if ((await getDoc(ref)).exists()) continue;
    await setDoc(ref, { uid, name });
    return code;
  }
  throw new Error("no-handle");
}

/**
 * Current display names for a set of accounts, read from the handles.
 *
 * Every follow and every request carries its own copy of the name, written at
 * the moment the edge was made. That copy is stale the instant somebody renames
 * themselves, and nothing ever refreshed it, so the list showed the name an
 * account had when it was added rather than the name it has now. The handle is
 * the source of truth, so the list resolves it here instead.
 *
 * One query for the whole list, never one per row: a rules check may make at
 * most ten document access calls, and the feed already spends one per post.
 */
export async function loadNamesFor(uids: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const unique = Array.from(new Set(uids.filter(Boolean)));
  // `in` rejects an empty array, and "nobody" is a real answer here: a new
  // account follows nobody and has no requests, so it asks for zero names.
  if (unique.length === 0) return names;
  // `in` takes at most thirty values.
  for (let i = 0; i < unique.length; i += 30) {
    const chunk = unique.slice(i, i + 30);
    const snap = await getDocs(query(collection(db, "handles"), where("uid", "in", chunk)));
    for (const d of snap.docs) {
      const data = d.data();
      if (typeof data.uid === "string") {
        names.set(data.uid, authorNameOf(typeof data.name === "string" ? data.name : ""));
      }
    }
  }
  return names;
}

export interface HandleHit {
  uid: string;
  name: string;
}

/** Resolves a shared code. Returns null when nothing matches. */
export async function findByHandle(code: string): Promise<HandleHit | null> {
  const snap = await getDoc(doc(db, "handles", code.trim().toUpperCase()));
  if (!snap.exists()) return null;
  const d = snap.data();
  if (typeof d.uid !== "string") return null;
  return { uid: d.uid, name: authorNameOf(typeof d.name === "string" ? d.name : "") };
}

/* ---------- Following ---------- */

/**
 * Asking is a request, not a follow. It becomes a follow only when the person
 * being asked says yes, which is the whole point of the feature.
 */
export async function requestFollow(
  uid: string,
  myName: string,
  target: HandleHit
): Promise<void> {
  if (uid === target.uid) throw new Error("self-follow");
  await setDoc(doc(db, "requests", edgeId(uid, target.uid)), {
    followerUid: uid,
    followeeUid: target.uid,
    followerName: authorNameOf(myName),
    followeeName: authorNameOf(target.name),
    createdAt: Date.now(),
  });
}

/**
 * Accepting moves the edge: the request goes and the follow arrives. Both
 * writes go in one batch, so a half-accepted follow is not a state that exists.
 */
export async function acceptFollow(request: FollowRequest): Promise<void> {
  const batch = writeBatch(db);
  batch.set(doc(db, "follows", edgeId(request.followerUid, request.followeeUid)), {
    followerUid: request.followerUid,
    followeeUid: request.followeeUid,
    followerName: request.followerName,
    followeeName: request.followeeName,
    acceptedAt: request.createdAt,
  });
  batch.delete(doc(db, "requests", request.id));
  await batch.commit();
}

/** Declining, and changing your mind, both just remove the request. */
export async function declineFollow(id: string) {
  await deleteDoc(doc(db, "requests", id));
}

/** Leaving is always the follower's own call. */
export async function unfollow(id: string) {
  await deleteDoc(doc(db, "follows", id));
}

function toRows<T>(docs: { id: string; data: () => unknown }[]): (T & { id: string })[] {
  return docs.map((d) => ({ ...(d.data() as T), id: d.id }));
}

/** Who this account follows. Oldest first, so the list does not reshuffle. */
export function subscribeFollowing(uid: string, cb: (rows: Follow[]) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, "follows"), where("followerUid", "==", uid)),
    (snap) => cb(toRows<Follow>(snap.docs).sort((a, b) => a.acceptedAt - b.acceptedAt)),
    (err) => {
      console.error(err);
      cb([]);
    }
  );
}

/** Requests this account has sent and is waiting on. */
export function subscribeRequestsSent(
  uid: string,
  cb: (rows: FollowRequest[]) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "requests"), where("followerUid", "==", uid)),
    (snap) => cb(toRows<FollowRequest>(snap.docs)),
    (err) => {
      console.error(err);
      cb([]);
    }
  );
}

/** Requests waiting for this account to answer. Newest first. */
export function subscribeRequestsForMe(
  uid: string,
  cb: (rows: FollowRequest[]) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "requests"), where("followeeUid", "==", uid)),
    (snap) => cb(toRows<FollowRequest>(snap.docs).sort((a, b) => b.createdAt - a.createdAt)),
    (err) => {
      console.error(err);
      cb([]);
    }
  );
}

/* ---------- Posts: a summary of a session, nothing underneath it ---------- */

export interface PostDraft {
  authorUid: string;
  authorName: string;
  workoutName: string;
  sets: number;
  volumeKg: number;
  /** YYYY-MM-DD */
  date: string;
  kind?: PostKind;
  /** Only sent when the athlete has postDetail set to "full". */
  detail?: LiftDetail[];
}

export async function createPost(draft: PostDraft): Promise<string> {
  const ref = await addDoc(collection(db, "posts"), {
    ...draft,
    authorName: authorNameOf(draft.authorName),
    volumeKg: Math.round(draft.volumeKg),
    createdAt: Date.now(),
    reactions: {},
    kind: draft.kind ?? "session",
    commentCount: 0,
    notes: {},
  });
  return ref.id;
}

/**
 * A rank crossing is worth saying out loud, so it goes into the same feed as a
 * session rather than a stream of its own. It costs the feed query nothing: a
 * milestone is an ordinary post with a different `kind`.
 */
export function createMilestone(draft: Omit<PostDraft, "kind">) {
  return createPost({ ...draft, kind: "milestone" });
}

/** Adds a reaction and, optionally, the word that goes with it. */
export async function toggleReaction(postId: string, uid: string, key: ReactionKey, note = "") {
  const ref = doc(db, "posts", postId);
  const snap = await getDoc(ref);
  const current = (snap.data()?.reactions ?? {}) as Record<string, string[]>;
  const notes = ((snap.data()?.notes ?? {}) as Record<string, string>) || {};
  const mine = current[key] ?? [];
  const giving = mine.includes(uid);
  const next = giving ? mine.filter((u) => u !== uid) : [...mine, uid];
  // The key stays in place with an empty array, so a count can render as 0
  // rather than the button vanishing and shifting the row under the thumb. A
  // word only lives while the reaction does: taking the reaction back takes the
  // word with it, or a cheer would linger on a row nobody agrees with.
  const nextNotes = giving
    ? Object.fromEntries(Object.entries(notes).filter(([k]) => k !== key))
    : { ...notes, [key]: note.trim().slice(0, CHEER_MAX) };
  await updateDoc(ref, { reactions: { ...current, [key]: next }, notes: nextNotes });
}

/** A cheer is one word. Long enough to mean something, short enough to type. */
export const CHEER_MAX = 40;

export function countReaction(post: FeedPost, key: string): number {
  return post.reactions?.[key]?.length ?? 0;
}

export function gaveReaction(post: FeedPost, uid: string, key: string): boolean {
  return post.reactions?.[key]?.includes(uid) ?? false;
}

/** Firestore caps an `in` query at 30 values, so a big list shows the newest. */
export const FEED_QUERY_CAP = 30;

/** Rows the feed pulls in one read. Enough to scroll, few enough to stay cheap. */
export const FEED_ROWS = 25;

/**
 * One query, narrowed to this account and the people it follows. The rules
 * narrow it again: a post from somebody this account does not follow is
 * dropped by Firestore rather than by this code, so the client cannot be
 * edited into reading what the rules would not hand over.
 */
export function subscribeFeed(
  uid: string,
  followeeIds: string[],
  cb: (posts: FeedPost[]) => void
): Unsubscribe {
  const ids = [uid, ...followeeIds]
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, FEED_QUERY_CAP);
  return onSnapshot(
    query(
      collection(db, "posts"),
      where("authorUid", "in", ids),
      orderBy("createdAt", "desc"),
      limit(FEED_ROWS)
    ),
    (snap) => cb(toRows<FeedPost>(snap.docs)),
    (err) => {
      console.error(err);
      cb([]);
    }
  );
}

/** Everything this account has posted, newest first. */
export function subscribeOwnPosts(uid: string, cb: (posts: FeedPost[]) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, "posts"), where("authorUid", "==", uid), orderBy("createdAt", "desc")),
    (snap) => cb(toRows<FeedPost>(snap.docs)),
    (err) => {
      console.error(err);
      cb([]);
    }
  );
}

async function deleteRefs(refs: DocumentReference[]) {
  for (let i = 0; i < refs.length; i += 400) {
    const batch = writeBatch(db);
    for (const r of refs.slice(i, i + 400)) batch.delete(r);
    await batch.commit();
  }
}

export async function deletePost(postId: string) {
  await deleteDoc(doc(db, "posts", postId));
}

/* ---------- Leaving: the account takes its social graph with it ---------- */

export async function deleteAllEdges(uid: string) {
  const outgoing = await getDocs(query(collection(db, "follows"), where("followerUid", "==", uid)));
  const incoming = await getDocs(query(collection(db, "follows"), where("followeeUid", "==", uid)));
  const sent = await getDocs(query(collection(db, "requests"), where("followerUid", "==", uid)));
  const got = await getDocs(query(collection(db, "requests"), where("followeeUid", "==", uid)));
  await deleteRefs(
    [...outgoing.docs, ...incoming.docs, ...sent.docs, ...got.docs].map((d) => d.ref)
  );
}

export async function deleteOwnPosts(uid: string) {
  const mine = await getDocs(query(collection(db, "posts"), where("authorUid", "==", uid)));
  await deleteRefs(mine.docs.map((d) => d.ref));
}

export async function deleteHandle(uid: string) {
  const mine = await getDocs(query(collection(db, "handles"), where("uid", "==", uid)));
  await deleteRefs(mine.docs.map((d) => d.ref));
}

/* ---------- Comments: opened on demand, never in the feed ---------- */

/**
 * A thread lives in a subcollection rather than on the post, because a post is
 * read by up to 25 people at once and a thread is read by one person at a time.
 * Inlining it would put a comment query behind every row of the feed.
 */
export interface PostComment {
  id: string;
  authorUid: string;
  authorName: string;
  body: string;
  /** uids named with @ in the body, for the badge and for the notification. */
  mentions: string[];
  createdAt: number;
}

/** A thread nobody reads past the first screen is not worth a long read. */
export const COMMENTS_CAP = 50;

/** Long enough to say a thing, short enough to be worth reading on a phone. */
export const COMMENT_MAX = 280;

export function subscribeComments(
  postId: string,
  cb: (rows: PostComment[]) => void
): Unsubscribe {
  return onSnapshot(
    query(
      collection(db, "posts", postId, "comments"),
      orderBy("createdAt", "asc"),
      limit(COMMENTS_CAP)
    ),
    (snap) => cb(toRows<PostComment>(snap.docs)),
    (err) => {
      console.error(err);
      cb([]);
    }
  );
}

/**
 * The count on the post is denormalised rather than counted on read, so the
 * feed never opens a subcollection. Two comments landing at once can both read
 * the same count, so the bump happens in a transaction that re-reads first.
 */
export async function addComment(
  postId: string,
  authorUid: string,
  authorName: string,
  body: string,
  mentions: string[]
): Promise<void> {
  const text = body.trim().slice(0, COMMENT_MAX);
  if (!text) throw new Error("empty-comment");
  const postRef = doc(db, "posts", postId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(postRef);
    if (!snap.exists()) throw new Error("no-post");
    tx.set(doc(collection(postRef, "comments")), {
      authorUid,
      authorName: authorNameOf(authorName),
      body: text,
      mentions,
      createdAt: Date.now(),
    });
    tx.update(postRef, { commentCount: (snap.data().commentCount ?? 0) + 1 });
  });
}

export async function deleteComment(postId: string, commentId: string): Promise<void> {
  await deleteDoc(doc(db, "posts", postId, "comments", commentId));
  // Deliberately not decremented: a delete racing the count would drop it to a
  // wrong number, and an over-count is the smaller lie.
}

/* ---------- Mentions: written by the sender, because no server runs ---------- */

export interface AppNotification {
  id: string;
  fromUid: string;
  fromName: string;
  postId: string;
  /** The sentence as written, capped on write. */
  body: string;
  createdAt: number;
  read: boolean;
}

/** The bell only ever needs the recent past. */
export const NOTIFICATIONS_CAP = 30;

/**
 * Finds @Name in a body against the people the writer can actually name. It
 * matches on the display name rather than a handle, because a handle is six
 * characters read aloud across a gym floor and nobody types one into a comment.
 */
export function parseMentions(
  body: string,
  candidates: { uid: string; name: string }[]
): string[] {
  const hits: string[] = [];
  for (const c of candidates) {
    const name = c.name.trim();
    if (!name || c.uid === "") continue;
    // `(?![\\w@])` stops `@name` matching inside a longer word, but a dot still
    // slips past it, so `@icrn.com` would read as a mention of icrn. A dot
    // only means an email address when a domain-looking run follows it, since
    // a full stop is also how a sentence ends: "@icrn." is a mention, and
    // "@icrn.com" is an address.
    const mention = new RegExp(`(^|\\s)@${escapeRegExp(name)}(?![\\w@])`, "i");
    const match = mention.exec(body);
    if (!match) continue;
    if (/^\.[A-Za-z]/.test(body.slice(match.index + match[0].length))) continue;
    hits.push(c.uid);
  }
  return [...new Set(hits)];
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function subscribeNotifications(
  uid: string,
  cb: (rows: AppNotification[]) => void
): Unsubscribe {
  return onSnapshot(
    query(
      collection(db, "notifications", uid, "items"),
      orderBy("createdAt", "desc"),
      limit(NOTIFICATIONS_CAP)
    ),
    (snap) => cb(toRows<AppNotification>(snap.docs)),
    (err) => {
      console.error(err);
      cb([]);
    }
  );
}

/**
 * No Cloud Functions run on the free plan, so the writer's own device drops the
 * notification in. That is sound rather than a workaround: the writer is
 * already allowed to write the comment, and the rules check the post is one
 * they could read before letting the document land, so nobody can post a bell
 * into an account that could not have seen it.
 */
export async function notifyMention(
  toUid: string,
  fromUid: string,
  fromName: string,
  postId: string,
  body: string
): Promise<void> {
  if (toUid === fromUid) return;
  await addDoc(collection(db, "notifications", toUid, "items"), {
    fromUid,
    fromName: authorNameOf(fromName),
    postId,
    body: body.trim().slice(0, COMMENT_MAX),
    createdAt: Date.now(),
    read: false,
  });
}

/**
 * Clears the badge for the items the athlete has actually seen.
 *
 * The ids are passed in rather than queried for, because a query for "every
 * unread thing" also catches a mention that arrived in the moment between the
 * sheet opening and this running. That mention would be marked read without
 * ever being looked at, and the bell would sit empty while somebody waited for
 * a notification that had quietly been swallowed.
 */
export async function markNotificationsRead(uid: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const batch = writeBatch(db);
  for (const id of ids.slice(0, 400)) {
    batch.update(doc(db, "notifications", uid, "items", id), { read: true });
  }
  await batch.commit();
}

export async function deleteNotifications(uid: string): Promise<void> {
  const snap = await getDocs(collection(db, "notifications", uid, "items"));
  await deleteRefs(snap.docs.map((d) => d.ref));
}
