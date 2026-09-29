import { describe, expect, it } from "vitest";
import { csvRowsToPlayers, parsePlayerCsv, type ImportSkip } from "../data/player-import";
import { SEED_DISCIPLINES } from "../domain/seed";
import type { Discipline, Player } from "../domain/types";
import { renderRoster } from "../test-support/renderRoster";
import { CSV_TEMPLATE } from "../data/csv-template";
import { isTemplateExampleRow, TEMPLATE_EXAMPLE_REASON_MARKER, type ImportReport } from "./usePlayerImport";

/**
 * The import report, checked against the parser and against the copy.
 *
 * The panel is a reading of `ImportReport`, and the thing it is a reading *of*
 * is a file the user has in front of them. So nothing here is asserted against
 * the panel's own strings alone: every claim the panel makes about a row is
 * produced by driving `parsePlayerCsv` and `csvRowsToPlayers` — the two shipped
 * parsers — and checking the report says the same thing they do. A parser that
 * changes its reasons, or grows a sixth, fails this file rather than leaving a
 * group quietly empty on a user's screen.
 *
 * **What `renderToStaticMarkup` cannot see, and what that costs here.** It runs
 * no effects and no event handlers, so this file proves the panel *renders* a
 * given report and nothing about how one comes to exist. The three claims that
 * depend on the hook — that a CSV import sets the report, that a second import
 * replaces it, and that switching community clears it — are proved in
 * `e2e/tests/roster/fast-entry.spec.ts` against a real browser, where the file
 * input, the state and the re-render all happen. A report that renders
 * correctly here and is never set is still a broken report, and nothing in this
 * file could tell the difference.
 *
 * `player-import.test.ts` owns the parsers' own mechanics and
 * `RosterScreen.csv-hint.test.ts` owns the standing hint; neither is repeated
 * here. What is new in this file is the *grouping*, the headline, and the two
 * decisions this task had to make: which rows are named by a line number, and
 * what the panel says about a column the parser never read.
 */

/** The catalog most of these cases import against. */
const CATALOG: Discipline[] = SEED_DISCIPLINES;

/** A report as the hook would hand it over, with its skips in line order. */
const report = (imported: number, skipped: ImportSkip[]): ImportReport => ({ imported, skipped });

/** How many players a report says landed. */
const imported = (r: ImportReport): number => r.imported;

/**
 * The page's prose, with markup and React's entity escaping taken off.
 *
 * `renderToStaticMarkup` escapes an apostrophe as `&#x27;` and an ampersand as
 * `&amp;`, so an assertion written against the copy as it is *written* would
 * fail on a page that renders it correctly. Every text assertion here goes
 * through this, and the copy constants are compared as prose rather than as
 * HTML.
 */
const text = (html: string): string =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

/** The one line at the top of the panel, as prose. */
const headline = (html: string): string => {
  const found = /<p class="import-report-headline">([\s\S]*?)<\/p>/.exec(html);
  if (found === null) throw new Error("the report did not render");
  return text(found[1]);
};

/** Every group title in reading order, with its row count. */
const groupTitles = (html: string): string[] =>
  [...html.matchAll(/<h3 class="import-report-group-title">([\s\S]*?)<\/h3>/g)].map((m) => text(m[1]));

/** The group a row landed in, by its title; "" when it landed in none. */
const groupOf = (html: string, needle: string): string =>
  groupTitles(html).find((title) => title.includes(needle)) ?? "";

/** Every `.import-skipped-row`, as `Line N: reason`. */
const skippedRows = (html: string): string[] =>
  [...html.matchAll(/<li class="import-skipped-row">([\s\S]*?)<\/li>/g)].map((m) => text(m[1]));

/**
 * The rows of one group, in the order that group rendered them.
 *
 * Split on the group wrapper rather than on the whole page, because "the rows
 * are in line order" is a claim about *a group*: across the panel the order is
 * the group's, by design, and asserting a global line order here would be
 * asserting the thing this task deliberately did not do.
 */
const rowsInGroup = (html: string, needle: string): string[] => {
  const chunk = html
    .split('<div class="import-report-group">')
    .slice(1)
    .find((part) => part.includes(needle));
  if (chunk === undefined) throw new Error(`no group titled ${needle}`);
  return [...chunk.matchAll(/<li class="import-skipped-row">([\s\S]*?)<\/li>/g)].map((m) => text(m[1]));
};

