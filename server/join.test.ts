import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { sqliteDatabase } from "./test-support/sqlite";
import type { Database } from "./db";
import handler from "./index";
import * as storage from "./storage";
import { asD1, type D1Like } from "./test-support/as-d1";
import { hashSessionToken } from "./tokens";

/** The env the handler expects: a D1-shaped DB, not the raw seam. */
function envFor(db: Database): { DB: D1Like } {
  return { DB: asD1(db) };
}

/**
 * The join routes' contract, end to end through the Worker handler
 * (TASK-125): a code the Organizer mints lets a stranger with no session read
 * the community's registration form data and submit a registration; the
 * registrations stay the Organizer's alone (scoped by account), until they
 * are pulled and acknowledged, and then they are gone.
 *
 * The load-bearing guarantees, each pinned by a test:
 *  - minting requires a session and a community the account actually has;
 *  - the public GET never answers for a code that does not exist;
 *  - the public POST validates the discipline and role against the
 *    community's own catalog, not the request's say-so;
 *  - the pull list is scoped by account: another account minting the same
 *    code value cannot read it (a second code row with the same code is
 *    impossible by the primary key, so the test uses the ids route with a
 *    foreign token);
 *  - the ack deletes only the account's own rows.
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

/** A valid v5 document with one discipline ("Futsal", roles "Keeper"/"Anchor") and no players. */
function doc(): string {
  return JSON.stringify({
    version: 5,
    exportedAt: "2026-10-19T00:00:00.000Z",
    communities: [{ id: "c1", name: "Sunday League", createdAt: 1000 }],
    players: [],
    sessions: [],
    tournaments: [],
    savedSquads: [],
    disciplines: [
      {
        id: "d-futsal",
        name: "Futsal",
        shortName: "Futsal",
        roles: [
          { id: "r-keeper", name: "Keeper" },
          { id: "r-anchor", name: "Anchor" },
        ],
        attributes: [{ id: "a-fit", name: "Fitness" }],
        strengthModel: { kind: "mean" },
        team: { minTeamSize: 3, maxTeamSize: 5, rolesRequired: false },
      },
    ],
  });
}

/** Sign up, adopt the document, mint a code: the shared prefix of every test. */
async function mintedCode(db: Database): Promise<{ token: string; code: string }> {
  await storage.insertAccount(db, { id: "a1", handle: "handle-a1", email: "a@example.com", createdAt: 1000 });
  const token = await sessionFor(db, "a1");
  const adopt = await handler.fetch(authed("/api/documents/adopt", token, { method: "POST", body: JSON.stringify({ communityId: "c1", payload: doc() }) }), envFor(db));
  expect(adopt.status).toBe(200);
  const mint = await handler.fetch(authed("/api/join/codes", token, { method: "POST", body: JSON.stringify({ communityId: "c1" }) }), envFor(db));
  expect(mint.status).toBe(200);
  const body = (await mint.json()) as { code: string };
  return { token, code: body.code };
}

describe("POST /api/join/codes", () => {
  it("requires a session", async () => {
    const db = await freshDb();
    const response = await handler.fetch(request("/api/join/codes", { method: "POST", body: JSON.stringify({ communityId: "c1" }) }), envFor(db));
    expect(response.status).toBe(401);
  });

  it("refuses a community the account does not have", async () => {
    const db = await freshDb();
    await storage.insertAccount(db, { id: "a1", handle: "handle-a1", email: "a@example.com", createdAt: 1000 });
    const token = await sessionFor(db, "a1");
    const response = await handler.fetch(authed("/api/join/codes", token, { method: "POST", body: JSON.stringify({ communityId: "nope" }) }), envFor(db));
    expect(response.status).toBe(404);
  });

  it("mints a code and lists it back", async () => {
    const db = await freshDb();
    const { token, code } = await mintedCode(db);
    expect(code).toMatch(/^[A-Za-z0-9_-]{11}$/);
    const list = await handler.fetch(authed("/api/join/codes", token), envFor(db));
    expect(list.status).toBe(200);
    const body = (await list.json()) as { codes: Array<{ code: string; communityId: string }> };
    expect(body.codes.map((c) => c.code)).toContain(code);
    expect(body.codes[0].communityId).toBe("c1");
  });
});

