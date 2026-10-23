/**
 * The navigation invariant every other spec depends on: a hub name resolves to
 * exactly one visible control, in whichever layout that width ships.
 *
 * Settings is a destination but not one of the five. The bottom bar carries the
 * five hubs and Settings lives in the sidebar footer on desktop and inside the
 * phone menu sheet, so its control is only in the tree once that surface is
 * open. That is the difference this spec now asserts instead of pretending all
 * six are always visible.
 */
import { expect, test } from "@playwright/test";
import { hubButton, type HubName } from "../../support/seed";

/** The five that hold a slot in the bottom bar and the rail. */
const HUBS: HubName[] = ["Home", "Roster", "Games", "History", "Squads"];

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 390, height: 844 },
]) {
  test(`each hub resolves to exactly one control at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("./");
    await expect(page.locator(".app")).toBeVisible({ timeout: 15000 });

    for (const hub of HUBS) {
      // A strict-mode violation here means both navs are in the accessibility
      // tree at this width: one helper is no longer correct for both layouts.
      await expect(hubButton(page, hub)).toHaveCount(1);
      await expect(hubButton(page, hub)).toBeVisible();
    }

    // Five slots in the primary nav, in whichever layout this width ships. A
    // sixth NAV_ITEMS entry would render a sixth control into a five-slot bar
    // and break the layout, and HubName is hand-written so tsc cannot catch the
    // drift. Scoped to the nav containers, not to every `.rail-link`: the
    // sidebar footer holds Settings and the label toggle, which are utilities
    // rather than destinations.
    await expect(
      page.locator(".rail-nav .rail-link:visible, .bottom-nav .nav-link:visible"),
    ).toHaveCount(5);

    await hubButton(page, "Games").click();
    await expect(page.locator(".screen h1")).toHaveText("Games");
  });

  test(`Settings is reachable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("./");
    await expect(page.locator(".app")).toBeVisible({ timeout: 15000 });

    if (viewport.width <= 640) {
      // On a phone the five hubs live in the bottom bar and Settings is inside
      // the menu sheet, so the sheet has to be opened before it is in the tree.
      await expect(hubButton(page, "Settings")).toHaveCount(0);
      await page.locator(".topbar-menu").click();
      await expect(page.locator("#phone-menu")).toBeVisible();
    }

    await hubButton(page, "Settings").click();
    await expect(page.locator(".screen h1")).toHaveText("Settings");

    if (viewport.width <= 640) {
      // Picking a destination closes the sheet, so the screen behind it is
      // usable rather than hidden under an open dialog.
      await expect(page.locator("#phone-menu")).toHaveCount(0);
    }
  });
}
