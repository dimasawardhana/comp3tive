import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sqliteDatabase } from "./test-support/sqlite";
import type { Database } from "./db";
import handler from "./index";
import * as storage from "./storage";
import { asD1 } from "./test-support/as-d1";
import { hashSessionToken } from "./tokens";
import { runTool } from "./ai";

/**
 * The AI chat route's contract (TASK-130).
 *
 * Three guarantees, in the same spirit as queries.test.ts:
 *  - the route answers 401 without a session and 503 without AI config;
 *  - the tool layer is read-only and Account-scoped — a second account's
 *    rows are invisible to every tool, and no tool mutates anything;
 *  - the tool-calling loop passes tool results back and stops when the
 *    model answers in plain text (mocked LLM, no network).
 */
const SCHEMA = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
const SCHEMA_V2 = readFileSync(new URL("./schema-v2.sql", import.meta.url), "utf8");

function envFor(db: Database, extra: Record<string, string> = {}) {
  return { DB: asD1(db), ...extra } as Parameters<typeof handler.fetch>[1];
}

async function freshDb(): Promise<Database> {
  const db = sqliteDatabase();
  await db.exec(SCHEMA);
  await db.exec(SCHEMA_V2);
  return db;
}

beforeEach(() => {
  vi.unstubAllGlobals();
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

/** A discipline with one attribute, matching the community document below. */
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

/** One community's document: two rated players, no sessions. */
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
    sessions: [],
    tournaments: [],
    savedSquads: [],
    disciplines: discipline(),
  });
}

async function accountWithCommunity(db: Database, accountId: string, communityId: string): Promise<string> {
  await storage.insertAccount(db, { id: accountId, handle: `handle-${accountId}`, email: `${accountId}@example.com`, createdAt: 1000 });
  const token = await sessionFor(db, accountId);
  const adopt = await handler.fetch(
    authed("/api/documents/adopt", token, {
      method: "POST",
      body: JSON.stringify({ communityId, payload: communityDoc(communityId, "Sunday League") }),
    }),
    envFor(db),
  );
  expect(adopt.status).toBe(200);
  return token;
}

// ── Route guards ──────────────────────────────────────────────────────────

describe("POST /api/ai/chat", () => {
  it("answers 401 without a session", async () => {
    const db = await freshDb();
    const res = await handler.fetch(
      request("/api/ai/chat", { method: "POST", body: JSON.stringify({ turns: [{ role: "user", content: "hi" }] }) }),
      envFor(db, { AI_API_KEY: "test-key" }),
    );
    expect(res.status).toBe(401);
  });

  it("answers 503 when no AI key is configured", async () => {
    const db = await freshDb();
    const accountId = "a1";
    await storage.insertAccount(db, { id: accountId, handle: "h", email: "a@example.com", createdAt: 1000 });
    const token = await sessionFor(db, accountId);
    const res = await handler.fetch(
      authed("/api/ai/chat", token, {
        method: "POST",
        body: JSON.stringify({ turns: [{ role: "user", content: "hi" }] }),
      }),
      envFor(db),
    );
    expect(res.status).toBe(503);
  });

  it("answers 400 when the body carries no turns", async () => {
    const db = await freshDb();
    const accountId = "a1";
    await storage.insertAccount(db, { id: accountId, handle: "h", email: "a@example.com", createdAt: 1000 });
    const token = await sessionFor(db, accountId);
    const res = await handler.fetch(
      authed("/api/ai/chat", token, { method: "POST", body: JSON.stringify({}) }),
      envFor(db, { AI_API_KEY: "test-key" }),
    );
    expect(res.status).toBe(400);
  });
});

// ── Tool layer: account scoping + read-only ──────────────────────────────

