// Reproduces the follow flow against the REAL firestore.rules using the
// emulator. Auth is faked with an unsigned JWT: the Firestore emulator reads
// the `sub` claim as the uid without verifying the signature, which is exactly
// what lets rules be exercised without the auth emulator.
//
// Flow: alice asks to follow bob, bob accepts (batched set + delete).
const HOST = "127.0.0.1";
const PORT = 8080;
const PROJECT = "demo-reprange";

const b64 = (o) =>
  Buffer.from(JSON.stringify(o))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const token = (uid) => `${b64({ alg: "none", typ: "JWT" })}.${b64({ sub: uid })}.`;

const ALICE = "aliceUid123";
const BOB = "bobUid456";
const edge = (a, b) => `${a}__${b}`;
const rel = `projects/${PROJECT}/databases/(default)/documents`;
const base = `http://${HOST}:${PORT}/v1/${rel}`;

async function call(uid, method, path, body) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token(uid)}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const e = new Error(`${method} ${path}: ${res.status}`);
    e.status = res.status;
    e.detail = JSON.stringify(json.error ?? json).slice(0, 400);
    throw e;
  }
  return json;
}

async function tryIt(label, fn) {
  try {
    await fn();
    console.log(`  PASS  ${label}`);
    return true;
  } catch (e) {
    console.log(`  FAIL  ${label}`);
    console.log(`        ${e.status ?? ""} ${e.message}`);
    if (e.detail) console.log(`        ${e.detail}`);
    return false;
  }
}

const F = (v) => { if (v === undefined) return { nullValue: null }; return { stringValue: String(v) }; };
const N = (v) => ({ integerValue: String(v) });

console.log("[1] alice creates a follow request to bob");
await tryIt("request create", () =>
  call(ALICE, "PATCH", `/requests/${edge(ALICE, BOB)}?documentId=${edge(ALICE, BOB)}`, {
    fields: {
      followerUid: F(ALICE),
      followeeUid: F(BOB),
      followerName: F("Alice"),
      followeeName: F("Bob"),
      createdAt: N(1),
    },
  })
);

console.log("\n[2] bob reads his incoming requests (what the UI subscribes to)");
await tryIt("incoming query by followeeUid", () =>
  call(BOB, "POST", ":runQuery", {
    structuredQuery: {
      from: [{ collectionId: "requests" }],
      where: {
        fieldFilter: { field: { fieldPath: "followeeUid" }, op: "EQUAL", value: F(BOB) },
      },
    },
  })
);

console.log("\n[3] bob ACCEPTS - batched set follows + delete requests");
await tryIt("accept batch", () =>
  call(BOB, "POST", ":commit", {
    writes: [
      {
        update: {
          name: `${rel}/follows/${edge(ALICE, BOB)}`,
          fields: {
            followerUid: F(ALICE),
            followeeUid: F(BOB),
            followerName: F("Alice"),
            followeeName: F("Bob"),
            acceptedAt: N(1),
          },
        },
      },
      { delete: `${rel}/requests/${edge(ALICE, BOB)}` },
    ],
  })
);

console.log("\n[4] reads after accept");
await tryIt("alice reads her following list", () =>
  call(ALICE, "POST", ":runQuery", {
    structuredQuery: {
      from: [{ collectionId: "follows" }],
      where: {
        fieldFilter: { field: { fieldPath: "followerUid" }, op: "EQUAL", value: F(ALICE) },
      },
    },
  })
);
await tryIt("bob reads his followers", () =>
  call(BOB, "POST", ":runQuery", {
    structuredQuery: {
      from: [{ collectionId: "follows" }],
      where: {
        fieldFilter: { field: { fieldPath: "followeeUid" }, op: "EQUAL", value: F(BOB) },
      },
    },
  })
);