/** One player, so the roster list renders rather than the empty state. */
const ONE_PLAYER: Player = {
  id: "p1",
  communityId: "c1",
  name: "Andi",
  capabilities: [],
};

/**
 * Drive the shipped parsers over a CSV and return what the report would be
 * given, with the template's example rows held out exactly as the hook holds
 * them out — so these cases are an end-to-end reading of the real pipeline, not
 * a hand-written report.
 */
const throughTheParsers = (csv: string, catalog: Discipline[] = CATALOG): ImportReport => {
  const { rows, skipped: unparsed } = parsePlayerCsv(csv);
  const kept = rows.filter((r) => !isTemplateExampleRow(r.name));
  const examples: ImportSkip[] = rows
    .filter((r) => isTemplateExampleRow(r.name))
    .map((r) => ({
      line: r.line,
      reason: `"${r.name}" — this app did not import it: the name starts with ${TEMPLATE_EXAMPLE_REASON_MARKER}.`,
    }));
  const { players, skipped: unresolved } = csvRowsToPlayers(kept, catalog, "c1");
  const skipped = [...unparsed, ...unresolved, ...examples].sort((a, b) => a.line - b.line);
  return report(players.length, skipped);
};

/** Run a CSV through the parsers and render the panel it would produce. */
const panelFor = (csv: string, catalog: Discipline[] = CATALOG): string =>
  renderRoster({ disciplines: catalog, lastReport: throughTheParsers(csv, catalog) });

describe("the import report's headline", () => {
  it("names the app, the count and the rows that were not imported, in one line", () => {
    // The three failures this sentence has to avoid, all at once. Crediting
    // nobody ("Imported 12 players") leaves a 200-row file with 3 skips reading
    // as a clean run; calling the 3 "errors" makes three spreadsheet cells sound
    // like a broken file. The line is a fact, attributed, with the shortfall
    // named in the same breath.
    const html = renderRoster({
      disciplines: CATALOG,
      lastReport: report(12, [
        { line: 4, reason: 'Unknown discipline "quidditch".' },
        { line: 9, reason: 'Strength "very strong" is not a number.' },
        { line: 11, reason: 'Unknown discipline "chess".' },
      ]),
    });
    expect(headline(html)).toBe(
      "This app imported 12 of the 15 player rows in the file. The other 3 were not imported, and are grouped below by what to change.",
    );
  });

  it("does not say the rows failed, refused, or were errors", () => {
    // The verbs are the argument. "Failed" and "refused" are verdicts on the
    // user's file, and the same sentence has to cover a row the app could not
    // parse and a row it chose to leave out — only the groups can tell those
    // apart. Fails on any of them being reintroduced.
    const html = renderRoster({ disciplines: CATALOG, lastReport: report(1, [{ line: 3, reason: "x" }]) });
    for (const word of ["failed", "refused", "error", "invalid", "problem", "wrong", "corrupt"]) {
      expect(headline(html).toLowerCase()).not.toContain(word);
    }
  });

  it("counts one player row in the singular", () => {
    // Fails if the plural is written out rather than derived: "1 player rows" is
    // the first thing a one-row file would show, and a one-row file is what a
    // first-time organizer writes.
    expect(headline(renderRoster({ disciplines: CATALOG, lastReport: report(1, []) }))).toBe(
      "This app imported all 1 player row in the file.",
    );
  });

  it("offers no next action on a clean import, because there is nothing to do", () => {
    // "There is nothing to fix" is itself a claim: it says the file is
    // complete, and a file whose rows carry a fourth column *is* incomplete to
    // this app. So the line stops at the fact and the absence of a next action
    // is left as the absence. Fails if a reassurance is added back.
    expect(headline(renderRoster({ disciplines: CATALOG, lastReport: report(15, []) }))).toBe(
      "This app imported all 15 player rows in the file.",
    );
  });

  it("says a file with no rows in it had none, rather than that it failed", () => {
    // A heading-only or blank CSV. The hook's own error toast says "No players
    // imported", and there the "0" is the point; in the report, which sits
    // under a heading that already says what it is, a bare "0" reads as a defect
    // in the count rather than as the shape of the file.
    expect(headline(renderRoster({ disciplines: CATALOG, lastReport: report(0, []) }))).toBe(
      "This app found no player rows in the file.",
    );
  });

  it("does not blame the file when nothing at all could be read", () => {
    // Every row unreadable is a total failure, and the line has to say so
    // without the reader concluding their file is broken — the groups below name
    // the cause, and one of those causes may be an empty catalog rather than a
    // bad file.
    const html = panelFor(["name,discipline,strength", "Andi,quidditch,4", "Budi,chess,3", ""].join("\n"));
    expect(headline(html)).toBe(
      "This app imported no players. All 2 player rows in the file were not imported, and are grouped below by what to change.",
    );
  });
});

