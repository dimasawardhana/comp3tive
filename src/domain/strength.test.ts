import { describe, expect, it } from "vitest";
import { computeStrength } from "./strength";
import { FUTSAL_DISCIPLINE, MLBB_DISCIPLINE } from "./seed";
import type { Capability } from "./types";

const futsalCap = (ratings: Record<string, number>): Capability => ({
  disciplineId: FUTSAL_DISCIPLINE.id,
  attributeRatings: ratings,
  eligibleRoles: ["goalkeeper"],
  preferredRole: "goalkeeper",
});

describe("computeStrength (mean model)", () => {
  it("averages the discipline's attributes with equal weight", () => {
    expect(computeStrength(FUTSAL_DISCIPLINE, futsalCap({ technical: 4, fitness: 3, "game-iq": 5 }))).toBe(4);
  });

  it("keeps fractional precision (used for the gap display)", () => {
    expect(computeStrength(FUTSAL_DISCIPLINE, futsalCap({ technical: 4, fitness: 4, "game-iq": 5 }))).toBeCloseTo(4.333, 3);
  });

  it("handles a 4-attribute discipline (MLBB)", () => {
    const cap: Capability = {
      disciplineId: MLBB_DISCIPLINE.id,
      attributeRatings: { mechanics: 5, "game-sense": 4, "hero-pool": 3, teamwork: 4 },
      eligibleRoles: ["tank"],
      preferredRole: "tank",
    };
    expect(computeStrength(MLBB_DISCIPLINE, cap)).toBe(4);
  });

  it("throws when a rating is missing", () => {
    expect(() => computeStrength(FUTSAL_DISCIPLINE, futsalCap({ technical: 4, fitness: 3 }))).toThrow(/missing rating/i);
  });

  it("is deterministic and independent of rating key order", () => {
    const a = computeStrength(FUTSAL_DISCIPLINE, futsalCap({ technical: 2, fitness: 3, "game-iq": 4 }));
    const b = computeStrength(FUTSAL_DISCIPLINE, futsalCap({ "game-iq": 4, technical: 2, fitness: 3 }));
    expect(a).toBe(b);
  });
});
