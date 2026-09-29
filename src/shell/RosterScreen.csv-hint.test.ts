import { describe, expect, it } from "vitest";
import { csvRowsToPlayers, parsePlayerCsv } from "../data/player-import";
import { CSV_TEMPLATE } from "../data/csv-template";
import { BADMINTON_DISCIPLINE, SEED_DISCIPLINES } from "../domain/seed";
import type { Discipline } from "../domain/types";
import { renderRoster } from "../test-support/renderRoster";

/**
 * The column hint, checked against the parser instead of against itself.
 *
 * The hint is the app's only statement of what a CSV must look like, and the
 * parser is the thing that decides. A sentence that the parser does not honour
 * is worse than no sentence: the user is told the app will accept something and
 * then watches a row refused. So each claim in the copy below is asserted here
 * as a fact about `parsePlayerCsv` and `csvRowsToPlayers`, which means a change
 * to either one that invalidates the copy fails this file rather than waiting
 * to be found by a user.
 *
 * The parser's own mechanics are `player-import.test.ts`'s business and are not
 * repeated here. What is new in this file is the *catalog-derived* list: it is
 * data, not a literal, and it is the one piece of the hint that could name a
 * string the parser does not accept.
 */

const WORKFLOW_COPY =
  "Fill the template in and save it, then press Import players and pick that file. Nothing here is read until you choose it.";
const COLUMNS_COPY =
  "CSV columns, in this order: name, discipline, strength. A name with a comma in it goes in quotes — the template's second row shows one.";
const STRENGTH_COPY = "Strength is a number from 1 to 5. Leave it blank and it is read as 3; text there skips the row.";

/** Every `.import-hint` paragraph, as one line of text each. */
const hintTexts = (html: string): string[] =>
  [...html.matchAll(/<p class="import-hint">([\s\S]*?)<\/p>/g)].map((m) =>
    m[1].replace(/\s+/g, " ").replaceAll("&#x27;", "'").trim(),
  );

/** Does a CSV naming this discipline in this spelling import without a skip? */
const accepted = (discipline: string, catalog: Discipline[] = SEED_DISCIPLINES): boolean => {
  const { rows } = parsePlayerCsv(`Ada,${discipline},3`);
  return csvRowsToPlayers(rows, catalog, "c1").skipped.length === 0;
};

/** Both spellings the parser matches a discipline on, in the order it checks them. */
const spellings = (d: Discipline): string[] =>
  d.name.toLowerCase() === d.shortName.toLowerCase() ? [d.shortName] : [d.shortName, d.name];

