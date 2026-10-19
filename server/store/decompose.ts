/**
 * Decompose: a v5 backup document becomes rows.
 *
 * ADR-0007 (as amended 2026-10-15): the wire format is the backup format, the
 * storage is normalized. This module is the one place that turns a document
 * into rows; `reassemble.ts` is its exact inverse, and the round-trip law —
 * `reassemble(decompose(b)) === b` for any valid document — is the test that
 * pins both.
 *
 * Every write names the account from the session, never from the payload
 * (ADR-0008): the caller passes `accountId` and this module stamps it onto
 * every row. A document that names a community the account does not have a
 * revision row for is a caller bug (the handlers always create it first) and
 * the foreign keys here make it fail loudly rather than store an orphan.
 *
 * The guard is why the guarded variant exists. A D1 `batch` is one atomic
 * transaction, but a lost compare-and-swap is not an error — the conditional
 * UPDATE just changes zero rows, and the batch happily runs on. So every row
 * write in the guarded variant carries the gate in its own WHERE: a subquery
 * naming the revision the CAS should have produced. When the CAS loses, the
 * revision never reaches that value and every statement in the batch no-ops —
 * the loser leaves zero rows behind, not the loser's data over the winner's.
 * The unguarded path is the round-trip tests', which run without a revision
 * row at all.
 */
import type { Database, Statement } from "../db";
import type { BackupData } from "../../src/data/transfer";

/** Errors thrown by decompose/reassemble. The handlers map 400 onto it. */
export class StoreError extends Error {}

/** An INSERT template must end in this shape for the guard to be attached. */
const INSERT_SHAPE = /^(INSERT (?:OR IGNORE )?INTO [^(]+\([^)]*\)) VALUES \(((?:\?(?:, \?)*)*)\)$/;

const GUARD = " WHERE (SELECT revision FROM community_revisions WHERE account_id = ? AND community_id = ?) = ?";

/**
 * One guarded statement: the given INSERT or DELETE runs only when the
 * community's revision counter equals `revision` — the value a winning
 * compare-and-swap leaves behind. Binding order is the statement's own values
 * first, then the guard's (account, community, revision).
 */
function guarded(
  sql: string,
  accountId: string,
  communityId: string,
  revision: number,
  bind: (sql: string, ...values: unknown[]) => Statement,
): Statement {
  // The guard's three placeholders come last, so the caller appends the
  // statement's own values after the guard's binds inside `bind`.
  if (sql.startsWith("DELETE"))
    return bind(
      `${sql} AND (SELECT revision FROM community_revisions WHERE account_id = ? AND community_id = ?) = ?`,
      accountId,
      communityId,
      revision,
    );
  const match = INSERT_SHAPE.exec(sql);
  if (!match) throw new StoreError(`decompose template is not guardable: ${sql}`);
  const [, head, placeholders] = match;
  if (!placeholders) throw new StoreError(`decompose template has no VALUES to guard: ${sql}`);
  return bind(`${head} SELECT ${placeholders}${GUARD}`, accountId, communityId, revision);
}

type Add = (sql: string, ...values: unknown[]) => void;

/**
 * Build one document's worth of rows, replacing whatever the community had.
 * With `revision` set, every statement is no-op'd by the guard unless the
 * caller's compare-and-swap won in the same transaction (the CAS statement
 * must be first in the batch). Without it — the round-trip tests' path — the
 * statements apply unconditionally. Nothing runs here either way: statements
 * are collected for the caller's one atomic `batch`.
 */
