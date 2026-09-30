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
 * repeated here; the template's own bytes are `csv-template.test.ts`'s, which
 * also owns the proof that a comma has to be quoted. What is new in this file
 * is the *catalog-derived* list: it is data, not a literal, and it is the one
 * piece of the hint that could name a string the parser does not accept, or
 * split one string into two by the punctuation it joins on.
 */

const WORKFLOW_COPY =
  "Fill the template in and save it, then press Import players and pick that file. Nothing here is read until you choose it.";
const COLUMNS_COPY =
  "CSV columns, in this order: name, discipline, strength. Any value with a comma in it goes in quotes. The last example row in the template shows one in the name column.";
const STRENGTH_COPY = "Strength is a number from 1 to 5. Leave it blank and it is read as 3; text there skips the row.";

/** Every `.import-hint` paragraph, as one line of text each. */
const hintTexts = (html: string): string[] =>
  [...html.matchAll(/<p class="import-hint">([\s\S]*?)<\/p>/g)].map((m) =>
    m[1].replace(/\s+/g, " ").replaceAll("&#x27;", "'").trim(),
  );

/** Every discipline the hint offers, as one line of text each. */
const hintList = (html: string): string[] =>
  [...html.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => m[1].replace(/\s+/g, " ").trim());

/**
 * Assert that a CSV naming this discipline in this spelling imports, all the way
 * to a player. It asserts rather than returns: a helper that answered a
 * question is a helper that can answer it wrongly without anybody noticing, and
 * this one did — `csvRowsToPlayers([]).skipped` is empty, so a discipline
 * string that had quietly stopped becoming a row at all came back `true` and the
 * sentence went on promising rows the app refuses. Every step is checked, so the
 * only way out is a player.
 */
const accepted = (discipline: string, catalog: Discipline[] = SEED_DISCIPLINES): void => {
  // A value carrying a comma is quoted first, which is what the copy tells a
  // person to do. Unquoted it splits the record, the strength column stops being
  // a number, and the row is refused before the catalog is ever consulted — so
  // building the CSV any other way would be testing a row the app never sees.
  const value = discipline.includes(",") ? `"${discipline}"` : discipline;
  const { rows, skipped: unparsed } = parsePlayerCsv(`Ada,${value},3`);
  expect(unparsed).toEqual([]);
  expect(rows).toHaveLength(1);
  const { players, skipped } = csvRowsToPlayers(rows, catalog, "c1");
  expect(skipped).toEqual([]);
  expect(players).toHaveLength(1);
  expect(players[0].capabilities[0].disciplineId).toBe(
    catalog.find((d) => spellings(d).some((s) => s.toLowerCase() === discipline.toLowerCase()))?.id,
  );
};

/** Both spellings the parser matches a discipline on, in the order it checks them. */
const spellings = (d: Discipline): string[] =>
  d.name.toLowerCase() === d.shortName.toLowerCase() ? [d.shortName] : [d.shortName, d.name];