describe("the import report's groups", () => {
  it("puts each reason in the group whose fix is the user's next move", () => {
    // One file carrying one of every failure the parsers can produce, so the
    // grouping is read off real reasons rather than off literals. The order is
    // the argument: shape, then one cell, then a word measured against the
    // catalog, then the rows that need no fix.
    const csv = [
      "name,discipline,strength", //   line 1, heading
      "Andi,futsal,4", //                line 2, imports
      "Budi,quidditch,3", //              line 3, vocabulary
      ",badminton,3", //                  line 4, value — the name is empty
      "Dewi,futsal,strong", //            line 5, value — the strength is not a number
      "Eko,futsal,3,extra", //            line 6, four fields: imports
      "Example Player 1,mlbb,4", //       line 7, example
      "Fajar,badminton,3,notes", //       line 8, four fields: imports
      '"Gita,futsal,4', //                line 9, shape — the quote never closes
    ].join("\n");
    const html = panelFor(csv);
    expect(groupTitles(html)).toEqual([
      "Fix the shape of these rows · 1 row",
      "Correct what one cell says in these rows · 2 rows",
      "Spell the discipline as one this community has · 1 row",
      "Check these example-looking rows · 1 row",
    ]);
    // Nothing fell through, and nothing was invented: every row the parsers
    // skipped is on the page. The two four-field rows import, which is why the
    // closing note about the fourth column has to be there.
    // The unclosed quote is on the **last** line on purpose. A quote left open
    // in the middle of a file swallows the line after it into the broken
    // record — `parsePlayerCsv`'s documented trade, held down by its own test —
    // so a fixture that put one in the middle would be measuring that and not
    // the grouping. That is also why the "spans two lines" case below uses a
    // quote that *closes*: a closed quote is a record, not a defect.
    expect(skippedRows(html)).toHaveLength(5);
    expect(imported(throughTheParsers(csv))).toBe(3);
  });

  it("orders the groups by the scope of the fix, not by line or by spelling", () => {
    // The two orders this is not. **Chronological** — the parser's own output —
    // is what a flat list of skips gives a user who has more than one kind of
    // problem, and it is why the report groups at all. **Alphabetical** on the
    // reason text files "Expected 3 columns" under E and "The name column is
    // empty" under T, and would put "Unknown discipline" next to "Unclosed
    // quoted field" for sharing a first letter. Both are readable; neither tells
    // a user which fix to make first, and an outer fix can retire an inner one.
    const csv = [
      "name,discipline,strength", //   line 1
      "Andi,nope,4", //                 line 2, vocabulary — the earliest line
      "Budi,quidditch,3", //             line 3, vocabulary
      "Citra,futsal,strong", //          line 4, value — the latest line
    ].join("\n");
    // Line order would lead with the vocabulary group and alphabetical would
    // lead with "Correct what one cell says", so both are excluded.
    expect(groupTitles(panelFor(csv))).toEqual([
      "Correct what one cell says in these rows · 1 row",
      "Spell the discipline as one this community has · 2 rows",
    ]);
  });

  it("keeps the rows inside a group in line order", () => {
    // The chronology is not thrown away, it is moved: a group is a filter, and
    // what a user does with a filtered spreadsheet is walk it top to bottom.
    const csv = [
      "name,discipline,strength", //  line 1
      "Andi,nope,4", //                line 2
      "Budi,futsal,strong", //         line 3
      "Citra,nope,2", //               line 4
      "Dewi,futsal,weak", //           line 5
    ].join("\n");
    const html = panelFor(csv);
    // Four skips in two groups, and the two groups are interleaved in the file:
    // the *panel's* order is the group's, while the order *inside* each group is
    // the file's. Asserting the flattened page order would be asserting the
    // chronological report this task replaced.
    expect(skippedRows(html)).toEqual([
      'Line 3: Strength "strong" is not a number.',
      'Line 5: Strength "weak" is not a number.',
      'Line 2: Unknown discipline "nope".',
      'Line 4: Unknown discipline "nope".',
    ]);
    expect(rowsInGroup(html, "Correct what one cell says")).toEqual([
      'Line 3: Strength "strong" is not a number.',
      'Line 5: Strength "weak" is not a number.',
    ]);
    expect(rowsInGroup(html, "Spell the discipline")).toEqual([
      'Line 2: Unknown discipline "nope".',
      'Line 4: Unknown discipline "nope".',
    ]);
  });

  it("names a row by the line the user's spreadsheet shows", () => {
    // The whole of the row-identifier decision. `parsePlayerCsv` numbers a skip
    // by **physical line, 1-based, from the top of the file** — so the heading
    // is line 1, the first player is line 2, and those are the numbers a
    // spreadsheet puts in its own row gutter. The panel adds the one note a
    // reader needs, because the thing that genuinely differs is the reader's
    // numbering instinct, not the parser's.
    const html = panelFor(["name,discipline,strength", "Andi,nope,4", ""].join("\n"));
    expect(skippedRows(html)).toEqual(['Line 2: Unknown discipline "nope".']);
    expect(text(html)).toContain("Lines count the file as you saved it, heading included.");
    // Fails if the panel starts numbering rows itself — an array index, say —
    // which would put "Line 1" on the first data row and send the user to the
    // heading.
  });

  it("reports a row that spans two lines against the line it starts on", () => {
    // **The `line`-versus-spreadsheet-row hazard, pinned.** A quoted newline is
    // the one place a record and a line part company: the row occupies two
    // lines of the file and one row of the sheet. The report must name the line
    // the sheet shows the record *starting* on, and the record after it must
    // still be numbered by the file rather than by a running count of records —
    // which is what a user would be checking with their spreadsheet open.
    const csv = [
      "name,discipline,strength", //  line 1, heading
      '"Smith,', //                    line 2, a quoted value that opens
      'John",futsal,4', //              line 3, and closes on the next line
      "Budi,quidditch,3", //            line 4
    ].join("\n");
    expect(skippedRows(panelFor(csv))).toEqual(['Line 4: Unknown discipline "quidditch".']);
    // Four physical lines, three logical records, and the answer is 4 — the
    // number in the row gutter, not the record's ordinal. And the record that
    // spans two lines imported rather than being skipped, so the panel is not
    // reporting it at all.
    expect(imported(throughTheParsers(csv))).toBe(1);
  });

  it("does not name a player on a row, because the report cannot know one", () => {
    // `ImportSkip` is `{ line, reason }` and the reason carries no name, so a
    // panel that printed "Andi" beside a line number would be inventing it from
    // a position in an array — and on a file where an earlier row was dropped,
    // the name would be the *wrong* player's. The line is the only identifier
    // this report has, and it is the one a user can act on. The roster is
    // rendered with a player in it on purpose, so the one "Andi" on the page is
    // the one the roster put there.
    const html = renderRoster({
      disciplines: CATALOG,
      players: [ONE_PLAYER],
      visiblePlayers: [ONE_PLAYER],
      lastReport: report(0, [{ line: 2, reason: 'Strength "strong" is not a number.' }]),
    });
    expect(skippedRows(html)).toEqual(['Line 2: Strength "strong" is not a number.']);
    // The report panel itself, which is where a name would have to be invented.
    // Read from the panel rather than the whole page: the roster's own row may
    // name the player as often as its markup needs to — its button, its
    // checkbox and its name are three, and only the first two are about editing.
    const panel = html.match(/<section class="import-report"[\s\S]*?<\/section>/)?.[0] ?? "";
    expect(panel).not.toMatch(/Andi/);
  });

  it("groups a reason it has never seen under a floor, in full, rather than dropping it", () => {
    // The ungrouped group. Every reason the parsers can produce has a home
    // above — the exhaustiveness case below fails the day a sixth arrives — but
    // a report that silently dropped the one row it did not recognise would be
    // the exact defect this surface exists to end. It shows the raw reason, says
    // the app does not group it, and puts it last.
    const html = renderRoster({
      disciplines: CATALOG,
      lastReport: report(1, [
        { line: 2, reason: "The column separator is not a comma." },
        { line: 3, reason: 'Strength "x" is not a number.' },
      ]),
    });
    expect(groupTitles(html)).toEqual([
      "Correct what one cell says in these rows · 1 row",
      "Rows this app did not import · 1 row",
    ]);
    expect(skippedRows(html)).toContain("Line 2: The column separator is not a comma.");
    expect(text(html)).toContain("This app does not group this reason yet");
  });

  it("gives every reason in a group the fix that reason actually needs", () => {
    // **Two notes that were wrong, found by reading them against their own
    // reasons.** The shape group's note explained the column count and then
    // told every reader in it to put a comma inside quotes — which is advice
    // for a row with too many columns and *the opposite* of the advice for a
    // row whose quote is never closed: that user already quoted it. The value
    // group's note said one cell "holds something this app cannot read", which
    // is false for `The name column is empty.` — the cell holds nothing, and the
    // user is sent hunting for content in a cell they deliberately left blank.
    // And the headline promises rows are "grouped below by what to change", so a
    // group whose note changes nothing is a broken promise. Each pair below is
    // asserted on its own two reasons.
    const unclosed = text(panelFor('name,discipline,strength\n"Andi,futsal,4'));
    expect(unclosed).toContain("A row whose quote is opened and never closed is read together with the line after it");
    const shortRow = text(panelFor("name,discipline,strength\nAndi,futsal"));
    expect(shortRow).toContain("a comma inside any value has to be inside quotes");
    // The fix for an unclosed quote is to close or remove it, not to add quotes
    // the row already has.
    expect(unclosed).toContain("closed or taken out");

    const emptyName = text(panelFor("name,discipline,strength\n,futsal,4"));
    expect(emptyName).toContain("a row with an empty one has no player in it");
    expect(emptyName).toContain("Put a name in the name column");
    const badStrength = text(panelFor("name,discipline,strength\nAndi,futsal,strong"));
    expect(badStrength).toContain("a number from 1 to 5 in the strength column");
    // The two value reasons get two different halves of one sentence, so neither
    // is sent after the other's fix. Fails if either half is dropped: a note
    // that only mentions the name leaves the mistyped strength with no
    // instruction at all, and the other way round.
    expect(emptyName).toContain("or leave that blank and it is read as 3");
    expect(badStrength).toContain("or leave that blank and it is read as 3");
  });

  it("shows a row the app failed to save, in the floor, with its own line", () => {
    // **The half-failed write.** `savePlayer` can refuse, and when it did the
    // loop aborted with the report still unset: a roster the file had partly
    // changed, a red toast, and no verdict. The hook now counts what really
    // landed and pushes one skip per row it never wrote, carrying that row's
    // line. The screen's half of the job is to show it, in the floor, because a
    // row the app could not *store* is not any of the four causes above and has
    // no file-side fix to offer.
    const html = renderRoster({
      disciplines: CATALOG,
      lastReport: report(2, [
        { line: 2, reason: "This app did not save this player, so the row was not imported." },
        { line: 5, reason: "This app did not save this player, so the row was not imported." },
        { line: 7, reason: 'Strength "x" is not a number.' },
      ]),
    });
    expect(groupTitles(html)).toEqual([
      "Correct what one cell says in these rows · 1 row",
      "Rows this app did not import · 2 rows",
    ]);
    expect(skippedRows(html)).toEqual([
      'Line 7: Strength "x" is not a number.',
      "Line 2: This app did not save this player, so the row was not imported.",
      "Line 5: This app did not save this player, so the row was not imported.",
    ]);
    // The floor's note must not claim the parser wrote it. A row the app failed
    // to store was written by the app, and "as the parser wrote it" would be a
    // false attribution on the one row that had nothing wrong with the file.
    expect(text(html)).toContain("so the rows are shown as they were recorded");
    expect(text(html)).not.toContain("as the parser wrote it");
    // And the arithmetic still holds: two landed, three did not, five rows.
    expect(headline(html)).toBe(
      "This app imported 2 of the 5 player rows in the file. The other 3 were not imported, and are grouped below by what to change.",
    );
  });

  it("gives the vocabulary group the list that is actually on the page", () => {
    // The group note points up at the discipline list rendered by the same
    // screen, so it is a pointer and it has to be a pointer to something. With
    // an empty catalog the list is not rendered *and* every row fails the same
    // way, which is a total failure the report has to name rather than send the
    // user to look for a list that is not there.
    const csv = ["name,discipline,strength", "Andi,quidditch,4", ""].join("\n");
    expect(text(panelFor(csv, []))).toContain(
      "This community has no disciplines yet, so no row can name one. Add a sport on the Disciplines screen, then import the file again.",
    );
    expect(text(panelFor(csv))).toContain("The list above is every discipline in this community.");
  });
});

