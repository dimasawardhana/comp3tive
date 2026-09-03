/** Deep module: Split — fair split computation.
 *  Small interface (deep): compute(pool, discipline, teamCount) → SplitResult.
 *  Internal seams (not exposed): swapPlayers, recomputeResult, freshSplit, varietySplit.
 *  Adapters (separate seams at screen level): SessionAdapter, TournamentAdapter.
 */
import type { Discipline, Id, Player, SplitResult } from "../domain/types";
import {
  buildSettings,
  fairSplit,
  poolFromPlayers,
  suggestTeamCount,
} from "../solver/solver";
import { freshSplit, swapPlayers, recomputeResult } from "./edit";

export interface SplitComputeOptions {
  teamCount: number;
  variety?: number;
}

/** Deep interface: compute split. One method, much hidden behaviour. */
export function compute(
  players: Player[],
  discipline: Discipline,
  options: SplitComputeOptions,
): SplitResult {
  const poolIds = players.map((p) => p.id);
  return freshSplit(poolIds, players, discipline, { teamCount: options.teamCount }, options.variety !== undefined ? { variety: options.variety } : undefined);
}
export function swap(
  result: SplitResult,
  roster: Player[],
  discipline: Discipline,
  aTeamIndex: number,
  aPlayerId: Id,
  bTeamIndex: number,
  bPlayerId: Id,
): SplitResult {
  return swapPlayers(result, roster, discipline, { teamIndex: aTeamIndex, playerId: aPlayerId }, { teamIndex: bTeamIndex, playerId: bPlayerId });
}

/** Internal seam: recompute gap/flags after edit. */
export function recompute(
  result: SplitResult,
  roster: Player[],
  discipline: Discipline,
): SplitResult {
  return recomputeResult(result.teams, discipline, result.unassigned, roster);
}
