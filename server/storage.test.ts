import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { sqliteDatabase } from "./test-support/sqlite";
import type { Database } from "./db";
import type { Account, Credential } from "../src/domain/types";
import {
  countCredentials,
  deleteSession,
  findAccountByFederatedIdentity,
  findAccountsByEmail,
  findLiveSession,
  getAccount,
  getCredential,
  insertAccount,
  insertChallenge,
  insertSession,
  linkFederatedIdentity,
  listCredentials,
  recordSignCount,
  setAccountEmail,
  takeChallenge,
  upsertCredential,
} from "./storage";

/**
 * The schema and the queries, against real SQLite.
 *
 * `server/test-support/sqlite.ts` exists so these run the same statements D1
 * will. What that buys is the constraints: several of this file's assertions are
 * about a rule the *schema* enforces rather than one the calling code
 * remembers — a credential id is a primary key, (issuer, subject) is a primary
 * key — and a hand-written mock would accept every one of them.
 *
 * The schema is read from `schema.sql`, the same file `wrangler d1 execute
 * --file` applies, so there is one definition of the tables.
 */
const SCHEMA = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");

async function freshDb(): Promise<Database> {
  const db = sqliteDatabase();
  await db.exec(SCHEMA);
  return db;
}

const account = (id: string, email: string | null = null): Account => ({
  id,
  handle: `handle-${id}`,
  email,
  createdAt: 1000,
});

const credential = (id: string, accountId: string, over: Partial<Credential> = {}): Credential => ({
  id,
  accountId,
  publicKey: "cHVibGljLWtleQ",
  signCount: 0,
  backedUp: false,
  deviceType: "singleDevice",
  transports: ["internal"],
  createdAt: 1000,
  ...over,
});

describe("the schema applies", () => {
  it("creates every table a fresh database needs", async () => {
    const db = await freshDb();
    const rows = await db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all<{ name: string }>();
    expect(rows.map((r) => r.name)).toEqual([
      "accounts",
      "capability_ratings",
      "capability_roles",
      "challenges",
      "communities",
      "community_revisions",
      "credentials",
      "discipline_attributes",
      "discipline_roles",
      "disciplines",
      "federated_identities",
      "match_games",
      "player_capabilities",
      "players",
      "saved_squads",
      "sessions",
      "split_sessions",
      "tournament_matches",
      "tournament_teams",
      "tournaments",
    ]);
  });

  it("is idempotent, so applying it twice is not a deploy failure", async () => {
    const db = await freshDb();
    await expect(db.exec(SCHEMA)).resolves.toBeUndefined();
  });
});

describe("accounts", () => {
  it("round-trips an account", async () => {
    const db = await freshDb();
    await insertAccount(db, account("a1", "organizer@example.com"));
    expect(await getAccount(db, "a1")).toEqual(account("a1", "organizer@example.com"));
  });

  it("answers null for an account that does not exist", async () => {
    const db = await freshDb();
    expect(await getAccount(db, "nobody")).toBeNull();
  });

  it("stores no email at all for a passkey-only account", async () => {
    // The nullable column is a real state, not a placeholder: an Account whose
    // only credential is a passkey may never supply an address (ADR-0008).
    const db = await freshDb();
    await insertAccount(db, account("a1"));
    expect((await getAccount(db, "a1"))?.email).toBeNull();
  });

  it("allows two accounts to share one email address", async () => {
    // The schema must NOT grow a unique constraint here. Two Accounts may share
    // an address, and anything that treated one as "the" account would be the
    // account-takeover inference ADR-0008 rejects.
    const db = await freshDb();
    await insertAccount(db, account("a1", "shared@example.com"));
    await insertAccount(db, account("a2", "shared@example.com"));
    const found = await findAccountsByEmail(db, "shared@example.com");
    expect(found.map((a) => a.id).sort()).toEqual(["a1", "a2"]);
  });

  it("sets an email on an account that had none", async () => {
    const db = await freshDb();
    await insertAccount(db, account("a1"));
    await setAccountEmail(db, "a1", "organizer@example.com");
    expect((await getAccount(db, "a1"))?.email).toBe("organizer@example.com");
  });
});

