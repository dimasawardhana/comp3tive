/**
 * A player's creation timestamp (Phase E ticket 02).
 *
 * The ranking rule is unit-tested in `src/dashboardTeasers.test.ts`, and the
 * format rule in `src/data/transfer.test.ts`. What neither can reach is the
 * **create-vs-edit distinction inside the editor**: the value is built in
 * `PlayerEditModal.save`, which is a click handler, and the unit environment
 * runs none (`renderToStaticMarkup` renders the first paint and nothing more).
 *
 * The defect this covers is specific and silent. The stamp rule is
 * `player?.createdAt ?? Date.now()` — the same shape as the id rule beside it.
 * Written as a plain `Date.now()` instead, every edit would restamp the player,
 * and because the Dashboard ranks "recently added" by this field, **fixing a
 * typo in an old player's name would move them to the top of the Dashboard**.
 * Nothing else in the app would look wrong.
 *
 * So the two cases below are the two halves of that rule: an edit preserves,
 * and a create stamps. They are asserted through the Dashboard teaser, because
 * that is the surface the field exists for — a stored number nobody renders
 * proves nothing about the order a user sees.
 */
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { gotoHubSeeded, hubButton, type SeedWorld } from "../../support/seed";

/**
 * Three players with explicit, well-separated timestamps. The ids sort the
 * opposite way to the timestamps on purpose: anything reading id order answers
 * with the wrong end of the roster.
 */
const world = (): SeedWorld => ({
  communities: [{ id: "comm-stamp", name: "Stamp Crew", createdAt: 100 }],
  players: [
    { id: "p-1", communityId: "comm-stamp", name: "Oldest", createdAt: 1000 },
    { id: "p-2", communityId: "comm-stamp", name: "Middle", createdAt: 5000 },
    { id: "p-3", communityId: "comm-stamp", name: "Newest", createdAt: 9000 },
  ],
  sessions: [],
  tournaments: [],
  squads: [],
  activeCommunityId: "comm-stamp",
});

/** The player teasers' names, in the order the Dashboard renders them. */
const teaserNames = (page: Page) =>
  page.locator('section[aria-label="Recent players"] .row').allInnerTexts();

test("editing an older player does not move them up the teasers", async ({ page }) => {
  await gotoHubSeeded(page, world(), "Home");
  const teasers = page.locator('section[aria-label="Recent players"] .row');
  // Newest first, by the field and not by the roster's order.
  await expect(teasers.first()).toContainText("Newest");
  await expect(teasers.nth(2)).toContainText("Oldest");

  // Edit the OLDEST player's name. A restamping edit would promote them to the
  // top; a preserving one leaves them where they were.
  await hubButton(page, "Roster").click();
  const oldRow = page.locator(".roster .row", { hasText: "Oldest" });
  await oldRow.getByRole("button", { name: /Edit/ }).click();
  await page.locator("#player-name").fill("Oldest Renamed");
  await page.locator(".modal-card").getByRole("button", { name: /Save|Update/ }).click();
  await expect(page.locator(".modal-card")).not.toBeVisible();

  await hubButton(page, "Home").click();
  await expect(teasers.first()).toContainText("Newest");
  await expect(teasers.nth(1)).toContainText("Middle");
  await expect(teasers.nth(2)).toContainText("Oldest Renamed");
  // And the old name is gone, so the edit really landed.
  expect(await teaserNames(page)).toHaveLength(3);
  await expect(page.locator('section[aria-label="Recent players"]')).not.toContainText("OldestMLBB");
});

test("creating a player stamps it, so it leads the teasers", async ({ page }) => {
  await gotoHubSeeded(page, world(), "Home");
  await hubButton(page, "Roster").click();
  await page.getByRole("button", { name: "+ Add Player" }).click();

  const modal = page.locator(".modal-card");
  await expect(modal.locator(".modal-title")).toHaveText("Add player");
  // A name is the whole requirement: a player with no capabilities is valid,
  // and the save button is disabled until the name is non-empty.
  await modal.locator("#player-name").fill("Brand New");
  await modal.getByRole("button", { name: "Add player", exact: true }).click();
  await expect(modal).not.toBeVisible();

  await hubButton(page, "Home").click();
  // The newest player leads, because `Date.now()` on a real clock is later than
  // every seeded 1000/5000/9000.
  await expect(page.locator('section[aria-label="Recent players"] .row').first()).toContainText("Brand New");
});
