import { test, expect } from "@playwright/test";

test("inspect2: dump full page", async ({ page }) => {
  await page.goto("http://localhost:4173/");
  await expect(page.locator(".app")).toBeVisible({ timeout: 15000 });

  // Create community
  await page.getByTitle("New community").click();
  await page.locator(".add-community input").fill("Inspect2");
  await page.locator(".add-community .btn-primary").click();
  await expect(page.locator(".add-community")).not.toBeVisible({ timeout: 3000 });

  // Go to Games
  await page.locator(".bottom-nav .nav-link").nth(1).click();

  // Create Series tournament
  await page.locator("button:has-text('+ New tournament')").click();
  await page.locator("#tournament-name").fill("Inspect2");
  await page.locator(".chip", { hasText: "Series" }).click();
  await page.locator(".modal-card .btn-primary").click();

  await page.waitForTimeout(1000);

  // Dump everything after the header
  const content = await page.locator(".app > *:nth-child(2)").innerHTML();
  console.log("=== CONTENT (first 8000 chars) ===");
  console.log(content.substring(0, 8000));
  console.log("=== END ===");

  // Check if "Split your teams" button is visible and clickable
  const splitBtn = page.getByTestId("split-teams-cta");
  const isVisible = await splitBtn.isVisible();
  const isEnabled = await splitBtn.isEnabled();
  console.log(`Split CTA: visible=${isVisible}, enabled=${isEnabled}`);

  // Take screenshot
  await page.screenshot({ path: "/tmp/tourney-draft.png", fullPage: true });
  console.log("Screenshot saved to /tmp/tourney-draft.png");
});
