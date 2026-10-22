import { describe, expect, it } from "vitest";
import { attributeLabel, validateCapability, validatePlayer } from "./validation";
import { FUTSAL_DISCIPLINE, MLBB_DISCIPLINE } from "./seed";
import type { Attribute, Capability, Discipline, Player } from "./types";

const futsalCap: Capability = {
  disciplineId: "futsal",
  attributeRatings: { technical: 4, fitness: 3, "game-iq": 4 },
  eligibleRoles: ["goalkeeper", "defender"],
  preferredRole: "goalkeeper",
};

const mlbbCap: Capability = {
  disciplineId: "mlbb",
  attributeRatings: { mechanics: 4, "game-sense": 3, "hero-pool": 5, teamwork: 4 },
  eligibleRoles: ["roam", "mid-lane"],
  preferredRole: "roam",
};

const validPlayer = (overrides: Partial<Player> = {}): Player => ({
  id: "p1",
  communityId: "c1",
  name: "Budi",
  capabilities: [futsalCap, mlbbCap],
  createdAt: 1000,
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
    const bad: Capability = { ...futsalCap, disciplineId: "padel" };
    const issues = validatePlayer(validPlayer({ capabilities: [bad] }), disciplines);
    expect(issues.some((i) => i.message.includes('Unknown discipline "padel"'))).toBe(true);
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
    const bad: Capability = { ...futsalCap, eligibleRoles: ["roam"] };
    const issues = validatePlayer(validPlayer({ capabilities: [bad] }), disciplines);
    expect(issues.some((i) => i.message.includes('Role "roam" is not part of "Futsal"'))).toBe(true);
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

describe("a 1-10 attribute", () => {
  const aim: Attribute = { id: "aim", name: "Aim", min: 1, max: 10 };
  const fps: Discipline = {
    id: "fps",
    name: "FPS",
    shortName: "FPS",
    roles: [{ id: "entry", name: "Entry" }],
    attributes: [aim],
    strengthModel: { kind: "mean" },
    team: { minTeamSize: 2, maxTeamSize: 2, rolesRequired: false },
  };
  const cap = (value: number): Capability => ({
    disciplineId: "fps",
    attributeRatings: { aim: value },
    eligibleRoles: ["entry"],
    preferredRole: null,
  });

  it("accepts a rating of 7", () => {
    expect(validateCapability(cap(7), fps)).toEqual([]);
  });

  it("still refuses a rating of 11", () => {
    const issues = validateCapability(cap(11), fps);
    expect(issues.some((i) => i.message.includes("must be 1-10, got 11"))).toBe(true);
  });
});

describe("attributeLabel", () => {
  const ends: Attribute = {
    id: "aim",
    name: "Aim",
    min: 1,
    max: 10,
    labels: { 1: "Novice", 10: "Legend", 5: "  " },
  };

  it("returns the label a value carries", () => {
    expect(attributeLabel(ends, 1)).toBe("Novice");
    expect(attributeLabel(ends, 10)).toBe("Legend");
  });

  it("returns null for a value the catalog does not name", () => {
    expect(attributeLabel(ends, 7)).toBeNull();
  });

  it("treats a blank label as no label", () => {
    expect(attributeLabel(ends, 5)).toBeNull();
  });

  it("returns null when the attribute has no catalog at all", () => {
    expect(attributeLabel({ id: "a", name: "A" }, 3)).toBeNull();
  });
});