describe("GET /api/join/:code (public)", () => {
  it("answers the community name and its disciplines with roles, no session", async () => {
    const db = await freshDb();
    const { code } = await mintedCode(db);
    const response = await handler.fetch(request(`/api/join/${code}`), envFor(db));
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      community: { name: string };
      disciplines: Array<{ name: string; roles: string[]; attributes: Array<{ name: string; min: number; max: number }> }>;
    };
    expect(body.community.name).toBe("Sunday League");
    // The catalog is the ACCOUNT's (schema-v2's decision): the seed
    // disciplines ride along with the adopted document's own, and every
    // discipline lists its roles and attributes. The doc's own Futsal is
    // last (rowid order).
    expect(body.disciplines.length).toBeGreaterThanOrEqual(1);
    const last = body.disciplines[body.disciplines.length - 1];
    expect(last.name).toBe("Futsal");
    expect([...last.roles].sort()).toEqual(["Anchor", "Keeper"]);
    expect(last.attributes).toContainEqual({ name: "Fitness", min: 1, max: 5 });
  });

  it("404s an unknown code", async () => {
    const db = await freshDb();
    const response = await handler.fetch(request("/api/join/does-not-exist"), envFor(db));
    expect(response.status).toBe(404);
  });
});

describe("POST /api/join/:code (public)", () => {
  it("records a registration and hides it from the public answer", async () => {
    const db = await freshDb();
    const { code } = await mintedCode(db);
    const response = await handler.fetch(
      request(`/api/join/${code}`, {
        method: "POST",
        body: JSON.stringify({ name: "Ama", discipline: "Futsal", role: "Keeper", notes: "hi" }),
      }),
      envFor(db),
    );
    expect(response.status).toBe(201);
    // The public GET must not leak registrations back: the form data route
    // answers only the community and the catalog.
    const form = await handler.fetch(request(`/api/join/${code}`), envFor(db));
    const body = (await form.json()) as Record<string, unknown>;
    expect(body.registrations).toBeUndefined();
  });

  it("stores self-assessed ratings, clamped to the attribute's bounds, dropping unknown keys", async () => {
    const db = await freshDb();
    const { token, code } = await mintedCode(db);
    const response = await handler.fetch(
      request(`/api/join/${code}`, {
        method: "POST",
        body: JSON.stringify({
          name: "Ama",
          discipline: "Futsal",
          role: "Keeper",
          ratings: { Fitness: 4, Sprint: 5, Bogus: 9, // Sprint and Bogus are not this discipline's
          },
        }),
      }),
      envFor(db),
    );
    expect(response.status).toBe(201);
    const pull = await handler.fetch(authed("/api/join/registrations", token, { method: "POST", body: JSON.stringify({ code }) }), envFor(db));
    const body = (await pull.json()) as { registrations: Array<{ payload: string }> };
    const payload = JSON.parse(body.registrations[0].payload) as { ratings: Record<string, number> };
    // Clamped into Fitness's 1..5, unknown attributes dropped entirely.
    expect(payload.ratings).toEqual({ Fitness: 4 });
  });

  it("clamps an out-of-bounds rating into the attribute's range", async () => {
    const db = await freshDb();
    const { token, code } = await mintedCode(db);
    await handler.fetch(
      request(`/api/join/${code}`, {
        method: "POST",
        body: JSON.stringify({ name: "Ama", discipline: "Futsal", ratings: { Fitness: 99 } }),
      }),
      envFor(db),
    );
    const pull = await handler.fetch(authed("/api/join/registrations", token, { method: "POST", body: JSON.stringify({ code }) }), envFor(db));
    const body = (await pull.json()) as { registrations: Array<{ payload: string }> };
    const payload = JSON.parse(body.registrations[0].payload) as { ratings: Record<string, number> };
    expect(payload.ratings).toEqual({ Fitness: 5 });
  });

  it("refuses a discipline the community does not offer", async () => {
    const db = await freshDb();
    const { code } = await mintedCode(db);
    const response = await handler.fetch(
      request(`/api/join/${code}`, { method: "POST", body: JSON.stringify({ name: "Ama", discipline: "Chess" }) }),
      envFor(db),
    );
    expect(response.status).toBe(400);
  });

  it("refuses a role the discipline does not offer", async () => {
    const db = await freshDb();
    const { code } = await mintedCode(db);
    const response = await handler.fetch(
      request(`/api/join/${code}`, { method: "POST", body: JSON.stringify({ name: "Ama", discipline: "Futsal", role: "Quarterback" }) }),
      envFor(db),
    );
    expect(response.status).toBe(400);
  });

  it("refuses a missing name", async () => {
    const db = await freshDb();
    const { code } = await mintedCode(db);
    const response = await handler.fetch(
      request(`/api/join/${code}`, { method: "POST", body: JSON.stringify({ name: "   ", discipline: "Futsal" }) }),
      envFor(db),
    );
    expect(response.status).toBe(400);
  });

  it("rate-limits a busy code", async () => {
    const db = await freshDb();
    const { code } = await mintedCode(db);
    for (let i = 0; i < 20; i++) {
      const ok = await handler.fetch(
        request(`/api/join/${code}`, { method: "POST", body: JSON.stringify({ name: `P${i}`, discipline: "Futsal" }) }),
        envFor(db),
      );
      expect(ok.status).toBe(201);
    }
    const busy = await handler.fetch(
      request(`/api/join/${code}`, { method: "POST", body: JSON.stringify({ name: "P20", discipline: "Futsal" }) }),
      envFor(db),
    );
    expect(busy.status).toBe(429);
  });
});

