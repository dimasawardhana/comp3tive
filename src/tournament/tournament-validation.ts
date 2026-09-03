import type { Discipline, TournamentFormat, SeriesLength } from "../domain/types";

export interface TournamentValidationIssue {
  path: string;
  message: string;
}

/** Validates tournament specification against discipline constraints. Used before creation to catch incompatibilities early. */
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
  
  // 1. Validate team size meets discipline requirements (e.g., MLBB needs exactly 5, futsal needs at least 5)
  if (!isTeamSizeValid(spec.teamCount, discipline)) {
    issues.push({
      path: "teamCount",
      message: `Discipline "${discipline.name}" requires ${discipline.team.minTeamSize}-${discipline.team.maxTeamSize || "exact"} players per team.`
    });
  }
  
  // 2. Validate format-team count mapping (e.g., series only supports 2 teams)
  if (!isValidTeamCountForFormat(spec.format, spec.teamCount)) {
    const validCounts = getValidTeamCounts(spec.format);
    issues.push({
      path: "teamCount",
      message: `${spec.format} format only supports: ${validCounts.join(", ")} teams.`
    });
  }
  
  // 3. Validate format-discipline compatibility (e.g., MLBB requires hard role coverage)
  if (!isFormatCompatible(spec.format, spec.teamCount, discipline)) {
    issues.push({
      path: "format",
      message: `Discipline "${discipline.name}" doesn't support ${spec.format} format with ${spec.teamCount} teams.`
    });
  }
  
  // 4. Validate series length restrictions
  if (!isSeriesLengthValid(spec.format, spec.seriesLength)) {
    issues.push({
      path: "seriesLength",
      message: `Series length must be 1, 3, or 5 for ${spec.format} format.`
    });
  }
  
  return issues;
}

/** Helper: Check if team count matches discipline's team size constraints (e.g., MLBB needs exactly 5, futsal needs min 5). */
function isTeamSizeValid(teamCount: number, discipline: Discipline): boolean {
  if (discipline.team.maxTeamSize === null) {
    return teamCount >= discipline.team.minTeamSize;
  }
  return teamCount === discipline.team.minTeamSize;
}

/** Helper: Get valid team counts for a tournament format (series=2, single-elim=[4,2,8], swiss=[4,6,8]). */
function getValidTeamCounts(format: TournamentFormat): number[] {
  return format === "series" ? [2]
       : format === "single-elim" ? [4, 2, 8]
       : format === "swiss" ? [4, 6, 8]
       : [];
}

/** Helper: Check if team count is valid for the tournament format (e.g., Swiss format doesn't support 3 teams). */
function isValidTeamCountForFormat(format: TournamentFormat, teamCount: number): boolean {
  return getValidTeamCounts(format).includes(teamCount);
}

/** Helper: Validate format-discipline compatibility based on discipline requirements (e.g., MLBB needs role coverage). */
function isFormatCompatible(_format: TournamentFormat, teamCount: number, discipline: Discipline): boolean {
  // MLBB requires exactly 5 teams with hard role coverage
  if (discipline.id === "mlbb") {
    return teamCount === 5 && discipline.team.rolesRequired;
  }
  
  // Futsal requires at least 5 players per team
  if (discipline.id === "futsal") {
    return teamCount >= 5;
  }
  
  // Other disciplines (e.g., badminton) will have their own compatibility rules
  return true;
}

/** Helper: Validate series length is only supported for series format. */
function isSeriesLengthValid(format: TournamentFormat, seriesLength: SeriesLength): boolean {
  return format === "series" && [1, 3, 5].includes(seriesLength);
}