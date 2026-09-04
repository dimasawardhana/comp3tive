import { test, expect } from "@playwright/test";

test("match-setup: discipline first, then players, then teams", async ({ page }) => {
  await page.goto("http://localhost:4173/");
  await expect(page.locator(".app")).toBeVisible({ timeout: 15000 });

  // Create community
  await page.getByTitle("New community").click();
  await page.locator(".add-community input").fill("Match Test");
  await page.locator(".add-community .btn-primary").click();
  await expect(page.locator(".add-community")).not.toBeVisible({ timeout: 3000 });

  // Add 2 players with Futsal capability via direct store manipulation
  // (skip the complex modal flow; just verify layout structure)
  // Add players via the simpler flow
  for (let i = 0; i < 2; i++) {
    await page.getByRole("button", { name: /Add Player/ }).click();
    const modal = page.locator(".modal-card");
    await expect(modal).toBeVisible();
    await modal.locator("#player-name").fill(`Player ${i + 1}`);
    // Just save with default (no capabilities) — we only test layout
    await modal.locator(".btn-primary").click();
    await expect(modal).not.toBeVisible({ timeout: 5000 });
  }

  // Trigger match setup — click Split match button
  const splitMatchBtn = page.getByRole("button", { name: /Split match/ }).first();
  await expect(splitMatchBtn).toBeVisible({ timeout: 5000 });
  await splitMatchBtn.click();

  // Now on match setup screen
  await expect(page.locator(".match-setup")).toBeVisible({ timeout: 5000 });

  // 1. Heading "Set the match"
  await expect(page.locator(".match-setup h1")).toHaveText("Set the match");

  // 2. Section order: Discipline (1) → Players (2) → Teams (3)
  const steps = page.locator(".match-step");
  await expect(steps).toHaveCount(3);
  await expect(steps.nth(0)).toHaveText("1");
  await expect(steps.nth(1)).toHaveText("2");
  await expect(steps.nth(2)).toHaveText("3");

  // 3. Section titles in order
  await expect(page.locator(".match-section-title").nth(0)).toHaveText(/What are we playing/);
  await expect(page.locator(".match-section-title").nth(1)).toHaveText(/Who's playing/);
  await expect(page.locator(".match-section-title").nth(2)).toHaveText(/How many teams/);

  // 4. Game cards present
  const gameCards = page.locator(".match-setup .game");
  const gameCount = await gameCards.count();
  expect(gameCount).toBeGreaterThanOrEqual(2);
  const activeGames = page.locator(".match-setup .game.active");
  await expect(activeGames.first()).toBeVisible();

  // 5. Player count badge
  await expect(page.locator(".match-count").first()).toBeVisible();
  await expect(page.locator(".match-count").first()).toHaveText(/\d+ \/ \d+ eligible/);

  // 6. Stepper present
  await expect(page.locator(".stepper .count")).toBeVisible();

  // 7. Sticky Split button
  const splitBtn = page.getByTestId("split-button");
  await expect(splitBtn).toBeVisible();
  await expect(splitBtn).toContainText(/Split/);
});
