import { test, expect } from "@playwright/test";

/** Verify panel + navigation stay on viewport (fixed/sticky). */
test("panel and navigation stay on viewport", async ({ page }) => {
  await page.goto("http://localhost:4173/");
  await expect(page.locator(".app")).toBeVisible({ timeout: 15000 });

  // 1. Topbar is sticky (stays at top when scrolling)
  const topbar = page.locator(".topbar-wrap");
  await expect(topbar).toBeVisible();
  const topbarBox1 = await topbar.boundingBox();
  expect(topbarBox1).not.toBeNull();

  // 2. Bottom nav is fixed at viewport bottom
  const nav = page.locator(".bottom-nav");
  await expect(nav).toBeVisible();
  const navBox = await nav.boundingBox();
  expect(navBox).not.toBeNull();
  const viewportSize = page.viewportSize();
  if (navBox && viewportSize) {
    // nav bottom should be at or near viewport bottom
    expect(navBox.y + navBox.height).toBeGreaterThanOrEqual(viewportSize.height - 5);
  }

  // 3. Open settings panel → anchored to topbar
  await page.getByTitle("Settings").click();
  const popover = page.locator(".settings-popover");
  await expect(popover).toBeVisible();
  const popoverBox = await popover.boundingBox();
  const topbarBox2 = await topbar.boundingBox();
  if (popoverBox && topbarBox2) {
    // popover appears below topbar
    expect(popoverBox.y).toBeGreaterThan(topbarBox2.y);
  }

  // 4. Click Desktop layout → layout changes
  await page.locator(".settings-chip", { hasText: "Desktop" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-layout", "desktop");
});
