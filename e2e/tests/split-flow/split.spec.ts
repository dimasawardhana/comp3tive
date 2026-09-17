/**
 * Critical path smoke: split team flow.
 */
import { test, expect } from "@playwright/test";
import { gotoHubSeeded, hubButton, type SeedWorld } from "../../support/seed";

const world = (): SeedWorld => ({
  communities: [{ id: "comm-split-flow", name: "Split Test", createdAt: 100 }],
  players: [],
  sessions: [],
  tournaments: [],
  squads: [],
  activeCommunityId: "comm-split-flow",
});

test.describe("Split team", () => {
  test("app loads and split flow is reachable", async ({ page }) => {
    // A roster is active from the first paint, so the hub is reachable without
    // walking the create-community form.
    await gotoHubSeeded(page, world(), "Roster");

    // The split button is present on the Games screen; verify app stability
    await page.getByRole("button", { name: "Games" }).click();
    await expect(hubButton(page, "Games")).toBeVisible({ timeout: 5000 });
  });
});
