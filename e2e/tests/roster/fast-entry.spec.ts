/**
 * Roster fast entry: the CSV template a user downloads, the column contract
 * stated on the page next to it, and the name the file arrives under.
 *
 * Task 15 owns the template, the button and the hint, and this file is the
 * browser half of those: what a person sees on the roster and what lands in
 * their Downloads folder. The other half is `src/data/csv-template.test.ts`,
 * which is where the template is tied to the parser — the parser's own
 * behaviour is `player-import.test.ts`'s, and none of the three is repeated
 * here. Tasks 16 and 17 append the import report and the merge flow to this
 * same file.
 */
import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { gotoHubSeeded, type SeedWorld } from "../../support/seed";

/**
 * The template's bytes, written out rather than imported from `src`: no e2e
 * spec imports from `src` (see the note in the first case below), and the
 * template's own contents are `src/data/csv-template.test.ts`'s to hold. What
 * this spec needs is a file that *is* the template, so a user's very first
 * import can be exercised end to end.
 */
const CSV_TEMPLATE_BODY = [
  "name,discipline,strength",
  "Example Player 1,futsal,4",
  '"Example Player 2, delete me",mlbb,3',
  "",
].join("\n");

/** A community with an empty roster: the page a first-time organizer sees. */
const world = (): SeedWorld => ({
  communities: [{ id: "comm-fast", name: "Fast Entry", createdAt: 100 }],
  players: [],
  sessions: [],
  tournaments: [],
  squads: [],
  activeCommunityId: "comm-fast",
});

test("the column contract is on the page, and the template downloads", async ({ page }) => {
  await gotoHubSeeded(page, world(), "Roster");

  // Four sentences, in this order, and a list under the fourth. The list is
  // rendered from the discipline catalog rather than written out, so it is what
  // changes when a sport is added; here it is the seed three, one element each.
  const hints = page.locator(".import-hint");
  await expect(hints).toHaveCount(4);
  await expect(hints.nth(0)).toContainText("press Import players and pick that file");
  await expect(hints.nth(1)).toContainText("CSV columns, in this order: name, discipline, strength.");
  await expect(hints.nth(2)).toContainText("Leave it blank and it is read as 3");
  await expect(hints.nth(3)).toHaveText("Discipline must be one of:");
  await expect(page.locator(".import-hint-list li")).toHaveText([
    "Futsal",
    "MLBB (Mobile Legends)",
    "Badminton",
  ]);

  const download = page.waitForEvent("download");
  await page.getByTestId("download-csv-template").click();
  const file = await download;

  // The name is part of the file's usefulness: a blank form and a filled-in
  // roster in the same Downloads folder have to be tellable apart, and the
  // product prefix is what files this one next to the backup export.
  expect(file.suggestedFilename()).toBe("comp3tive-players-template.csv");

  // The name is not the file. A Blob built from a string can still arrive
  // somewhere else — an empty body, a byte-order mark, translated line endings —
  // while the name and the button both look right. The template's contents are
  // held against the parser in `src/data/csv-template.test.ts`; no e2e spec
  // imports from `src`, so what is checked here is that the body is a CSV of
  // the shape the page just promised.
  const path = await file.path();
  expect(path).not.toBeNull();
  const text = readFileSync(path as string, "utf8");
  expect(text.split("\n")[0]).toBe("name,discipline,strength");
  expect(text.trim().split("\n")).toHaveLength(3);
});

test("downloading the template does not put a player on the roster", async ({ page }) => {
  await gotoHubSeeded(page, world(), "Roster");
  await expect(page.locator(".roster .row")).toHaveCount(0);

  const download = page.waitForEvent("download");
  await page.getByTestId("download-csv-template").click();
  await download;

  // **This case is weaker than its name, and it is kept for what it does rule
  // out, not for what it looks like it rules out.** A count of zero resolves the
  // instant it is read: it cannot observe an import that lands a tick later, so
  // it would not catch a download that imported asynchronously and slowly. What
  // it does catch is a download that imports synchronously or at all within the
  // click, and that is the only shape the handler could take — the click
  // creates a Blob, an anchor and an object URL, and nothing in `RosterScreen`
  // reads any of them back. The structural half of the same claim is asserted
  // properly in `RosterScreen.csv-hint.test.ts`, which pins exactly one file
  // input on the screen, and the download's own path is a closed function of
  // `CSV_TEMPLATE`.
  await expect(page.locator(".roster .row")).toHaveCount(0);
});

