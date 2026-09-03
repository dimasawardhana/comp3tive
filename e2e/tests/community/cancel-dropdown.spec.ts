import { test, expect } from "@playwright/test";

/** Verify community: cancel button + redesigned dropdown. */
test("community: cancel button + custom dropdown", async ({ page }) => {
  await page.goto("http://localhost:4173/");
  await expect(page.locator(".app")).toBeVisible({ timeout: 15000 });

  const communityBtn = page.getByTitle("New community");

  // 1. Open add-community form
  await communityBtn.click();
  const addForm = page.locator(".add-community");
  await expect(addForm).toBeVisible();

  // 2. Cancel button exists and is visible
  const cancelBtn = page.locator(".add-community .btn-ghost");
  await expect(cancelBtn).toBeVisible();
  await expect(cancelBtn).toHaveText(/cancel/i);

  // 3. Type something then cancel → form closes, name cleared
  await page.locator(".add-community input").fill("Should be cancelled");
  await cancelBtn.click();
  await expect(addForm).not.toBeVisible({ timeout: 3000 });

  // 4. Re-open form → input should be empty (cancelled name not persisted)
  await communityBtn.click();
  await expect(addForm).toBeVisible();
  const inputValue = await page.locator(".add-community input").inputValue();
  expect(inputValue).toBe("");

  // 5. Create a community for dropdown test
  await page.locator(".add-community input").fill("Alpha Crew");
  await page.locator(".add-community .btn-primary").click();
  await expect(addForm).not.toBeVisible({ timeout: 3000 });

  // 6. Verify custom dropdown (not native select)
  const select = page.locator(".squad-select");
  await expect(select).toBeVisible();
  // Should be a button, not a select element
  const tagName = await select.evaluate((el) => el.tagName);
  expect(tagName).toBe("BUTTON");

  // 7. Click dropdown → menu appears
  await select.click();
  const menu = page.locator(".squad-menu");
  await expect(menu).toBeVisible();

  // 8. Menu has items
  const items = page.locator(".squad-menu-item");
  await expect(items.first()).toBeVisible();
  const itemCount = await items.count();
  expect(itemCount).toBeGreaterThanOrEqual(1);

  // 9. Select has aria-expanded
  await expect(select).toHaveAttribute("aria-expanded", "true");

  // 10. Click an item → menu closes, community changes
  await items.nth(1).click(); // first real community
  await expect(menu).not.toBeVisible({ timeout: 3000 });
  const selectedText = await page.locator(".squad-select-value").textContent();
  expect(selectedText).not.toBe("— No community —");

  // 11. Escape key cancels add-community form
  await communityBtn.click();
  await expect(addForm).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(addForm).not.toBeVisible({ timeout: 3000 });
});