describe("the roster's CSV column hint", () => {
  it("states the workflow, the columns and the strength rule, in that order", () => {
    // Fails on any copy change, which is the point: these sentences are the
    // app's statement of the file's contract, and a rewrite should be a decision
    // somebody re-argues rather than a diff. The fourth is the lead-in to the
    // list below it rather than the list itself, because the list is data and
    // has its own case.
    expect(hintTexts(renderRoster({ disciplines: SEED_DISCIPLINES }))).toEqual([
      WORKFLOW_COPY,
      COLUMNS_COPY,
      STRENGTH_COPY,
      "Discipline must be one of:",
    ]);
  });

  it("offers one item per discipline, and only spellings the parser accepts", () => {
    // The load-bearing case for the derived list. Every string the screen puts
    // in front of a user has to be a string that imports: `csvRowsToPlayers`
    // compares a row's lower-cased discipline against each discipline's short
    // name and full name and refuses anything else, so a list that named only
    // the short names would understate what works, and a list that named
    // anything else would promise a row the app will skip.
    const html = renderRoster({ disciplines: SEED_DISCIPLINES });
    expect(hintList(html)).toEqual(["Futsal", "MLBB (Mobile Legends)", "Badminton"]);
    for (const d of SEED_DISCIPLINES) {
      for (const spelling of spellings(d)) {
        expect(hintList(html).join(" ")).toContain(spelling);
        accepted(spelling);
      }
    }
  });

  it("keeps a name with a comma in it in one item, because a list is not a sentence", () => {
    // The punctuation defect. `DisciplineEditModal` takes free text, so a
    // discipline can be called "Volleyball, Indoor" — and a comma-joined
    // sentence would have read that as two sports, on the one sentence on this
    // screen that claims to be exhaustive. Nothing in the seed catalog can
    // trigger it, which is why it is constructed here.
    const commaNamed: Discipline = { ...BADMINTON_DISCIPLINE, id: "indoor", name: "Volleyball, Indoor", shortName: "Indoor", builtIn: false };
    const catalog = [...SEED_DISCIPLINES, commaNamed];
    const items = hintList(renderRoster({ disciplines: catalog }));
    expect(items).toContain("Indoor (Volleyball, Indoor)");
    // One element, whatever it contains: the sentence around it is
    // "Discipline must be one of:" and the items are a list, so the count is the
    // count of sports and not the count of commas.
    expect(items).toHaveLength(catalog.length);
    // And the name is still exactly the string the parser matches on — once it
    // is quoted, which is what the columns sentence now says about *any* value
    // rather than about the name column. Writing this case is what found that
    // gap: unquoted, `"Ada,Volleyball, Indoor,3"` is four fields and the row is
    // refused before the catalog is consulted, so a hint that showed the sport
    // and only explained quoting for names would have offered a value the app
    // cannot read. `accepted` quotes it, which is the copy's instruction.
    accepted("Volleyball, Indoor", catalog);
    expect(parsePlayerCsv("Ada,Volleyball, Indoor,3").skipped).toHaveLength(1);
  });

  it("names a discipline the catalog has just gained, with no copy edit", () => {
    // The maintenance cost of naming disciplines by hand, and its removal: the
    // list is derived from the `disciplines` prop, so the fourth sport is in it
    // the moment the fourth sport exists. A hand-written list would be a refusal
    // the app could have avoided, and the only evidence would be a skip in a
    // user's import.
    const volleyball: Discipline = { ...BADMINTON_DISCIPLINE, id: "volley", name: "Volleyball", shortName: "Volley", builtIn: false };
    const catalog = [...SEED_DISCIPLINES, volleyball];
    const items = hintList(renderRoster({ disciplines: catalog }));
    expect(items).toEqual(["Futsal", "MLBB (Mobile Legends)", "Badminton", "Volley (Volleyball)"]);
    // Both spellings the screen now offers, not just the full name: a derivation
    // that printed the long name alone would leave the short one unproven here
    // and only discover it on the next custom sport somebody adds.
    for (const spelling of spellings(volleyball)) accepted(spelling, catalog);
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

  it("points at a row that is actually quoted", () => {
    // The copy says "the last example row", so the row is derived here the same
    // way the copy names it: from the end of the file, by the same words. The
    // previous version of this case indexed `split("\n")[2]` and called the
    // variable `secondDataRow` while the sentence said "second row", which is
    // how the two agreed about a row neither of them was reading — a spreadsheet
    // counts the heading as row 1, so "second row" was the unquoted example and
    // the sentence was pointing a reader at a row that demonstrated nothing.
    // Deriving both from the same end of the file is what stops that recurring.
    expect(COLUMNS_COPY).toContain("last example row");
    const lastExampleRow = CSV_TEMPLATE.trimEnd().split("\n").at(-1) ?? "";
    expect(lastExampleRow.startsWith('"')).toBe(true);
    // Fails if a line is ever appended below the example, which would leave the
    // sentence pointing at a row that is no longer the one showing the quoting.
    // What that row's quotes are *worth* is `csv-template.test.ts`'s case, which
    // also proves the unquoted spelling is refused; asserting it here as well
    // would have made this file's own header untrue.
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
