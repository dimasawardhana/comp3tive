/**
 * The single-player editor's rating controls, and their agreement with the bulk
 * rate dialog's.
 *
 * **What is pinned here is one contract, stated twice.** Both surfaces ask the
 * discipline what a rating looks like and both answer with the same control, so
 * a person cannot find that the same person is rated on a 1-5 row in one dialog
 * and a 0-10 row in the other. That agreement is only real because both read
 * `attributeScale` / `attributeBounds` / `middleOf`, so the cases below render
 * both components for one attribute and assert the same answer twice — a second
 * copy of the scale logic on either surface would fail here rather than in a
 * user's hands.
 *
 * The second thing pinned is the default a rating control opens on. A literal
 * `3` was correct for all three seeded disciplines and wrong for any other: on a
 * discipline whose scale starts at `4` it is a rating `validateCapability`
 * refuses, so a player given a capability there could not be saved at all until
 * someone guessed which button to press. The cases below are the numbers for
 * that: on a 4-6 scale the control offers 4, 5, 6, and a record with no rating
 * for the attribute opens on 5 — a step the discipline declared, so one of the
 * buttons is always pressed and the save is never blocked.
 *
 * `renderToStaticMarkup` runs no effects and lays nothing out, so what is
 * asserted is the HTML a browser receives on first paint: the control, its
 * name, its bounds, and which button is pressed. `emptyCap` — the draft written
 * when a capability is *added* — is a different path, reached by a click, and
 * is not asserted here; what pins its value is `middleOf` in
 * `BulkRateModal.test.ts`, and the fact that `emptyCap` calls it is read from
 * the source.
 */
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PlayerEditModal } from "./PlayerEditModal";
import { BulkRateModal, attributeScale, middleOf } from "./BulkRateModal";
import { SEED_DISCIPLINES, FUTSAL_DISCIPLINE } from "../domain/seed";
import type { Attribute, Discipline, Player } from "../domain/types";

/** A discipline whose attributes are whatever the case needs them to be. */
const disciplineOf = (...attributes: Attribute[]): Discipline => ({
  id: "custom",
  name: "Custom",
  shortName: "Cust",
  roles: [{ id: "only", name: "Only" }],
  attributes,
  strengthModel: { kind: "mean" },
  team: { minTeamSize: 1, maxTeamSize: 1, rolesRequired: true },
});

/** A player already holding a capability in `disciplineId`, with these ratings. */
const playerRated = (disciplineId: string, attributeRatings: Record<string, number>): Player => ({
  id: "p1",
  communityId: "c1",
  name: "Andi",
  notes: "",
  capabilities: [
    {
      disciplineId,
      attributeRatings,
      eligibleRoles: ["only"],
      preferredRole: null,
    },
  ],
});

/** The single-player editor's HTML, for one discipline and one set of ratings. */
const edit = (discipline: Discipline, attributeRatings: Record<string, number>): string =>
  renderToStaticMarkup(
    createElement(PlayerEditModal, {
      player: playerRated(discipline.id, attributeRatings),
      disciplines: [discipline],
      communityId: "c1",
      onClose: () => {},
      onSave: async () => {},
    }),
  );

/** The bulk rate dialog's HTML, for the same discipline. */
const bulk = (discipline: Discipline): string =>
  renderToStaticMarkup(
    createElement(BulkRateModal, {
      disciplines: [discipline, ...SEED_DISCIPLINES],
      players: [playerRated(discipline.id, Object.fromEntries(discipline.attributes.map((a) => [a.id, middleOf(a)])))],
      defaultDisciplineId: discipline.id,
      onApply: async () => {},
      onClose: () => {},
    }),
  );

/** The buttons the surface pressed, in order. */
const pressed = (html: string, name: string): string[] =>
  [...html.matchAll(new RegExp(`class="rating-btn on" aria-label="${name} (\\d+)"`, "g"))].map((m) => m[1]);

/** Every button the surface offered for an attribute, in order. */
const offered = (html: string, name: string): string[] =>
  [...html.matchAll(new RegExp(`aria-label="${name} (\\d+)"`, "g"))].map((m) => m[1]);

