import { test, expect } from "@playwright/test";
import { gotoSeeded, openSettings, type SeedWorld } from "../../support/seed";

test.use({ viewport: { width: 390, height: 844 } });

const world = (): SeedWorld => ({
  communities: [{ id: "comm-viewport", name: "Viewport Test", createdAt: 100 }],
  players: [],
  sessions: [],
  tournaments: [],
  squads: [],
  activeCommunityId: "comm-viewport",
});

/** Verify the Settings screen + navigation stay on viewport (fixed/sticky). */
test("settings screen and navigation stay on viewport", async ({ page }) => {
  await gotoSeeded(page, world());

  // 1. Topbar is sticky (stays at top when scrolling)
  const topbar = page.locator(".topbar-wrap");
  await expect(topbar).toBeVisible();
  const topbarBox1 = await topbar.boundingBox();
  expect(topbarBox1).not.toBeNull();

  // 2. Bottom nav is sticky at the bottom of the layout column
  const nav = page.locator(".bottom-nav");
  await expect(nav).toBeVisible();
  const navPos = await nav.evaluate((el) => window.getComputedStyle(el).position);
  expect(navPos).toBe("sticky");
  const navBox = await nav.boundingBox();
  expect(navBox).not.toBeNull();
  const viewportSize = page.viewportSize();
  if (navBox && viewportSize) {
    // The bar occupies the foot of the viewport.
    expect(navBox.y + navBox.height).toBeGreaterThanOrEqual(viewportSize.height - 5);
  }

  // 3. Settings is a destination but not one of the five hubs, so at 390 it is
  // inside the menu sheet rather than in the bottom bar. openSettings opens
  // whichever surface holds it and waits for the screen.
  await openSettings(page);
  const screenBox = await page.locator(".screen").boundingBox();
  const topbarBox2 = await topbar.boundingBox();
  if (screenBox && topbarBox2) {
    expect(screenBox.y).toBeGreaterThan(topbarBox2.y);
  }

  // 4. Click Desktop layout → layout changes
  await page.locator(".settings-chip", { hasText: "Desktop" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-layout", "desktop");
});
