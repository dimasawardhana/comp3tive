import { describe, expect, it } from "vitest";
import type { Discipline } from "../domain/types";
import { registrationToPlayer } from "./JoinPanel";

/** The discipline the public form offered: two attributes with bounds. */
function futsal(): Discipline {
  return {
    id: "d-futsal",
    name: "Futsal",
    shortName: "Futsal",
    roles: [
      { id: "r-keeper", name: "Keeper" },
      { id: "r-anchor", name: "Anchor" },
    ],
    attributes: [
      { id: "a-fit", name: "Fitness", min: 1, max: 5 },
      { id: "a-shot", name: "Shooting", min: 1, max: 5 },
    ],
    strengthModel: { kind: "mean" },
    team: { minTeamSize: 3, maxTeamSize: 5, rolesRequired: false },
  };
}

describe("registrationToPlayer", () => {
  it("maps self-assessed ratings by attribute name onto the discipline's attribute ids", () => {
    const player = registrationToPlayer(
      {
        payload: {
          name: "Ama",
          disciplineName: "Futsal",
          roleName: "Keeper",
          roles: ["Keeper"],
          ratings: { Fitness: 4, Shooting: 2 },
          notes: null,
        },
      },
      "c1",
      [futsal()],
    );
    expect(player).not.toBeNull();
    expect(player!.capabilities[0].attributeRatings).toEqual({ "a-fit": 4, "a-shot": 2 });
    expect(player!.capabilities[0].preferredRole).toBe("r-keeper");
    expect(player!.capabilities[0].eligibleRoles).toEqual(["r-keeper"]);
  });

  it("defaults un-rated attributes (and pre-rating-form rows) to the middle rating", () => {
    const player = registrationToPlayer(
      {
        payload: { name: "Bo", disciplineName: "Futsal", roleName: null, roles: null, ratings: null, notes: null },
      },
      "c1",
      [futsal()],
    );
    expect(player!.capabilities[0].attributeRatings).toEqual({ "a-fit": 3, "a-shot": 3 });
    expect(player!.capabilities[0].eligibleRoles).toEqual(["r-keeper", "r-anchor"]);
  });

  it("maps the ticked roles onto eligibility, keeping the preferred inside them", () => {
    const player = registrationToPlayer(
      {
        payload: {
          name: "Cy",
          disciplineName: "Futsal",
          roleName: "Anchor",
          roles: ["Keeper", "Anchor"],
          ratings: null,
          notes: null,
        },
      },
      "c1",
      [futsal()],
    );
    expect(player!.capabilities[0].eligibleRoles).toEqual(["r-keeper", "r-anchor"]);
    expect(player!.capabilities[0].preferredRole).toBe("r-anchor");
  });
});
