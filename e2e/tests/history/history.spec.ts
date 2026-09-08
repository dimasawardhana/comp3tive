import { test, expect } from "@playwright/test";

test("history: layout padding + kicker + lede + empty state", async ({ page }) => {
  await page.goto("http://localhost:4173/");
  await expect(page.locator(".app")).toBeVisible({ timeout: 15000 });

  // Create community
  await page.getByTitle("New community").click();
  await page.locator(".add-community input").fill("History Test");
  await page.locator(".add-community .btn-primary").click();
  await expect(page.locator(".add-community")).not.toBeVisible({ timeout: 3000 });

  // Navigate to History via bottom nav (index 3; Home now sits at index 2).
  await page.locator(".bottom-nav .nav-link").nth(3).click();

  // 1. .screen wrapper exists with proper padding
  const screen = page.locator(".screen");
  await expect(screen).toBeVisible();
  const padding = await screen.evaluate((el) => {
    const cs = window.getComputedStyle(el);
    return { top: parseInt(cs.paddingTop), left: parseInt(cs.paddingLeft) };
  });
  expect(padding.top).toBeGreaterThanOrEqual(12);
  expect(padding.left).toBeGreaterThanOrEqual(12);

  // 2. Title "History" with kicker
  const h1 = page.locator(".screen h1");
  await expect(h1).toHaveText("History");
  const kicker = page.locator(".screen .kicker").first();
  await expect(kicker).toBeVisible();
  await expect(kicker).toHaveText(/Game Tape/);

  // 3. Lede description
  await expect(page.locator(".screen .lede")).toBeVisible();

  // 4. Empty state shows when no sessions
  await expect(page.locator(".empty")).toBeVisible();
  await expect(page.locator(".empty .big")).toHaveText(/Sessions appear here/);
});