/* ------------------------------------------------------------------ *
 * The import report. Task 16's browser half.
 *
 * Everything here is a claim about the *hook* rather than the screen: a report
 * that renders correctly and is never set is still a broken report, and
 * `src/shell/RosterScreen.import-report.test.ts` cannot see the difference
 * because `renderToStaticMarkup` runs no effects and no event handlers. These
 * specs drive the real file input on a real page, so the CSV reaches
 * `parsePlayerCsv`, the state reaches `RosterScreen`, and the three decisions
 * below are observed rather than inferred.
 * ------------------------------------------------------------------ */

/** Upload a CSV to the roster's file input, as a user picking a file does. */
const importCsv = async (page: Page, csv: string, name = "players.csv"): Promise<void> => {
  await page.setInputFiles('input[type="file"]', {
    name,
    mimeType: "text/csv",
    buffer: Buffer.from(csv, "utf8"),
  });
};

test("a partial import reports the count, names the row that failed, and keeps the good rows", async ({ page }) => {
  await gotoHubSeeded(page, world(), "Roster");

  // Line 2 imports; line 3 names a discipline the catalog does not have.
  await importCsv(page, ["name,discipline,strength", "Andi,futsal,4", "Budi,quidditch,3", ""].join("\n"));

  const report = page.locator(".import-report");
  await expect(report).toBeVisible({ timeout: 5000 });
  // The one line says what happened and who decided it, and names the shortfall
  // in the same breath. "Imported 1 players." — the plan's draft sentence — would
  // have credited nobody and left the skipped row to be discovered.
  await expect(report).toContainText(
    "This app imported 1 of the 2 player rows in the file. The other 1 was not imported, and is grouped below by what to change.",
  );
  // Grouped by the fix, and the group carries its own next action.
  const skipped = page.locator(".import-skipped-row");
  await expect(skipped).toHaveCount(1);
  await expect(skipped.first()).toContainText("Line 3:");
  await expect(skipped.first()).toContainText('Unknown discipline "quidditch".');
  await expect(page.locator(".import-report-group-title")).toHaveText([
    "Spell the discipline as one this community has 1",
  ]);
  // And the panel is a block beside the roster, not a dialog over it: the rows
  // it is talking about are still on the page, which is how a user checks it.
  await expect(page.locator(".roster .row", { hasText: "Andi" })).toBeVisible();
  await expect(page.locator(".roster .row", { hasText: "Budi" })).toHaveCount(0);
});

test("a partial import does not also raise a red skip toast", async ({ page }) => {
  await gotoHubSeeded(page, world(), "Roster");
  await importCsv(page, ["name,discipline,strength", "Andi,futsal,4", "Budi,quidditch,3", ""].join("\n"));
  await expect(page.locator(".import-report")).toBeVisible();

  // 40 players landing with 3 rows unread is a good outcome told in a red toast
  // — a second, worse copy of a fact the report is already holding, styled as a
  // failure. The success toast is the report's own summary and stays; the error
  // one is the copy that overstates.
  await expect(page.locator(".toast--error")).toHaveCount(0);
  await expect(page.locator(".toast")).toHaveCount(1);
});

test("an import where nothing could be read is announced as a failure", async ({ page }) => {
  await gotoHubSeeded(page, world(), "Roster");
  await importCsv(page, ["name,discipline,strength", "Andi,quidditch,4", "Budi,chess,3", ""].join("\n"));

  // The other end of the same rule: when nothing landed, the report is not
  // something the user has to go and find, so the failure is announced too.
  await expect(page.locator(".toast--error").first()).toContainText("No players imported");
  await expect(page.locator(".import-report")).toContainText("This app imported no players.");
  await expect(page.locator(".roster .row")).toHaveCount(0);
});

