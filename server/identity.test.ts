import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { sqliteDatabase } from "./test-support/sqlite";
import type { Database } from "./db";
import { CLIENT_ID, NOW, googleToken, keysFrom, newSigner } from "./test-support/google-jwt";
import { resetJwksCache } from "./google";
import {
  accountForToken,
  attachGoogle,
  finishRegistration,
  finishSignIn,
  signInWithGoogle,
  signOut,
  startRegistration,
  startSignIn,
} from "./identity";
import * as storage from "./storage";
import { hashSessionToken } from "./tokens";

/**
 * Google's key set is cached in a module-level variable, so it survives between
 * tests in one file. Each test here generates its own key pair and reuses
 * `KEY_ID`, so a stale cache would hand a later test the *previous* test's key
 * and fail its signature check for a reason that has nothing to do with the
 * behaviour under test. Clearing it per test is what keeps a green run meaning
 * "this worked" rather than "this happened to be first".
 */
beforeEach(() => {
  resetJwksCache();
});
const SCHEMA = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");

async function freshDb(): Promise<Database> {
  const db = sqliteDatabase();
  await db.exec(SCHEMA);
  return db;
}

const request = (path: string) =>
  new Request(`https://comp3tive.example${path}`, { method: "POST", headers: { origin: "https://comp3tive.example" } });

describe("sessions", () => {
  it("resolves a token it issued, and forgets it after sign-out", async () => {
    const db = await freshDb();
    const start = await startRegistration(db, request("/api/passkey/register/options"), { now: NOW });
    const challenge = await storage.takeChallenge(db, start.ceremonyId, "registration", NOW);
    expect(challenge).not.toBeNull();

    await storage.insertAccount(db, {
      id: "a1",
      handle: "h1",
      email: null,
      createdAt: NOW,
    });
    await storage.insertSession(db, await hashSessionToken("token-1"), "a1", NOW, NOW + 1000);

    await signOut(db, "token-1");
    expect(await accountForToken(db, "token-1", NOW)).toBeNull();
  });

  it("answers null for a forged token", async () => {
    const db = await freshDb();
    expect(await accountForToken(db, "never-issued", NOW)).toBeNull();
  });

  it("answers null for an expired token, and clears the row", async () => {
    // ADR-0008 forbids a lapsed token from clearing the *client's* data; the
    // server is free to forget the session itself, and does.
    const db = await freshDb();
    await storage.insertAccount(db, { id: "a1", handle: "h1", email: null, createdAt: NOW });
    await storage.insertSession(db, await hashSessionToken("token-1"), "a1", NOW, NOW + 1000);
    expect(await accountForToken(db, "token-1", NOW + 1001)).toBeNull();
  });

  it("treats an empty token as no session rather than hashing it", async () => {
    const db = await freshDb();
    expect(await accountForToken(db, "", NOW)).toBeNull();
  });
});

describe("a ceremony cannot be replayed", () => {
  it("refuses a verify call whose ceremony was never issued", async () => {
    const db = await freshDb();
    await expect(
      finishSignIn(db, request("/api/passkey/signin/verify"), "no-such-ceremony", { id: "x" } as never, NOW),
    ).rejects.toThrow(/expired/);
  });

  it("refuses a registration verify that reuses a spent ceremony", async () => {
    // The challenge is consumed by the first verify call, so a captured
    // response cannot be presented twice.
    const db = await freshDb();
    const start = await startRegistration(db, request("/api/passkey/register/options"), { now: NOW });
    await storage.takeChallenge(db, start.ceremonyId, "registration", NOW);
    await expect(
      finishRegistration(db, request("/api/passkey/register/verify"), start.ceremonyId, {} as never, NOW),
    ).rejects.toThrow(/expired/);
  });
});

describe("signing in with a passkey this server never registered", () => {
  it("is refused rather than attributed to anybody", async () => {
    // The Account comes from the credential row the response names. A credential
    // that does not exist has no Account to be, so there is nothing to attribute
    // it to — and the refusal happens before any signature work.
    const db = await freshDb();
    const start = await startSignIn(db, request("/api/passkey/signin/options"), NOW);
    await expect(
      finishSignIn(db, request("/api/passkey/signin/verify"), start.ceremonyId, { id: "unknown" } as never, NOW),
    ).rejects.toThrow(/not registered/);
  });
});

/** `newSigner` under a shorter name: every ceremony test needs a key pair. */
const signer = newSigner;

