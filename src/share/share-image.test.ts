import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { blockHeight, layoutShareImage, textWidth } from "./share-image";
import { teamsAsText } from "./share-text";
import { BIB } from "../ui/constants";
import { FUTSAL_DISCIPLINE } from "../domain/seed";
import type { Player, SplitResult } from "../domain/types";

/**
 * `--name: value;` pairs from one `:root` block of the token sheet.
 *
 * The poster paints literal hexes, so the only thing keeping them honest is a
 * test that reads `src/tokens.css` and asks whether each of them is still a
 * token. It is also how the test avoids a second copy of the palette: the
 * expected values are read, never typed.
 */
function tokenBlock(header: string): Record<string, string> {
  const sheet = readFileSync(new URL("../tokens.css", import.meta.url), "utf8");
  const start = sheet.indexOf(header);
  const body = sheet.slice(start, sheet.indexOf("}", start));
  return Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1] as string, (m[2] as string).trim().toLowerCase()]));
}

const LIGHT = tokenBlock(":root {");
const DARK = tokenBlock(':root[data-theme="dark"]');

const cap = (t: number, f: number, g: number) => ({
  disciplineId: "futsal",
  attributeRatings: { technical: t, fitness: f, "game-iq": g },
  eligibleRoles: ["goalkeeper"],
  preferredRole: "goalkeeper",
});

const roster: Player[] = Array.from({ length: 12 }, (_, i) => ({
  id: `p${i + 1}`,
  communityId: "c1",
  name: `Player ${i + 1}`,
  capabilities: [cap(4, 4, 4)],
}));

const PROVEN: SplitResult["solver"] = { optimal: true, nodesExplored: 51, elapsedMs: 6 };
/** What a budget-exhausted search and a hand edit both stamp. */
const BEST_FOUND: SplitResult["solver"] = { optimal: false, nodesExplored: 0, elapsedMs: 0 };

const result = (teamCount: number, perTeam: number, solver: SplitResult["solver"] = PROVEN, unassigned: string[] = []): SplitResult => ({
  teams: Array.from({ length: teamCount }, (_, index) => ({
    index,
    slots: Array.from({ length: perTeam }, (_, s) => ({ playerId: `p${index * perTeam + s + 1}`, roleId: null })),
    totalStrength: 4 * perTeam,
    avgStrength: 4,
  })),
  gap: 0.4,
  flags: [],
  unassigned,
  solver,
});

const input = (teamCount: number, perTeam: number, result_ = result(teamCount, perTeam)) => ({
  disciplineName: "Futsal",
  discipline: FUTSAL_DISCIPLINE,
  result: result_,
  roster,
});

/** The share text the poster is a picture of, for the same split. */
const shareTextFor = (result_: SplitResult, roster_: Player[] = roster) =>
  teamsAsText({ communityName: "Thursday Crew", disciplineName: "Futsal", discipline: FUTSAL_DISCIPLINE, result: result_, roster: roster_ });

/** The gap sentence, read back out of the copy that leaves the app. */
const closingOf = (result_: SplitResult) => {
  const closing = shareTextFor(result_).split("\n").find((line) => line.startsWith("Gap "));
  // A rename upstream would otherwise leave a silent `undefined` and a test
  // failure that reads as a poster bug.
  expect(closing, "teamsAsText no longer starts its gap line this way").toBeTruthy();
  return closing as string;
};

/**
 * The footer as its own lines: everything the layout emits after the last
 * player row. The gap sentence lives here, so a copy assertion that scans the
 * whole poster would be reading a roster it does not own.
 */
const footerOf = (result_: SplitResult, roster_: Player[] = roster) => {
  const lines = layoutShareImage({ ...input(2, 5, result_), roster: roster_ }).ops
    .filter((op) => op.kind === "text")
    .map((op) => (op.kind === "text" ? op.text : ""));
  return lines.slice(lines.findLastIndex((line) => line.startsWith("• ")) + 1);
};

describe("blockHeight", () => {
  it("grows by exactly one row per player", () => {
    // Fails if ROW_HEIGHT stops being the per-player term, or the base and
    // padding stop being the per-block ones: the poster's height is summed from
    // these, so a drift here is a block that no longer covers its own rows.
    expect(blockHeight(0)).toBe(blockHeight(1) - 56);
    expect(blockHeight(5)).toBe(blockHeight(1) + 4 * 56);
  });
});

