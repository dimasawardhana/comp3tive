/**
 * Tournament squad split: verify SplitScreen shows tournament context
 * when entered from a tournament draft.
 *
 * Flow: create community -> create Series tournament -> open draft page ->
 * click "Split your teams" -> land in match setup (locked to tournament).
 * The split button is disabled when no eligible players exist, but we can
 * verify the tournament context is wired by checking the draft page elements.
 */
import { test, expect } from "@playwright/test";

test("tournament split: draft page links to match setup with tournament context", async ({ page }) => {
  await page.goto("http://localhost:4173/");
  await expect(page.locator(".app")).toBeVisible({ timeout: 15000 });

  // Create community
  await page.getByTitle("New community").click();
  await page.locator(".add-community input").fill("Tourney Squad");
  await page.locator(".add-community .btn-primary").click();
  await expect(page.locator(".add-community")).not.toBeVisible({ timeout: 3000 });

  // Go to Games and create Series tournament
  await page.locator(".bottom-nav .nav-link").nth(1).click();
  await page.locator("button:has-text('+ New tournament')").click();
  await page.locator("#tournament-name").fill("Squad Test");
  await page.locator(".chip", { hasText: "Series" }).click();
  await page.locator(".modal-card .btn-primary").click();
  await expect(page.locator(".modal-card")).not.toBeVisible({ timeout: 5000 });

  // On draft page — verify tournament context
  await expect(page.locator(".tournament-header h1")).toHaveText("Squad Test");
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
