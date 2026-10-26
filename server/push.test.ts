import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { sqliteDatabase } from "./test-support/sqlite";
import type { Database } from "./db";
import handler from "./index";
import * as storage from "./storage";
import { reassemble } from "./store/reassemble";
import { hashSessionToken } from "./tokens";

/**
 * The push route's contract, end to end through the Worker handler:
 * the compare-and-swap is what makes a stale device refused rather than a
 * silent overwrite - ticket 06's whole point. Two clients on the same version:
 * the first push is accepted, the second is rejected with a 409 naming the
 * server's version, and the first client's payload is what survives.
 *
 * "Survives" is checked through the normalized store (`reassemble`), not the
 * dual-written blob, because the rows are the read path after the cutover.
 * The loser's rows must be zero: a batch is atomic, but a lost CAS is not an
 * error, so every write carries the revision gate in its own WHERE. Mutation:
 * building the decompose statements without the revision (or moving the CAS
 * after them) turns the loser's rows live and this file red.
 */
const SCHEMA = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
// The read path is `reassemble`, which reads the normalized (v2) tables; the
// deployed setup applies both files in order, so the test does too.
const SCHEMA_V2 = readFileSync(new URL("./schema-v2.sql", import.meta.url), "utf8");

async function freshDb(): Promise<Database> {
  const db = sqliteDatabase();
  await db.exec(SCHEMA);
  await db.exec(SCHEMA_V2);
  return db;
}

beforeEach(() => {
  process.env.GOOGLE_CLIENT_ID = "test-client-id";
});

