/**
 * Reassemble: rows become a v5 backup document. The exact inverse of
 * `decompose.ts`, and the round-trip law — `reassemble(decompose(b)) === b` —
 * is the test that pins both modules together.
 *
 * Ordering comes from the `position` columns the decomposer wrote; JSON
 * object key order is preserved by construction, because every JSON column
 * was stringified from the original object and is parsed back verbatim.
 */
import type { Database } from "../db";
import type { BackupData } from "../../src/data/transfer";
import type {
  Attribute,
  Capability,
  Community,
  Discipline,
  GameResult,
  Player,
  Role,
  SavedSquad,
  Session,
  SplitResult,
  SessionSettings,
  Tournament,
  TournamentMatch,
  TournamentTeam,
} from "../../src/domain/types";

/**
 * The community's whole state as a document.
 *
 * Fields the document shape requires but the community may legitimately not
 * have (a capability with no ratings yet) serialize as the empty structures
 * `serializeBackup` would have produced for the same state, so the law holds
 * for sparse data as well as dense.
 */
export async function reassemble(
  db: Database,
  accountId: string,
  communityId: string,
): Promise<BackupData | null> {
  const communityRow = await db
    .prepare("SELECT id, name, created_at, exported_at FROM communities WHERE account_id = ? AND id = ?")
    .bind(accountId, communityId)
    .first<{ id: string; name: string; created_at: number; exported_at: string }>();
  if (!communityRow) return null;

  const community: Community = { id: communityRow.id, name: communityRow.name, createdAt: communityRow.created_at };

  const disciplineRows = await db
    .prepare("SELECT id, name, short_name, strength_model, team, built_in FROM disciplines WHERE account_id = ? ORDER BY rowid")
    .bind(accountId)
    .all<{ id: string; name: string; short_name: string; strength_model: string; team: string; built_in: number }>();
  const disciplines: Discipline[] = [];
  for (const d of disciplineRows) {
    const roles = await db
      .prepare("SELECT id, name FROM discipline_roles WHERE account_id = ? AND discipline_id = ? ORDER BY position")
      .bind(accountId, d.id)
      .all<{ id: string; name: string }>();
    const attributeRows = await db
      .prepare("SELECT id, name, min_def, max_def FROM discipline_attributes WHERE account_id = ? AND discipline_id = ? ORDER BY position")
      .bind(accountId, d.id)
      .all<{ id: string; name: string; min_def: number | null; max_def: number | null }>();
    const attributes: Attribute[] = attributeRows.map((a) => ({
      id: a.id,
      name: a.name,
      ...(a.min_def !== null ? { min: a.min_def } : {}),
      ...(a.max_def !== null ? { max: a.max_def } : {}),
    }));
    disciplines.push({
      id: d.id,
      name: d.name,
      shortName: d.short_name,
      roles: roles as Role[],
      attributes,
      strengthModel: JSON.parse(d.strength_model),
      team: JSON.parse(d.team),
      ...(d.built_in ? { builtIn: true } : {}),
    });
  }

  const playerRows = await db
    .prepare("SELECT id, community_id, name, notes, created_at FROM players WHERE account_id = ? AND community_id = ? ORDER BY rowid")
    .bind(accountId, communityId)
    .all<{ id: string; community_id: string; name: string; notes: string | null; created_at: number }>();
  const players: Player[] = [];
  for (const p of playerRows) {
    const capabilities = await capabilitiesFor(db, accountId, p.id);
    players.push({
      id: p.id,
      communityId: p.community_id,
      name: p.name,
      ...(p.notes !== null ? { notes: p.notes } : {}),
      capabilities,
      createdAt: p.created_at,
    });
  }

  const sessions: Session[] = (
    await db
      .prepare(
        "SELECT id, community_id, discipline_id, created_at, pool_player_ids, settings, result FROM split_sessions WHERE account_id = ? AND community_id = ? ORDER BY rowid",
      )
      .bind(accountId, communityId)
      .all<{ id: string; community_id: string; discipline_id: string; created_at: number; pool_player_ids: string; settings: string; result: string }>()
  ).map((s) => ({
    id: s.id,
    communityId: s.community_id,
    disciplineId: s.discipline_id,
    createdAt: s.created_at,
    poolPlayerIds: JSON.parse(s.pool_player_ids) as string[],
    settings: JSON.parse(s.settings) as SessionSettings,
    result: JSON.parse(s.result) as SplitResult,
  }));

  const squads: SavedSquad[] = (
    await db
      .prepare(
        "SELECT id, community_id, name, discipline_id, created_at, pool_player_ids, settings, result FROM saved_squads WHERE account_id = ? AND community_id = ? ORDER BY rowid",
      )
      .bind(accountId, communityId)
      .all<{ id: string; community_id: string; name: string; discipline_id: string; created_at: number; pool_player_ids: string; settings: string; result: string }>()
  ).map((s) => ({
    id: s.id,
    communityId: s.community_id,
    name: s.name,
    disciplineId: s.discipline_id,
    createdAt: s.created_at,
    poolPlayerIds: JSON.parse(s.pool_player_ids) as string[],
    settings: JSON.parse(s.settings) as SessionSettings,
    result: JSON.parse(s.result) as SplitResult,
  }));

  const tournaments: Tournament[] = [];
  const tournamentRows = await db
    .prepare("SELECT id, community_id, discipline_id, name, format, series_length, team_count, third_place, status, created_at FROM tournaments WHERE account_id = ? AND community_id = ? ORDER BY rowid")
    .bind(accountId, communityId)
    .all<{ id: string; community_id: string; discipline_id: string; name: string; format: Tournament["format"]; series_length: number; team_count: number; third_place: number; status: Tournament["status"]; created_at: number }>();
  for (const t of tournamentRows) {
    const teamRows = await db
      .prepare("SELECT id, bib_index, name, strength, player_ids FROM tournament_teams WHERE account_id = ? AND tournament_id = ? ORDER BY position")
      .bind(accountId, t.id)
      .all<{ id: string; bib_index: number; name: string; strength: number; player_ids: string }>();
    const teams: TournamentTeam[] = teamRows.map((team) => ({
      id: team.id,
      bibIndex: team.bib_index,
      name: team.name,
      strength: team.strength,
      players: JSON.parse(team.player_ids) as string[],
    }));
    const matches: TournamentMatch[] = [];
    const matchRows = await db
      .prepare(
        "SELECT id, round, position, team_a_id, team_b_id, winner_team_id, winner_next, loser_next, is_third_place FROM tournament_matches WHERE account_id = ? AND tournament_id = ? ORDER BY position",
      )
      .bind(accountId, t.id)
      .all<{ id: string; round: number; position: number; team_a_id: string | null; team_b_id: string | null; winner_team_id: string | null; winner_next: string | null; loser_next: string | null; is_third_place: number }>();
    for (const m of matchRows) {
      const gameRows = await db
        .prepare("SELECT idx, winner_team_id, score_a, score_b FROM match_games WHERE account_id = ? AND tournament_id = ? AND match_id = ? ORDER BY idx")
        .bind(accountId, t.id, m.id)
        .all<{ idx: number; winner_team_id: string; score_a: number | null; score_b: number | null }>();
      const games: GameResult[] = gameRows.map((g) => ({
        winnerTeamId: g.winner_team_id,
        ...(g.score_a !== null ? { scoreA: g.score_a } : {}),
        ...(g.score_b !== null ? { scoreB: g.score_b } : {}),
      }));
      matches.push({
        id: m.id,
        round: m.round,
        position: m.position,
        teamAId: m.team_a_id,
        teamBId: m.team_b_id,
        games,
        winnerTeamId: m.winner_team_id,
        winnerNext: m.winner_next ? JSON.parse(m.winner_next) : null,
        loserNext: m.loser_next ? JSON.parse(m.loser_next) : null,
        ...(m.is_third_place ? { isThirdPlace: true } : {}),
      });
    }
    tournaments.push({
      id: t.id,
      communityId: t.community_id,
      disciplineId: t.discipline_id,
      name: t.name,
      format: t.format,
      seriesLength: t.series_length as Tournament["seriesLength"],
      teamCount: t.team_count,
      thirdPlace: t.third_place === 1,
      createdAt: t.created_at,
      status: t.status,
      teams,
      matches,
    });
  }

  return {
    version: 5,
    exportedAt: communityRow.exported_at,
    communities: [community],
    players,
    sessions,
    tournaments,
    savedSquads: squads,
    disciplines,
  };
}

