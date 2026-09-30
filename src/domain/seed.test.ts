import { describe, expect, it } from "vitest";
import { BADMINTON_DISCIPLINE, FUTSAL_DISCIPLINE, MLBB_DISCIPLINE, SEED_DISCIPLINES } from "./seed";

describe("seed disciplines", () => {
  it("seeds exactly Futsal, MLBB and Badminton", () => {
    expect(SEED_DISCIPLINES.map((d) => d.id)).toEqual(["futsal", "mlbb", "badminton"]);
  });

  it("futsal defines its roles and attributes", () => {
    expect(FUTSAL_DISCIPLINE.roles.map((r) => r.id)).toEqual(["goalkeeper", "defender", "winger", "pivot"]);
    expect(FUTSAL_DISCIPLINE.attributes.map((a) => a.id)).toEqual(["technical", "fitness", "game-iq"]);
  });

  it("futsal: soft role coverage, min 5, subs allowed", () => {
    expect(FUTSAL_DISCIPLINE.team).toEqual({ minTeamSize: 5, maxTeamSize: null, rolesRequired: false });
  });

  it("mlbb defines its roles and attributes", () => {
    expect(MLBB_DISCIPLINE.roles.map((r) => r.id)).toEqual(["tank", "assassin", "mage", "marksman", "fighter"]);
    expect(MLBB_DISCIPLINE.attributes.map((a) => a.id)).toEqual(["mechanics", "game-sense", "hero-pool", "teamwork"]);
  });

  it("mlbb: hard role coverage, exactly 5", () => {
    expect(MLBB_DISCIPLINE.team).toEqual({ minTeamSize: 5, maxTeamSize: 5, rolesRequired: true });
  });

  it("badminton defines its court roles and attributes", () => {
    expect(BADMINTON_DISCIPLINE.roles.map((r) => r.id)).toEqual(["front-court", "rear-court"]);
    expect(BADMINTON_DISCIPLINE.attributes.map((a) => a.id)).toEqual(["technical", "fitness", "game-iq"]);
  });

  it("badminton: hard role coverage, exactly 2", () => {
    // Two roles with rolesRequired needs exactly two players per team:
    // `roleCoverPossible` requires `team.length >= roleIds.length` and
    // `assignRoles` requires `players.length === roleIds.length`.
    expect(BADMINTON_DISCIPLINE.team).toEqual({ minTeamSize: 2, maxTeamSize: 2, rolesRequired: true });
  });

  it("badminton owns the mean strength model", () => {
    expect(BADMINTON_DISCIPLINE.strengthModel.kind).toBe("mean");
  });

  it("every seeded discipline owns the mean strength model (pluggable per discipline)", () => {
    for (const d of SEED_DISCIPLINES) {
      expect(d.strengthModel.kind).toBe("mean");
    }
  });
});
