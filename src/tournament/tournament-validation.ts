import type { Discipline, TournamentFormat, SeriesLength } from "../domain/types";

export interface TournamentValidationIssue {
  path: string;
  message: string;
}

/** Validates tournament specification against format constraints. Used before creation to catch incompatibilities early. */
export function validateTournamentSpec(
  spec: {
    name: string;
    disciplineId: string;
    format: TournamentFormat;
    seriesLength: SeriesLength;
    teamCount: number;
  },
  discipline: Discipline
): TournamentValidationIssue[] {
  const issues: TournamentValidationIssue[] = [];

  // 1. Team count must be valid for the format
  if (!isValidTeamCountForFormat(spec.format, spec.teamCount)) {
    const validCounts = getValidTeamCounts(spec.format);
    issues.push({
      path: "teamCount",
      message: `${spec.format} format only supports: ${validCounts.join(", ")} teams.`,
    });
  }

  // 2. Series length is only valid for series format
  if (spec.format !== "series" && spec.seriesLength !== 3) {
    issues.push({
      path: "seriesLength",
      message: `Series length only applies to "series" format.`,
    });
  }

  // 3. Discipline must exist
  if (!discipline) {
    issues.push({
      path: "disciplineId",
      message: `Discipline not found.`,
    });
  }

  // 4. Name is required
  if (!spec.name || !spec.name.trim()) {
    issues.push({
      path: "name",
      message: `Tournament needs a name.`,
    });
  }

  return issues;
}

/** Get valid team counts for a tournament format. */
function getValidTeamCounts(format: TournamentFormat): number[] {
  return format === "series" ? [2]
       : format === "single-elim" ? [2, 4, 8]
       : format === "swiss" ? [4, 6, 8]
       : [];
}

/** Check if team count is valid for the tournament format. */
function isValidTeamCountForFormat(format: TournamentFormat, teamCount: number): boolean {
  return getValidTeamCounts(format).includes(teamCount);
}
