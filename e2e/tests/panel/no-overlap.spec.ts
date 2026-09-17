import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 } });

/** Verify content is not cut off by sticky topbar / sticky bottom-nav.
 *  Simplified: create community, import players via file, verify no overlap. */
test("panel: content not cut by sticky nav", async ({ page }) => {
  await page.goto("./");
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

  // 3. Scroll to the bottom and verify the last row clears the sticky bar.
  //    The bar is `position: sticky; bottom: 0` inside the app column
  //    (src/index.css:685), so it sits in normal flow at the column's foot and
  //    the document's scrollable tail is below it.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const lastPlayer = page.locator(".roster .row").last();
  const playerBox = await lastPlayer.boundingBox();
  const navBox = await page.locator(".bottom-nav").boundingBox();
  expect(playerBox).not.toBeNull();
  expect(navBox).not.toBeNull();
  if (playerBox && navBox) {
    expect(playerBox.y + playerBox.height).toBeLessThanOrEqual(navBox.y + 1);
  }

  // 4. Verify topbar is sticky
  const topbarPos = await page.locator(".topbar-wrap").evaluate((el) => window.getComputedStyle(el).position);
  expect(topbarPos).toBe("sticky");

  // 5. Verify the bottom nav is sticky, not fixed
  const navPos = await page.locator(".bottom-nav").evaluate((el) => window.getComputedStyle(el).position);
  expect(navPos).toBe("sticky");

  // 7. Verify topbar is visible at top after scroll
  const topbarBox = await page.locator(".topbar-wrap").boundingBox();
  expect(topbarBox).not.toBeNull();
  if (topbarBox) {
    expect(topbarBox.y).toBeLessThanOrEqual(0);
  }
});
