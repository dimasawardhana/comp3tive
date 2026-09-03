import { describe, expect, it } from "vitest";
import { validatePlayer } from "./validation";
import { FUTSAL_DISCIPLINE, MLBB_DISCIPLINE } from "./seed";
import type { Capability, Player } from "./types";

const futsalCap: Capability = {
  disciplineId: "futsal",
  attributeRatings: { technical: 4, fitness: 3, "game-iq": 4 },
  eligibleRoles: ["goalkeeper", "defender"],
  preferredRole: "goalkeeper",
};

const mlbbCap: Capability = {
  disciplineId: "mlbb",
  attributeRatings: { mechanics: 4, "game-sense": 3, "hero-pool": 5, teamwork: 4 },
  eligibleRoles: ["tank", "mage"],
  preferredRole: "tank",
};

const validPlayer = (overrides: Partial<Player> = {}): Player => ({
  id: "p1",
  communityId: "c1",
  name: "Budi",
  capabilities: [futsalCap, mlbbCap],
  ...overrides,
});

const disciplines = [FUTSAL_DISCIPLINE, MLBB_DISCIPLINE];

describe("validatePlayer", () => {
  it("accepts a player with valid capabilities in two disciplines", () => {
    expect(validatePlayer(validPlayer(), disciplines)).toEqual([]);
  });

  it("rejects at most one capability per discipline", () => {
    const p = validPlayer({ capabilities: [futsalCap, { ...futsalCap }] });
    const issues = validatePlayer(p, disciplines);
    expect(issues.some((i) => i.message.includes("At most one capability"))).toBe(true);
  });

  it("rejects a capability in an unknown discipline", () => {
    const bad: Capability = { ...futsalCap, disciplineId: "badminton" };
    const issues = validatePlayer(validPlayer({ capabilities: [bad] }), disciplines);
    expect(issues.some((i) => i.message.includes('Unknown discipline "badminton"'))).toBe(true);
  });

  it("rejects a missing attribute rating", () => {
    const bad: Capability = { ...futsalCap, attributeRatings: { technical: 4, fitness: 3 } };
    const issues = validatePlayer(validPlayer({ capabilities: [bad] }), disciplines);
    expect(issues.some((i) => i.message.includes("Missing rating"))).toBe(true);
  });

  it("rejects out-of-range ratings", () => {
    const bad: Capability = { ...futsalCap, attributeRatings: { technical: 6, fitness: 3, "game-iq": 0 } };
    const issues = validatePlayer(validPlayer({ capabilities: [bad] }), disciplines);
    expect(issues.some((i) => i.message.includes("must be 1-5"))).toBe(true);
  });

  it("rejects a role that is not part of the discipline", () => {
    const bad: Capability = { ...futsalCap, eligibleRoles: ["tank"] };
    const issues = validatePlayer(validPlayer({ capabilities: [bad] }), disciplines);
    expect(issues.some((i) => i.message.includes('Role "tank" is not part of "Futsal"'))).toBe(true);
  });

  it("rejects an empty eligibility list", () => {
    const bad: Capability = { ...futsalCap, eligibleRoles: [] };
    const issues = validatePlayer(validPlayer({ capabilities: [bad] }), disciplines);
    expect(issues.some((i) => i.message.includes("At least one eligible role"))).toBe(true);
  });

  it("rejects a preferred role outside the eligibility list", () => {
    const bad: Capability = { ...futsalCap, eligibleRoles: ["defender"], preferredRole: "goalkeeper" };
    const issues = validatePlayer(validPlayer({ capabilities: [bad] }), disciplines);
    expect(issues.some((i) => i.message.includes("Preferred role"))).toBe(true);
  });

  it("reports issues under the canonical path capabilities[<disciplineId>]", () => {
    const bad: Capability = { ...futsalCap, attributeRatings: { technical: 4 } };
    const issues = validatePlayer(validPlayer({ capabilities: [bad] }), disciplines);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every((i) => i.path === "capabilities[futsal]")).toBe(true);
  });
});
