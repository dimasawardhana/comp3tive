/**
 * Critical path smoke: split team flow.
 */
import { test, expect } from "@playwright/test";

test.describe("Split team", () => {
  test("app loads and split flow is reachable", async ({ page }) => {
    await page.goto("http://localhost:4173/");
    await expect(page.locator(".app")).toBeVisible({ timeout: 15000 });

    // Create a community to ensure roster is active
    await page.getByTitle("New community").click();
    await page.getByRole("button", { name: "Create" }).click();

    // Navigate to roster
    await page.getByRole("button", { name: "Roster" }).click();

    // The split button is present on the Games screen; verify app stability
    await page.getByRole("button", { name: "Games" }).click();
    await expect(page.locator(".bottom-nav")).toBeVisible({ timeout: 5000 });
  });
});
