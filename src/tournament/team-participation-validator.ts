import type { Tournament, Session, SplitResult, TeamAssignment, TeamSlot, Discipline } from "../domain/types";

export interface TeamParticipationValidationIssue {
  path: string;
  message: string;
}

/** Validates that teams from a split can participate in a tournament. Ensures teams meet discipline requirements and tournament specifications. */
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
  if (session.poolPlayerIds.length !== splitResult.unassigned.length + splitResult.teams.reduce((sum, team) => sum + team.slots.length, 0)) {
    issues.push({
      path: "session.poolPlayerIds.length",
      message: `Session player pool size (${session.poolPlayerIds.length}) doesn't match split allocation (${splitResult.unassigned.length + splitResult.teams.reduce((sum, team) => sum + team.slots.length, 0)}).`
    });
  }
  
  return issues;
}

/** Helper: Validates team size against discipline constraints (exact or range). */
function isTeamSizeValidForDiscipline(team: TeamAssignment, discipline: Discipline): boolean {
  const size = team.slots.length;
  
  // If maxTeamSize is null, team must meet minimum requirement
  if (discipline.team.maxTeamSize === null) {
    return size >= discipline.team.minTeamSize;
  }
  
  // Otherwise, team size must exactly match minimumTeamSize
  return size === discipline.team.minTeamSize;
}

/** Helper: Validates that team covers all required roles for the discipline (e.g., MLBB needs tank, assassin, mage, marksman, support). */
function hasRequiredRoles(team: TeamAssignment, discipline: Discipline): boolean {
  // Extract all roles assigned to this team
  const teamRoleIds = team.slots
    .filter(slot => slot.roleId !== null)
    .map(slot => slot.roleId);
  
  // Check if discipline has required roles (e.g., MLBB has 5 roles)
  const requiredRoleIds = discipline.roles.map(role => role.id);
  
  // Verify all required roles are covered by this team
  return requiredRoleIds.every(roleId => teamRoleIds.includes(roleId));
}