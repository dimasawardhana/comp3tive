import type { Player, Tournament } from "./domain/types";

/**
 * Dashboard teaser helpers (CONTEXT.md: Recent Player / Active Tournament).
 * Pure selection over already community-scoped lists; the Dashboard renders
 * their output. A Player carries no creation timestamp, so "recently added"
 * means last in the roster's insertion order. A Tournament carries no
 * last-played timestamp, so "most recent active" ranks by creation time.
 */

const TEASER_COUNT = 3;

/** The last three players of a roster, in roster order (all of them if fewer). */
export function recentPlayers(players: Player[]): Player[] {
  return players.slice(-TEASER_COUNT);
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