test("the report survives leaving the roster and coming back, and a second import replaces it", async ({ page }) => {
  await gotoHubSeeded(page, world(), "Roster");
  await importCsv(page, ["name,discipline,strength", "Andi,futsal,4", "Budi,quidditch,3", ""].join("\n"));
  await expect(page.locator(".import-report")).toContainText("The other 1 was not imported");

  // Still there on the way back: History and Roster show the same people, so a
  // report read on one is still true on the other. A report that vanished on
  // navigation is a report the user asks for twice.
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(page.locator(".import-report")).toHaveCount(0);
  await page.getByRole("button", { name: "Roster", exact: true }).click();
  await expect(page.locator(".import-report")).toContainText('Line 3: Unknown discipline "quidditch".');

  // A second import **replaces** it rather than stacking. `ImportReport` carries
  // no file name, so two lists of line numbers side by side would give the user
  // no way to tell which file a line came from — and the panel's own heading
  // says what it is a report of, so the one on the page is always the current
  // one. Counted, not just found: a stack would leave two `.import-report`s.
  await importCsv(page, ["name,discipline,strength", "Citra,badminton,5", ""].join("\n"), "second.csv");
  await expect(page.locator(".import-report")).toHaveCount(1);
  await expect(page.locator(".import-report")).toContainText("This app imported all 1 player row in the file.");
  await expect(page.locator(".import-report")).not.toContainText("quidditch");
  await expect(page.locator(".import-skipped-row")).toHaveCount(0);
});

test("the untouched template imports no ghost and says which rows it held back", async ({ page }) => {
  await gotoHubSeeded(page, world(), "Roster");

  // The template exactly as the app writes it, filled in by nobody — which is
  // the file a user downloads and hands straight back.
  await importCsv(page, CSV_TEMPLATE_BODY, "comp3tive-players-template.csv");

  // H1, decided as surfacing rather than dropping. A user who left the example
 // rows in gets a roster with no ghosts **and** a sentence saying which rows were
  // held back — the alternative, dropping them silently, would have had the app
  // edit the user's file with no way to see that it had.
  await expect(page.locator(".roster .row")).toHaveCount(0);
  await expect(page.locator(".import-skipped-row")).toHaveCount(2);
  await expect(page.locator(".import-report-group-title")).toHaveText([
    "These are the template's own example rows 2",
  ]);
  await expect(page.locator(".import-report")).toContainText("Most recent CSV import");
});

test("switching community takes the report down with the roster it described", async ({ page }) => {
  const two: SeedWorld = {
    communities: [
      { id: "comm-fast", name: "Fast Entry", createdAt: 100 },
      { id: "comm-other", name: "Other Crew", createdAt: 200 },
    ],
    players: [],
    sessions: [],
    tournaments: [],
    squads: [],
    activeCommunityId: "comm-fast",
  };
  await gotoHubSeeded(page, two, "Roster");
  await importCsv(page, ["name,discipline,strength", "Andi,futsal,4", "Budi,quidditch,3", ""].join("\n"));
  await expect(page.locator(".import-report")).toBeVisible();

  // A report is a verdict about one file imported into one community, and the
  // roster beneath it becomes a different set of people the moment the user
  // switches. Left up, it is a list of line numbers about a file the user is no
  // longer looking at, sitting above an unrelated set of players.
  await page.getByRole("button", { name: "Active community" }).click();
  await page.getByRole("option", { name: "Other Crew" }).click();
  await expect(page.locator(".import-report")).toHaveCount(0);
  await expect(page.locator(".roster, .empty")).toBeVisible();
});

test("a JSON roster leaves no CSV report behind", async ({ page }) => {
  await gotoHubSeeded(page, world(), "Roster");
  await importCsv(page, ["name,discipline,strength", "Andi,futsal,4", "Budi,quidditch,3", ""].join("\n"));
  await expect(page.locator(".import-report")).toBeVisible();

  // A report is the *most recent CSV import's* outcome and says so. A JSON
 // roster is not a CSV import, so it must not leave the CSV report standing as
 // if it described the file just chosen — and it must not leave a hole where a
 // report would be, so the panel is typed to a CSV verdict rather than to any
  // import at all.
  await page.setInputFiles('input[type="file"]', {
    name: "roster.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ players: [{ id: "p9", name: "Citra" }] }), "utf8"),
  });
  await expect(page.locator(".import-report")).toHaveCount(0);
  await expect(page.locator(".roster .row", { hasText: "Citra" })).toBeVisible();
});