export function collectDecompose(
  db: Database,
  accountId: string,
  communityId: string,
  doc: BackupData,
  revision?: number,
): Statement[] {
  if (doc.version !== 5) throw new StoreError(`Unsupported document version: ${String(doc.version)}.`);

  // One document is one community's slice: the payload may not carry a
  // sibling community, because there would be nowhere to round-trip it back
  // from — a pull is scoped to one community. The handlers' parseBackup
  // accepts the general shape; this is the scope rule the wire adds on top.
  if (doc.communities.some((c) => c.id !== communityId))
    throw new StoreError("A document may only contain its own community.");
  const community = doc.communities.find((c) => c.id === communityId);
  if (!community) throw new StoreError(`Document does not contain community ${communityId}.`);
  for (const p of doc.players)
    if (p.communityId !== communityId)
      throw new StoreError(`Player ${p.id} does not belong to community ${communityId}.`);
  for (const s of doc.sessions)
    if (s.communityId !== communityId)
      throw new StoreError(`Session ${s.id} does not belong to community ${communityId}.`);
  for (const sq of doc.savedSquads)
    if (sq.communityId !== communityId)
      throw new StoreError(`Saved squad ${sq.id} does not belong to community ${communityId}.`);
  for (const t of doc.tournaments)
    if (t.communityId !== communityId)
      throw new StoreError(`Tournament ${t.id} does not belong to community ${communityId}.`);

  const stmts: Statement[] = [];
  const add: Add =
    revision === undefined
      ? (sql, ...values) => stmts.push(db.prepare(sql).bind(...values))
      : (sql, ...values) =>
          stmts.push(
            guarded(sql, accountId, communityId, revision, (s, ...vals) => db.prepare(s).bind(...values, ...vals)),
          );
  buildDocStatements(add, accountId, communityId, community, doc);
  return stmts;
}

function buildDocStatements(
  add: Add,
  accountId: string,
  communityId: string,
  community: BackupData["communities"][number],
  doc: BackupData,
): void {
  // Replace, not merge: the document is the community's whole state (the same
  // wholesale-replacement rule the client stores follow). Deleting by
  // community scope, not by the incoming ids, so a player removed on another
  // device disappears here too.
  stmtClearCommunity(add, accountId, communityId);

  add(
    "INSERT INTO communities (account_id, id, name, created_at, exported_at) VALUES (?, ?, ?, ?, ?)",
    accountId,
    community.id,
    community.name,
    community.createdAt,
    doc.exportedAt,
  );
  for (const d of doc.disciplines) {
    add(
      "INSERT INTO disciplines (account_id, id, name, short_name, strength_model, team, built_in) VALUES (?, ?, ?, ?, ?, ?, ?)",
      accountId,
      d.id,
      d.name,
      d.shortName,
      JSON.stringify(d.strengthModel),
      JSON.stringify(d.team),
      d.builtIn ? 1 : 0,
    );
    for (const [i, role] of d.roles.entries()) {
      add(
        "INSERT INTO discipline_roles (account_id, discipline_id, id, name, position) VALUES (?, ?, ?, ?, ?)",
        accountId,
        d.id,
        role.id,
        role.name,
        i,
      );
    }
    for (const [i, attr] of d.attributes.entries()) {
      add(
        "INSERT INTO discipline_attributes (account_id, discipline_id, id, name, min_def, max_def, position) VALUES (?, ?, ?, ?, ?, ?, ?)",
        accountId,
        d.id,
        attr.id,
        attr.name,
        attr.min ?? null,
        attr.max ?? null,
        i,
      );
    }
  }

  for (const p of doc.players) {
    add(
      "INSERT INTO players (account_id, community_id, id, name, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      accountId,
      communityId,
      p.id,
      p.name,
      p.notes ?? null,
      p.createdAt,
    );
    for (const cap of p.capabilities) {
      add(
        "INSERT INTO player_capabilities (account_id, player_id, discipline_id, preferred_role) VALUES (?, ?, ?, ?)",
        accountId,
        p.id,
        cap.disciplineId,
        cap.preferredRole,
      );
      for (const [attrId, rating] of Object.entries(cap.attributeRatings)) {
        add(
          "INSERT INTO capability_ratings (account_id, player_id, discipline_id, attribute_id, rating) VALUES (?, ?, ?, ?, ?)",
          accountId,
          p.id,
          cap.disciplineId,
          attrId,
          rating,
        );
      }
      for (const [i, roleId] of cap.eligibleRoles.entries()) {
        add(
          "INSERT INTO capability_roles (account_id, player_id, discipline_id, role_id, position) VALUES (?, ?, ?, ?, ?)",
          accountId,
          p.id,
          cap.disciplineId,
          roleId,
          i,
        );
      }
    }
  }

  for (const s of doc.sessions) {
    add(
      "INSERT INTO split_sessions (account_id, community_id, id, discipline_id, created_at, pool_player_ids, settings, result) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      accountId,
      communityId,
      s.id,
      s.disciplineId,
      s.createdAt,
      JSON.stringify(s.poolPlayerIds),
      JSON.stringify(s.settings),
      JSON.stringify(s.result),
    );
  }

  for (const sq of doc.savedSquads) {
    add(
      "INSERT INTO saved_squads (account_id, community_id, id, name, discipline_id, created_at, pool_player_ids, settings, result) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      accountId,
      communityId,
      sq.id,
      sq.name,
      sq.disciplineId,
      sq.createdAt,
      JSON.stringify(sq.poolPlayerIds),
      JSON.stringify(sq.settings),
      JSON.stringify(sq.result),
    );
  }

  for (const t of doc.tournaments) {
    add(
      "INSERT INTO tournaments (account_id, community_id, id, discipline_id, name, format, series_length, team_count, third_place, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      accountId,
      communityId,
      t.id,
      t.disciplineId,
      t.name,
      t.format,
      t.seriesLength,
      t.teamCount,
      t.thirdPlace ? 1 : 0,
      t.status,
      t.createdAt,
    );
    for (const [i, team] of t.teams.entries()) {
      add(
        "INSERT INTO tournament_teams (account_id, tournament_id, id, bib_index, name, strength, player_ids, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        accountId,
        t.id,
        team.id,
        team.bibIndex,
        team.name,
        team.strength,
        JSON.stringify(team.players),
        i,
      );
    }
    for (const m of t.matches) {
      add(
        "INSERT INTO tournament_matches (account_id, tournament_id, id, round, position, team_a_id, team_b_id, winner_team_id, winner_next, loser_next, is_third_place) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        accountId,
        t.id,
        m.id,
        m.round,
        m.position,
        m.teamAId,
        m.teamBId,
        m.winnerTeamId,
        m.winnerNext ? JSON.stringify(m.winnerNext) : null,
        m.loserNext ? JSON.stringify(m.loserNext) : null,
        m.isThirdPlace ? 1 : 0,
      );
      for (const [g, game] of m.games.entries()) {
        add(
          "INSERT INTO match_games (account_id, tournament_id, match_id, idx, winner_team_id, score_a, score_b) VALUES (?, ?, ?, ?, ?, ?, ?)",
          accountId,
          t.id,
          m.id,
          g,
          game.winnerTeamId,
          game.scoreA ?? null,
          game.scoreB ?? null,
        );
      }
    }
  }
}