describe("Google sign-in and the rule that protects the Account", () => {
  it("creates an Account on the first sign-in", async () => {
    const db = await freshDb();
    const key = await signer();
    const session = await signInWithGoogle(db, await googleToken(key), {
      clientId: CLIENT_ID,
      now: NOW,
      fetchKeys: keysFrom(key.jwk),
    });
    const account = await storage.getAccount(db, session.accountId);
    expect(account?.email).toBe("organizer@gmail.com");
  });

  it("reuses the same Account on the next sign-in", async () => {
    const db = await freshDb();
    const key = await signer();
    const options = { clientId: CLIENT_ID, now: NOW, fetchKeys: keysFrom(key.jwk) };
    const first = await signInWithGoogle(db, await googleToken(key), options);
    const second = await signInWithGoogle(db, await googleToken(key), options);
    expect(second.accountId).toBe(first.accountId);
    const accounts = await db.prepare("SELECT COUNT(*) AS n FROM accounts").first<{ n: number }>();
    expect(accounts?.n).toBe(1);
  });

  it("creates a SEPARATE Account when only the email address matches", async () => {
    // The rule ADR-0008 exists for, and the reason this test is spelled out at
    // length. An existing Account holds the address, but a *different* Google
    // subject presents it. Nothing is joined on the address, so this is a second
    // Account rather than a takeover of the first.
    const db = await freshDb();
    const existing = await signer("key-a");
    const attacker = await signer("key-b");
    const shared = "organizer@gmail.com";

    const first = await signInWithGoogle(db, await googleToken(existing, { sub: "victim", email: shared }), {
      clientId: CLIENT_ID,
      now: NOW,
      fetchKeys: keysFrom(existing.jwk, attacker.jwk),
    });
    const second = await signInWithGoogle(db, await googleToken(attacker, { sub: "someone-else", email: shared }), {
      clientId: CLIENT_ID,
      now: NOW,
      fetchKeys: keysFrom(existing.jwk, attacker.jwk),
    });

    expect(second.accountId).not.toBe(first.accountId);
    // And both Addresses are on file, unmerged.
    expect((await storage.findAccountsByEmail(db, shared)).map((a) => a.id).sort()).toEqual(
      [first.accountId, second.accountId].sort(),
    );
  });

  it("refuses a token minted for another application", async () => {
    const db = await freshDb();
    const key = await signer();
    await expect(
      signInWithGoogle(db, await googleToken(key, { aud: "somebody-else" }), {
        clientId: CLIENT_ID,
        now: NOW,
        fetchKeys: keysFrom(key.jwk),
      }),
    ).rejects.toThrow(/different application/);
  });

  it("writes no Account at all when verification fails", async () => {
    // A failed sign-in must not leave a row behind, or an attacker gets a
    // half-made Account per attempt.
    const db = await freshDb();
    const key = await signer();
    await expect(
      signInWithGoogle(db, "not-a-token", { clientId: CLIENT_ID, now: NOW, fetchKeys: keysFrom(key.jwk) }),
    ).rejects.toThrow();
    const accounts = await db.prepare("SELECT COUNT(*) AS n FROM accounts").first<{ n: number }>();
    expect(accounts?.n).toBe(0);
  });

  it("gives the new Account a PII-free handle, not the address", async () => {
    // WebAuthn forbids the user handle carrying personal data, and it is the
    // value an authenticator stores and later returns.
    const db = await freshDb();
    const key = await signer();
    const session = await signInWithGoogle(db, await googleToken(key), {
      clientId: CLIENT_ID,
      now: NOW,
      fetchKeys: keysFrom(key.jwk),
    });
    const account = await storage.getAccount(db, session.accountId);
    expect(account?.handle).not.toContain("organizer");
    expect(account?.handle).not.toContain("gmail");
    // 64 bytes base64url, no padding.
    expect(account?.handle).toMatch(/^[A-Za-z0-9_-]{86}$/);
  });
});

describe("attaching Google is an explicit act", () => {
  it("links the identity to the signed-in Account", async () => {
    const db = await freshDb();
    const existing = await signer("key-a");
    const google = await signer("key-b");
    const session = await signInWithGoogle(db, await googleToken(existing, { sub: "first-way" }), {
      clientId: CLIENT_ID,
      now: NOW,
      fetchKeys: keysFrom(existing.jwk, google.jwk),
    });

    await attachGoogle(db, session.accountId, await googleToken(google, { sub: "second-way" }), {
      clientId: CLIENT_ID,
      now: NOW,
      fetchKeys: keysFrom(existing.jwk, google.jwk),
    });

    const linked = await storage.findAccountByFederatedIdentity(
      db,
      "https://accounts.google.com",
      "second-way",
    );
    expect(linked?.id).toBe(session.accountId);
  });

  it("refuses when the identity already belongs to a different Account", async () => {
    // Otherwise attaching would silently move the identity, or leave a second
    // link that `findAccountByFederatedIdentity` could never resolve consistently.
    const db = await freshDb();
    const owner = await signer("key-a");
    const other = await signer("key-b");
    const keys = keysFrom(owner.jwk, other.jwk);

    const owned = await signInWithGoogle(db, await googleToken(owner, { sub: "owned" }), {
      clientId: CLIENT_ID,
      now: NOW,
      fetchKeys: keys,
    });
    const otherAccount = await signInWithGoogle(db, await googleToken(other, { sub: "other" }), {
      clientId: CLIENT_ID,
      now: NOW,
      fetchKeys: keys,
    });

    await expect(
      attachGoogle(db, otherAccount.accountId, await googleToken(owner, { sub: "owned" }), {
        clientId: CLIENT_ID,
        now: NOW,
        fetchKeys: keys,
      }),
    ).rejects.toThrow(/already attached/);

    // And the refusal left the identity where it was. A refusal that had already
    // moved the link before checking would pass the assertion above and still be
    // the bug this case exists for.
    const stillOwned = await storage.findAccountByFederatedIdentity(
      db,
      "https://accounts.google.com",
      "owned",
    );
    expect(stillOwned?.id).toBe(owned.accountId);
  });
});
