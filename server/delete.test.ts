import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { sqliteDatabase } from "./test-support/sqlite";
import type { Database } from "./db";
import handler from "./index";
import * as storage from "./storage";
import { reassemble } from "./store/reassemble";
import { hashSessionToken } from "./tokens";

/**
 * The delete route's contract, end to end through the Worker handler: a
 * community deleted on the client must stop existing on the server — revision
 * row, decomposed rows and dual-write blob — or it resurrects at the next
 * pull/sign-in (`listRevisions` names it and `reassemble` rebuilds it).
 *
 * Two routes share the guarantee with this one: the pull route's documents
 * list must no longer name the community, and the push route must answer a
 * post-delete push with the "no document" 409, not a CAS race.
 */
const SCHEMA = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
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

function deleteRequest(token: string, body: unknown): Request {
  return new Request("https://comp3tive.example/api/documents/delete", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

function adoptRequest(token: string, body: unknown): Request {
  return new Request("https://comp3itive.example/api/documents/adopt", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

function pullRequest(token: string, body: unknown): Request {
  return new Request("https://comp3tive.example/api/documents/pull", {
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

/** A minimal valid v5 document for one community. */
function doc(): string {
  return JSON.stringify({
    version: 5,
    exportedAt: "2026-10-15T00:00:00.000Z",
    communities: [{ id: "c1", name: "from-adopt", createdAt: 1000 }],
    players: [],
    sessions: [],
    tournaments: [],
    savedSquads: [],
    disciplines: [],
  });
}

describe("POST /api/documents/delete", () => {
  it("removes the revision row, the decomposed rows and the blob, so nothing resurrects", async () => {
    const db = await freshDb();
    await storage.insertAccount(db, { id: "a1", handle: "handle-a1", email: "a@example.com", createdAt: 1000 });
    const token = await sessionFor(db, "a1");
    const env = { DB: db } as never;
    const adopted = await handler.fetch(adoptRequest(token, { communityId: "c1", payload: doc() }), env);
    expect(adopted.status).toBe(200);

    const response = await handler.fetch(deleteRequest(token, { communityId: "c1" }), env);
    expect(response.status, JSON.stringify(await response.clone().json())).toBe(200);

    // The three stores a resurrection needs are all empty.
    const revision = await db
      .prepare("SELECT revision FROM community_revisions WHERE account_id = 'a1' AND community_id = 'c1'")
      .first<{ revision: number }>();
    expect(revision).toBeNull();
    expect(await reassemble(db, "a1", "c1")).toBeNull();
    const communityRow = await db
      .prepare("SELECT COUNT(*) AS n FROM communities WHERE account_id = 'a1' AND id = 'c1'")
      .first<{ n: number }>();
    expect(communityRow?.n).toBe(0);

    // The pull route no longer names it.
    const pulled = await handler.fetch(pullRequest(token, { communityIds: ["c1"] }), env);
    expect(pulled.status).toBe(200);
    expect(((await pulled.json()) as { documents: unknown[] }).documents).toHaveLength(0);
  });

  it("is idempotent: deleting a community the server never held is a 200 no-op", async () => {
    const db = await freshDb();
    await storage.insertAccount(db, { id: "a1", handle: "handle-a1", email: "a@example.com", createdAt: 1000 });
    const token = await sessionFor(db, "a1");
    const response = await handler.fetch(
      deleteRequest(token, { communityId: "never-existed" }),
      { DB: db } as never,
    );
    expect(response.status).toBe(200);
  });

  it("deletes only the named community, not a sibling", async () => {
    const db = await freshDb();
    await storage.insertAccount(db, { id: "a1", handle: "handle-a1", email: "a@example.com", createdAt: 1000 });
    const token = await sessionFor(db, "a1");
    const env = { DB: db } as never;
    const docC1 = JSON.stringify({
      version: 5,
      exportedAt: "2026-10-15T00:00:00.000Z",
      communities: [{ id: "c1", name: "one", createdAt: 1000 }],
      players: [], sessions: [], tournaments: [], savedSquads: [], disciplines: [],
    });
    const docC2 = JSON.stringify({
      version: 5,
      exportedAt: "2026-10-15T00:00:00.000Z",
      communities: [{ id: "c2", name: "two", createdAt: 1000 }],
      players: [], sessions: [], tournaments: [], savedSquads: [], disciplines: [],
    });
    expect((await handler.fetch(adoptRequest(token, { communityId: "c1", payload: docC1 }), env)).status).toBe(200);
    expect((await handler.fetch(adoptRequest(token, { communityId: "c2", payload: docC2 }), env)).status).toBe(200);

    expect((await handler.fetch(deleteRequest(token, { communityId: "c1" }), env)).status).toBe(200);
    expect(await reassemble(db, "a1", "c1")).toBeNull();
    expect((await reassemble(db, "a1", "c2"))?.communities[0]?.name).toBe("two");
  });

  it("requires a session", async () => {
    const db = await freshDb();
    const response = await handler.fetch(
      deleteRequest("no-such-token", { communityId: "c1" }),
      { DB: db } as never,
    );
    expect(response.status).toBe(401);
  });

  it("refuses a body with no community id", async () => {
    const db = await freshDb();
    await storage.insertAccount(db, { id: "a1", handle: "handle-a1", email: "a@example.com", createdAt: 1000 });
    const token = await sessionFor(db, "a1");
    const response = await handler.fetch(deleteRequest(token, {}), { DB: db } as never);
    expect(response.status).toBe(400);
  });
});