async function capabilitiesFor(db: Database, accountId: string, playerId: string): Promise<Capability[]> {
  const capRows = await db
    .prepare("SELECT discipline_id, preferred_role FROM player_capabilities WHERE account_id = ? AND player_id = ? ORDER BY rowid")
    .bind(accountId, playerId)
    .all<{ discipline_id: string; preferred_role: string | null }>();
  const capabilities: Capability[] = [];
  for (const c of capRows) {
    const ratingRows = await db
      .prepare("SELECT attribute_id, rating FROM capability_ratings WHERE account_id = ? AND player_id = ? AND discipline_id = ? ORDER BY rowid")
      .bind(accountId, playerId, c.discipline_id)
      .all<{ attribute_id: string; rating: number }>();
    const roleRows = await db
      .prepare("SELECT role_id FROM capability_roles WHERE account_id = ? AND player_id = ? AND discipline_id = ? ORDER BY position")
      .bind(accountId, playerId, c.discipline_id)
      .all<{ role_id: string }>();
    capabilities.push({
      disciplineId: c.discipline_id,
      attributeRatings: Object.fromEntries(ratingRows.map((r) => [r.attribute_id, r.rating])),
      eligibleRoles: roleRows.map((r) => r.role_id),
      preferredRole: c.preferred_role,
    });
  }
  return capabilities;
}

