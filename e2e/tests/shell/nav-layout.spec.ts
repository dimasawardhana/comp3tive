/**
 * The navigation invariant every other spec depends on: a hub name resolves to
 * exactly one visible control, in whichever layout that width ships.
 */
import { expect, test } from "@playwright/test";
import { hubButton, type HubName } from "../../support/seed";

const HUBS: HubName[] = ["Home", "Roster", "Games", "History", "Squads", "Settings"];

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

    // Six slots, in whichever layout this width ships. A seventh NAV_ITEMS entry
    // would render a seventh control into a six-slot bar and break the layout,
    // and HubName is hand-written so tsc cannot catch the drift.
    await expect(page.locator(".rail-link:visible, .bottom-nav .nav-link:visible")).toHaveCount(6);

    await hubButton(page, "Games").click();
    await expect(page.locator(".screen h1")).toHaveText("Games");
  });
}
