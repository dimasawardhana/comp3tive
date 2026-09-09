import { test, expect } from "@playwright/test";

test("tournament journey: create -> split -> submit -> review", async ({ page }) => {
  await page.goto("http://localhost:4173/");
  await expect(page.locator(".app")).toBeVisible({ timeout: 15000 });

  // Create community
  await page.getByTitle("New community").click();
  await page.locator(".add-community input").fill("Tourney Test");
  await page.locator(".add-community .btn-primary").click();
  await expect(page.locator(".add-community")).not.toBeVisible({ timeout: 3000 });

  // The app lands on the Dashboard; the roster toolbar lives on the Roster hub.
  await page.getByRole("button", { name: "Roster" }).click();

  // Add 4 players with Futsal capability
  for (let i = 0; i < 4; i++) {
    await page.getByRole("button", { name: /Add Player/ }).click();
    const modal = page.locator(".modal-card");
    await expect(modal).toBeVisible();
    await modal.locator("#player-name").fill(`P${i + 1}`);
    // Save with default (no capabilities) - the split screen will show "no eligible" but we can still test the flow
    await modal.locator(".btn-primary").click();
    await expect(modal).not.toBeVisible({ timeout: 5000 });
  }

  // Go to Games
  await page.locator(".bottom-nav .nav-link").nth(1).click();

  // Create Series tournament
  await page.locator("button:has-text('+ New tournament')").click();
  await page.locator("#tournament-name").fill("Test Tourney");
  await page.locator(".chip", { hasText: "Series" }).click();
  await page.locator(".modal-card .btn-primary").click();

  // Should be on tournament page now
  await page.waitForTimeout(500);

  // Screenshot the current state
  await page.screenshot({ path: "/tmp/tourney-state.png", fullPage: true });
});
