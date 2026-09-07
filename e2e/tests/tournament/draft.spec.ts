import { test, expect } from "@playwright/test";

test("tournament draft: h1, meta cards, pre-split preview", async ({ page }) => {
  await page.goto("http://localhost:4173/");
  await expect(page.locator(".app")).toBeVisible({ timeout: 15000 });

  // Create community
  await page.getByTitle("New community").click();
  await page.locator(".add-community input").fill("Draft Test");
  await page.locator(".add-community .btn-primary").click();
  await expect(page.locator(".add-community")).not.toBeVisible({ timeout: 3000 });

  // Go to Games
  await page.locator(".bottom-nav .nav-link").nth(1).click();

  // Create a tournament
  await page.locator("button:has-text('+ New tournament')").click();
  await page.locator("#tournament-name").fill("Draft League");
  await page.locator(".chip", { hasText: "Futsal" }).click();
  await page.locator(".chip", { hasText: "Single elimination" }).click();
  await page.locator(".modal-card .btn-primary").click();

  // On tournament page


  // Meta cards present
  const metaCards = page.locator(".tournament-meta-card");
  await expect(metaCards).toHaveCount(4);
  await expect(metaCards.nth(0).locator(".tournament-meta-card-value")).toHaveText(/Single elimination/);
  await expect(metaCards.nth(1).locator(".tournament-meta-card-value")).toHaveText("BO3");
  await expect(metaCards.nth(2).locator(".tournament-meta-card-value")).toHaveText("0/4");
  await expect(metaCards.nth(3).locator(".tournament-meta-card-value")).toHaveText("Draft");

  // Pre-split preview visible
  await expect(page.locator(".tournament-preview")).toBeVisible();
  await expect(page.locator(".tournament-preview-text").first()).toContainText("eligible players");

  // Split CTA
  const splitCta = page.getByTestId("split-teams-cta");
  await expect(splitCta).toBeVisible();
  await expect(splitCta).toHaveText(/Split your teams/);
});