describe("POST /api/join/registrations + /ack (organizer)", () => {
  it("lists and acknowledges, scoped by account", async () => {
    const db = await freshDb();
    const { token, code } = await mintedCode(db);
    await handler.fetch(
      request(`/api/join/${code}`, { method: "POST", body: JSON.stringify({ name: "Ama", discipline: "Futsal", role: "Keeper" }) }),
      envFor(db),
    );
    await handler.fetch(
      request(`/api/join/${code}`, { method: "POST", body: JSON.stringify({ name: "Bo", discipline: "Futsal" }) }),
      envFor(db),
    );

    // A second account cannot pull with this code, even signed in.
    await storage.insertAccount(db, { id: "a2", handle: "handle-a2", email: "b@example.com", createdAt: 1000 });
    const foreign = await sessionFor(db, "a2");
    const denied = await handler.fetch(
      authed("/api/join/registrations", foreign, { method: "POST", body: JSON.stringify({ code }) }),
      envFor(db),
    );
    expect(denied.status).toBe(404);

    const pull = await handler.fetch(authed("/api/join/registrations", token, { method: "POST", body: JSON.stringify({ code }) }), envFor(db));
    expect(pull.status).toBe(200);
    const body = (await pull.json()) as {
      registrations: Array<{ id: string; payload: string; createdAt: number }>;
    };
    expect(body.registrations).toHaveLength(2);
    // Oldest first: the pull order is the review order.
    expect(JSON.parse(body.registrations[0].payload).name).toBe("Ama");
    expect(JSON.parse(body.registrations[1].payload).name).toBe("Bo");

    const ack = await handler.fetch(
      authed("/api/join/registrations/ack", token, { method: "POST", body: JSON.stringify({ ids: body.registrations.map((r) => r.id) }) }),
      envFor(db),
    );
    expect(ack.status).toBe(200);
    const after = await handler.fetch(authed("/api/join/registrations", token, { method: "POST", body: JSON.stringify({ code }) }), envFor(db));
    const afterBody = (await after.json()) as { registrations: unknown[] };
    expect(afterBody.registrations).toHaveLength(0);
  });

  it("ack cannot delete another account's rows", async () => {
    const db = await freshDb();
    const { token, code } = await mintedCode(db);
    await handler.fetch(
      request(`/api/join/${code}`, { method: "POST", body: JSON.stringify({ name: "Ama", discipline: "Futsal" }) }),
      envFor(db),
    );
    const pull = await handler.fetch(authed("/api/join/registrations", token, { method: "POST", body: JSON.stringify({ code }) }), envFor(db));
    const body = (await pull.json()) as { registrations: Array<{ id: string }> };
    const id = body.registrations[0].id;

    await storage.insertAccount(db, { id: "a2", handle: "handle-a2", email: "b@example.com", createdAt: 1000 });
    const foreign = await sessionFor(db, "a2");
    await handler.fetch(authed("/api/join/registrations/ack", foreign, { method: "POST", body: JSON.stringify({ ids: [id] }) }), envFor(db));
    const after = await handler.fetch(authed("/api/join/registrations", token, { method: "POST", body: JSON.stringify({ code }) }), envFor(db));
    const afterBody = (await after.json()) as { registrations: unknown[] };
    expect(afterBody.registrations).toHaveLength(1);
  });
});

describe("GET /join/:code (the public page)", () => {
  it("serves the form document, and only for a well-formed code", async () => {
    const db = await freshDb();
    const page = await handler.fetch(request("/join/abc123_ABC"), envFor(db));
    expect(page.status).toBe(200);
    expect(page.headers.get("content-type")).toContain("text/html");
    const html = await page.text();
    expect(html).toContain("Register as a player");

    const bad = await handler.fetch(request("/join/not%20a%20code"), envFor(db));
    expect(bad.status).toBe(404);
  });
});
