import type { Discipline, Id, Player, SplitResult, TeamSlot } from "../domain/types";
import { gapKind } from "../session/gapProvenance";
import { strengthOf, teamName } from "../session/flow";

export interface ShareTextInput {
  communityName: string;
  disciplineName: string;
  discipline: Discipline;
  result: SplitResult;
  roster: Player[];
}

/**
 * Strongest first; a player with no capability in this discipline sorts last.
 *
 * Exported because the poster is this split drawn a different way, and the two
 * must not be free to order a team's players differently: `share-image.ts`
 * takes the same list and prints one line per entry.
 */
export function orderedSlots(slots: TeamSlot[], roster: Player[], discipline: Discipline) {
  return slots
    .map((slot, position) => ({ slot, position, player: roster.find((p) => p.id === slot.playerId) }))
    .filter((x): x is typeof x & { player: Player } => x.player !== undefined)
    .sort((a, b) => {
      const sa = strengthOf(a.player, discipline);
      const sb = strengthOf(b.player, discipline);
      if (sa === null && sb === null) return a.position - b.position;
      if (sa === null) return 1;
      if (sb === null) return -1;
      return sb - sa || a.position - b.position;
    });
}

/**
 * The verdict, stated in both cases. A chat message has no surrounding sentence to
 * carry it, so this branches on `gapKind`, never on `gapQualifier() !== null`: the
 * qualifier is append-only and returns null when the gap is proven.
 *
 * `gapKind` is the whole contract. `result.solver.optimal` is not read here, and
 * neither is `nodesExplored`: a hand-edited arrangement carries
 * `optimal: false, nodesExplored: 0` (`src/session/edit.ts:72`) because no search
 * ran, and this is the one surface where a wrong answer leaves the app entirely —
 * in the group chat, quoting the app. Re-deriving provenance would put a second,
 * divergent rule next to the one the split screen obeys.
 *
 * The best-found sentence describes the *result*, never the search that produced
 * it. "The smallest gap found. The search ended before proving it minimal." was
 * true of a budget-exhausted `fairSplit` and false of a hand swap, where nothing
 * was found and no search ended. "The smallest gap known for this pool. A
 * smaller one may exist." is true of all three, so this branch needs no third
 * provenance state and no new field. Do not restore the mechanism wording.
 *
 * Exported for the same reason the poster takes the sentence rather than a
 * number: a poster's text is pixels, so a claim painted into it cannot be
 * corrected afterwards, only re-sent. One function means the image and the chat
 * message cannot disagree about how good the split is.
 */
export function closingLine(result: SplitResult): string {
  const gap = result.gap.toFixed(1);
  return gapKind(result) === "proven"
    ? `Gap ${gap}. The proven minimum for this pool.`
    : `Gap ${gap}. The smallest gap known for this pool. A smaller one may exist.`;
}

export function teamsAsText(input: ShareTextInput): string {
  const { communityName, disciplineName, discipline, result, roster } = input;
  const nameOf = (id: Id): string => roster.find((p) => p.id === id)?.name ?? "?";

  const blocks = result.teams.map((team) => {
    const lines = orderedSlots(team.slots, roster, discipline).map(({ player }) => {
      const strength = strengthOf(player, discipline);
      return strength === null ? `• ${player.name}` : `• ${player.name} (${strength.toFixed(1)})`;
    });
    return [`${teamName(team.index)} · avg ${team.avgStrength.toFixed(1)}`, ...lines].join("\n");
  });

  const parts = [
    `${disciplineName} · ${communityName}, ${result.teams.length} teams`,
    ...blocks,
    closingLine(result),
  ];
  if (result.unassigned.length > 0) {
    parts.push(`Not playing: ${result.unassigned.map(nameOf).join(", ")}`);
  }
  return parts.join("\n\n");
}