describe("the import report's two notes", () => {
  it("says the fourth column was not imported, in the past tense and conditionally", () => {
    // H2. `parsePlayerCsv` checks `fields.length` only for `< 3`, so a fourth
    // column is dropped with no skip recorded and the user never learns. The
    // note is the only place they can learn it, so it has to be true — and it is
    // checked twice: that it says what it must, and that it does not say the
    // things it must not.
    const clean = panelFor(["name,discipline,strength", "Andi,futsal,4", ""].join("\n"));
    expect(text(clean)).not.toContain("first three columns");

    const withSkips = text(panelFor(["name,discipline,strength", "Andi,nope,4", ""].join("\n")));
    expect(withSkips).toContain(
      "Only a row's first three columns are read. If your file has a fourth column, that column was not imported.",
    );
    // The conditional is load-bearing: a flat "a fourth column was not imported"
    // asserts the file has one, and a user with three columns would go looking
    // for a column that is not there. The past tense is load-bearing too:
    // "is ignored" is a claim about code this task may not change, and a
    // promise about a future parse. Fails on any of the promise tenses.
    for (const promise of ["will be", "will not be", "is ignored", "will ignore", "will always", "cannot be imported"]) {
      expect(withSkips).not.toContain(promise);
    }
  });

  it("is held to the parser: a fourth column really is dropped, with no skip", () => {
    // The note is a claim about `parsePlayerCsv`, and this is the assertion that
    // keeps it one. Fails if the parser ever reads a fourth column — at which
    // point the note becomes a lie and this file is what says so.
    const { rows, skipped } = parsePlayerCsv("name,discipline,strength\nAndi,futsal,4,andi@example.com");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ line: 2, name: "Andi", discipline: "futsal", strength: 4 });
    expect(skipped).toEqual([]);
    // And the app therefore cannot see it: `ImportSkip` is per *row*, and a row
    // that imported cleanly has no skip to attach the fact to. That is why the
    // note is a standing conditional rather than a line of its own.
  });

  it("says nothing extra when there is nothing to report", () => {
    // The cost of the conditional note, recorded and tested: a clean import
    // shows one sentence. A standing warning about a column most files do not
    // have is how a real note becomes noise people learn to skip.
    const html = panelFor(["name,discipline,strength", "Andi,futsal,4", "Budi,mlbb,3", ""].join("\n"));
    expect(headline(html)).toBe("This app imported all 2 player rows in the file.");
    expect(text(html)).not.toContain("first three columns");
    expect(html).not.toContain("import-skipped");
  });
});

