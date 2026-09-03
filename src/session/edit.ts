import type { Discipline, Id, Player, SolverFlag, SplitResult, TeamAssignment, SessionSettings } from "../domain/types";
import { assignTeamRoles, buildSettings, fairSplit, poolFromPlayers, varietySplit, type FairSplitOptions } from "../solver/solver";
import { strengthOf } from "./flow";

interface TeamRef {
  teamIndex: number;
  playerId: Id;
}

function findTeam(teams: TeamAssignment[], index: number): TeamAssignment | undefined {
  return teams.find((t) => t.index === index);
}

/** Re-derive a team's roles after its membership changed (handles both modes). */
function rederiveRoles(team: TeamAssignment, roster: Player[], discipline: Discipline): void {
  const players = team.slots
    .map((s) => roster.find((p) => p.id === s.playerId))
    .filter((p): p is Player => p !== undefined);
  const pool = poolFromPlayers(players, discipline);
  const roles = assignTeamRoles(pool, discipline.roles.map((r) => r.id), discipline.team.rolesRequired);
  team.slots = team.slots.map((s, i) => ({ ...s, roleId: roles[i] ?? null }));
}

/**
 * Exchange two players between two different teams, re-derive both teams'
 * roles, and recompute strengths, gap, and flags. Returns a new SplitResult
 * (the input is not mutated).
 */
export function swapPlayers(
  result: SplitResult,
  roster: Player[],
  discipline: Discipline,
  a: TeamRef,
  b: TeamRef,
): SplitResult {
  if (a.teamIndex === b.teamIndex || a.playerId === b.playerId) return result;

  const teams: TeamAssignment[] = result.teams.map((t) => ({
    index: t.index,
    slots: t.slots.map((s) => ({ ...s })),
    totalStrength: 0,
    avgStrength: 0,
  }));
  const teamA = findTeam(teams, a.teamIndex);
  const teamB = findTeam(teams, b.teamIndex);
  const slotA = teamA?.slots.find((s) => s.playerId === a.playerId);
  const slotB = teamB?.slots.find((s) => s.playerId === b.playerId);
  if (!teamA || !teamB || !slotA || !slotB) return result;

  slotA.playerId = b.playerId;
  slotB.playerId = a.playerId;
  rederiveRoles(teamA, roster, discipline);
  rederiveRoles(teamB, roster, discipline);

  return recomputeResult(teams, discipline, result.unassigned, roster);
}

/** Recompute totals, gap, and flags for a (possibly edited) team set. */
export function recomputeResult(
  teams: TeamAssignment[],
  discipline: Discipline,
  unassigned: Id[],
  roster: Player[],
  solver: SplitResult["solver"] = { optimal: true, nodesExplored: 0, elapsedMs: 0 },
): SplitResult {
  const strengthOfId = (id: Id): number => {
    const player = roster.find((p) => p.id === id);
    return player ? strengthOf(player, discipline) ?? 0 : 0;
  };
  for (const t of teams) {
    t.totalStrength = t.slots.reduce((sum, slot) => sum + strengthOfId(slot.playerId), 0);
    t.avgStrength = t.totalStrength / Math.max(1, t.slots.length);
  }

  const flags: SolverFlag[] = [];
  for (const t of teams) {
    if (t.slots.length < discipline.team.minTeamSize) {
      flags.push({ kind: "team-below-min", teamIndex: t.index, size: t.slots.length, minTeamSize: discipline.team.minTeamSize });
    }
    if (!discipline.team.rolesRequired) {
      const covered = new Set(t.slots.map((s) => s.roleId).filter((r): r is Id => r !== null));
      for (const role of discipline.roles) {
        if (!covered.has(role.id)) {
          flags.push({ kind: "role-uncovered", teamIndex: t.index, roleId: role.id, coveringPlayerId: null });
        }
      }
    }
  }
  for (const id of unassigned) flags.push({ kind: "leftover", playerId: id });

  const gap =
    teams.length >= 2
      ? Math.max(...teams.map((t) => t.avgStrength)) - Math.min(...teams.map((t) => t.avgStrength))
      : 0;

  return { teams, gap, flags, unassigned, solver };
}

/** A fresh split from a session's own inputs (its pool and settings). */
export function freshSplit(
  poolPlayerIds: Id[],
  roster: Player[],
  discipline: Discipline,
  settings: SessionSettings,
  options?: FairSplitOptions,
): SplitResult {
  const players = poolPlayerIds
    .map((id) => roster.find((p) => p.id === id))
    .filter((p): p is Player => p !== undefined);
  const pool = poolFromPlayers(players, discipline);
  const solverSettings = buildSettings(discipline, settings.teamCount);
  if (options?.variety !== undefined) {
    // Re-roll: a different, fair split (seeded; no exhaustive search).
    return varietySplit(pool, discipline, solverSettings, options.variety);
  }
  return fairSplit(pool, discipline, solverSettings);
}
