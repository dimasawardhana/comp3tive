import { describe, expect, it } from "vitest";
import { CSV_TEMPLATE, CSV_TEMPLATE_FILE_NAME } from "./csv-template";
import { parsePlayerCsv, csvRowsToPlayers, type CsvRow } from "./player-import";
import { SEED_DISCIPLINES } from "../domain/seed";
import type { Player } from "../domain/types";

/**
 * The tie between the template and the parser.
 *
 * Everything here is a round trip rather than a string comparison, because the
 * header rule has already been got wrong once — a first-row player called
 * `Nameer` was swallowed by a substring heuristic that reported nothing. A test
 * asserting that the header "looks like a header" would have passed over that
 * defect and over every one of its successors; running the shipped
 * `parsePlayerCsv` over the shipped bytes is the only assertion that cannot.
 *
 * Nothing in this file edits the parser. It is Phase A's, and
 * `contracts.md:209` lists it as read-never-written by this phase.
 */

/** The four fields `CsvRow` declares today, so a field added later is not a break here. */
const summary = (rows: CsvRow[]) =>
  rows.map(({ line, name, discipline, strength }) => ({ line, name, discipline, strength }));

/** The players an import of the template would actually write. */
const importedPlayers = (): Player[] => {
  const { rows, skipped } = parsePlayerCsv(CSV_TEMPLATE);
  expect(skipped).toEqual([]);
  const { players, skipped: unresolved } = csvRowsToPlayers(rows, SEED_DISCIPLINES, "c1");
  expect(unresolved).toEqual([]);
  return players;
};

describe("CSV_TEMPLATE", () => {
  it("states the parser's column order in its header", () => {
    expect(CSV_TEMPLATE.split("\n")[0]).toBe("name,discipline,strength");
    // Fails if the order is changed, or if the headings are re-cased or
    // re-worded. The parser reads positions, so a reordered header is not a
    // parser change — it is a template that now describes a file the app
    // cannot read, and this is the line that says so first.
  });

  it("is one heading and two example rows, and ends with a newline", () => {
    const lines = CSV_TEMPLATE.split("\n");
    expect(lines.filter((l) => l.trim() !== "")).toHaveLength(3);
    expect(CSV_TEMPLATE.endsWith("\n")).toBe(true);
    // Fails if a third example is added. That is allowed — but it should be a
    // decision someone makes, with a row that earns its place, rather than a
    // diff nobody reads. The trailing newline is what a file saved from a
    // sheet has, and what keeps an editor from warning about its last line.
  });

  it("parses cleanly through the shipped parser, with every row accounted for", () => {
    // The load-bearing case: the template the app hands out, run through the
    // parser the app uses. A template that the parser refuses is the failure
    // this whole task exists to prevent.
    const { rows, skipped } = parsePlayerCsv(CSV_TEMPLATE);
    expect(skipped).toEqual([]);
    // Line numbers are 1-based and name the data row, not the heading — which
    // is also the check that the heading was read as a heading.
    expect(summary(rows)).toEqual([
      { line: 2, name: "Example Player 1", discipline: "futsal", strength: 4 },
      { line: 3, name: "Example Player 2, delete me", discipline: "mlbb", strength: 3 },
    ]);
  });

  it("becomes players with nothing skipped, because the second parse is where a discipline is refused", () => {
    // `parsePlayerCsv` lower-cases the discipline and does not know the catalog;
    // `csvRowsToPlayers` is what refuses a discipline nothing matches. A
    // template whose example row named a sport that does not exist would parse
    // perfectly here and then hand the user a skipped line on their first
    // import, which is the same lost-player failure wearing a different hat.
    const players = importedPlayers();
    expect(players.map((p) => p.name)).toEqual(["Example Player 1", "Example Player 2, delete me"]);
    expect(players.map((p) => p.communityId)).toEqual(["c1", "c1"]);
    expect(players.map((p) => p.capabilities[0].disciplineId)).toEqual(["futsal", "mlbb"]);
  });

  it("carries each example's strength through to the ratings it came from", () => {
    const players = importedPlayers();
    // One strength per capability, spread over that discipline's attributes:
    // a set, so the assertion survives a seed discipline gaining an attribute.
    expect(new Set(Object.values(players[0].capabilities[0].attributeRatings))).toEqual(new Set([4]));
    expect(new Set(Object.values(players[1].capabilities[0].attributeRatings))).toEqual(new Set([3]));
    // Fails if the strength column stops being read, is clamped, or is applied
    // to the wrong attribute set.
  });

  it("names every example so that a leftover row cannot pass for a person", () => {
    // The ghost guard. The app has no way to tell an example from a real entry
    // — there is no example column, and adding one would mean changing a parser
    // this phase does not own — so the only place the marker can live is the
    // name. A realistic name here is a roster with a ghost in it.
    const { rows } = parsePlayerCsv(CSV_TEMPLATE);
    for (const row of rows) expect(row.name).toMatch(/^Example Player \d/);
    // Fails the day someone swaps "Example Player 1" for "Andi", which is the
    // exact edit the brief suggested and the one this assertion exists to stop.
  });

  it("shows the quoted form in its second row, and the unquoted form is refused", () => {
    const rows = CSV_TEMPLATE.split("\n");
    expect(rows[2].startsWith('"')).toBe(true);
    // The comma comes back as data rather than as a column break.
    expect(parsePlayerCsv(CSV_TEMPLATE).rows[1].name).toContain(",");
    // And the same row without the quotes is one skip, which is why the
    // quoting is in the file and not only in the app's hint: a user editing
    // the file never sees the hint.
    expect(parsePlayerCsv("Example Player 2, delete me,mlbb,3").skipped).toHaveLength(1);
  });

  it("names only disciplines the seed catalog has", () => {
    const short = SEED_DISCIPLINES.map((d) => d.shortName.toLowerCase());
    const { rows } = parsePlayerCsv(CSV_TEMPLATE);
    for (const row of rows) expect(short).toContain(row.discipline);
    // Fails if an example row is pointed at a sport with no discipline record.
  });

  it("has no line the parser would report as skipped", () => {
    // The negative space, stated on its own: the template's only failure mode
    // worth shipping is one the user typed, so the file as handed over has
    // none. This is the assertion that would catch a future "let me add a
    // comment line explaining the columns" edit.
    expect(parsePlayerCsv(CSV_TEMPLATE).skipped).toEqual([]);
  });
});

describe("CSV_TEMPLATE_FILE_NAME", () => {
  it("is a .csv that says it is a template", () => {
    expect(CSV_TEMPLATE_FILE_NAME.endsWith(".csv")).toBe(true);
    expect(CSV_TEMPLATE_FILE_NAME).toContain("template");
    // Fails if it is renamed to `players.csv` — after which a user with a
    // filled-in file and a blank one in the same folder has nothing in the
    // name to tell them apart.
  });

  it("carries the product prefix the backup export uses, so the two sort together", () => {
    expect(CSV_TEMPLATE_FILE_NAME.startsWith("comp3tive-")).toBe(true);
    // Fails if it drops the prefix or grows a date. A date is a claim that the
    // file's contents are new, and this file's bytes never change.
  });
});