/**
 * Run one document's worth of rows, replacing whatever the community had.
 * One atomic `batch`, unguarded. The compare-and-swap handlers call
 * `collectDecompose` with a revision instead, so a lost CAS no-ops the batch.
 */
export async function decompose(
  db: Database,
  accountId: string,
  communityId: string,
  doc: BackupData,
): Promise<void> {
  await db.batch(collectDecompose(db, accountId, communityId, doc));
}

/**
 * Delete every row the community owns, plus its revision row — the server
 * half of a community deletion, so the document cannot resurrect at the next
 * pull. One atomic `batch`. Idempotent: deleting a community the server has
 * no rows for succeeds as a no-op, because the client's local delete already
 * ran and a retry must not be an error.
 */
export function collectDeleteCommunity(
  db: Database,
  accountId: string,
  communityId: string,
): Statement[] {
  const stmts: Statement[] = [];
  const add: Add = (sql, ...values) => stmts.push(db.prepare(sql).bind(...values));
  stmtClearCommunity(add, accountId, communityId);
  add("DELETE FROM community_revisions WHERE account_id = ? AND community_id = ?", accountId, communityId);
  add("DELETE FROM community_documents WHERE account_id = ? AND community_id = ?", accountId, communityId);
  return stmts;
}

/**
 * Delete every row the community owns. FK cascades do most of it; the
 * statement list is explicit so a new table without a cascade fails the
 * round-trip test (leftover rows leak into the next reassemble) rather than
 * being silently swept. Guarded when built through `collectDecompose` with a
 * revision, for the same compare-and-swap reason as the inserts.
 */
function stmtClearCommunity(add: Add, accountId: string, communityId: string): void {
  add("DELETE FROM players WHERE account_id = ? AND community_id = ?", accountId, communityId);
  add("DELETE FROM split_sessions WHERE account_id = ? AND community_id = ?", accountId, communityId);
  add("DELETE FROM saved_squads WHERE account_id = ? AND community_id = ?", accountId, communityId);
  add("DELETE FROM tournaments WHERE account_id = ? AND community_id = ?", accountId, communityId);
  add("DELETE FROM disciplines WHERE account_id = ?", accountId);
  add("DELETE FROM communities WHERE account_id = ? AND id = ?", accountId, communityId);
}
