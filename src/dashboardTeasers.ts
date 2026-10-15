import type { Player, Tournament } from "./domain/types";

/**
 * Dashboard teaser helpers (CONTEXT.md: Recent Player / Active Tournament).
 * Pure selection over already community-scoped lists; the Dashboard renders
 * their output.
 *
 * **"Recently added" ranks by `Player.createdAt`, not by the roster's order.**
 * It used to be `players.slice(-3)`, which was only ever correct because
 * `list()` is a bare `getAll()` and the seeded ids happened to sort the same
 * way as their insertion order. That is an order inherited from a storage
 * engine: insertion-ordered within a session, id-ascending after a reload, and
 * whatever a server feels like once one exists. The meaning is written down
 * here instead. A Tournament carries no last-played timestamp, so "most recent
 * active" still ranks by creation time.
 */

const TEASER_COUNT = 3;

/**
 * The three most recently added players, newest first (fewer if the roster is
 * smaller). Equal `createdAt` ties break by id ascending, so the result does
 * not depend on the order the caller passed in - the same tie-break
 * `recentActiveTournaments` uses below.
 */
export function recentPlayers(players: Player[]): Player[] {
  return [...players]
    .sort((a, b) => b.createdAt - a.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .slice(0, TEASER_COUNT);
}

/**
 * The three most recently created active tournaments (status `active`),
 * ranked by createdAt descending; drafts and complete tournaments are
 * excluded. Equal-createdAt ties break by id ascending so the result is
 * deterministic regardless of input order.
 */
export function recentActiveTournaments(tournaments: Tournament[]): Tournament[] {
  return tournaments
    .filter((t) => t.status === "active")
    .sort((a, b) => b.createdAt - a.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .slice(0, TEASER_COUNT);
}
