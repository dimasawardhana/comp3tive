"use strict";

/**
 * Domain model fixes for tournament creation and team participation.
 * 
 * This file addresses the gaps identified in the tournament creation workflow:
 * 1. Pre-creation tournament validation
 * 2. Team participation validation
 * 3. Format-discipline compatibility checking
 * 4. Team submission validation
 */

import type { Discipline, Tournament, Session, SplitResult, TeamAssignment, TeamSlot, TournamentFormat, SeriesLength, Id } from "../domain/types";

export interface TournamentValidationIssue {
  path: string;
  message: string;
}

export interface TeamParticipationValidationIssue {
  path: string;
  message: string;
}

/**
 * Validates tournament specification against discipline constraints before creation.
 * 
 * Ensures that tournament formats, team counts, and series lengths are compatible
 * with the selected discipline's requirements (e.g., MLBB needs 5 players with role coverage).
 * 
 * @param spec - Tournament specification to validate
 * @param discipline - Discipline being used for the tournament
 * @returns Array of validation issues (empty if valid)
 */
export function validateTournamentSpec(
  spec: {
    name: string;
    disciplineId: Id;
    format: TournamentFormat;
    seriesLength: SeriesLength;
    teamCount: number;
  },
  discipline: Discipline
): TournamentValidationIssue[] {
  const issues: TournamentValidationIssue[] = [];
  
  // 1. Validate team size meets discipline requirements
  if (!isTeamSizeValid(spec.teamCount, discipline)) {
    issues.push({
      path: "teamCount",
      message: `Discipline "${discipline.name}" requires ${discipline.team.minTeamSize}-${discipline.team.maxTeamSize || "exact"} players per team.`
    });
  }
  
  // 2. Validate format-team count mapping
  if (!isValidTeamCountForFormat(spec.format, spec.teamCount)) {
    const validCounts = getValidTeamCounts(spec.format);
    issues.push({
      path: "teamCount",
      message: `${spec.format} format only supports: ${validCounts.join(", ")} teams.`
    });
  }
  
  // 3. Validate format-discipline compatibility
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

/**
 * Validates that teams from a split can participate in a tournament.
 * 
 * Ensures teams meet tournament requirements, discipline constraints, and have
 * proper team structure and role coverage.
 * 
 * @param tournament - Tournament to validate against
 * @param session - Session containing the split teams
 * @param splitResult - Split result containing teams to validate
 * @param discipline - Discipline being used
 * @returns Array of validation issues (empty if valid)
 */
export function validateTeamParticipation(
  tournament: Tournament,
  session: Session,
  splitResult: SplitResult,
  discipline: Discipline
): TeamParticipationValidationIssue[] {
  const issues: TeamParticipationValidationIssue[] = [];
  
  // 1. Validate team count matches tournament requirements
  if (splitResult.teams.length !== tournament.teamCount) {
    issues.push({
      path: "teams.length",
      message: `Tournament expects ${tournament.teamCount} teams, but split produced ${splitResult.teams.length}.`
    });
  }
  
  // 2. Validate each team meets discipline constraints
  for (let i = 0; i < splitResult.teams.length; i++) {
    const team = splitResult.teams[i];
    
    // 2a. Validate team size meets discipline requirements
    if (!isTeamSizeValidForDiscipline(team, discipline)) {
      issues.push({
        path: `teams[${i}].slots.length`,
        message: `Team ${i} size (${team.slots.length}) violates discipline constraints (${discipline.team.minTeamSize}-${discipline.team.maxTeamSize || "exact"} players).`
      });
    }
    
    // 2b. Validate role coverage if discipline requires it
    if (discipline.team.rolesRequired && !hasRequiredRoles(team, discipline)) {
      issues.push({
        path: `teams[${i}].slots`,
        message: `Team ${i} doesn't cover all required roles for ${discipline.name}.`
      });
    }
    
    // 2c. Validate team strength is within acceptable range
    if (team.avgStrength < 1 || team.avgStrength > 5) {
      issues.push({
        path: `teams[${i}].avgStrength`,
        message: `Team ${i} has invalid average strength: ${team.avgStrength}. Strength should be between 1-5.`
      });
    }
  }
  
  // 3. Validate session matches tournament discipline
  if (session.disciplineId !== tournament.disciplineId) {
    issues.push({
      path: "session.disciplineId",
      message: `Session discipline (${session.disciplineId}) doesn't match tournament discipline (${tournament.disciplineId}).`
    });
  }
  
  // 4. Validate session players match split players
  const totalSplitPlayers = splitResult.unassigned.length + splitResult.teams.reduce((sum, team) => sum + team.slots.length, 0);
  if (session.poolPlayerIds.length !== totalSplitPlayers) {
    issues.push({
      path: "session.poolPlayerIds.length",
      message: `Session player pool size (${session.poolPlayerIds.length}) doesn't match split allocation (${totalSplitPlayers}).`
    });
  }
  
  return issues;
}

/** Tournament State Management */

/**
 * Determines if a tournament is ready for activation based on team submission status.
 * 
 * @param tournament - Tournament to check
 * @param sessions - All sessions in the system
 * @returns Tournament readiness status
 */
export function checkTournamentReadiness(
  tournament: Tournament,
  sessions: Session[]
): TournamentReadinessStatus {
  // Find sessions for this tournament's discipline
  const disciplineSessions = sessions.filter(s => s.disciplineId === tournament.disciplineId);
  
  if (disciplineSessions.length === 0) {
    return {
      status: "needs-teams",
      tournament,
      required: tournament.teamCount,
      current: 0
    };
  }
  
  if (disciplineSessions.length < tournament.teamCount) {
    return {
      status: "needs-teams",
      tournament,
      required: tournament.teamCount,
      current: disciplineSessions.length
    };
  }
  
  // For tournaments with teams, check if teams are valid
  return { status: "not-ready", tournament, reason: "Teams need validation" };
}

/** Tournament Readiness Status Types */
export type TournamentReadinessStatus =
  | { status: "ready"; tournament: Tournament }
  | { status: "needs-teams"; tournament: Tournament; required: number; current: number }
  | { status: "not-ready"; tournament: Tournament; reason: string };

/** Helper Functions */

function isTeamSizeValid(teamCount: number, discipline: Discipline): boolean {
  if (discipline.team.maxTeamSize === null) {
    return teamCount >= discipline.team.minTeamSize;
  }
  return teamCount === discipline.team.minTeamSize;
}

function getValidTeamCounts(format: TournamentFormat): number[] {
  return format === "series" ? [2]
       : format === "single-elim" ? [4, 2, 8]
       : format === "swiss" ? [4, 6, 8]
       : [];
}

function isValidTeamCountForFormat(format: TournamentFormat, teamCount: number): boolean {
  return getValidTeamCounts(format).includes(teamCount);
}

function isFormatCompatible(_format: TournamentFormat, teamCount: number, discipline: Discipline): boolean {
  // MLBB requires exactly 5 teams with hard role coverage
  if (discipline.id === "mlbb") {
    return teamCount === 5 && discipline.team.rolesRequired;
  }
  
  // Futsal requires at least 5 players per team
  if (discipline.id === "futsal") {
    return teamCount >= 5;
  }
  
  // Other disciplines will have their own compatibility rules
  return true;
}

function isSeriesLengthValid(format: TournamentFormat, seriesLength: SeriesLength): boolean {
  return format === "series" && [1, 3, 5].includes(seriesLength);
}

function isTeamSizeValidForDiscipline(team: TeamAssignment, discipline: Discipline): boolean {
  const size = team.slots.length;
  
  if (discipline.team.maxTeamSize === null) {
    return size >= discipline.team.minTeamSize;
  }
  
  return size === discipline.team.minTeamSize;
}

function hasRequiredRoles(team: TeamAssignment, discipline: Discipline): boolean {
  const teamRoleIds = team.slots
    .filter(slot => slot.roleId !== null)
    .map(slot => slot.roleId);
  
  const requiredRoleIds = discipline.roles.map(role => role.id);
  
  return requiredRoleIds.every(roleId => teamRoleIds.includes(roleId));
}

/**
 * Type guard to check if a tournament is ready for activation.
 * 
 * @param status - Tournament readiness status
 * @returns true if tournament is ready
 */
export function isTournamentReady(status: TournamentReadinessStatus): boolean {
  return status.status === "ready";
}