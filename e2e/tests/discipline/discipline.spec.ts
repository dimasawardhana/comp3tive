import { test, expect } from "@playwright/test";

test("discipline: layout padding + list refreshes after creation", async ({ page }) => {
  await page.goto("http://localhost:4173/");
  await expect(page.locator(".app")).toBeVisible({ timeout: 15000 });

  // The app now lands on the Dashboard; Games is still nav index 1.
  await page.locator(".bottom-nav .nav-link").nth(1).click();
  await expect(page.locator(".screen h1")).toHaveText("Games");
  await page.getByRole("button", { name: "Disciplines" }).click();
  await expect(page.locator(".screen h1")).toHaveText("Disciplines");

  // 1. .screen wrapper has padding
  const screen = page.locator(".screen");
  await expect(screen).toBeVisible();
  const screenPadding = await screen.evaluate((el) => {
    const cs = window.getComputedStyle(el);
    return { top: parseInt(cs.paddingTop), left: parseInt(cs.paddingLeft) };
  });
  expect(screenPadding.top).toBeGreaterThanOrEqual(12);
  expect(screenPadding.left).toBeGreaterThanOrEqual(12);

  // 2. Count initial disciplines
  const initialRows = await page.locator(".roster .row").count();
  expect(initialRows).toBeGreaterThanOrEqual(2);

  // 3. Open new discipline modal
  await page.getByRole("button", { name: /New Discipline/ }).click();
  const modal = page.locator(".modal-card");
  await expect(modal).toBeVisible();

  // 4. Fill name
  await modal.getByRole("textbox", { name: "Name", exact: true }).fill("Test Discipline");
  await modal.getByRole("button", { name: /Add attribute/ }).click();
  await modal.getByPlaceholder("e.g. Skill").fill("skill");
  await modal.getByRole("checkbox", { name: /Roles are required/ }).uncheck();
  const saveBtn = modal.getByRole("button", { name: /Add discipline/ });
  await expect(saveBtn).toBeEnabled({ timeout: 3000 });
  await saveBtn.click();

  // 7. Modal closes
  await expect(modal).not.toBeVisible({ timeout: 5000 });

  // 8. New discipline appears WITHOUT page refresh
  await expect(page.locator(".roster .row")).toHaveCount(initialRows + 1, { timeout: 5000 });
  await expect(page.getByText("Test Discipline")).toBeVisible();
});
