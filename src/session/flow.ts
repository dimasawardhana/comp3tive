import type { Capability, Discipline, Player, SplitResult } from "../domain/types";
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
 * Render the solver's flags as referee-voice copy (design: "No keeper on pink.
 * Fitri is covering."). Best-fit covering is derived in the view layer.
 */
export function describeFlags(result: SplitResult, discipline: Discipline, roster: Player[]): string[] {
  const nameOf = (id: string): string => roster.find((p) => p.id === id)?.name ?? "?";
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
        out.push(`${nameOf(flag.playerId)} sits out tonight.`);
        break;
      case "team-below-min":
        out.push(`${teamName(flag.teamIndex)} is short. Needs ${flag.minTeamSize} to play.`);
        break;
    }
  }
  return out;
}
