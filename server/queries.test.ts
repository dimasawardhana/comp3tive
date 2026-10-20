import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { sqliteDatabase } from "./test-support/sqlite";
import type { Database } from "./db";
import handler from "./index";
import * as storage from "./storage";
import { asD1, type D1Like } from "./test-support/as-d1";
import { hashSessionToken } from "./tokens";

/**
 * The RB-5 query routes' contract, end to end through the Worker handler:
 * leaderboards, cross-community player search, and session history — the
 * joins the relational backend was built to answer (plan Task 5).
 *
 * The load-bearing guarantee, pinned from three angles:
 *  - every route answers 401 without a session;
 *  - every route answers 404/400 for a selector that names nothing or nothing
 *    at all, rather than an unscoped dump;
 *  - a second account with its own communities and identically-named players
 *    sees none of the first's rows — the account_id scope comes from the
 *    token, never the query string.
 *
 * And the grep gate (the plan's own requirement, Task 5): every SQL statement
 * in server/store/queries.ts must carry account_id in its WHERE.
 */
const SCHEMA = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
const SCHEMA_V2 = readFileSync(new URL("./schema-v2.sql", import.meta.url), "utf8");

function envFor(db: Database): { DB: D1Like } {
  return { DB: asD1(db) };
}

async function freshDb(): Promise<Database> {
  const db = sqliteDatabase();
  await db.exec(SCHEMA);
  await db.exec(SCHEMA_V2);
  return db;
}

beforeEach(() => {
  process.env.GOOGLE_CLIENT_ID = "test-client-id";
});

function request(path: string, init: RequestInit = {}): Request {
  return new Request(`https://comp3tive.example${path}`, {
    headers: { "content-type": "application/json" },
    ...init,
  });
}

function authed(path: string, token: string, init: RequestInit = {}): Request {
  const headers = new Headers(init.headers ?? {});
  headers.set("authorization", `Bearer ${token}`);
  return request(path, { ...init, headers });
}

async function sessionFor(db: Database, accountId: string): Promise<string> {
  const token = `tok-${accountId}-${Math.random().toString(36).slice(2)}`;
  await storage.insertSession(db, await hashSessionToken(token), accountId, Date.now(), Date.now() + 60_000);
  return token;
}

/** A discipline with one attribute, matching the documents below. */
function discipline() {
  return [
    {
      id: "d-futsal",
      name: "Futsal",
      shortName: "Futsal",
      roles: [
        { id: "r-keeper", name: "Keeper" },
        { id: "r-anchor", name: "Anchor" },
      ],
      attributes: [{ id: "a-fit", name: "Fitness", min: 1, max: 5 }],
      strengthModel: { kind: "mean" },
      team: { minTeamSize: 3, maxTeamSize: 5, rolesRequired: false },
    },
  ];
}

/** One community's document: players with ratings, one session. */
function communityDoc(communityId: string, communityName: string): string {
  return JSON.stringify({
    version: 5,
    exportedAt: "2026-10-19T00:00:00.000Z",
    communities: [{ id: communityId, name: communityName, createdAt: 1000 }],
    players: [
      {
        id: `p-${communityId}-1`,
        communityId,
        name: `Kim ${communityName}`,
        capabilities: [
          { disciplineId: "d-futsal", attributeRatings: { "a-fit": 5 }, eligibleRoles: ["r-keeper"] },
        ],
        createdAt: 1000,
      },
      {
        id: `p-${communityId}-2`,
        communityId,
        name: `Lee ${communityName}`,
        capabilities: [
          { disciplineId: "d-futsal", attributeRatings: { "a-fit": 3 }, eligibleRoles: ["r-anchor"] },
        ],
        createdAt: 1000,
      },
    ],
    sessions: [
      {
        id: `s-${communityId}`,
        communityId,
        disciplineId: "d-futsal",
        createdAt: communityId === "c1" ? 2000 : 1000,
        poolPlayerIds: [],
        settings: { teamCount: 2 },
        result: { teams: [], gap: 0 },
      },
    ],
    tournaments: [],
    savedSquads: [],
    disciplines: discipline(),
  });
}

/** An account with two communities (c1, c2), each with players and a session. */
async function accountWithTwoCommunities(db: Database): Promise<string> {
  await storage.insertAccount(db, { id: "a1", handle: "handle-a1", email: "a@example.com", createdAt: 1000 });
  const token = await sessionFor(db, "a1");
  for (const [id, name] of [
    ["c1", "Sunday League"],
    ["c2", "Weeknight League"],
  ] as const) {
    const adopt = await handler.fetch(
      authed("/api/documents/adopt", token, {
        method: "POST",
        body: JSON.stringify({ communityId: id, payload: communityDoc(id, name) }),
      }),
      envFor(db),
    );
    expect(adopt.status).toBe(200);
  }
  return token;
}

/** A second account with the same player names in its own community. */
async function secondAccount(db: Database): Promise<string> {
  await storage.insertAccount(db, { id: "a2", handle: "handle-a2", email: "b@example.com", createdAt: 1000 });
  const token = await sessionFor(db, "a2");
  const adopt = await handler.fetch(
    authed("/api/documents/adopt", token, {
      method: "POST",
      body: JSON.stringify({ communityId: "c9", payload: communityDoc("c9", "Rival League") }),
    }),
    envFor(db),
  );
  expect(adopt.status).toBe(200);
  return token;
}