describe("the import report's surface", () => {
  it("is a block on the page, not a dialog over it", () => {
    // The choice, asserted structurally so it cannot be undone by a wrapper: a
    // modal covers the roster, and the roster is the report's evidence — "Andi
    // is on the list and Budi is not" is how a user checks the panel is true.
    // Fails if the report is wrapped in a dialog, or moved above the roster
    // into the chrome, where the two lists would be separated by the filters
    // and a user could not read them as one answer.
    const html = renderRoster({
      disciplines: CATALOG,
      players: [ONE_PLAYER],
      visiblePlayers: [ONE_PLAYER],
      lastReport: report(1, [{ line: 2, reason: 'Unknown discipline "nope".' }]),
    });
    expect(html).toContain('class="import-report"');
    expect(html).not.toContain('role="dialog"');
    expect(html.indexOf('class="import-report"')).toBeGreaterThan(-1);
    expect(html.indexOf('class="roster"')).toBeGreaterThan(html.indexOf('class="import-report"'));
  });

  it("is titled as the most recent import, because the next one replaces it", () => {
    // **The replacement rule, in the one place a user can see it.** The hook
    // sets `lastReport` on every CSV import, so a second file's verdict is the
    // only one on the page. `ImportReport` carries no file name, so two stacked
    // reports would be two lists of line numbers with nothing to say which file
    // a line came from — and a stale report is a small lie, while two of them
    // are a small lie with a lookup table. The heading is what makes the
    // replacement true instead of merely convenient: the panel's claim is about
    // *the most recent* import, so it is never claiming to be about the one
    // before it. (That a second import really does replace it is the hook's
    // behaviour, and it is proved in the browser spec, not here.)
    const html = renderRoster({ disciplines: CATALOG, lastReport: report(1, []) });
    expect(text(html)).toContain("Most recent CSV import");
    expect(html).toContain('aria-label="Most recent CSV import"');
  });

  it("is not on the page before an import, and not on a screen with no community", () => {
    // Two absences. Before the first import there is no report, and an empty
    // panel would be a status the user cannot act on. With no community there is
    // no roster, no import control and no file — the same rule the hint follows,
    // and the same one `RosterScreen.csv-hint.test.ts` pins for the hint.
    expect(renderRoster({ disciplines: CATALOG, lastReport: null })).not.toContain("import-report");
    expect(renderRoster({ activeCommunity: null, lastReport: report(1, []) })).not.toContain("import-report");
  });

  it("does not touch the standing hint, which is a different document", () => {
    // The hint is what a user reads *before* choosing a file; the report is what
    // they read after. Merging them would make the reference copy an event, and
    // `RosterScreen.csv-hint.test.ts` holds the hint to four paragraphs and a
    // list. Fails if the report starts writing into `.import-hint`.
    const html = panelFor(["name,discipline,strength", "Andi,nope,4", ""].join("\n"));
    expect([...html.matchAll(/<p class="import-hint">/g)]).toHaveLength(4);
  });
});