describe("runTool", () => {
  it("search_players finds only the calling account's players", async () => {
    const db = await freshDb();
    await accountWithCommunity(db, "a1", "c1");
    await accountWithCommunity(db, "a2", "c2");

    const tokenA1 = await sessionFor(db, "a1");
    // Re-adopt is not needed; just resolve via the store layer directly.
    void tokenA1;

    const mine = await runTool(db, "a1", "search_players", { query: "Kim" });
    expect(mine).toMatchObject({ players: [{ name: "Kim Sunday League" }] });

    const theirs = await runTool(db, "a2", "search_players", { query: "Kim" });
    expect(theirs).toMatchObject({ players: [{ name: "Kim Sunday League" }] });
    // a2 sees its own Kim (same fixture name), never a1's row beyond its own.
    const a2rows = (theirs as { players: Array<{ communityId: string }> }).players;
    expect(a2rows.every((p) => p.communityId === "c2")).toBe(true);
  });

  it("get_community_roster refuses another account's community", async () => {
    const db = await freshDb();
    await accountWithCommunity(db, "a1", "c1");

    const cross = await runTool(db, "a2", "get_community_roster", { communityId: "c1" });
    expect(cross).toMatchObject({ error: "No such community for this Account." });
  });

  it("get_leaderboard ranks highest first, scoped to the account", async () => {
    const db = await freshDb();
    await accountWithCommunity(db, "a1", "c1");

    const rows = await runTool(db, "a1", "get_leaderboard", { disciplineId: "d-futsal", attributeId: "a-fit" });
    const list = (rows as { rows: Array<{ playerName: string; rating: number }> }).rows;
    expect(list).toHaveLength(2);
    expect(list[0].rating).toBe(5);
    expect(list[1].rating).toBe(3);
  });

  it("unknown tool names are an error result, not a throw", async () => {
    const db = await freshDb();
    await expect(runTool(db, "a1", "drop_everything", {})).resolves.toMatchObject({ error: /Unknown tool/ });
  });

  it("no tool mutates the database (read-only surface)", async () => {
    const db = await freshDb();
    await accountWithCommunity(db, "a1", "c1");
    const before = await db.prepare("SELECT count(*) AS n FROM players").first<{ n: number }>();

    await runTool(db, "a1", "list_communities", {});
    await runTool(db, "a1", "search_players", { query: "Kim" });
    await runTool(db, "a1", "get_leaderboard", { disciplineId: "d-futsal", attributeId: "a-fit" });
    await runTool(db, "a1", "list_disciplines", {});
    await runTool(db, "a1", "get_session_history", { disciplineId: "d-futsal" });
    await runTool(db, "a1", "get_community_roster", { communityId: "c1" });

    const after = await db.prepare("SELECT count(*) AS n FROM players").first<{ n: number }>();
    expect(after).toEqual(before);
  });
});

// ── The chat loop with a mocked LLM ──────────────────────────────────────

describe("ai chat loop", () => {
  it("executes tool calls server-side and returns the final answer with a trace", async () => {
    const db = await freshDb();
    await accountWithCommunity(db, "a1", "c1");
    const token = await sessionFor(db, "a1");

    // Two-phase mock: first call asks for a tool, second answers in text.
    const calls: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        calls.push(body);
        const isFirst = calls.length === 1;
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: isFirst
                  ? {
                      role: "assistant",
                      content: null,
                      tool_calls: [
                        {
                          id: "call-1",
                          type: "function",
                          function: { name: "search_players", arguments: JSON.stringify({ query: "Kim" }) },
                        },
                      ],
                    }
                  : { role: "assistant", content: "I found 1 player named Kim." },
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }),
    );

    const res = await handler.fetch(
      authed("/api/ai/chat", token, {
        method: "POST",
        body: JSON.stringify({ turns: [{ role: "user", content: "Find Kim." }] }),
      }),
      envFor(db, { AI_API_KEY: "test-key", AI_BASE_URL: "https://llm.example/v1" }),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { reply: string; toolCalls: Array<{ tool: string }> };
    expect(data.reply).toBe("I found 1 player named Kim.");
    expect(data.toolCalls).toEqual([{ tool: "search_players", args: { query: "Kim" } }]);

    // The LLM saw a system prompt, the user turn, then the tool result.
    expect(calls).toHaveLength(2);
    const secondMessages = calls[1].messages as Array<{ role: string; content?: string; tool_call_id?: string }>;
    expect(secondMessages.at(-1)).toMatchObject({ role: "tool", tool_call_id: "call-1" });
    expect(secondMessages.at(-1)?.content).toContain("Kim Sunday League");
  });

  it("stops after the round cap when the model keeps asking for tools", async () => {
    const db = await freshDb();
    await accountWithCommunity(db, "a1", "c1");
    const token = await sessionFor(db, "a1");

    let n = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string | URL, init?: RequestInit) => {
        void init;
        n++;
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  role: "assistant",
                  content: null,
                  tool_calls: [
                    { id: `call-${n}`, type: "function", function: { name: "list_communities", arguments: "{}" } },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }),
    );

    const res = await handler.fetch(
      authed("/api/ai/chat", token, {
        method: "POST",
        body: JSON.stringify({ turns: [{ role: "user", content: "hello" }] }),
      }),
      envFor(db, { AI_API_KEY: "test-key" }),
    );
    expect(res.status).toBe(200);
    // 4 tool rounds + 1 final plain completion = 5 LLM calls.
    expect(n).toBe(5);
  });

  it("propagates a provider failure as a 502", async () => {
    const db = await freshDb();
    await accountWithCommunity(db, "a1", "c1");
    const token = await sessionFor(db, "a1");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("boom", { status: 500 })),
    );

    const res = await handler.fetch(
      authed("/api/ai/chat", token, {
        method: "POST",
        body: JSON.stringify({ turns: [{ role: "user", content: "hi" }] }),
      }),
      envFor(db, { AI_API_KEY: "test-key" }),
    );
    expect(res.status).toBe(502);
  });
});