describe("GET /api/leaderboards/:disciplineId/:attributeId", () => {
  it("requires a session", async () => {
    const db = await freshDb();
    const response = await handler.fetch(request("/api/leaderboards/d-futsal/a-fit"), envFor(db));
    expect(response.status).toBe(401);
  });

  it("ranks players across every community, highest rating first, naming each community", async () => {
    const db = await freshDb();
    const token = await accountWithTwoCommunities(db);
    const response = await handler.fetch(authed("/api/leaderboards/d-futsal/a-fit", token), envFor(db));
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      rows: Array<{ playerName: string; communityName: string; rating: number }>;
    };
    // Highest first; each community contributed its own two players.
    expect(body.rows.map((r) => `${r.playerName}:${r.rating}`)).toEqual([
      "Kim Sunday League:5",
      "Kim Weeknight League:5",
      "Lee Sunday League:3",
      "Lee Weeknight League:3",
    ]);
    expect(body.rows[0].communityName).toBe("Sunday League");
  });

  it("stays inside the account: another account's identically-named players are invisible", async () => {
    const db = await freshDb();
    await accountWithTwoCommunities(db);
    const rival = await secondAccount(db);
    const response = await handler.fetch(authed("/api/leaderboards/d-futsal/a-fit", rival), envFor(db));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { rows: Array<{ communityName: string }> };
    expect(body.rows.map((r) => r.communityName)).toEqual(["Rival League", "Rival League"]);
  });

  it("answers an empty list for an attribute nobody was rated on", async () => {
    const db = await freshDb();
    const token = await accountWithTwoCommunities(db);
    const response = await handler.fetch(authed("/api/leaderboards/d-futsal/a-none", token), envFor(db));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { rows: unknown[] };
    expect(body.rows).toEqual([]);
  });

  it("400s when the path names no attribute", async () => {
    const db = await freshDb();
    const token = await accountWithTwoCommunities(db);
    const response = await handler.fetch(authed("/api/leaderboards/d-futsal", token), envFor(db));
    expect(response.status).toBe(400);
  });
});

describe("GET /api/players?q=", () => {
  it("requires a session", async () => {
    const db = await freshDb();
    const response = await handler.fetch(request("/api/players?q=kim"), envFor(db));
    expect(response.status).toBe(401);
  });

  it("finds players by a case-insensitive substring across communities", async () => {
    const db = await freshDb();
    const token = await accountWithTwoCommunities(db);
    const response = await handler.fetch(authed("/api/players?q=kim", token), envFor(db));
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      players: Array<{ name: string; communityName: string }>;
    };
    expect(body.players.map((p) => p.name).sort()).toEqual(["Kim Sunday League", "Kim Weeknight League"]);
  });

  it("stays inside the account", async () => {
    const db = await freshDb();
    await accountWithTwoCommunities(db);
    const rival = await secondAccount(db);
    const response = await handler.fetch(authed("/api/players?q=kim", rival), envFor(db));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { players: Array<{ communityName: string }> };
    expect(body.players.map((p) => p.communityName)).toEqual(["Rival League"]);
  });

  it("400s an empty query rather than dumping the whole roster", async () => {
    const db = await freshDb();
    const token = await accountWithTwoCommunities(db);
    const response = await handler.fetch(authed("/api/players", token), envFor(db));
    expect(response.status).toBe(400);
  });
});

describe("GET /api/history?disciplineId=", () => {
  it("requires a session", async () => {
    const db = await freshDb();
    const response = await handler.fetch(request("/api/history?disciplineId=d-futsal"), envFor(db));
    expect(response.status).toBe(401);
  });

  it("lists the discipline's sessions newest first, naming each community, without payloads", async () => {
    const db = await freshDb();
    const token = await accountWithTwoCommunities(db);
    const response = await handler.fetch(authed("/api/history?disciplineId=d-futsal", token), envFor(db));
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      sessions: Array<{ sessionId: string; communityName: string; createdAt: number }>;
    };
    expect(body.sessions.map((s) => s.communityName)).toEqual(["Sunday League", "Weeknight League"]);
    expect(body.sessions.map((s) => s.createdAt)).toEqual([2000, 1000]);
    expect("result" in (body.sessions[0] as object)).toBe(false);
  });

  it("stays inside the account", async () => {
    const db = await freshDb();
    await accountWithTwoCommunities(db);
    const rival = await secondAccount(db);
    const response = await handler.fetch(authed("/api/history?disciplineId=d-futsal", rival), envFor(db));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { sessions: Array<{ communityName: string }> };
    expect(body.sessions.map((s) => s.communityName)).toEqual(["Rival League"]);
  });

  it("400s when the discipline is missing", async () => {
    const db = await freshDb();
    const token = await accountWithTwoCommunities(db);
    const response = await handler.fetch(authed("/api/history", token), envFor(db));
    expect(response.status).toBe(400);
  });
});

describe("the account_id grep gate", () => {
  it("every SQL statement in server/store/queries.ts scopes by account_id", () => {
    const source = readFileSync(new URL("./store/queries.ts", import.meta.url), "utf8");
    // Each query is a template literal ending in a WHERE block. Split on the
    // SELECTs and require the tenant key in every fragment that has one.
    const fragments = source.split(/SELECT/).slice(1);
    expect(fragments.length).toBeGreaterThanOrEqual(3);
    for (const fragment of fragments) {
      // Stop at the bind() call: the SQL is everything before it.
      const sql = fragment.slice(0, fragment.indexOf('")'));
      expect(sql, `query without account_id in WHERE:\n${sql}`).toMatch(/WHERE[\s\S]*account_id = \?/);
    }
  });
});
