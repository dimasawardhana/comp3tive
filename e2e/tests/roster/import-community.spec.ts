/**
 * Import merge (ticket 06). The defect: handleImport overrode communityId for
 * players and squads with the active community, splitting a v4 restore in half
 * while sessions and tournaments kept theirs.
 */
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { gotoHubSeeded, DB_VERSION, MLBB_ID, splitOf, type SeedWorld } from "../../support/seed";

const activeOnly = (): SeedWorld => ({
  communities: [{ id: "comm-active", name: "Active Crew", createdAt: 100 }],
  players: [],
  sessions: [],
  tournaments: [],
  squads: [],
  activeCommunityId: "comm-active",
});

/** A v4 backup carrying two communities that are not the active one. */
const twoCommunityBackup = () =>
  JSON.stringify({
    version: 4,
    exportedAt: new Date().toISOString(),
    communities: [
      { id: "comm-alpha", name: "Alpha Crew", createdAt: 200 },
      { id: "comm-beta", name: "Beta Guild", createdAt: 300 },
    ],
    players: [
      { id: "al-1", communityId: "comm-alpha", name: "Alpha One", capabilities: [] },
      { id: "be-1", communityId: "comm-beta", name: "Beta One", capabilities: [] },
    ],
    sessions: [],
    tournaments: [],
    savedSquads: [
      {
        id: "sq-beta",
        communityId: "comm-beta",
        name: "Beta Squad",
        disciplineId: MLBB_ID,
        createdAt: 400,
        poolPlayerIds: ["be-1"],
        settings: { teamCount: 1 },
        result: splitOf(["be-1"]),
      },
    ],
  });

/** The communityId of every persisted player, sorted. */
function storedPlayerCommunityIds(page: Page) {
  // The version is passed in rather than written here: this runs in the browser.
  return page.evaluate(
    (version) =>
      new Promise<string[]>((resolve) => {
        const request = indexedDB.open("comp3tive", version);
        request.onerror = () => resolve([]);
        request.onsuccess = () => {
          const db = request.result;
          const all = db.transaction("players", "readonly").objectStore("players").getAll();
          all.onerror = () => resolve([]);
          all.onsuccess = () => {
            resolve((all.result as { communityId: string }[]).map((p) => p.communityId).sort());
            db.close();
          };
        };
      }),
    DB_VERSION,
  );
}

test("a merged backup leaves each record in its own community", async ({ page }) => {
  await gotoHubSeeded(page, activeOnly(), "Roster");
  await expect(page.locator(".roster .row")).toHaveCount(0);

  page.once("dialog", (dialog) => void dialog.accept());
  await page.setInputFiles('input[type="file"]', {
    name: "two-communities.json",
    mimeType: "application/json",
    buffer: Buffer.from(twoCommunityBackup(), "utf8"),
  });

  // The merge writes land in IndexedDB asynchronously. With the override both
  // players were persisted into the active community, so this was
  // ["comm-active", "comm-active"].
  await expect.poll(() => storedPlayerCommunityIds(page)).toEqual(["comm-alpha", "comm-beta"]);

  // The active community must not have absorbed the imported records: the
  // defect re-homed both players (and the squad) here, so this was 2.
  await expect(page.locator(".roster .row")).toHaveCount(0);

  // The two imported communities are reachable, and each owns its own records.
  await page.getByRole("button", { name: "Active community" }).click();
  await page.locator(".squad-menu-item", { hasText: "Beta Guild" }).click();
  await expect(page.locator(".squad-select-value")).toHaveText("Beta Guild");
  await page.getByRole("button", { name: "Roster", exact: true }).click();
  await expect(page.locator(".roster .row")).toHaveCount(1);
  await expect(page.locator(".roster .row").first()).toContainText("Beta One");
  await page.getByRole("button", { name: "Squads", exact: true }).click();
  await expect(page.locator(".screen h1")).toHaveText("Saved squads");
  await expect(page.locator(".history-row")).toHaveCount(1);
  await expect(page.locator(".history-row").first()).toContainText("Beta Squad");

  // Alpha kept its own player too: the merge split neither way.
  await page.getByRole("button", { name: "Active community" }).click();
  await page.locator(".squad-menu-item", { hasText: "Alpha Crew" }).click();
  await expect(page.locator(".squad-select-value")).toHaveText("Alpha Crew");
  await page.getByRole("button", { name: "Roster", exact: true }).click();
  await expect(page.locator(".roster .row")).toHaveCount(1);
  await expect(page.locator(".roster .row").first()).toContainText("Alpha One");

  // And the originally-active community ends up with nothing.
  await page.getByRole("button", { name: "Active community" }).click();
  await page.locator(".squad-menu-item", { hasText: "Active Crew" }).click();
  await expect(page.locator(".squad-select-value")).toHaveText("Active Crew");
  await page.getByRole("button", { name: "Roster", exact: true }).click();
  await expect(page.locator(".roster .row")).toHaveCount(0);
});
