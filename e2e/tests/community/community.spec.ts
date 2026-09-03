import { test, expect } from "@playwright/test";

/** Verify community form layout + squad-select font legibility. */
test("community: form layout + select font readable", async ({ page }) => {
  await page.goto("http://localhost:4173/");
  await expect(page.locator(".app")).toBeVisible({ timeout: 15000 });

  // 1. Create initial community if none exists
  const communityBtn = page.getByTitle("New community");
  await communityBtn.click();
  const input = page.locator(".add-community input");
  await input.fill("Test Crew");
  await page.locator(".add-community .btn-primary").click();
  await expect(page.locator(".add-community")).not.toBeVisible({ timeout: 3000 });

  // 2. Verify squad-select is visible and uses readable font
  const select = page.locator(".squad-select");
  await expect(select).toBeVisible();
  const fontInfo = await select.evaluate((el) => {
    const cs = window.getComputedStyle(el);
    return { family: cs.fontFamily, size: cs.fontSize, weight: cs.fontWeight };
  });
  // Font should be Familjen Grotesk, size 15px, weight 600
  expect(fontInfo.family).toContain("Familjen Grotesk");
  expect(parseInt(fontInfo.size)).toBeGreaterThanOrEqual(14);
  expect(fontInfo.weight).toBe("600");

  // 3. Open add-community form again → verify form layout has label + row
  await communityBtn.click();
  const addForm = page.locator(".add-community");
  await expect(addForm).toBeVisible();

  // Form should have a label
  const formLabel = page.locator(".add-community .form-label");
  await expect(formLabel).toBeVisible();
  await expect(formLabel).toHaveText(/new community/i);

  // Form should have a row with input + button
  const formRow = page.locator(".add-community .form-row");
  await expect(formRow).toBeVisible();
  await expect(page.locator(".add-community .form-row input")).toBeVisible();
  await expect(page.locator(".add-community .form-row .btn-primary")).toBeVisible();

  // 4. Verify the select dropdown has custom arrow (appearance: none)
  const appearance = await select.evaluate((el) => window.getComputedStyle(el).appearance);
  expect(appearance).toBe("none");

  // 5. Change community via select
  await page.keyboard.press("Escape"); // close any open popover
  const addForm2 = page.locator(".add-community");
  if (await addForm2.isVisible()) {
    await communityBtn.click(); // close form
  }
  await expect(page.locator(".squad-select")).toBeVisible();
});
