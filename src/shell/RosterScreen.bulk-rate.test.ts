/**
 * The roster's rating mode: the selection it keeps, the line that describes it,
 * and the two controls every row now carries.
 *
 * `renderToStaticMarkup` runs no effects and no clicks, so what is pinned here
 * is the first paint: the copy, the controls' accessible names, which of them
 * are disabled, and — through `selectedIn` — the rule that decides which rows a
 * selection means. Ticking a box, writing anything, the toast and the selection
 * being cleared are the browser suite's, in
 * `e2e/tests/roster/fast-entry.spec.ts`.
 */
import { describe, expect, it } from "vitest";
import { renderRoster } from "../test-support/renderRoster";
import { selectedIn, selectionNote } from "./RosterScreen";
import { SEED_DISCIPLINES } from "../domain/seed";
import type { Player } from "../domain/types";

const byId = new Map(SEED_DISCIPLINES.map((d) => [d.id, d]));

/** Three players, two of them in futsal. */
const roster: Player[] = [
  { id: "p1", communityId: "c1", name: "Andi", capabilities: [{ disciplineId: "futsal", attributeRatings: { technical: 2, fitness: 2, "game-iq": 2 }, eligibleRoles: ["goalkeeper"], preferredRole: null }] },
  { id: "p2", communityId: "c1", name: "Budi", capabilities: [{ disciplineId: "futsal", attributeRatings: { technical: 2, fitness: 2, "game-iq": 2 }, eligibleRoles: ["goalkeeper"], preferredRole: null }] },
  { id: "p3", communityId: "c1", name: "Citra", capabilities: [{ disciplineId: "mlbb", attributeRatings: { mechanics: 1 }, eligibleRoles: ["tank"], preferredRole: null }] },
];

/** The roster's HTML with its three players, all visible. */
const screen = (): string =>
  renderRoster({ disciplines: SEED_DISCIPLINES, disciplinesById: byId, players: roster, visiblePlayers: roster });

/** The page's prose, with markup and entity escaping off. */
const text = (html: string): string =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

/** The selection bar's sentence, as prose. */
const note = (html: string): string => {
  const raw = html.match(/<p class="roster-select-note">([\s\S]*?)<\/p>/)?.[1];
  return raw === undefined ? "" : text(raw);
};

describe("what a selection means", () => {
  const selection = { communityId: "c1", ids: ["p1", "p2"] };

  it("is the ticked rows, in roster order", () => {
    expect(selectedIn(selection, "c1", roster).map((p) => p.id)).toEqual(["p1", "p2"]);
  });

  it("is nothing at all in another community", () => {
    // A mode that outlives the thing that started it: the ids belong to the
    // community the user just left, and the new roster may not hold them.
    expect(selectedIn(selection, "c2", roster)).toEqual([]);
    expect(selectedIn(selection, undefined, roster)).toEqual([]);
  });

  it("cannot include a row the filter is not showing", () => {
    // The second half of the same rule: a ticked row that has been filtered
    // out is not in the set the dialog is handed, so it cannot be written.
    const filtered = roster.filter((p) => p.id !== "p2");
    expect(selectedIn(selection, "c1", filtered).map((p) => p.id)).toEqual(["p1"]);
  });

  it("is empty when nothing is ticked", () => {
    expect(selectedIn({ communityId: "c1", ids: [] }, "c1", roster)).toEqual([]);
  });

  it("is never a duplicate, whatever the state holds", () => {
    expect(selectedIn({ communityId: "c1", ids: ["p1", "p1"] }, "c1", roster).map((p) => p.id)).toEqual(["p1"]);
  });
});

describe("the line that describes the selection", () => {
  it("counts nothing selected and says how to start", () => {
    expect(selectionNote(0, 3)).toBe(
      "0 of 3 selected. Choose players here, or press Select all, to rate them together in one discipline.",
    );
  });

  it("answers what happens to the rest, for one player", () => {
    expect(selectionNote(1, 3)).toBe(
      "1 of 3 selected. Rating writes to that one player; the other 2 keep the ratings they have.",
    );
  });

  it("answers what happens to the rest, for many", () => {
    expect(selectionNote(2, 3)).toBe(
      "2 of 3 selected. Rating writes to those 2; the other 1 keep the ratings they have.",
    );
  });

  it("has nothing to say about a roster with no rows", () => {
    expect(selectionNote(0, 0)).toBe("");
  });

  it("says the whole set when every row is ticked, rather than counting an absent other", () => {
    expect(selectionNote(3, 3)).toBe("3 of 3 selected. Rating writes to all 3 of them.");
    expect(selectionNote(3, 3)).not.toContain("other 0");
  });

  it("never claims the ticked players were compared with each other", () => {
    for (const n of [0, 1, 2, 40]) {
      expect(selectionNote(n, 60)).not.toMatch(/equal|better|best|compare/i);
    }
  });
});

describe("the roster's rating controls", () => {
  it("says how many are selected and offers the two ways to change that", () => {
    const html = screen();
    expect(note(html)).toBe(
      "0 of 3 selected. Choose players here, or press Select all, to rate them together in one discipline.",
    );
    expect(html).toContain(">Select all</button>");
    expect(html).toContain(">Rate selected</button>");
  });

  it("will not open a dialog with nobody selected", () => {
    expect(screen()).toMatch(/<button[^>]*class="btn btn-primary"[^>]*disabled[^>]*>Rate selected/);
  });

  it("gives every row a checkbox of its own and a button of its own", () => {
    const html = screen();
    for (const name of ["Andi", "Budi", "Citra"]) {
      expect(html).toContain(`aria-label="Select ${name}"`);
      expect(html).toContain(`aria-label="Edit ${name}"`);
    }
  });

  it("keeps the checkbox out of the button, so it survives in the accessibility tree", () => {
    // A `role="button"` element's contents are presentational: a checkbox nested
    // inside the row's button would be a tick a mouse can do and a keyboard
    // cannot. The two controls are siblings inside one row.
    const html = screen();
    const button = html.match(/<div class="row-open"[^>]*>[\s\S]*?<\/div><\/div>/)?.[0] ?? "";
    expect(button).toContain("Edit Andi");
    expect(button).not.toContain("Select Andi");
  });

  it("says nothing about selection on a roster with no rows", () => {
    const html = renderRoster({ disciplines: SEED_DISCIPLINES, disciplinesById: byId, players: [], visiblePlayers: [] });
    expect(html).not.toContain("roster-select-bar");
    expect(html).not.toContain("Rate selected");
  });

  it("counts only the rows the filter shows", () => {
    const futsal = roster.filter((p) => p.id !== "p3");
    const html = renderRoster({
      disciplines: SEED_DISCIPLINES,
      disciplinesById: byId,
      players: roster,
      visiblePlayers: futsal,
      filterIds: ["futsal"],
    });
    expect(note(html)).toContain("0 of 2 selected.");
  });

  it("opens no dialog on its own", () => {
    // The dialog is a mode the user enters; the screen's own render must not
    // bring it up behind the roster.
    expect(screen()).not.toContain("modal-card");
    expect(screen()).not.toContain("Rate 3 players");
  });
});