describe("a rating control asks the discipline, in both dialogs", () => {
  it("offers 4, 5 and 6 for a scale that starts at 4", () => {
    // The scale a 4-6 discipline declares, in the editor: three buttons, and
    // not the 1-5 row the editor used to hardcode for every discipline ever.
    const scale = disciplineOf({ id: "reach", name: "Reach", min: 4, max: 6 });
    expect(offered(edit(scale, { reach: 4 }), "Reach")).toEqual(["4", "5", "6"]);
  });

  it("opens a capability with no rating for the attribute on 5, not on a 3 it never declared", () => {
    // The blocked save, observed rather than assumed. A record whose ratings
    // lack the attribute — a hand-edited backup, or a capability the app did
    // not write — used to display as `3`, which is not on this scale at all:
    // no button was pressed *and* the value the editor would have written is one
    // `validatePlayer` refuses. Now it opens on the middle of the scale, so
    // exactly one button is pressed and that button's value saves.
    const scale = disciplineOf({ id: "reach", name: "Reach", min: 4, max: 6 });
    expect(pressed(edit(scale, {}), "Reach")).toEqual(["5"]);
    expect(attributeScale(scale.attributes[0])).toEqual([4, 5, 6]);
    expect(middleOf(scale.attributes[0])).toBe(5);
  });

  it("keeps the player's own rating pressed when they have one", () => {
    // The default is a fallback, not an override: a rating the record already
    // carries is the truth about that person and the control must show it.
    const scale = disciplineOf({ id: "reach", name: "Reach", min: 4, max: 6 });
    expect(pressed(edit(scale, { reach: 4 }), "Reach")).toEqual(["4"]);
    expect(pressed(edit(scale, { reach: 6 }), "Reach")).toEqual(["6"]);
  });

  it("answers with the same control as the bulk rate dialog, for every scale", () => {
    // F2 said a wide or fractional scale must be one control in both places.
    // Rendered side by side per attribute, so a second scale rule on either
    // surface — or a row of buttons in one and a field in the other — fails.
    for (const attribute of [
      { id: "a", name: "A" },
      { id: "b", name: "B", min: 0, max: 10 },
      { id: "c", name: "C", min: 4, max: 6 },
      { id: "d", name: "D", min: 1, max: 3.5 },
      { id: "e", name: "E", min: 0.5, max: 0.75 },
    ] as Attribute[]) {
      const scale = disciplineOf(attribute);
      const mine = edit(scale, { [attribute.id]: middleOf(attribute) });
      const theirs = bulk(scale);
      const name = attribute.name;
      expect(offered(mine, name), `buttons for ${name}`).toEqual(offered(theirs, name));
      // A number field, when the buttons cannot say all of it, in both — same
      // bounds, same name, because the field's `min`/`max` are the discipline's.
      const field = (html: string) => {
        const m = html.match(
          new RegExp(`<input class="input rating-number" type="number" min="([^"]+)" max="([^"]+)" aria-label="${name} rating" value="([^"]+)"`),
        );
        return m ? { min: m[1], max: m[2], value: m[3] } : null;
      };
      // Comparing two nulls would pass, so which control is *expected* is
      // stated: a scale with no buttons must produce a field on both surfaces,
      // and a scale with buttons must produce neither. That is what stops a
      // regex that matches nothing from reading as agreement.
      const wantField = attributeScale(attribute).length === 0;
      expect(field(mine) !== null, `editor shows a field for ${name}`).toBe(wantField);
      expect(field(theirs) !== null, `bulk shows a field for ${name}`).toBe(wantField);
      expect(field(mine), `number field for ${name}`).toEqual(field(theirs));
      // And the bounds in it are the discipline's, not a literal 1 and 5, and
      // the value is the middle of them — both surfaces were handed the same
      // rating, so the fields can be compared whole.
      if (wantField) {
        expect(field(mine), `bounds for ${name}`).toEqual({
          min: String(attribute.min ?? 1),
          max: String(attribute.max ?? 5),
          value: String(middleOf(attribute)),
        });
      }
    }
  });

  it("still offers the seeded catalog exactly as it shipped", () => {
    // The change is bounded to attributes that declare their own bounds: for
    // every seeded discipline the editor shows a 1-5 row with a button pressed,
    // which is what it did before and what every existing record assumes.
    for (const d of SEED_DISCIPLINES) {
      for (const a of d.attributes) {
        const html = renderToStaticMarkup(
          createElement(PlayerEditModal, {
            player: playerRated(d.id, { [a.id]: 3 }),
            disciplines: [d],
            communityId: "c1",
            onClose: () => {},
            onSave: async () => {},
          }),
        );
        expect(offered(html, a.name), `${d.shortName}/${a.name}`).toEqual(["1", "2", "3", "4", "5"]);
        expect(pressed(html, a.name), `${d.shortName}/${a.name}`).toEqual(["3"]);
      }
    }
    expect(FUTSAL_DISCIPLINE.attributes.map((a) => attributeScale(a))).toEqual([
      [1, 2, 3, 4, 5],
      [1, 2, 3, 4, 5],
      [1, 2, 3, 4, 5],
    ]);
  });
});