describe("the roster's CSV column hint", () => {
  it("states the workflow, the columns and the strength rule, in that order", () => {
    // Fails on any copy change, which is the point: these three sentences are
    // the app's statement of the file's contract, and a rewrite should be a
    // decision somebody re-argues rather than a diff.
    expect(hintTexts(renderRoster({ disciplines: SEED_DISCIPLINES }))).toEqual([
      WORKFLOW_COPY,
      COLUMNS_COPY,
      STRENGTH_COPY,
      "Discipline must be one of: Futsal, MLBB (Mobile Legends), Badminton.",
    ]);
  });

  it("offers only discipline spellings the parser accepts", () => {
    // The load-bearing case for the derived list. Every string the sentence puts
    // in front of a user has to be a string that imports: `csvRowsToPlayers`
    // compares a row's lower-cased discipline against each discipline's short
    // name and full name and refuses anything else, so a list that named only
    // the short names would be understating what works, and a list that named
    // anything else would be promising a row the app will skip.
    const html = renderRoster({ disciplines: SEED_DISCIPLINES });
    for (const d of SEED_DISCIPLINES) {
      for (const spelling of spellings(d)) {
        expect(hintTexts(html).join(" ")).toContain(spelling);
        expect(accepted(spelling)).toBe(true);
      }
    }
  });

  it("names a discipline the catalog has just gained, with no copy edit", () => {
    // The maintenance cost of naming disciplines by hand, and its removal: the
    // sentence is derived from the `disciplines` prop, so the fourth sport is in
    // it the moment the fourth sport exists. A hand-written list would be a
    // refusal the app could have avoided, and the only evidence would be a skip
    // in a user's import.
    const volleyball: Discipline = { ...BADMINTON_DISCIPLINE, id: "volley", name: "Volleyball", shortName: "Volley", builtIn: false };
    const hints = hintTexts(renderRoster({ disciplines: [...SEED_DISCIPLINES, volleyball] }));
    expect(hints).toContain("Discipline must be one of: Futsal, MLBB (Mobile Legends), Badminton, Volley (Volleyball).");
    expect(accepted("Volleyball", [...SEED_DISCIPLINES, volleyball])).toBe(true);
  });

  it("says the blank strength is read as 3, which is what the parser does", () => {
    const { rows, skipped } = parsePlayerCsv("name,discipline,strength\nAndi,futsal,");
    expect(skipped).toEqual([]);
    expect(rows[0].strength).toBe(3);
    // Fails if the parser ever stops defaulting an empty cell — at which point
    // this sentence is a promise the app breaks on every roster that leaves a
    // strength blank, which is every roster an organizer is likely to write.
  });

  it("says text in the strength column skips the row, which is what the parser does", () => {
    const { rows, skipped } = parsePlayerCsv("name,discipline,strength\nAndi,futsal,very strong");
    expect(rows).toEqual([]);
    expect(skipped).toHaveLength(1);
    expect(skipped[0].line).toBe(2);
    // Fails if a future "friendlier" default turns a non-numeric strength into a
    // 3 — the kind of change that looks like an improvement and silently gives
    // every mistyped row the same rating.
  });

  it("keeps both ends of the range it names", () => {
    for (const strength of [1, 5]) {
      const { rows } = parsePlayerCsv(`name,discipline,strength\nAndi,futsal,${strength}`);
      expect(csvRowsToPlayers(rows, SEED_DISCIPLINES, "c1").players[0].capabilities[0].attributeRatings.technical).toBe(strength);
    }
    // Fails if the parser stops accepting 1 or stops accepting 5, i.e. if the
    // stated range ever became narrower than the range that works.
  });

  it("points at a second row that is actually quoted", () => {
    expect(COLUMNS_COPY).toContain("second row");
    const secondDataRow = CSV_TEMPLATE.split("\n")[2];
    expect(secondDataRow.startsWith('"')).toBe(true);
    // And the quotes are load-bearing, which is why the sentence points at the
    // file rather than only describing the rule in prose: the same row without
    // them is a refused row.
    expect(parsePlayerCsv(secondDataRow.replaceAll('"', "")).skipped).toHaveLength(1);
    // Fails if a row is ever added above the example — the copy's "second row"
    // would then be pointing at a row that demonstrates nothing.
  });

  it("appears on a community's roster and on no other screen state", () => {
    expect(hintTexts(renderRoster({ disciplines: SEED_DISCIPLINES })).length).toBeGreaterThan(0);
    // Without a community there is no roster, no file to describe, and no
    // import control: the hint would be instructions for a control that is not
    // on the page.
    expect(hintTexts(renderRoster({ activeCommunity: null }))).toEqual([]);
  });

  it("names the control that reads the file, by the label that control carries", () => {
    const html = renderRoster({ disciplines: SEED_DISCIPLINES });
    // The two halves of the round trip, in the user's words: the sentence tells
    // them to use Import players, so the button has to say exactly that.
    expect(WORKFLOW_COPY).toContain("Import players");
    expect(html).toContain(">Import players</button>");
    // Fails if either side is renamed alone — which is how copy drifts away
    // from the screen it is talking about.
  });

  it("reaches the file only through a control the user operates", () => {
    const html = renderRoster({ disciplines: SEED_DISCIPLINES });
    // Downloading hands the browser a blob URL and the app nothing: there is one
    // file input, it is the one `importFile` hangs off, and picking from it is a
    // user gesture. So there is no path by which the file the app just wrote
    // comes back into it on its own, and the workflow sentence says so.
    expect([...html.matchAll(/<input[^>]*type="file"/g)]).toHaveLength(1);
    // Matched as a tag rather than as an exact string, so the assertion is
    // about the control and not about where React happens to put `type`.
    const button = /<button[^>]*data-testid="download-csv-template"[^>]*>/.exec(html);
    expect(button?.[0]).toContain('type="button"');
    // Fails if a second file input appears — which would be a second, unnamed
    // door into the importer — or if the download button stops being a plain
    // button and starts being a submit.
  });
});
