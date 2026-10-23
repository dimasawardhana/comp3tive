/**
 * The AI chat route: `/api/ai/chat`.
 *
 * An Organizer asks a question; the Worker calls an LLM whose tools are the
 * Account-scoped read queries this server already answers — leaderboards,
 * player search, session history, and full community documents. Every tool
 * execution happens *here*, with the account id taken from the session token
 * and threaded through the same `account_id`-scoped store functions every
 * other route uses. The model never sees SQL, never sees another account's
 * rows, and can only read.
 *
 * The LLM is OpenAI-compatible (base URL + key + model all come from env, so
 * a deployment can point this at any compatible provider, or leave the key
 * unset and get a 503 — same optionality rule as Google sign-in).
 *
 * No conversation state is stored server-side: the client sends the recent
 * turns with each request and owns the history, the same way it owns the
 * document cache. That keeps the Worker stateless and the data story simple
 * ("in your Account" stays about *their* records, not our transcripts).
 */

import type { Database } from "./db";
import { leaderboard, searchPlayers, sessionHistory } from "./store/queries";
import { accountDisciplines } from "./store/join";
import { reassemble } from "./store/reassemble";
import { listRevisions } from "./storage";
import { ApiError, json, type Env } from "./shared";

/** One turn as the client sends it — no server-side transcript exists. */
export interface AiTurn {
  role: "user" | "assistant";
  content: string;
}

// ── Tool layer ────────────────────────────────────────────────────────────
// Each tool is a name, a JSON-schema description for the LLM, and a run that
// receives the *server-resolved* accountId. The schema strings are the model's
// only view of the domain, so they name the domain words (Player, Discipline,
// Community, Split, Tournament) rather than table names.

interface ToolSpec {
  description: string;
  parameters: Record<string, unknown>;
  run: (db: Database, accountId: string, args: Record<string, unknown>) => Promise<unknown>;
}

const TOOLS: Record<string, ToolSpec> = {
  list_communities: {
    description:
      "List the Organizer's Communities (profiles) with their ids and names. Call this first when a question needs a communityId.",
    parameters: { type: "object", properties: {} },
    run: async (db, accountId) => {
      const revisions = await listRevisions(db, accountId);
      return revisions.map((r) => ({ communityId: r.communityId, version: r.revision, updatedAt: r.updatedAt }));
    },
  },

  get_community_roster: {
    description:
      "Get one Community's full document: its Players (with per-Discipline capabilities, ratings and roles), recent Splits, Saved Squads and Tournaments. Use after list_communities when a question needs roster detail.",
    parameters: {
      type: "object",
      properties: {
        communityId: { type: "string", description: "The Community's id, from list_communities." },
      },
      required: ["communityId"],
    },
    run: async (db, accountId, args) => {
      const communityId = String(args.communityId ?? "");
      if (!communityId) throw new ApiError(400, "That tool call names no community.");
      const doc = await reassemble(db, accountId, communityId);
      if (!doc) return { error: "No such community for this Account." };
      // Trim to what a roster question needs — the full document can be large.
      const community = doc.communities.find((c) => c.id === communityId) ?? null;
      return {
        community,
        players: doc.players
          .filter((p) => p.communityId === communityId)
          .map((p) => ({
            id: p.id,
            name: p.name,
            notes: p.notes ?? null,
            createdAt: p.createdAt,
            capabilities: p.capabilities,
          })),
        savedSquads: doc.savedSquads
          .filter((s) => s.communityId === communityId)
          .map((s) => ({ id: s.id, name: s.name })),
        tournaments: doc.tournaments
          .filter((t) => t.communityId === communityId)
          .map((t) => ({ id: t.id, name: t.name, status: t.status })),
      };
    },
  },

  search_players: {
    description:
      "Search Players by name (substring, case-insensitive) across every Community of the Account. Returns each hit's community.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "All or part of the player's name." },
      },
      required: ["query"],
    },
    run: async (db, accountId, args) => {
      const q = String(args.query ?? "").trim();
      if (!q) return { error: "No query given." };
      return { players: await searchPlayers(db, accountId, q) };
    },
  },

  get_leaderboard: {
    description:
      "Get the ranking of Players for one Discipline's one attribute (e.g. Fitness in Futsal), across all the Account's Communities, highest rating first.",
    parameters: {
      type: "object",
      properties: {
        disciplineId: { type: "string", description: "The Discipline's id (from list_disciplines)." },
        attributeId: { type: "string", description: "The attribute's id (e.g. a rating like Fitness)." },
      },
      required: ["disciplineId", "attributeId"],
    },
    run: async (db, accountId, args) => {
      const disciplineId = String(args.disciplineId ?? "");
      const attributeId = String(args.attributeId ?? "");
      if (!disciplineId || !attributeId) return { error: "Missing disciplineId or attributeId." };
      return { rows: await leaderboard(db, accountId, disciplineId, attributeId) };
    },
  },

  list_disciplines: {
    description:
      "List the Account's Disciplines (games) with their ids, names and attributes — use it to resolve ids before get_leaderboard.",
    parameters: { type: "object", properties: {} },
    run: async (db, accountId) => {
      const disciplines = await accountDisciplines(db, accountId);
      return { disciplines };
    },
  },

  get_session_history: {
    description:
      "List past Split sessions (team splits) for one Discipline, newest first, across every Community — headers only, no full results.",
    parameters: {
      type: "object",
      properties: {
        disciplineId: { type: "string", description: "The Discipline's id (from list_disciplines)." },
      },
      required: ["disciplineId"],
    },
    run: async (db, accountId, args) => {
      const disciplineId = String(args.disciplineId ?? "");
      if (!disciplineId) return { error: "Missing disciplineId." };
      return { sessions: await sessionHistory(db, accountId, disciplineId) };
    },
  },
};