describe("credentials: a synced passkey is one row, not two", () => {
  it("reuses the row when the same credential arrives again", async () => {
    // This is the acceptance criterion, at the layer that enforces it. A synced
    // passkey reaches a second device as the SAME credential id, so the second
    // sign-in must update rather than insert.
    const db = await freshDb();
    await insertAccount(db, account("a1"));
    await upsertCredential(db, credential("cred-1", "a1"));
    await upsertCredential(db, credential("cred-1", "a1", { signCount: 4 }));
    expect(await countCredentials(db, "a1")).toBe(1);
    expect((await getCredential(db, "cred-1"))?.signCount).toBe(4);
  });

  it("keeps two different credentials apart", async () => {
    const db = await freshDb();
    await insertAccount(db, account("a1"));
    await upsertCredential(db, credential("cred-1", "a1"));
    await upsertCredential(db, credential("cred-2", "a1", { transports: ["hybrid"] }));
    expect((await listCredentials(db, "a1")).map((c) => c.id).sort()).toEqual(["cred-1", "cred-2"]);
  });

  it("preserves the transports list through the JSON column", async () => {
    const db = await freshDb();
    await insertAccount(db, account("a1"));
    await upsertCredential(db, credential("cred-1", "a1", { transports: ["internal", "hybrid"] }));
    expect((await getCredential(db, "cred-1"))?.transports).toEqual(["internal", "hybrid"]);
  });

  it("round-trips the backedUp flag as a boolean, not 0/1", async () => {
    const db = await freshDb();
    await insertAccount(db, account("a1"));
    await upsertCredential(db, credential("cred-1", "a1", { backedUp: true }));
    expect((await getCredential(db, "cred-1"))?.backedUp).toBe(true);
  });

  it("refuses a credential for an account that does not exist", async () => {
    // The foreign key, which is the point of having one: identity rows have no
    // dangling references, unlike the sync documents.
    const db = await freshDb();
    await expect(upsertCredential(db, credential("cred-1", "ghost"))).rejects.toThrow();
  });

  it("never walks the counter backwards", async () => {
    // A synced or platform authenticator can legitimately report a LOWER counter
    // on a second device, and overwriting would let a genuine regression move the
    // stored value down so a later clone looked normal. The high-water mark keeps
    // the signal meaningful without ever refusing a sign-in (ADR-0008).
    const db = await freshDb();
    await insertAccount(db, account("a1"));
    await upsertCredential(db, credential("cred-1", "a1", { signCount: 9 }));
    await recordSignCount(db, "cred-1", 3);
    expect((await getCredential(db, "cred-1"))?.signCount).toBe(9);
  });

  it("advances the counter when it genuinely increases", async () => {
    const db = await freshDb();
    await insertAccount(db, account("a1"));
    await upsertCredential(db, credential("cred-1", "a1", { signCount: 3 }));
    await recordSignCount(db, "cred-1", 9);
    expect((await getCredential(db, "cred-1"))?.signCount).toBe(9);
  });
});

describe("federated identities are keyed on iss + sub", () => {
  it("finds the account a Google identity was attached to", async () => {
    const db = await freshDb();
    await insertAccount(db, account("a1"));
    await linkFederatedIdentity(db, "https://accounts.google.com", "sub-1", "a1", 1000);
    expect((await findAccountByFederatedIdentity(db, "https://accounts.google.com", "sub-1"))?.id).toBe("a1");
  });

  it("answers null for an issuer/subject pair it has never seen", async () => {
    const db = await freshDb();
    await insertAccount(db, account("a1"));
    expect(await findAccountByFederatedIdentity(db, "https://accounts.google.com", "sub-x")).toBeNull();
  });

  it("does not move an identity to a second account when it is attached twice", async () => {
    // `INSERT OR IGNORE` on the (issuer, subject) primary key. Re-presenting a
    // Google token must not re-point the identity at whoever presents it next.
    const db = await freshDb();
    await insertAccount(db, account("a1"));
    await insertAccount(db, account("a2"));
    await linkFederatedIdentity(db, "https://accounts.google.com", "sub-1", "a1", 1000);
    await linkFederatedIdentity(db, "https://accounts.google.com", "sub-1", "a2", 2000);
    expect((await findAccountByFederatedIdentity(db, "https://accounts.google.com", "sub-1"))?.id).toBe("a1");
  });

  it("keeps the same subject at two issuers apart", async () => {
    // `sub` is only unique per issuer; that is exactly why the key is the pair.
    const db = await freshDb();
    await insertAccount(db, account("a1"));
    await insertAccount(db, account("a2"));
    await linkFederatedIdentity(db, "https://accounts.google.com", "sub-1", "a1", 1000);
    await linkFederatedIdentity(db, "https://other.example", "sub-1", "a2", 1000);
    expect((await findAccountByFederatedIdentity(db, "https://accounts.google.com", "sub-1"))?.id).toBe("a1");
    expect((await findAccountByFederatedIdentity(db, "https://other.example", "sub-1"))?.id).toBe("a2");
  });
});