describe("the template's example rows", () => {
  it("catches every example row the shipped template contains", () => {
    // H1, decided as **surfacing rather than dropping**, and this is the case
    // that makes the two ends agree. `CSV_TEMPLATE` is a file this phase may
    // not edit and the prefix is a string this task owns; the tie between them
    // is this test, so a rename on either side fails here rather than leaving a
    // ghost on somebody's roster.
    const { rows, skipped } = parsePlayerCsv(CSV_TEMPLATE);
    // The template's own words, not the detector's: two example rows, and a
    // heading that is not a player.
    expect(rows.map((r) => r.name)).toEqual(["Example Player 1", "Example Player 2, delete me"]);
    expect(rows.map((r) => r.line)).toEqual([2, 3]);
    expect(skipped).toEqual([]);
    for (const row of rows) expect(isTemplateExampleRow(row.name)).toBe(true);
  });

  it("does not mistake a real name for an example", () => {
    // The false positive this rule is allowed to have, and the test that keeps
    // it to names nobody would use. A detection rule that reads "a player whose
    // name starts with Example Player is not a player" is a rule about a word,
    // which is exactly why it is a sentence in a report and not a filter.
    for (const name of ["Andi", "Example", "Exemplary Player", "The Example Player 3", "Ana", "", "  "]) {
      expect(isTemplateExampleRow(name)).toBe(false);
    }
  });

  it("tolerates the casing and spacing a spreadsheet cell can carry", () => {
    // A spreadsheet cell is not obliged to preserve the capitalisation the
    // template was written in, and the cost of a false negative is a ghost on
    // the roster while the cost of a false positive is one sentence.
    for (const name of ["example player 1", "  Example Player 1", "EXAMPLE PLAYER 2, DELETE ME"]) {
      expect(isTemplateExampleRow(name)).toBe(true);
    }
  });

  it("shows an example-looking row in its own group, last, and not as a mistake", () => {
    // The report's treatment of H1. These rows are not a failure and the panel
    // must not make them look like one: the note offers both readings (delete
    // it, or rename it if you meant it), and the reason says the row *was not
    // imported* — past tense, this import, no promise about the next one. Fails
    // if the row is merged into the shape or value groups, which are both about
    // mistakes.
    //
    // **Neither the reason nor the title claims the row IS a template row.**
    // The app ran a name prefix; it cannot know which rows the template ships.
    // So the reason states the rule that was applied and the title says
    // "example-*looking*", and the note hands the decision back. A report that
    // says "is one of the example rows the CSV template ships" about a row that
    // is not one is a false claim about somebody's file.
    const html = panelFor(["name,discipline,strength", "Andi,futsal,4", "Example Player 1,mlbb,4", ""].join("\n"));
    expect(groupTitles(html)).toEqual(["Check these example-looking rows · 1 row"]);
    expect(skippedRows(html)).toEqual([
      'Line 3: "Example Player 1" — this app did not import it: the name starts with the template\'s example marker.',
    ]);
    expect(text(html)).toContain("Delete them from the file, or rename them if you meant them as real players.");
    expect(text(html)).not.toContain("is one of the example rows the CSV template ships");
    expect(headline(html)).toBe(
      "This app imported 1 of the 2 player rows in the file. The other 1 was not imported, and is grouped below by what to change.",
    );
  });

  it("counts a held-out example as a row the app did not import, and says so", () => {
    // The arithmetic has to add up or the headline is not checkable against the
    // user's own file. Two rows in the template, none on the roster, both named
    // below: a user who counts their spreadsheet gets 2 and the panel agrees.
    const untouched = throughTheParsers(CSV_TEMPLATE, CATALOG);
    expect(untouched.imported).toBe(0);
    expect(untouched.skipped).toHaveLength(2);
    expect(skippedRows(renderRoster({ disciplines: CATALOG, lastReport: untouched }))).toEqual([
      'Line 2: "Example Player 1" — this app did not import it: the name starts with the template\'s example marker.',
      'Line 3: "Example Player 2, delete me" — this app did not import it: the name starts with the template\'s example marker.',
    ]);
    expect(headline(renderRoster({ disciplines: CATALOG, lastReport: untouched }))).toBe(
      "This app imported no players. All 2 player rows in the file were not imported, and are grouped below by what to change.",
    );
  });
});