describe("layoutShareImage", () => {
  it("is a fixed 1080 px wide", () => {
    // Fails if WIDTH is derived from the team count or the viewport.
    for (const n of [2, 3, 4]) expect(layoutShareImage(input(n, 5)).width).toBe(1080);
  });

  it("rounds the height up to the next 8 px", () => {
    // Fails if the rounding is dropped, or moved above the footer so the rule
    // rounds a height that the footer then changes again.
    for (const n of [2, 3, 4]) expect(layoutShareImage(input(n, 5)).height % 8).toBe(0);
  });

  it("grows the height with team count for stacked blocks", () => {
    // Fails if the stacked branch measures only the first block, which is what a
    // leftover `Math.max(...heights)` outside the `columns` test would do: two
    // teams would be taller than four.
    const two = layoutShareImage(input(2, 5)).height;
    const three = layoutShareImage(input(3, 5)).height;
    const four = layoutShareImage(input(4, 5)).height;
    expect(three).toBeGreaterThan(two);
    expect(four).toBeGreaterThan(three);
  });

  it("paints the brand tokens by literal hex, never a CSS variable", () => {
    // A canvas cannot resolve `var(--accent)`, so a token string here would be
    // painted as nothing at all. Fails if any fill is a `var(...)` or a name.
    const fills = layoutShareImage(input(2, 5)).ops.map((op) => op.fill);
    expect(fills).toContain("#FAF8F5");
    expect(fills).toContain("#1C1917");
    expect(fills).toContain("#57534E");
    expect(fills).toContain("#C2410C");
    expect(fills).toContain("#E7E3DC");
    expect(fills.some((f) => f.startsWith("var("))).toBe(false);
  });

  it("paints every brand fill with a value that is still a light token", () => {
    // The drift guard. The poster copies the palette out of a theme-scoped
    // sheet, so a token that changes silently desynchronises the image from the
    // app, and a hex edited here silently desynchronises the app from the
    // image. Expected values are read from `src/tokens.css`, not typed, so this
    // test cannot rot in the same direction as the sheet.
    const fills = new Set(layoutShareImage(input(5, 2)).ops.map((op) => op.fill.toUpperCase()));
    for (const token of ["--surface", "--text", "--text-2", "--accent", "--hairline", "--bib-a", "--bib-b", "--bib-c", "--bib-d", "--bib-e"]) {
      expect(fills).toContain(LIGHT[token].toUpperCase());
    }
  });

  it("is the light theme, and the dark accent is a different colour", () => {
    // The reason the choice is pinned rather than assumed: a poster is a file,
    // not a view, so it cannot answer a media query, and the two themes do not
    // agree — `tokens.css` re-declares `--accent` as the brighter amber at
    // `:47`. Fails if the sheet's two accents are ever merged into one, which
    // would leave the choice unpinnable rather than merely wrong.
    expect(LIGHT["--accent"]).toBe("#c2410c");
    expect(DARK["--accent"]).toBe("#ea580c");
  });

  it("gives each team its bib colour, in the order BIB defines", () => {
    // Expected values are the sheet's own `--bib-<key>` for each key of the
    // imported BIB, so this fails if the poster re-declares the order instead
    // of taking it: a hardcoded list that drifted from BIB would answer a
    // different order than the split screen's own stripes.
    const bibFills = BIB.map((key) => LIGHT[`--bib-${key}`].toUpperCase());
    expect(bibFills).toEqual(["#FFC400", "#FF4F9A", "#4E8FDB", "#6FAF8E", "#C9A227"]);
    const bars = (n: number) =>
      layoutShareImage(input(n, 2)).ops.filter((op) => op.kind === "roundRect").map((op) => op.fill.toUpperCase());
    expect(bars(3)).toEqual(bibFills.slice(0, 3));
  });

  it("wraps the sixth team back to the first bib", () => {
    // BIB is "indexed modulo its own length" (`src/ui/constants.ts:3`). A roster
    // that large is the only way to observe the wrap, and a poster that indexed
    // a five-colour array by `team.index` would read `undefined` here.
    const bars = layoutShareImage(input(6, 2)).ops.filter((op) => op.kind === "roundRect").map((op) => op.fill.toUpperCase());
    expect(bars).toEqual([...BIB.map((key) => LIGHT[`--bib-${key}`].toUpperCase()), "#FFC400"]);
  });

  it("never uses a type size below 34 px", () => {
    // The poster is read on a phone in a chat client, and the smallest type here
    // is body copy at 1080 px wide. Fails if a caption, a label, or the not-
    // playing line drops under 34 px.
    for (const op of layoutShareImage(input(2, 5, result(2, 5, PROVEN, ["p11"]))).ops) {
      if (op.kind !== "text") continue;
      const size = Number(op.font.match(/(\d+)px/)?.[1]);
      expect(size).toBeGreaterThanOrEqual(34);
    }
  });

  it("is deterministic, and keeps no state between calls", () => {
    // The same split must lay out the same, or two organizers who made the same
    // split cannot compare posters. What is compared is the op list, not the
    // rasterised bytes: the last hop is the canvas and whatever font state the
    // machine was in. Fails if a `Date`, a random, or a module-level `ops`
    // array reaches the layout — the array case is what the second half
    // catches, and it is the one a reuse refactor would introduce.
    expect(layoutShareImage(input(2, 5))).toEqual(layoutShareImage(input(2, 5)));
    const three = layoutShareImage(input(3, 5));
    layoutShareImage(input(4, 5));
    expect(layoutShareImage(input(3, 5))).toEqual(three);
  });

  it("keeps every glyph inside the poster, clipping a long name instead of overflowing", () => {
    // A name is data, not layout: a 44-character one must not push the poster
    // wider or spill past its edge. Fails if `fit` is dropped from the row, if
    // the column math changes without the row budget following, or if the
    // footer wraps into the last block.
    const longName = { ...input(2, 5) };
    longName.roster = roster.map((p, i) => (i === 0 ? { ...p, name: "A Very Long Player Name That Should Clip" } : p));
    const { width, height, ops } = layoutShareImage(longName);
    for (const op of ops) {
      if (op.kind !== "text") continue;
      const size = Number(op.font.match(/(\d+)px/)?.[1]);
      const w = textWidth(op.text, op.font);
      const left = op.align === "right" ? op.x - w : op.x;
      expect(left).toBeGreaterThanOrEqual(0);
      expect(left + w).toBeLessThanOrEqual(width);
      expect(op.y).toBeLessThanOrEqual(height);
      expect(op.y - size).toBeGreaterThanOrEqual(0);
    }
    expect(ops.some((op) => op.kind === "text" && op.text.includes("…"))).toBe(true);

    /**
     * The gutter is the edge the poster-width check above cannot see. A row
     * label widened to its whole block would end at the second column's left
     * edge — still inside 1080, so every assertion above would pass and the two
     * columns would print on top of each other. This is the only assertion that
     * fails if the row budget drops the stripe inset or the block's own gutter.
     */
    const MARGIN = 64;
    const COLUMN_GAP = 32;
    const columnEdge = MARGIN + (width - MARGIN * 2 - COLUMN_GAP) / 2;
    for (const op of ops) {
      if (op.kind !== "text" || !op.text.startsWith("• ")) continue;
      const w = textWidth(op.text, op.font);
      const left = op.align === "right" ? op.x - w : op.x;
      expect(left + w <= columnEdge || left >= columnEdge + COLUMN_GAP).toBe(true);
    }
  });

  it("gives an ordinary name its whole line in a column, and clips only an extraordinary one", () => {
    // Two teams is the only split `ae0b3e1` leaves shareable, and it is the
    // narrow one: a row budget of 390.57px inside a 460px column, which is a
    // name of about 20 characters in this face.
    //
    // HISTORY, and the reason this case has two fixtures. It was written with
    // one, and that fixture — "Rangga Saputra" — had quietly stopped being able
    // to fail. The bug it exists for takes `MARGIN` instead of the block's
    // `BLOCK_GUTTER`, narrowing the budget from 390.57px to 342.57px; under the
    // old `0.52` estimate "• Rangga Saputra (4.0)" measured 388.96px, well over
    // the narrowed budget, so restoring the bug clipped the label and the test
    // went red. The real advance widths measure that same label at 335.05px,
    // which fits in the narrowed budget with 7.53px to spare — so after Task 9
    // retuned the metrics, restoring the exact bug this case names passed the
    // whole suite. A test that only failed for the wrong reason is a test that
    // stops failing when the wrong reason is fixed, and the companion
    // `columnEdge` assertion above only ever fires when the budget is *widened*.
    //
    // So the fixture now sits in the window between the two budgets: wide
    // enough that the gutter bug clips it, ordinary enough that it has no
    // business being clipped. The second fixture pins the other side of the
    // same boundary, which this case's name has always promised and never
    // asserted. Fails if the budget takes `MARGIN` instead of the gutter, if it
    // widens past the block, or if the rating is appended after `fit` rather
    // than before it.
    const named = (name: string): Player[] => roster.map((p, i) => (i === 0 ? { ...p, name } : p));
    const rows = (name: string) => layoutShareImage({ ...input(2, 5), roster: named(name) }).ops
      .filter((op) => op.kind === "text" && op.text.startsWith("• "))
      .map((op) => (op.kind === "text" ? op.text : ""));
    expect(rows("Rangga Saputra")).toContain("• Rangga Saputra (4.0)");
    // 370.09px against a 390.57px budget — over 342.57px.
    expect(rows("Siti Nurhaliza Putri")).toContain("• Siti Nurhaliza Putri (4.0)");
    // 444.41px, past the budget in the other direction.
    expect(rows("Rangga Saputra Wijaya").some((row) => row.startsWith("• Rangga Saputra Wijaya") && row.endsWith("…"))).toBe(true);
  });

  it("lists unassigned players only when there are any", () => {
    // A sit-out the chat does not know about is a person who turns up with no
    // team. Fails if the guard is dropped (every poster would end in a bare
    // "Not playing:") or if the names are dropped from the line.
    const withUnassigned = { ...input(2, 5), result: result(2, 5, PROVEN, ["p11"]) };
    expect(layoutShareImage(withUnassigned).ops.some((op) => op.kind === "text" && op.text.includes("Not playing: Player 11"))).toBe(true);
    expect(layoutShareImage(input(2, 5)).ops.some((op) => op.kind === "text" && op.text.includes("Not playing"))).toBe(false);
  });

  it("paints the same rows, in the same order, as the share text", () => {
    // The poster draws the same data a different way; if the two surfaces could
    // disagree, one of them is lying in the group chat. Fails if the poster
    // re-derives the ordering, prints `strengthOf(...) ?? 0` for a player with no
    // capability in the discipline, or abbreviates the number differently.
    const mixed: Player[] = [
      { id: "p1", communityId: "c1", name: "Andi", capabilities: [cap(5, 4, 4)] },
      { id: "p2", communityId: "c1", name: "Dewi", capabilities: [] },
      { id: "p3", communityId: "c1", name: "Citra", capabilities: [cap(4, 4, 4)] },
    ];
    const result_: SplitResult = {
      ...result(1, 3),
      teams: [{ index: 0, slots: [{ playerId: "p2", roleId: null }, { playerId: "p1", roleId: null }, { playerId: "p3", roleId: null }], totalStrength: 8.3, avgStrength: 4.3 }],
    };
    const posterText = layoutShareImage({ disciplineName: "Futsal", discipline: FUTSAL_DISCIPLINE, result: result_, roster: mixed })
      .ops.filter((op) => op.kind === "text")
      .map((op) => (op.kind === "text" ? op.text : ""));
    const text = shareTextFor(result_, mixed).split("\n");
    for (const line of text.filter((l) => l.startsWith("• "))) {
      expect(posterText).toContain(line);
    }
    // The average is the one figure the two surfaces share without sharing a
    // string: the text folds it into the heading, the poster sets it at the
    // block's right edge, so the heading itself is not a string the poster
    // paints and asserting it would be asserting a layout nobody ships.
    const AVG = " · avg ";
    for (const [, value] of text.filter((l) => l.includes(AVG)).map((l) => l.split(AVG))) {
      expect(posterText).toContain(`avg ${value}`);
    }
    expect(posterText).not.toContain("Dewi (");
  });

  it("paints the share text's own closing line, hedged, on a best-found result", () => {
    // The one claim Phase B existed to remove. A poster is the worst place to
    // make it: the words are pixels, so a wrong one cannot be corrected, only
    // re-sent. The expected sentence is lifted out of `teamsAsText` rather than
    // typed here, so a third hand-written version cannot pass this test, and the
    // join over wrapped lines is what makes the assertion survive wrapping.
    const bestFound = result(2, 5, BEST_FOUND);
    const painted = footerOf(bestFound).join(" ");
    expect(painted).toContain(closingOf(bestFound));
    expect(painted).toContain("A smaller one may exist.");
    for (const banned of ["proven", "minimum", "optimal", "solver"]) expect(painted).not.toContain(banned);
  });

  it("paints the share text's own closing line, unhedged, on a proven result", () => {
    // The mirror of the case above, and the reason the poster takes the sentence
    // rather than a number: a proven result must not be hedged on a surface that
    // cannot be corrected. Fails if the poster branches on anything but the same
    // rule `teamsAsText` branches on.
    const proven = result(2, 5, PROVEN);
    const painted = footerOf(proven).join(" ");
    expect(painted).toContain(closingOf(proven));
    expect(painted).not.toContain("A smaller one may exist.");
  });

  it("breaks the hedged line where the measured budget runs out, not where the old guess said", () => {
    // The invariant under test is the one the case was written for: no line
    // ends on a one-character word, which on a poster reads as a bug rather
    // than as a break. Where the break lands has moved, and the reason is the
    // measurement rather than a change of heart — `0.52` per character
    // overstated this sentence by 21% (1255 px against 1033 px measured in
    // Familjen Grotesk at wght 500), and that overstatement is the only reason
    // it used to run out one character after the "A". On the fonts' own
    // advances the budget runs out after "may", so the orphan rule does not
    // fire here and cannot be observed from this sentence any more. "never
    // strands a one-character word, whatever the word is" is where the rule
    // firing is pinned; what is pinned here is that the break follows the
    // measurement. Fails if `wrap` returns to a fixed character count, or if
    // the one-character-word guard is dropped.
    const lines = footerOf(result(2, 5, BEST_FOUND));
    for (const line of lines.slice(0, -1)) expect(line.split(" ").at(-1)?.length).toBeGreaterThan(1);
    expect(lines).toEqual(["Gap 0.4. The smallest gap known for this pool. A smaller one may", "exist."]);
  });

  it("leaves a closing line that fits on one line unbroken", () => {
    // The other half of the rule above: moving a word down must not invent a
    // break where the line already fitted. The proven sentence is 43 characters
    // against a 53-character budget, and it must arrive as one op — a footer
    // that split a line with room to spare would be a wrap that breaks on
    // something other than the budget. Fails if the orphan rule is applied
    // before the fit is checked.
    expect(footerOf(result(2, 5, PROVEN))).toEqual(["Gap 0.4. The proven minimum for this pool."]);
  });

  it("never strands a one-character word, whatever the word is", () => {
    // The rule is word length, not the letter A. A player whose name is two
    // one-character words puts a different one-character word exactly where the
    // hedged sentence puts its "A", and it must move down too — here with the
    // name list sized so the break lands on it. Fails if the fix tests for "A",
    // or if the break lands between the two halves of the name.
    const sitOuts: Player[] = [
      { id: "budi", communityId: "c1", name: "Budi Santoso", capabilities: [cap(4, 4, 4)] },
      { id: "citra", communityId: "c1", name: "Citra Dewi", capabilities: [cap(4, 4, 4)] },
      { id: "andi", communityId: "c1", name: "Andi Wijaya", capabilities: [cap(4, 4, 4)] },
      { id: "xy", communityId: "c1", name: "X Y", capabilities: [cap(4, 4, 4)] },
    ];
    const lines = footerOf(result(2, 5, PROVEN, ["budi", "citra", "andi", "xy"]), [...roster, ...sitOuts]);
    // Only a line with text after it can strand: the last line's short word is
    // the end of the sentence, not a break in it.
    for (const line of lines.slice(0, -1)) expect(line.split(" ").at(-1)?.length).toBeGreaterThan(1);
    expect(lines.join(" ")).toContain("X Y");
  });
});

