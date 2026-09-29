import type { Discipline, Player, SplitResult, TeamAssignment, TeamSlot } from "../domain/types";
import { strengthOf, teamName } from "../session/flow";

export interface FairnessInput {
  result: SplitResult;
  discipline: Discipline;
  roster: Player[];
}

/** The lowest- and highest-averaging teams; ties break by index so the output is stable. */
function extremes(teams: TeamAssignment[]): { low: TeamAssignment; high: TeamAssignment } | null {
  if (teams.length < 2) return null;
  const byAverage = [...teams].sort((a, b) => a.avgStrength - b.avgStrength || a.index - b.index);
  return { low: byAverage[0], high: byAverage[byAverage.length - 1] };
}

/** Each rated player on a team, in slot order, with their Strength. */
function rated(team: TeamAssignment, roster: Player[], discipline: Discipline) {
  return team.slots
    .map((slot: TeamSlot, position: number) => ({ position, player: roster.find((p) => p.id === slot.playerId) }))
    .filter((x): x is typeof x & { player: Player } => x.player !== undefined)
    .map((x) => ({ ...x, strength: strengthOf(x.player, discipline) }))
    .filter((x): x is typeof x & { strength: number } => x.strength !== null);
}

/**
 * Why the teams come out even, in the terms a player would use: the band every
 * team's average falls inside, who is not on a team at all, and the strongest
 * player on the higher-averaging side set against the weakest on the lower.
 *
 * The last sentence is conditional on there being a higher side. When every team
 * sits on the same number there is nobody who gave something up, and the band
 * sentence already says so in one number, so `trade` is empty. An empty string
 * is how this module says nothing: the three returns below all mean "there is
 * no sentence here", the same shape `share-image.ts` gives a footer line it has
 * nothing to print, and a consumer renders the sentence only when it is there.
 *
 * It deliberately imports no verdict. `result.solver` is not read, and every
 * record the app can attach to the same teams produces byte-identical output,
 * so these sentences cannot restate or contradict a claim about how good the
 * gap is. That claim belongs to `src/session/gapProvenance.ts` and to
 * the share text's own closing line; a third copy here would be a second
 * answer free to drift. For the same reason `result.flags` is not read either:
 * those are the referee's warnings and `describeFlags` owns them, and a
 * measurement has no standing to agree or disagree with one.
 */
export function explainFairness(input: FairnessInput): { averages: string; trade: string } {
  const { result, discipline, roster } = input;
  const span = extremes(result.teams);
  if (!span) return { averages: "", trade: "" };

  const low = span.low.avgStrength.toFixed(1);
  const high = span.high.avgStrength.toFixed(1);
  const band = low === high ? `Every team averages ${low}.` : `Every team averages ${low} to ${high}.`;

  // The pool the band was measured over. A band printed on its own reads as a
  // claim about everyone in the room, so the people the split dropped are named
  // here. It is lifted whole from `teamsAsText` and the poster, right down to
  // the "?" an id no roster holds becomes, which is why nothing is appended
  // after the list: a full stop there would print "?.", and a second wording
  // here is two answers to one fact. It belongs in `averages` and not in
  // `trade` because this is the one field every reader is shown.
  const sittingOut = result.unassigned.length > 0
    ? ` Not playing: ${result.unassigned.map((id) => roster.find((p) => p.id === id)?.name ?? "?").join(", ")}`
    : "";
  const averages = `${band}${sittingOut}`;

  if (low === high) return { averages, trade: "" };

  // Ties break by slot order, so the same input always names the same two players.
  const best = rated(span.high, roster, discipline).sort((a, b) => b.strength - a.strength || a.position - b.position)[0];
  const weakest = rated(span.low, roster, discipline).sort((a, b) => a.strength - b.strength || a.position - b.position)[0];
  if (!best || !weakest) return { averages, trade: "" };

  const trade =
    `${best.player.name} (${best.strength.toFixed(1)}) is ${teamName(span.high.index)}'s best; ` +
    `${weakest.player.name} (${weakest.strength.toFixed(1)}) is ${teamName(span.low.index)}'s weakest.`;
  return { averages, trade };
}
