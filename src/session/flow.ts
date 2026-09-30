import type { Capability, Discipline, Id, Player, SplitResult } from "../domain/types";
import { computeStrength } from "../domain/strength";

/** A player's capability for a discipline, if they have one. */
export function capabilityFor(player: Player, discipline: Discipline): Capability | undefined {
  return player.capabilities.find((c) => c.disciplineId === discipline.id);
}

/** The player's Strength in a discipline, or null when they have no capability. */
export function strengthOf(player: Player, discipline: Discipline): number | null {
  const cap = capabilityFor(player, discipline);
  return cap ? computeStrength(discipline, cap) : null;
}

/** Team label: 0 -> "Team A", 1 -> "Team B", ... */
export function teamName(index: number): string {
  return `Team ${String.fromCharCode(65 + index)}`;
}

/**
 * The name a roster prints for an id, or `?` when it holds nobody under it.
 *
 * The `?` is a **ghost**: a name-shaped hole standing in for a person the
 * roster no longer holds, which is what a saved squad reopened after they
 * left produces. It sits where a name goes, so it is a placeholder and not
 * punctuation, and that is why a sentence mark after one prints `?.` and
 * reads as a typo. `fairness.ts` closes its sit-out list with a semicolon for
 * exactly that reason, and a surface that ends its sentence on a name must
 * not add a mark.
 *
 * Nine places under `src/` wrote this lookup out, three of them as a local
 * `nameOf` closure, and all nine were free to drift apart. The phase's
 * standing rule is already written down on the one definition it made about
 * (`contracts.md:410-413`, four duplicate `BIB` arrays removed and a fifth
 * refused), so this is that rule applied to a lookup rather than an array.
 *
 * It lives here rather than in a share module because all three surfaces
 * already import `strengthOf` and `teamName` from here, and because this
 * module already held a private copy of it: promoting one is a smaller change
 * than adding an edge. A measurement importing a name resolver out of the
 * chat text's module would invert the direction `fairness.ts` is built on,
 * which is that a measurement shares no verdict with a surface.
 */
export function nameOf(roster: Player[], id: Id): string {
  return roster.find((p) => p.id === id)?.name ?? "?";
}

/**
 * The same names in one line, in the order the ids come, and `""` for no ids.
 *
 * The list is the shape three surfaces share: the chat text, the poster
 * footer, and the fairness band. Only the *names* are shared. Each surface
 * keeps its own label and its own terminator, because the fairness copy is one
 * clause inside a longer sentence while the other two are whole lines, and
 * because only the fairness copy ends on a mark.
 */
export function namesOf(roster: Player[], ids: readonly Id[]): string {
  return ids.map((id) => nameOf(roster, id)).join(", ");
}

/**
 * Render the solver's flags as referee-voice copy (design: "No keeper on pink.
 * Fitri is covering."). Best-fit covering is derived in the view layer.
 */
export function describeFlags(result: SplitResult, discipline: Discipline, roster: Player[]): string[] {
  const teamMembers = (index: number) =>
    result.teams.find((t) => t.index === index)?.slots.map((s) => s.playerId) ?? [];

  const strongestOnTeam = (playerIds: string[], eligibleRoleId?: string): string | undefined => {
    const players = playerIds
      .map((id) => roster.find((p) => p.id === id))
      .filter((p): p is Player => p !== undefined)
      .filter((p) => !eligibleRoleId || capabilityFor(p, discipline)?.eligibleRoles.includes(eligibleRoleId));
    players.sort((a, b) => (strengthOf(b, discipline) ?? 0) - (strengthOf(a, discipline) ?? 0));
    return players[0]?.name;
  };

  const out: string[] = [];
  for (const flag of result.flags) {
    switch (flag.kind) {
      case "role-uncovered": {
        const role = discipline.roles.find((r) => r.id === flag.roleId);
        const roleName = role ? role.name.toLowerCase() : "role";
        const covering =
          strongestOnTeam(teamMembers(flag.teamIndex), flag.roleId) ??
          strongestOnTeam(teamMembers(flag.teamIndex));
        out.push(
          `No ${roleName} on ${teamName(flag.teamIndex)}. ${covering ? `${covering} is covering.` : "Best fit is covering."}`,
        );
        break;
      }
      case "leftover":
        out.push(`${nameOf(roster, flag.playerId)} sits out tonight.`);
        break;
      case "team-below-min":
        out.push(`${teamName(flag.teamIndex)} is short. Needs ${flag.minTeamSize} to play.`);
        break;
    }
  }
  return out;
}
