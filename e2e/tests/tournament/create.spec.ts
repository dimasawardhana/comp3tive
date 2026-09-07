import { test, expect } from "@playwright/test";

test("tournament create: sectioned modal with previews and constraints", async ({ page }) => {
  await page.goto("http://localhost:4173/");
  await expect(page.locator(".app")).toBeVisible({ timeout: 15000 });

  // Create community
  await page.getByTitle("New community").click();
  await page.locator(".add-community input").fill("Create Test");
  await page.locator(".add-community .btn-primary").click();
  await expect(page.locator(".add-community")).not.toBeVisible({ timeout: 3000 });

  // Go to Games
  await page.locator(".bottom-nav .nav-link").nth(1).click();
  await page.locator("button:has-text('+ New tournament')").click();
  const modal = page.locator(".modal-card");
  await expect(modal).toBeVisible();
  const sectionLabels = modal.locator(".field-label");
  await expect(sectionLabels.first()).toHaveText("Name");

  // Fill name
  await modal.locator("#tournament-name").fill("Saturday League");
  await modal.locator(".chip", { hasText: "Futsal" }).click();
  // Discipline detail preview should appear
  const disciplinePreview = modal.locator(".modal-section-preview");
  await expect(disciplinePreview.first()).toBeVisible();
  await expect(disciplinePreview.first()).toContainText("Futsal");

  // Pick Single elim format
  await modal.locator(".chip", { hasText: "Single elim" }).click();

  // Series length helper
  const seriesHint = modal.locator(".modal-section-hint");
  await expect(seriesHint.first()).toContainText(/BO3 = first to 2/);

  // Team count constraint hint
  await expect(modal.locator(".modal-section-hint", { hasText: /Single elimination/ })).toBeVisible();

  // Format preview at bottom
  const formatPreview = modal.locator(".modal-section-preview").last();
  await expect(formatPreview).toContainText("Single elimination");

  await expect(formatPreview).toContainText("Single elim");
  await expect(modal.locator('input[type="checkbox"]')).toBeVisible();
});
