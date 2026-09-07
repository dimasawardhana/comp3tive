import { test, expect } from "@playwright/test";

test("inspect: what does the tournament draft page look like", async ({ page }) => {
  await page.goto("http://localhost:4173/");
  await expect(page.locator(".app")).toBeVisible({ timeout: 15000 });

  // Create community
  await page.getByTitle("New community").click();
  await page.locator(".add-community input").fill("Inspect");
  await page.locator(".add-community .btn-primary").click();
  await expect(page.locator(".add-community")).not.toBeVisible({ timeout: 3000 });

  // Go to Games
  await page.locator(".bottom-nav .nav-link").nth(1).click();

  // Create Series tournament
  await page.locator("button:has-text('+ New tournament')").click();
  await page.locator("#tournament-name").fill("Inspect");
  await page.locator(".chip", { hasText: "Series" }).click();
  await page.locator(".modal-card .btn-primary").click();

  // Wait for tournament page
  await page.waitForTimeout(1000);

  // Dump the full page HTML for inspection
  const html = await page.locator(".app").innerHTML();
  console.log("=== TOURNAMENT PAGE HTML ===");
  console.log(html.substring(0, 5000));
  console.log("=== END ===");

  // List all visible buttons
  const buttons = await page.locator("button").all();
  console.log(`=== ${buttons.length} BUTTONS ===`);
  for (let i = 0; i < buttons.length; i++) {
    const text = await buttons[i].textContent();
    const visible = await buttons[i].isVisible();
    if (visible && text?.trim()) {
      console.log(`  [${i}] "${text.trim()}"`);
    }
  }
});