/** The schemas sent to the LLM. */
function toolSchemas() {
  return Object.entries(TOOLS).map(([name, t]) => ({
    type: "function" as const,
    function: { name, description: t.description, parameters: t.parameters },
  }));
}

/** Execute one tool call by name. Unknown names are an error result, not a throw. */
export async function runTool(
  db: Database,
  accountId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const tool = TOOLS[name];
  if (!tool) return { error: `Unknown tool: ${name}` };
  try {
    return await tool.run(db, accountId, args);
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    return { error: error instanceof Error ? error.message : "The tool failed." };
  }
}

// ── LLM client (OpenAI-compatible chat completions) ──────────────────────

interface LlmMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
}

function aiEnv(env: Env) {
  const apiKey = env.AI_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl: (env.AI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, ""),
    model: env.AI_MODEL ?? "gpt-4o-mini",
  };
}

async function llmChat(baseUrl: string, apiKey: string, body: Record<string, unknown>): Promise<LlmMessage> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new ApiError(502, `The AI provider answered ${res.status}. ${detail.slice(0, 200)}`);
  }
  const data = (await res.json()) as { choices?: Array<{ message?: LlmMessage }> };
  const message = data.choices?.[0]?.message;
  if (!message) throw new ApiError(502, "The AI provider returned no message.");
  return message;
}

const SYSTEM_PROMPT = `You are the assistant inside comp3tive, a tool for managing rosters of rated players and assembling balanced teams (Communities hold Players; Disciplines are the games; Splits divide a pool into teams; Tournaments run formats like Swiss and single elimination).

Answer the Organizer's questions about THEIR data only. Use the tools to look it up — never invent players, ratings, communities or results. If a tool returns an error or empty data, say so plainly. Be concise; when you cite numbers, name the tool that produced them.`;

const MAX_TOOL_ROUNDS = 4;

/**
 * The chat loop. `turns` is the client's recent history (already trimmed);
 * the newest turn must be the user's question.
 */
export async function aiChat(db: Database, env: Env, accountId: string, turns: AiTurn[]): Promise<Response> {
  const cfg = aiEnv(env);
  if (!cfg) throw new ApiError(503, "The AI assistant is not configured on this deployment.");
  if (turns.length === 0 || turns[turns.length - 1].role !== "user")
    throw new ApiError(400, "That request carries no question.");

  const history: LlmMessage[] = turns.slice(-12).map((t) => ({ role: t.role, content: t.content }));
  const messages: LlmMessage[] = [{ role: "system", content: SYSTEM_PROMPT }, ...history];
  const toolCallsTrace: Array<{ tool: string; args: unknown }> = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const reply = await llmChat(cfg.baseUrl, cfg.apiKey, {
      model: cfg.model,
      messages,
      tools: toolSchemas(),
      tool_choice: "auto",
      temperature: 0.2,
    });

    if (!reply.tool_calls || reply.tool_calls.length === 0) {
      return json({ reply: reply.content ?? "", toolCalls: toolCallsTrace });
    }

    messages.push(reply);
    for (const call of reply.tool_calls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
      } catch {
        args = {};
      }
      const result = await runTool(db, accountId, call.function.name, args);
      toolCallsTrace.push({ tool: call.function.name, args });
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result).slice(0, 12_000),
      });
    }
  }

  // Out of rounds: one plain completion with whatever was gathered.
  const final = await llmChat(cfg.baseUrl, cfg.apiKey, { model: cfg.model, messages, temperature: 0.2 });
  return json({ reply: final.content ?? "", toolCalls: toolCallsTrace });
}

/** Route helper: validate + dispatch. Called from server/index.ts. */
export async function handleAiChat(db: Database, request: Request, env: Env, accountId: string): Promise<Response> {
  const body = await (async () => {
    try {
      return (await request.json()) as { turns?: unknown };
    } catch {
      throw new ApiError(400, "That request body is not valid JSON.");
    }
  })();
  if (!Array.isArray(body.turns)) throw new ApiError(400, "That request carries no conversation.");
  const turns: AiTurn[] = [];
  for (const t of body.turns) {
    if (typeof t !== "object" || t === null) continue;
    const rec = t as Record<string, unknown>;
    const role = rec.role === "assistant" ? "assistant" : rec.role === "user" ? "user" : null;
    if (!role || typeof rec.content !== "string") continue;
    turns.push({ role, content: rec.content });
  }
  return aiChat(db, env, accountId, turns);
}