describe("sessions", () => {
  it("finds a live session", async () => {
    const db = await freshDb();
    await insertAccount(db, account("a1"));
    await insertSession(db, "hash-1", "a1", 1000, 5000);
    expect(await findLiveSession(db, "hash-1", 2000)).toEqual({ accountId: "a1", expiresAt: 5000 });
  });

  it("refuses an expired token and removes it", async () => {
    // Deleting as it refuses means a dead token cannot be retried into life, and
    // the table does not accumulate rows nothing will ever read.
    const db = await freshDb();
    await insertAccount(db, account("a1"));
    await insertSession(db, "hash-1", "a1", 1000, 5000);
    expect(await findLiveSession(db, "hash-1", 5001)).toBeNull();
    const rows = await db.prepare("SELECT COUNT(*) AS n FROM sessions").first<{ n: number }>();
    expect(rows?.n).toBe(0);
  });

  it("treats the expiry instant itself as expired", async () => {
    const db = await freshDb();
    await insertAccount(db, account("a1"));
    await insertSession(db, "hash-1", "a1", 1000, 5000);
    expect(await findLiveSession(db, "hash-1", 5000)).toBeNull();
  });

  it("answers null for a token it has never issued", async () => {
    const db = await freshDb();
    expect(await findLiveSession(db, "forged", 1000)).toBeNull();
  });

  it("stops finding a token once it is deleted", async () => {
    const db = await freshDb();
    await insertAccount(db, account("a1"));
    await insertSession(db, "hash-1", "a1", 1000, 9000);
    await deleteSession(db, "hash-1");
    expect(await findLiveSession(db, "hash-1", 2000)).toBeNull();
  });

  it("stores the digest, so the table holds no usable token", async () => {
    // The column is a hex SHA-256, not the token. A dump of `sessions` grants
    // nothing, which is the reason the hash is what gets written.
    const db = await freshDb();
    await insertAccount(db, account("a1"));
    await insertSession(db, "deadbeef", "a1", 1000, 9000);
    const row = await db.prepare("SELECT token_hash FROM sessions").first<{ token_hash: string }>();
    expect(row?.token_hash).toBe("deadbeef");
  });
});

describe("challenges are single-use", () => {
  it("returns a challenge once and never again", async () => {
    // A WebAuthn response is bound to the challenge it answered. If a challenge
    // could be read twice, one captured response could be replayed until it
    // expired.
    const db = await freshDb();
    await insertChallenge(db, "c-1", "the-challenge", "registration", null, null, 5000);
    expect(await takeChallenge(db, "c-1", "registration", 1000)).toEqual({
      value: "the-challenge",
      accountId: null,
      payload: null,
    });
    expect(await takeChallenge(db, "c-1", "registration", 1000)).toBeNull();
  });

  it("ignores an expired challenge", async () => {
    const db = await freshDb();
    await insertChallenge(db, "c-1", "the-challenge", "registration", null, null, 5000);
    expect(await takeChallenge(db, "c-1", "registration", 5001)).toBeNull();
  });

  it("will not answer a different ceremony than it was issued for", async () => {
    // A registration challenge must not verify an authentication response.
    const db = await freshDb();
    await insertChallenge(db, "c-1", "the-challenge", "registration", null, null, 5000);
    expect(await takeChallenge(db, "c-1", "authentication", 1000)).toBeNull();
  });

  it("carries the account for an authentication challenge", async () => {
    const db = await freshDb();
    await insertAccount(db, account("a1"));
    await insertChallenge(db, "c-1", "the-challenge", "authentication", "a1", null, 5000);
    expect((await takeChallenge(db, "c-1", "authentication", 1000))?.accountId).toBe("a1");
  });

  it("carries the pending registration data to the verify call", async () => {
    // A new Account is not created until its first credential verifies, so the
    // id and handle the options call generated have to travel through the
    // challenge rather than through a half-created Account row.
    const db = await freshDb();
    const pending = JSON.stringify({ accountId: "a1", handle: "handle-a1" });
    await insertChallenge(db, "c-1", "the-challenge", "registration", "a1", pending, 5000);
    expect((await takeChallenge(db, "c-1", "registration", 1000))?.payload).toBe(pending);
  });
});

