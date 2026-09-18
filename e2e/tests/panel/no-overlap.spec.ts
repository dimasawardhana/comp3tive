import { test, expect } from "@playwright/test";
import { gotoHubSeeded, type SeedWorld } from "../../support/seed";

test.use({ viewport: { width: 390, height: 844 } });

/** The row stack the test scrolls: 15 players, the default capability each. */
const world = (): SeedWorld => ({
  communities: [{ id: "comm-panel", name: "Test Crew", createdAt: 100 }],
  players: Array.from({ length: 15 }, (_, i) => ({
    id: `p${String(i + 1).padStart(2, "0")}`,
    communityId: "comm-panel",
    name: `Player ${i + 1}`,
  })),
  sessions: [],
  tournaments: [],
  squads: [],
  activeCommunityId: "comm-panel",
});

/** Verify content is not cut off by sticky topbar / sticky bottom-nav. */
test("panel: content not cut by sticky nav", async ({ page }) => {
  await gotoHubSeeded(page, world(), "Roster");

  // 1. The seeded stack is what the scroll below measures.
  await expect(page.locator(".roster .row")).toHaveCount(15);

  // 2. Scroll to the bottom and verify the last row clears the sticky bar.
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

  // 3. Verify topbar is sticky
  const topbarPos = await page.locator(".topbar-wrap").evaluate((el) => window.getComputedStyle(el).position);
  expect(topbarPos).toBe("sticky");

  // 4. Verify the bottom nav is sticky, not fixed
  const navPos = await page.locator(".bottom-nav").evaluate((el) => window.getComputedStyle(el).position);
  expect(navPos).toBe("sticky");

  // 5. Verify topbar is visible at top after scroll
  const topbarBox = await page.locator(".topbar-wrap").boundingBox();
  expect(topbarBox).not.toBeNull();
  if (topbarBox) {
    expect(topbarBox.y).toBeLessThanOrEqual(0);
  }
});
