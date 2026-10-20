/**
 * The query capability the relational backend was built for (RB-5, the plan's
 * Task 5): leaderboards, cross-community player search, per-discipline session
 * history. Before the cutover these were impossible — the data lived in one
 * JSON blob per (account, community) — and now they are joins.
 *
 * The load-bearing rule, same as every table in schema-v2: `account_id` is
 * part of the tenant key, D1 has no row-level security, and the id comes from
 * the session token at the route — never from the request's payload or query
 * string. Every statement below carries it in its WHERE; the grep gate in
 * `server/queries.test.ts` pins that by construction, and the scoping tests
 * pin it by behavior (a second account's rows are invisible).
 *
 * These are reads: no statement here writes, and none is allowed to.
 */
import type { Database } from "../db";
import type { Id } from "../../src/domain/types";

/** One leaderboard row: the rating plus enough to display it. */
export interface LeaderboardRow {
  playerId: Id;
  playerName: string;
  communityId: Id;
  communityName: string;
  rating: number;
}

/**
 * The leaderboard for one discipline's one attribute, across every community
 * the Account has: the plan's payoff query. Ties keep a deterministic order
 * (player id), so a re-run of the same data answers the same array.
 */
export async function leaderboard(
  db: Database,
  accountId: Id,
  disciplineId: Id,
  attributeId: Id,
): Promise<LeaderboardRow[]> {
  const rows = await db
    .prepare(
      `SELECT r.player_id, p.name AS player_name, p.community_id, c.name AS community_name, r.rating
       FROM capability_ratings r
       JOIN players p ON p.account_id = r.account_id AND p.id = r.player_id
       JOIN communities c ON c.account_id = p.account_id AND c.id = p.community_id
       WHERE r.account_id = ? AND r.discipline_id = ? AND r.attribute_id = ?
       ORDER BY r.rating DESC, r.player_id`,
    )
    .bind(accountId, disciplineId, attributeId)
    .all<{
      player_id: string;
      player_name: string;
      community_id: string;
      community_name: string;
      rating: number;
    }>();
  return rows.map((r) => ({
    playerId: r.player_id,
    playerName: r.player_name,
    communityId: r.community_id,
    communityName: r.community_name,
    rating: r.rating,
  }));
}

/** One search hit: a player plus the community they belong to. */
export interface PlayerHit {
  playerId: Id;
  name: string;
  communityId: Id;
  communityName: string;
  notes: string | null;
}

/**
 * Players by name across every community of the Account — a roster question
 * the blob store could not answer ("is Kim in any league of mine?").
 *
 * The needle is matched case-insensitively as a substring, from a query
 * string the route validates; it is data, never SQL.
 */
export async function searchPlayers(db: Database, accountId: Id, q: string): Promise<PlayerHit[]> {
  // The needle's own LIKE wildcards are stripped, so it can never widen the
  // match beyond a literal substring — and no ESCAPE clause is needed.
  const needle = `%${q.replace(/[%_\\]/g, "")}%`;
  const rows = await db
    .prepare(
      `SELECT p.id AS player_id, p.name, p.community_id, c.name AS community_name, p.notes
       FROM players p
       JOIN communities c ON c.account_id = p.account_id AND c.id = p.community_id
       WHERE p.account_id = ? AND p.name LIKE ?
       ORDER BY p.name, p.community_id`,
    )
    .bind(accountId, needle)
    .all<{ player_id: string; name: string; community_id: string; community_name: string; notes: string | null }>();
  return rows.map((r) => ({
    playerId: r.player_id,
    name: r.name,
    communityId: r.community_id,
    communityName: r.community_name,
    notes: r.notes,
  }));
}

/** One session-history entry: the header, without the result blob. */
export interface SessionHistoryRow {
  sessionId: Id;
  communityId: Id;
  communityName: string;
  createdAt: number;
}

/**
 * Split-session history for one discipline, across every community, newest
 * first. Headers only: the result stays a blob by design (schema-v2's
 * decision table), and a history list has no use for it — the client that
 * wants a result re-reads it through the document pull it already has.
 */
export async function sessionHistory(
  db: Database,
  accountId: Id,
  disciplineId: Id,
): Promise<SessionHistoryRow[]> {
  const rows = await db
    .prepare(
      `SELECT s.id AS session_id, s.community_id, c.name AS community_name, s.created_at
       FROM split_sessions s
       JOIN communities c ON c.account_id = s.account_id AND c.id = s.community_id
       WHERE s.account_id = ? AND s.discipline_id = ?
       ORDER BY s.created_at DESC, s.id`,
    )
    .bind(accountId, disciplineId)
    .all<{ session_id: string; community_id: string; community_name: string; created_at: number }>();
  return rows.map((r) => ({
    sessionId: r.session_id,
    communityId: r.community_id,
    communityName: r.community_name,
    createdAt: r.created_at,
  }));
}
