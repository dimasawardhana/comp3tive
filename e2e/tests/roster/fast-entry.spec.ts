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
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { gotoHubSeeded, type SeedWorld } from "../../support/seed";

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

  // Four sentences, in this order. The last one is rendered from the discipline
  // catalog rather than written out, so it is the one that changes when a sport
  // is added; here it is the seed three.
  const hints = page.locator(".import-hint");
  await expect(hints).toHaveCount(4);
  await expect(hints.nth(0)).toContainText("press Import players and pick that file");
  await expect(hints.nth(1)).toContainText("CSV columns, in this order: name, discipline, strength.");
  await expect(hints.nth(2)).toContainText("Leave it blank and it is read as 3");
  await expect(hints.nth(3)).toHaveText("Discipline must be one of: Futsal, MLBB (Mobile Legends), Badminton.");

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

  // The app hands the browser a blob URL and reads nothing back: the file only
  // reaches the roster when a person picks it, and the hint's first sentence is
  // what says so. If this ever fails, the download has started importing.
  await expect(page.locator(".roster .row")).toHaveCount(0);
});