describe("every reason the parsers can produce has a group", () => {
  it("holds the grouping to the shipped parsers rather than to a list of literals", () => {
    // The exhaustiveness check. Each reason below is produced by driving the
    // real parsers, and each is asserted to land in a named group. A parser
    // that grows a sixth reason fails here, in the file that owns the grouping,
    // instead of quietly emptying a group on a user's screen — and the
    // ungrouped floor, asserted separately above, is the only place a row can
    // end up with no group at all.
    const cases: Array<{ csv: string; group: string }> = [
      { csv: 'name,discipline,strength\nAndi,futsal', group: "Fix the shape of these rows" },
      { csv: 'name,discipline,strength\n"Andi,futsal,4', group: "Fix the shape of these rows" },
      { csv: "name,discipline,strength\n,futsal,4", group: "Correct what one cell says" },
      { csv: "name,discipline,strength\nAndi,futsal,strong", group: "Correct what one cell says" },
      { csv: "name,discipline,strength\nAndi,quidditch,4", group: "Spell the discipline" },
      { csv: "name,discipline,strength\nExample Player 1,futsal,4", group: "Check these example-looking rows" },
    ];
    for (const { csv, group } of cases) {
      const html = panelFor(csv);
      const label = JSON.stringify(csv);
      expect(skippedRows(html), `no row was rendered for ${label}`).toHaveLength(1);
      expect(groupOf(html, group), `${group} did not claim the row in ${label}`).not.toBe("");
      expect(groupTitles(html), `a row fell through to the floor in ${label}`).not.toContain(
        "Rows this app did not import · 1 row",
      );
    }
  });
});
