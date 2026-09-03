import type { Attribute, Capability, Discipline, Player } from "./types";

export interface ValidationIssue {
  path: string;
  message: string;
}

/**
 * Validate a Player against the model invariants from CONTEXT.md:
 * at most one Capability per Discipline, ratings within the attribute scale,
 * eligibility inside the discipline's roles, and preferred role inside the
 * eligibility list. Returns a list of issues (empty = valid).
 */
export function validatePlayer(player: Player, disciplines: Discipline[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const byId = new Map(disciplines.map((d) => [d.id, d]));

  const seen = new Set<string>();
  for (const cap of player.capabilities) {
    const path = `capabilities[${cap.disciplineId}]`;
    if (seen.has(cap.disciplineId)) {
      issues.push({ path, message: `At most one capability per discipline ("${cap.disciplineId}" appears twice).` });
    }
    seen.add(cap.disciplineId);

    const discipline = byId.get(cap.disciplineId);
    if (!discipline) {
      issues.push({ path, message: `Unknown discipline "${cap.disciplineId}".` });
      continue;
    }
    issues.push(...validateCapability(cap, discipline, path));
  }
  return issues;
}

export function validateCapability(cap: Capability, discipline: Discipline, path = "capability"): ValidationIssue[] {
  // `path` is the full issue path (e.g. "capabilities[futsal]") - used as-is.
  const issues: ValidationIssue[] = [];

  for (const attribute of discipline.attributes) {
    const value = cap.attributeRatings[attribute.id];
    const min = attribute.min ?? 1;
    const max = attribute.max ?? 5;
    if (value === undefined) {
      issues.push({ path, message: `Missing rating for attribute "${attribute.name}".` });
    } else if (!Number.isFinite(value) || value < min || value > max) {
      issues.push({ path, message: `Rating for "${attribute.name}" must be ${min}-${max}, got ${value}.` });
    }
  }

  const roleIds = new Set(discipline.roles.map((r) => r.id));
  for (const roleId of cap.eligibleRoles) {
    if (!roleIds.has(roleId)) {
      issues.push({ path, message: `Role "${roleId}" is not part of "${discipline.name}".` });
    }
  }
  if (cap.eligibleRoles.length === 0) {
    issues.push({ path, message: `At least one eligible role is required for "${discipline.name}".` });
  }
  if (cap.preferredRole !== null) {
    if (!cap.eligibleRoles.includes(cap.preferredRole)) {
      issues.push({ path, message: `Preferred role "${cap.preferredRole}" must be inside the eligibility list.` });
    }
  }
  return issues;
}

/** Human-readable label for an attribute's scale (used by forms and errors). */
export function attributeRange(attribute: Attribute): string {
  return `${attribute.min ?? 1}-${attribute.max ?? 5}`;
}
