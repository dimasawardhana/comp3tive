import type { Capability, Discipline } from "./types";

/**
 * Compute a player's Strength in a discipline from their capability's
 * attribute ratings, via the discipline's strength model.
 *
 * v1 model ("mean"): the equal-weight mean of the discipline's attributes,
 * each rated 1-5. A capability must rate every attribute of the discipline.
 * New models are new StrengthModel kinds; this dispatcher is the only switch.
 */
export function computeStrength(discipline: Discipline, capability: Capability): number {
  // New StrengthModel kinds must extend this switch (the model is discipline-owned).
  switch (discipline.strengthModel.kind) {
    case "mean":
      return meanOf(discipline, capability);
    default:
      throw new Error(`Unknown strength model kind: "${String(discipline.strengthModel.kind)}".`);
  }
}

function meanOf(discipline: Discipline, capability: Capability): number {
  const ratings = capability.attributeRatings;
  const ids = discipline.attributes.map((a) => a.id);
  if (ids.length === 0) return 0;
  let sum = 0;
  for (const id of ids) {
    const value = ratings[id];
    if (value === undefined) {
      throw new Error(
        `Capability for "${discipline.name}" is missing rating for attribute "${id}".`,
      );
    }
    sum += value;
  }
  return sum / ids.length;
}
