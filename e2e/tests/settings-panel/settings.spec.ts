import { test, expect } from "@playwright/test";
import { gotoSeeded, hubButton, openSettings, type SeedWorld } from "../../support/seed";

const world = (): SeedWorld => ({
  communities: [{ id: "comm-settings", name: "Settings Test", createdAt: 100 }],
  players: [],
  sessions: [],
  tournaments: [],
  squads: [],
  activeCommunityId: "comm-settings",
});

/** Settings is a hub destination now, not a popover: the nav button lands on
 *  a screen whose theme/layout chips work and persist, and whose Account
 *  section is present without signing in. */
test("settings screen: theme + layout + account fully functional", async ({ page }) => {
  await gotoSeeded(page, world());

  // 1. Settings is a destination, reachable from the sidebar footer on desktop
  // and from the menu sheet on a phone; openSettings handles both.
  await openSettings(page);

  // 2. Theme chips: Light/Dark/Auto all visible
  const lightChip = page.locator(".settings-chip", { hasText: "Light" });
  const darkChip = page.locator(".settings-chip", { hasText: "Dark" });
  const autoTheme = page.locator(".settings-section", { hasText: "Theme" }).locator(".settings-chip", { hasText: "Auto" });
  const autoLayout = page.locator(".settings-section", { hasText: "Layout" }).locator(".settings-chip", { hasText: "Auto" });
  const mobileChip = page.locator(".settings-chip", { hasText: "Mobile" });
  const desktopChip = page.locator(".settings-chip", { hasText: "Desktop" });
  await expect(lightChip).toBeVisible();
  await expect(darkChip).toBeVisible();
  await expect(autoTheme).toBeVisible();
  await expect(autoLayout).toBeVisible();
  await expect(mobileChip).toBeVisible();
  await expect(desktopChip).toBeVisible();

  // 3. Click Dark → html gets data-theme="dark"
  await darkChip.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  // 4. Click Light → data-theme="light"
  await lightChip.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  // 5. Click Desktop layout → html gets data-layout="desktop"
  await desktopChip.click();
  await expect(page.locator("html")).toHaveAttribute("data-layout", "desktop");

  // 6. Click Mobile layout
  await mobileChip.click();
  await expect(page.locator("html")).toHaveAttribute("data-layout", "mobile");

  // 7. Verify localStorage persistence
  const stored = await page.evaluate(() => ({
    theme: localStorage.getItem("tb-theme"),
    layout: localStorage.getItem("tb-layout"),
  }));
  expect(stored.theme).toBe("light");
  expect(stored.layout).toBe("mobile");

  // 8. Reload page → settings persist, and Settings is still reachable. The
  // reload returns to the Dashboard, so the nav starts from there again.
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("html")).toHaveAttribute("data-layout", "mobile");
  await openSettings(page);

  // 9. The Account section lives here now, not on the Dashboard. Signed out,
  // its buttons are the three sign-in paths, and no "Sync now" appears (that
  // button is for a signed-in Organizer).
  await expect(page.locator(".account-panel")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create an account" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sync now" })).toHaveCount(0);

  // 10. And the Dashboard no longer carries the Account section.
  await hubButton(page, "Home").click();
  await expect(page.locator(".screen h1")).toHaveText("Dashboard");
  await expect(page.locator(".account-panel")).toHaveCount(0);
});
