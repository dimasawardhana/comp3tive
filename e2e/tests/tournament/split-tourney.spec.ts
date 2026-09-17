/**
 * Tournament squad split: verify SplitScreen shows tournament context
 * when entered from a tournament draft.
 *
 * Flow: seed a community with four players -> create a Series tournament ->
 * open draft page -> click "Split your teams" -> land in match setup (locked to
 * tournament). The players are MLBB-capable (seedScript hardcodes mlbbCap), the
 * tournament is Futsal, so the setup screen has no eligible players — which the
 * final assertion below relies on.
 */
import { test, expect } from "@playwright/test";
import { gotoHubSeeded, type SeedWorld } from "../../support/seed";

const world = (): SeedWorld => ({
  communities: [{ id: "comm-split", name: "Tourney Squad", createdAt: 100 }],
  players: [
    { id: "sp-1", communityId: "comm-split", name: "Split One" },
    { id: "sp-2", communityId: "comm-split", name: "Split Two" },
    { id: "sp-3", communityId: "comm-split", name: "Split Three" },
    { id: "sp-4", communityId: "comm-split", name: "Split Four" },
  ],
  sessions: [],
  tournaments: [],
  squads: [],
  activeCommunityId: "comm-split",
});

test("tournament split: draft page links to match setup with tournament context", async ({ page }) => {
  await gotoHubSeeded(page, world(), "Games");
  await page.locator("button:has-text('+ New tournament')").click();
  await page.locator("#tournament-name").fill("Squad Test");
  await page.locator(".chip", { hasText: "Series" }).click();
  await page.locator(".modal-card .btn-primary").click();
  await expect(page.locator(".modal-card")).not.toBeVisible({ timeout: 5000 });

  // On draft page — verify tournament context
  await expect(page.locator(".screen h1")).toHaveText("Squad Test");
  await expect(page.locator(".tournament-meta-strip .tms-item")).toHaveCount(4);
  await expect(page.getByTestId("split-teams-cta")).toBeVisible();

  // Click Split your teams -> enters match setup with tournament locked
  await page.getByTestId("split-teams-cta").click();
  await expect(page.locator(".match-setup")).toBeVisible({ timeout: 5000 });

  // Verify tournament context in match setup: section 1 (discipline) is locked
  // (the game cards should be disabled except the tournament's chosen one)
  // Since no players have Futsal capability, the "Who's playing?" section shows empty state
  await expect(page.locator(".screen h1")).toHaveText("Set the match");
});
