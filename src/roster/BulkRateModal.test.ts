/**
 * The bulk rate dialog: the discipline's own bounds, what a write is allowed to
 * change, and the sentence that says what it changed.
 *
 * Three things in here are contracts rather than behaviour, so they are pinned
 * against something outside this file wherever one exists: the bounds come from
 * the discipline and not from a literal (all three seeded disciplines happen to
 * land on 1-5, which is a coincidence this file refuses to depend on), the
 * capability created for a player who had none is compared byte-for-byte with
 * the one `csvRowsToPlayers` writes, and the confirmation's numbers are counted
 * rather than eyeballed.
 *
 * `renderToStaticMarkup` runs no effects and lays nothing out, so what is
 * asserted here is the HTML a browser receives on first paint: the copy, the
 * controls, their names and their disabled state. What it cannot see is the
 * clicking — the write, the toast and the selection being cleared are the
 * browser suite's, in `e2e/tests/roster/fast-entry.spec.ts`.
 */
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  attributeBounds,
  attributeScale,
  BulkRateModal,
  rateConfirmation,
  ratePlayers,
  startingRatings,
} from "./BulkRateModal";
import { SEED_DISCIPLINES, FUTSAL_DISCIPLINE } from "../domain/seed";
import { csvRowsToPlayers, parsePlayerCsv } from "../data/player-import";
import { computeStrength } from "../domain/strength";
import { validatePlayer } from "../domain/validation";
import type { Attribute, Discipline, Player } from "../domain/types";

const NOOP = { onApply: async () => {}, onClose: () => {} };

/** A player in Futsal, with the ratings the CSV importer would have given. */
const futsalPlayer = (id: string, ratings: Record<string, number> = { technical: 2, fitness: 2, "game-iq": 2 }): Player => ({
  id,
  communityId: "c1",
  name: id,
  capabilities: [
    {
      disciplineId: "futsal",
      attributeRatings: ratings,
      eligibleRoles: ["goalkeeper", "defender"],
      preferredRole: "goalkeeper",
    },
  ],
});

/** A player who has never played futsal. */
const futsalOutsider = (id: string): Player => ({
  id,
  communityId: "c1",
  name: id,
  capabilities: [],
});

/** The dialog's HTML, with only the props a case names. */
const render = (
  props: Partial<React.ComponentProps<typeof BulkRateModal>> = {},
): string =>
  renderToStaticMarkup(
    createElement(BulkRateModal, {
      disciplines: SEED_DISCIPLINES,
      players: [futsalPlayer("andi")],
      defaultDisciplineId: "futsal",
      ...NOOP,
      ...props,
    }),
  );

/** The page's prose, with markup and entity escaping off. */
const text = (html: string): string =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

/** A custom discipline whose attributes are not on a 1-5 scale. */
const TEN_POINT: Discipline = {
  id: "ten",
  name: "Ten Point",
  shortName: "10pt",
  roles: [{ id: "only", name: "Only" }],
  attributes: [
    { id: "reach", name: "Reach", min: 0, max: 10 },
    { id: "grip", name: "Grip", min: 0, max: 10 },
  ],
  strengthModel: { kind: "mean" },
  team: { minTeamSize: 1, maxTeamSize: 1, rolesRequired: true },
};