function pushRequest(token: string, body: unknown): Request {
  return new Request("https://comp3tive.example/api/documents/push", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

function adoptRequest(token: string, body: unknown): Request {
  return new Request("https://comp3tive.example/api/documents/adopt", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

async function sessionFor(db: Database, accountId: string): Promise<string> {
  const token = `tok-${accountId}-${Math.random().toString(36).slice(2)}`;
  await storage.insertSession(db, await hashSessionToken(token), accountId, Date.now(), Date.now() + 60_000);
  return token;
}

/** A minimal valid v5 document whose community name carries a test marker. */
function doc(marker: string): string {
  return JSON.stringify({
    version: 5,
    exportedAt: "2026-10-15T00:00:00.000Z",
    communities: [{ id: "c1", name: `from-${marker}`, createdAt: 1000 }],
    players: [],
    sessions: [],
    tournaments: [],
    savedSquads: [],
    disciplines: [],
  });
}

/**
 * A v5 document with one player carrying a capability: ratings and an
 * eligible role, so all three capability tables get a row.
 */
function docWithCapability(marker: string, pace: number): string {
  return JSON.stringify({
    version: 5,
    exportedAt: "2026-10-15T00:00:00.000Z",
    communities: [{ id: "c1", name: `from-${marker}`, createdAt: 1000 }],
    disciplines: [
      {
        id: "futsal",
        name: "Futsal",
        shortName: "FUT",
        roles: [{ id: "keeper", name: "Keeper" }],
        attributes: [{ id: "pace", name: "Pace" }],
        strengthModel: { kind: "mean" },
        team: { minTeamSize: 1, maxTeamSize: 5, rolesRequired: true },
      },
    ],
    players: [
      {
        id: "p1",
        communityId: "c1",
        name: "One",
        createdAt: 1,
        capabilities: [
          {
            disciplineId: "futsal",
            attributeRatings: { pace },
            eligibleRoles: ["keeper"],
            preferredRole: "keeper",
          },
        ],
      },
    ],
    sessions: [],
    tournaments: [],
    savedSquads: [],
  });
}

describe("POST /api/documents/push", () => {
  it("accepts the first client and rejects the second on the same version, keeping the first's data", async () => {
    const db = await freshDb();
    await storage.insertAccount(db, { id: "a1", handle: "handle-a1", email: "a@example.com", createdAt: 1000 });
    // Adoption creates the revision row (version 1) both devices then build on.
    const seed = await sessionFor(db, "a1");
    const adopted = await handler.fetch(
      adoptRequest(seed, { communityId: "c1", payload: doc("origin") }),
      { DB: db } as never,
    );
    expect(adopted.status, JSON.stringify(await adopted.json())).toBe(200);
    const alice = await sessionFor(db, "a1");
    const bob = await sessionFor(db, "a1");
    const env = { DB: db } as never;

    // Both clients believe the version is 1. Only one can win.
    const first = await handler.fetch(pushRequest(alice, { communityId: "c1", expectedVersion: 1, payload: doc("alice") }), env);
    expect(first.status, JSON.stringify(await first.clone().json())).toBe(200);
    expect(((await first.json()) as { version: number }).version).toBe(2);

    const second = await handler.fetch(pushRequest(bob, { communityId: "c1", expectedVersion: 1, payload: doc("bob") }), env);
    expect(second.status).toBe(409);
    const rejection = (await second.json()) as { serverVersion: number; error: string };
    expect(rejection.serverVersion).toBe(2);

    // The winner's payload survives; the loser's evening is not silently gone,
    // it is refused and named. The loser leaves zero rows behind - the guard
    // no-ops the batch's writes when the CAS changes nothing.
    const surviving = await reassemble(db, "a1", "c1");
    expect(surviving?.communities[0]?.name).toBe("from-alice");
    const loserRows = await db
      .prepare("SELECT COUNT(*) AS n FROM communities WHERE account_id = 'a1' AND id = 'c1'")
      .first<{ n: number }>();
    expect(loserRows?.n).toBe(1);
  });

  it("refuses a push when the account has no document for that community", async () => {
    const db = await freshDb();
    await storage.insertAccount(db, { id: "a1", handle: "handle-a1", email: "a@example.com", createdAt: 1000 });
    const token = await sessionFor(db, "a1");
    const response = await handler.fetch(
      pushRequest(token, { communityId: "c1", expectedVersion: 1, payload: doc("nobody") }),
      { DB: db } as never,
    );
    expect(response.status).toBe(409);
    const rejection = (await response.json()) as { serverVersion: number | null };
    expect(rejection.serverVersion).toBeNull();
    // And it writes nothing: no revision row, no rows, no blob.
    expect(await getRevisionOrNull(db, "a1", "c1")).toBeNull();
    expect(await reassemble(db, "a1", "c1")).toBeNull();
  });

  it("replaces a community's capabilities on the next push, through the guarded batch", async () => {
    const db = await freshDb();
    await storage.insertAccount(db, { id: "a1", handle: "handle-a1", email: "a@example.com", createdAt: 1000 });
    const env = { DB: db } as never;
    const seed = await sessionFor(db, "a1");
    const adopted = await handler.fetch(
      adoptRequest(seed, { communityId: "c1", payload: docWithCapability("first", 4) }),
      env,
    );
    expect(adopted.status, JSON.stringify(await adopted.json())).toBe(200);

    // Same ids, same capability: every replaced row has to be deleted before
    // the identical row is inserted, and the capability tables carry no
    // community column, so they do not ride the `players` delete. In
    // production this batch answered 500 with a UNIQUE violation.
    const token = await sessionFor(db, "a1");
    const pushed = await handler.fetch(
      pushRequest(token, { communityId: "c1", expectedVersion: 1, payload: docWithCapability("second", 5) }),
      env,
    );
    expect(pushed.status, JSON.stringify(await pushed.json())).toBe(200);

    const back = await reassemble(db, "a1", "c1");
    expect(back?.players[0]?.capabilities).toEqual([
      { disciplineId: "futsal", attributeRatings: { pace: 5 }, eligibleRoles: ["keeper"], preferredRole: "keeper" },
    ]);
  });

  it("requires a session", async () => {
    const db = await freshDb();
    const response = await handler.fetch(
      pushRequest("no-such-token", { communityId: "c1", expectedVersion: 1, payload: doc("anon") }),
      { DB: db } as never,
    );
    expect(response.status).toBe(401);
  });
});

async function getRevisionOrNull(db: Database, accountId: string, communityId: string): Promise<number | null> {
  const row = await db
    .prepare("SELECT revision FROM community_revisions WHERE account_id = ? AND community_id = ?")
    .bind(accountId, communityId)
    .first<{ revision: number }>();
  return row?.revision ?? null;
}
