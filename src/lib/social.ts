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
}

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
}

export async function createPost(draft: PostDraft): Promise<string> {
  const ref = await addDoc(collection(db, "posts"), {
    ...draft,
    authorName: authorNameOf(draft.authorName),
    volumeKg: Math.round(draft.volumeKg),
    createdAt: Date.now(),
    reactions: {},
  });
  return ref.id;
}

/** Adds a reaction, or takes it back if this account already gave it. */
export async function toggleReaction(postId: string, uid: string, key: ReactionKey) {
  const ref = doc(db, "posts", postId);
  const snap = await getDoc(ref);
  const current = (snap.data()?.reactions ?? {}) as Record<string, string[]>;
  const mine = current[key] ?? [];
  const next = mine.includes(uid) ? mine.filter((u) => u !== uid) : [...mine, uid];
  // The key stays in place with an empty array, so a count can render as 0
  // rather than the button vanishing and shifting the row under the thumb.
  await updateDoc(ref, { reactions: { ...current, [key]: next } });
}

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