describe("an attribute's own bounds", () => {
  it("defaults to 1-5 when the discipline declares neither bound", () => {
    // Every seeded discipline lands here, because none of them declares a bound.
    for (const d of SEED_DISCIPLINES) {
      for (const a of d.attributes) expect(attributeBounds(a)).toEqual({ min: 1, max: 5 });
    }
  });

  it("reads a discipline's own numbers when it declares them", () => {
    expect(attributeBounds(TEN_POINT.attributes[0])).toEqual({ min: 0, max: 10 });
  });

  it("builds one step per whole number on the scale", () => {
    expect(attributeScale(FUTSAL_DISCIPLINE.attributes[0])).toEqual([1, 2, 3, 4, 5]);
    expect(attributeScale(TEN_POINT.attributes[0])).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("offers a number field, not an empty row of buttons, when the scale has no whole step", () => {
    // A 0.5-0.75 scale is legal on `Attribute` and untickable as buttons.
    const fractional: Attribute = { id: "f", name: "Reach", min: 0.5, max: 0.75 };
    const odd: Discipline = { ...TEN_POINT, attributes: [fractional] };
    expect(attributeScale(fractional)).toEqual([]);
    const html = render({ disciplines: [odd], players: [futsalOutsider("x")], defaultDisciplineId: "ten" });
    expect(html).toContain('aria-label="Reach rating"');
    // The field carries the discipline's own bounds, which are 0.5 and 0.75 and
    // not the 1 and 5 a hard-coded control would offer.
    expect(html).toContain('min="0.5"');
    expect(html).toContain('max="0.75"');
  });

  it("offers a number field rather than a wall of buttons on a very wide scale", () => {
    const wide: Attribute = { id: "w", name: "Reach", min: 0, max: 1000 };
    const vast: Discipline = { ...TEN_POINT, attributes: [wide] };
    expect(attributeScale(wide)).toEqual([]);
    expect(render({ disciplines: [vast], players: [futsalOutsider("x")], defaultDisciplineId: "ten" })).toContain(
      'aria-label="Reach rating"',
    );
  });

  it("renders one button per step of the discipline's own scale, and no input at all", () => {
    const html = render({ disciplines: [TEN_POINT], players: [futsalOutsider("x")], defaultDisciplineId: "ten" });
    // 0-10 is eleven buttons, per attribute, read off the discipline's bounds.
    expect(html.match(/aria-label="Reach \d+"/g) ?? []).toHaveLength(11);
    expect(html).toContain('aria-label="Reach 0"');
    expect(html).toContain('aria-label="Reach 10"');
    // A scale that fits a row of buttons gets no number field, and the only
    // input in this dialog is ever a rating, never a strength.
    expect(html).not.toContain("<input");
    expect(html).not.toMatch(/aria-label="[^"]*rating"/);
  });
});

describe("the value each field opens on", () => {
  it("opens on what every selected player already has, so a look changes nothing", () => {
    expect(startingRatings(FUTSAL_DISCIPLINE, [futsalPlayer("a"), futsalPlayer("b")])).toEqual({
      technical: 2,
      fitness: 2,
      "game-iq": 2,
    });
  });

  it("opens on the middle of the attribute's own range when the set disagrees", () => {
    const a = futsalPlayer("a", { technical: 1, fitness: 5, "game-iq": 3 });
    const b = futsalPlayer("b", { technical: 4, fitness: 2, "game-iq": 3 });
    expect(startingRatings(FUTSAL_DISCIPLINE, [a, b])).toEqual({ technical: 3, fitness: 3, "game-iq": 3 });
  });

  it("opens on the middle of the attribute's own range when nobody has a rating", () => {
    // A player with no capability has no value to agree with, and the midpoint
    // of 0-10 is 5 rather than the 3 a hard-coded 1-5 would give.
    expect(startingRatings(TEN_POINT, [futsalOutsider("x")])).toEqual({ reach: 5, grip: 5 });
  });

  it("opens on a value that is inside the discipline's own bounds", () => {
    for (const value of Object.values(startingRatings(TEN_POINT, [futsalOutsider("x")]))) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(10);
    }
  });
});

describe("a player who already plays the discipline", () => {
  it("keeps their own eligible roles and preferred role", () => {
    const [rated] = ratePlayers([futsalPlayer("andi")], FUTSAL_DISCIPLINE, {
      technical: 5,
      fitness: 4,
      "game-iq": 3,
    });
    const cap = rated.capabilities[0];
    // The Phase B merge rule, applied to a bulk write: add what was asked for,
    // keep every field the write was not asked about.
    expect(cap.eligibleRoles).toEqual(["goalkeeper", "defender"]);
    expect(cap.preferredRole).toBe("goalkeeper");
    expect(cap.attributeRatings).toEqual({ technical: 5, fitness: 4, "game-iq": 3 });
  });

  it("leaves the same player's other disciplines alone", () => {
    const player: Player = {
      ...futsalPlayer("andi"),
      capabilities: [
        ...futsalPlayer("andi").capabilities,
        { disciplineId: "mlbb", attributeRatings: { mechanics: 1 }, eligibleRoles: ["tank"], preferredRole: "tank" },
      ],
    };
    const [rated] = ratePlayers([player], FUTSAL_DISCIPLINE, {
      technical: 5,
      fitness: 5,
      "game-iq": 5,
    });
    expect(rated.capabilities).toHaveLength(2);
    expect(rated.capabilities[1]).toEqual(player.capabilities[1]);
  });

  it("does not change the player's name, notes or community", () => {
    const player: Player = { ...futsalPlayer("andi"), notes: "ONIC · Jungle" };
    const [rated] = ratePlayers([player], FUTSAL_DISCIPLINE, { technical: 5, fitness: 5, "game-iq": 5 });
    expect(rated.name).toBe("andi");
    expect(rated.notes).toBe("ONIC · Jungle");
    expect(rated.communityId).toBe("c1");
  });
});

describe("a player with no capability in the discipline", () => {
  it("gains one, holding exactly what a CSV row for this discipline holds", () => {
    // The two paths must not disagree about what "this person plays this
    // sport" means, or a player would gain roles by being rated and lose them
    // by being imported. The comparison is against the importer's own output.
    const { players: imported } = csvRowsToPlayers(
      parsePlayerCsv(["name,discipline,strength", "Zaki,futsal,4", ""].join("\n")).rows,
      SEED_DISCIPLINES,
      "c1",
    );
    const [rated] = ratePlayers([futsalOutsider("zaki")], FUTSAL_DISCIPLINE, {
      technical: 4,
      fitness: 4,
      "game-iq": 4,
    });
    expect(rated.capabilities).toEqual(imported[0].capabilities);
  });

  it("cannot smuggle a rating the discipline's own bounds forbid", () => {
    // The write is refused as a set, before anything is saved, and the refusal
    // is `validatePlayer`'s — the same call the single-player editor makes.
    const rated = ratePlayers([futsalOutsider("zaki")], TEN_POINT, { reach: 11, grip: 4 });
    const issues = validatePlayer(rated[0], [TEN_POINT]);
    expect(issues.map((i) => i.message)).toEqual(['Rating for "Reach" must be 0-10, got 11.']);
  });

  it("does not stand in the way of the roles the discipline has", () => {
    // Every role open, no preferred role: the app can say this person can play
    // the sport and can say nothing more than that.
    const [rated] = ratePlayers([futsalOutsider("zaki")], FUTSAL_DISCIPLINE, {
      technical: 4,
      fitness: 4,
      "game-iq": 4,
    });
    expect(rated.capabilities[0].eligibleRoles).toEqual(
      FUTSAL_DISCIPLINE.roles.map((r) => r.id),
    );
    expect(rated.capabilities[0].preferredRole).toBeNull();
  });

  it("writes a record the app's own validation accepts", () => {
    const rated = ratePlayers(
      [futsalOutsider("zaki"), futsalPlayer("andi")],
      FUTSAL_DISCIPLINE,
      { technical: 4, fitness: 2, "game-iq": 3 },
    );
    for (const player of rated) expect(validatePlayer(player, SEED_DISCIPLINES)).toEqual([]);
  });
});

describe("the confirmation", () => {
  const ratings = { technical: 5, fitness: 5, "game-iq": 5 };

  it("names the count, the discipline and every attribute it set", () => {
    expect(rateConfirmation(FUTSAL_DISCIPLINE, ratings, 8)).toContain(
      "This app set Technical 5, Fitness 5, Game IQ 5 on the 8 selected players in Futsal",
    );
  });

  it("says the consequence rather than leaving it to be discovered", () => {
    // A bulk write is one judgement written eight times, and after it every one
    // of them reads the same strength. The sentence has to say so.
    expect(rateConfirmation(FUTSAL_DISCIPLINE, ratings, 8)).toContain(
      "so their strength there is now the same",
    );
  });

  it("counts one player as one player, and drops a clause with nothing to compare", () => {
    const one = rateConfirmation(FUTSAL_DISCIPLINE, ratings, 1);
    expect(one).toContain("on the 1 selected player in Futsal");
    expect(one).not.toContain("the same");
  });

  it("is the same sentence for every set, and never says the players were compared", () => {
    const first = rateConfirmation(FUTSAL_DISCIPLINE, ratings, 3);
    const second = rateConfirmation(FUTSAL_DISCIPLINE, ratings, 30);
    expect(first.replace("the 3 ", "")).toBe(second.replace("the 30 ", ""));
    expect(first).not.toMatch(/equal|better|best|compared/i);
  });

  it("reads the attribute names and values off the discipline, not off a fixed list", () => {
    expect(rateConfirmation(TEN_POINT, { reach: 0, grip: 10 }, 2)).toContain(
      "This app set Reach 0, Grip 10 on the 2 selected players in Ten Point",
    );
  });
});

describe("the dialog's surface", () => {
  it("titles itself with the number of players it will write", () => {
    expect(text(render({ players: [futsalPlayer("a"), futsalPlayer("b")] }))).toContain("Rate 2 players");
    expect(text(render({ players: [futsalPlayer("a")] }))).toContain("Rate 1 player");
  });

  it("shows the strength this app derives, as a value with no control in it", () => {
    const html = render({ players: [futsalPlayer("a")] });
    // The readout is two spans. There is nothing in it to type into, and no
    // element anywhere in the dialog is labelled as a strength input.
    const readout = html.match(/<div class="derived-readout">[\s\S]*?<\/div>/)?.[0] ?? "";
    // Both attributes rate 2, so the derived value is the number they already
    // had, not one the dialog chose.
    expect(readout).toContain("2.0");
    expect(readout).not.toMatch(/<input|<button|<select|<textarea/);
    expect(html).toContain("Strength is worked out by this app from the ratings above");
    expect(html).toContain("It is not stored, and it cannot be edited here");
    expect(html).not.toMatch(/aria-label="Strength/);
  });

  it("derives the number it shows from the ratings, through the app's own model", () => {
    const html = render({ players: [futsalPlayer("a")] });
    const shown = html.match(/class="derived-value"[^>]*>([\d.]+)</)?.[1];
    const expected = computeStrength(FUTSAL_DISCIPLINE, {
      disciplineId: "futsal",
      attributeRatings: { technical: 2, fitness: 2, "game-iq": 2 },
      eligibleRoles: [],
      preferredRole: null,
    }).toFixed(1);
    expect(shown).toBe(expected);
  });

  it("says up front that the whole set gets the same numbers, and what happens to a player who had none", () => {
    const html = text(render({ players: [futsalPlayer("a"), futsalOutsider("b")] }));
    expect(html).toContain("Every player you selected is set to the same number in each row");
    expect(html).toContain("Players who do not play it yet are added to it");
    expect(html).toContain("the same as a row from a CSV import");
  });

  it("presses exactly the value the set agreed on", () => {
    const html = render({ players: [futsalPlayer("a"), futsalPlayer("b")] });
    expect(html.match(/class="rating-btn on"/g) ?? []).toHaveLength(3);
    expect(html).toContain('aria-label="Technical 2" aria-pressed="true"');
  });

  it("refuses a discipline with no attributes, and says why", () => {
    const bare: Discipline = { ...FUTSAL_DISCIPLINE, attributes: [] };
    const html = render({ disciplines: [bare], players: [futsalPlayer("a")], defaultDisciplineId: "futsal" });
    expect(text(html)).toContain("This discipline has no attributes, so there is nothing to rate.");
    expect(html).toMatch(/class="btn btn-primary"[^>]*disabled/);
  });

  it("will not write for nobody", () => {
    expect(render({ players: [] })).toMatch(/class="btn btn-primary"[^>]*disabled/);
  });

  it("opens on the discipline the roster was filtered to", () => {
    const html = render({ defaultDisciplineId: "mlbb" });
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain(">MLBB</button>");
    // MLBB's four attributes, not futsal's three.
    expect(html).toContain("Hero Pool");
  });

  it("shows every discipline in the catalog, by the name the app shows elsewhere", () => {
    const html = render();
    for (const short of ["Futsal", "MLBB", "Badminton"]) expect(html).toContain(`>${short}</button>`);
  });
});
