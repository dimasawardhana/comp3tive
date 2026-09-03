import { describe, expect, it } from "vitest";
import { FUTSAL_DISCIPLINE, MLBB_DISCIPLINE, SEED_DISCIPLINES } from "./seed";

describe("seed disciplines", () => {
  it("seeds exactly Futsal and MLBB", () => {
    expect(SEED_DISCIPLINES.map((d) => d.id)).toEqual(["futsal", "mlbb"]);
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

  it("both disciplines own the mean strength model (pluggable per discipline)", () => {
    for (const d of SEED_DISCIPLINES) {
      expect(d.strengthModel.kind).toBe("mean");
    }
  });
});