describe("the poster's own type metrics", () => {
  /**
   * The families the poster draws in, read out of a real op rather than typed,
   * so a rename on the token side cannot be satisfied by renaming the test too.
   */
  const fontsOf = () => [...new Set(layoutShareImage(input(2, 5)).ops.filter((op) => op.kind === "text").map((op) => (op.kind === "text" ? op.font : "")))] as string[];
  const stackOf = (font: string) => (font.match(/px (.+)$/)?.[1] ?? "").split(",").map((face) => face.trim().replace(/^"|"$/g, ""));

  it("draws in exactly the two families the token sheet names, in the same order", () => {
    // A `ctx.font` is a literal string, so `src/share/share-image.ts` repeats
    // `--font-display` and `--font-body` rather than reading them. That copy is
    // the only place the poster's faces can drift from the app's — and the drift
    // is invisible: a poster in a different face is not a broken poster. Fails
    // if a stack is edited here without the token, or the other way about.
    const sheet = readFileSync(new URL("../tokens.css", import.meta.url), "utf8");
    const declared = (token: string) => (sheet.match(new RegExp(`${token}:\\s*([^;]+);`))?.[1] ?? "").split(",").map((face) => face.trim().replace(/^"|"$/g, ""));
    expect(stackOf(fontsOf()[0] as string)).toEqual(declared("--font-display"));
    expect(fontsOf().map(stackOf).filter((faces) => faces[0] === "Familjen Grotesk")[0]).toEqual(declared("--font-body"));
  });

  it("measures with the fonts' own advance widths, not an average", () => {
    // The numbers are the `hmtx` advances of the woff2 files in `public/fonts`,
    // divided by each family's units per em, read with `wght` pinned to the
    // weight in the `ctx.font`. Pinned here so a careless edit to a table is a
    // test failure rather than a quietly different poster — and the ratio is
    // the reason a per-character table is not gold-plating: in these faces an
    // "i" is 0.2458 em and a "W" is 0.9125 em, so any single constant is wrong
    // for one of them by better than 2x, in whichever direction the name goes.
    //
    // Both tables, not one. The Outfit half drives `renderShareImage`'s own
    // `document.fonts.load(DISPLAY)` — the discipline heading and the team
    // names — and until this, its 104 numbers were pinned by no test at all,
    // which is the worse half of the same gap: an edit to it would not fail, it
    // would just quietly move the poster.
    const body = fontsOf().find((font) => font.includes("Familjen Grotesk")) as string;
    expect(textWidth("iii", body)).toBeCloseTo(3 * 0.2458 * 34, 5);
    expect(textWidth("WWW", body)).toBeCloseTo(3 * 0.9125 * 34, 5);
    expect(textWidth("WWW", body) / textWidth("iii", body)).toBeGreaterThan(3.5);
    const display = fontsOf().find((font) => font.includes("Outfit")) as string;
    expect(textWidth("iii", display)).toBeCloseTo(3 * 0.248 * 48, 5);
    expect(textWidth("WWW", display)).toBeCloseTo(3 * 0.992 * 48, 5);
    expect(textWidth("WWW", display) / textWidth("iii", display)).toBeGreaterThan(3.9);
  });

  it("charges an unlisted glyph its own family's measured mean, not a guess", () => {
    // Player names are data: an accented Latin letter, a CJK name or an emoji
    // all reach the poster, and none is in the table. The fall-back has to be a
    // measured quantity or a name in a script this table does not cover is laid
    // out by an assumption — which is the guess this replaced. Fails if the
    // fall-back is hard-coded to the old 0.52, or if an unlisted glyph silently
    // measures as zero and a row collapses.
    const body = fontsOf().find((font) => font.includes("Familjen Grotesk")) as string;
    expect(textWidth("한", body)).toBeCloseTo(0.5128 * 34, 5);
    expect(textWidth("", body)).toBe(0);
  });
});
