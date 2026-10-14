import { test, expect } from "@playwright/test";
import { gotoSeeded, type SeedWorld } from "../../support/seed";

const world = (): SeedWorld => ({
  communities: [{ id: "comm-settings", name: "Settings Test", createdAt: 100 }],
  players: [],
  sessions: [],
  tournaments: [],
  squads: [],
  activeCommunityId: "comm-settings",
});

/** Verify settings panel: gear button visible, popover appears below topbar,
 *  theme/layout chips toggle, and changes persist via localStorage. */
test("settings panel: theme + layout fully functional", async ({ page }) => {
  await gotoSeeded(page, world());

  // 1. Gear button visible in topbar
  const gear = page.getByTitle("Settings");
  await expect(gear).toBeVisible();

  // 1b. The trigger says whether it is open. The closed state is the
  // interesting half: a popover whose trigger still announces itself as open is
  // the failure a one-sided test cannot catch, and `AppChrome` already uses
  // `aria-expanded` this way for the rail toggle (:81) and the community
  // switcher (:105) — both booleans the chrome holds itself, which is what this
  // trigger's is. The ✚ button deliberately has none: its form's visibility is
  // App's and the chrome never learns the answer (`contracts.md` §5, R2 (a)).
  await expect(gear).toHaveAttribute("aria-expanded", "false");
  // 2. Popover hidden by default
  await expect(page.locator(".settings-popover")).not.toBeVisible();

  // 3. Click gear → popover appears
  await gear.click();
  const popover = page.locator(".settings-popover");
  await expect(popover).toBeVisible();
  await expect(gear).toHaveAttribute("aria-expanded", "true");

  // Closing it by hand says it again, so the attribute is a reading of the
  // state rather than a latch set on first open.
  await gear.click();
  await expect(gear).toHaveAttribute("aria-expanded", "false");
  await expect(popover).toBeHidden();
  await gear.click();

  // 4. Verify popover is positioned below topbar (not at viewport bottom)
  const popoverBox = await popover.boundingBox();
  const topbarBox = await page.locator(".topbar").boundingBox();
  expect(popoverBox).not.toBeNull();
  expect(topbarBox).not.toBeNull();
  if (popoverBox && topbarBox) {
    expect(popoverBox.y).toBeGreaterThan(topbarBox.y);
  }

  // 5. Theme chips: Light/Dark/Auto all visible
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

  // 6. Click Dark → html gets data-theme="dark"
  await darkChip.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  // 7. Click Light → data-theme="light"
  await lightChip.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  // 8. Click Desktop layout → html gets data-layout="desktop"
  await desktopChip.click();
  await expect(page.locator("html")).toHaveAttribute("data-layout", "desktop");

  // 9. Click Mobile layout
  await mobileChip.click();
  await expect(page.locator("html")).toHaveAttribute("data-layout", "mobile");

  // 10. Verify localStorage persistence
  const stored = await page.evaluate(() => ({
    theme: localStorage.getItem("tb-theme"),
    layout: localStorage.getItem("tb-layout"),
  }));
  expect(stored.theme).toBe("light");
  expect(stored.layout).toBe("mobile");

  // 11. Reload page → settings persist
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("html")).toHaveAttribute("data-layout", "mobile");
});
