import { test, expect } from "@playwright/test";

/** Verify content is not cut off by sticky topbar / fixed bottom-nav.
 *  Simplified: create community, import players via file, verify no overlap. */
test("panel: content not cut by fixed nav", async ({ page }) => {
  await page.goto("http://localhost:4173/");
  await expect(page.locator(".app")).toBeVisible({ timeout: 15000 });

  // 1. Create a community
  const communityBtn = page.getByTitle("New community");
  await communityBtn.click();
  await page.locator(".add-community input").fill("Test Crew");
  await page.locator(".add-community .btn-primary").click();
  await expect(page.locator(".add-community")).not.toBeVisible({ timeout: 3000 });

  // The app lands on the Dashboard; the roster toolbar lives on the Roster hub.
  await page.getByRole("button", { name: "Roster" }).click();

  // 2. Add players via the Add Player button
  for (let i = 0; i < 15; i++) {
    await page.getByRole("button", { name: /Add Player/ }).click();
    const modal = page.locator(".modal-card");
    await expect(modal).toBeVisible({ timeout: 3000 });
    const nameInput = modal.locator("input").first();
    await nameInput.fill(`Player ${i + 1}`);
    // Click the primary save button in the modal
    await modal.getByRole("button", { name: /Save|Create|Add/ }).click();
    await expect(modal).not.toBeVisible({ timeout: 5000 });
  }

  // 3. Verify .app has padding-bottom >= 64px (clears fixed nav)
  const appPadding = await page.locator(".app").evaluate((el) => {
    return parseInt(window.getComputedStyle(el).paddingBottom);
  });
  expect(appPadding).toBeGreaterThanOrEqual(64);

  // 4. Verify topbar is sticky
  const topbarPos = await page.locator(".topbar-wrap").evaluate((el) => window.getComputedStyle(el).position);
  expect(topbarPos).toBe("sticky");

  // 5. Verify bottom-nav is fixed
  const navPos = await page.locator(".bottom-nav").evaluate((el) => window.getComputedStyle(el).position);
  expect(navPos).toBe("fixed");

  // 6. Scroll to last player and verify it's not cut off
  const lastPlayer = page.locator(".roster .row").last();
  await lastPlayer.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);

  const playerBox = await lastPlayer.boundingBox();
  const viewportSize = page.viewportSize();
  expect(playerBox).not.toBeNull();
  expect(viewportSize).not.toBeNull();
  if (playerBox && viewportSize) {
    // Last player should be fully within viewport (not cut by fixed nav)
    const playerBottom = playerBox.y + playerBox.height;
    expect(playerBottom).toBeLessThanOrEqual(viewportSize.height);
  }

  // 7. Verify topbar is visible at top after scroll
  const topbarBox = await page.locator(".topbar-wrap").boundingBox();
  expect(topbarBox).not.toBeNull();
  if (topbarBox) {
    expect(topbarBox.y).toBeLessThanOrEqual(0);
  }
});
