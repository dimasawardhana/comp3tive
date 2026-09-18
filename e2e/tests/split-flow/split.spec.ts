/**
 * Critical path smoke: split team flow.
 *
 * The Games hub is the entry this flow is named for, and it is what has to be
 * reached: the empty Games screen offers "+ New tournament", the tournament it
 * creates offers "Split your teams", and that lands in match setup with the
 * seeded roster eligible. The previous version of this test clicked the Games
 * hub and then asserted that the same hub button was still visible, so nothing
 * about the Games screen — or the split — could fail it except a crash.
 */
import { test, expect } from "@playwright/test";
import { gotoHubSeeded, hubButton, type SeedWorld } from "../../support/seed";

const futsalPlayer = (id: string, name: string) => ({
  id,
  communityId: "comm-split-flow",
  name,
  capabilities: [
    {
      disciplineId: "futsal",
      attributeRatings: { technical: 4, fitness: 4, "game-iq": 4 },
      eligibleRoles: ["goalkeeper", "defender", "winger", "pivot"],
      preferredRole: null,
    },
  ],
});

const world = (): SeedWorld => ({
  communities: [{ id: "comm-split-flow", name: "Split Test", createdAt: 100 }],
  players: [
    futsalPlayer("sf-1", "Split One"),
    futsalPlayer("sf-2", "Split Two"),
    futsalPlayer("sf-3", "Split Three"),
    futsalPlayer("sf-4", "Split Four"),
  ],
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
    await expect(page.locator(".screen h1")).toHaveText("comp3tive");

    // Navigation goes through the shared helper, and the destination is
    // asserted: the Games screen, not the button that was just clicked.
    await hubButton(page, "Games").click();
    await expect(page.locator(".screen h1")).toHaveText("Games");

    // The split affordance the test is named for lives behind a tournament on
    // this screen.
    await page.locator("button:has-text('+ New tournament')").click();
    const modal = page.locator(".modal-card");
    await modal.locator("#tournament-name").fill("Split Smoke");
    await modal.locator(".chip", { hasText: "Futsal" }).click();
    await modal.locator(".btn-primary").click();
    await expect(modal).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator(".screen h1")).toHaveText("Split Smoke");

    const splitCta = page.getByTestId("split-teams-cta");
    await expect(splitCta).toBeVisible();
    await splitCta.click();

    // The split flow is reached, and it carries the roster it was seeded with:
    // all four futsal players are eligible, so "reachable" is about this screen
    // rather than about the app not having crashed.
    await expect(page.locator(".match-setup")).toBeVisible({ timeout: 5000 });
    await expect(page.locator(".screen h1")).toHaveText("Set the match");
    await expect(page.locator(".match-count").first()).toHaveText("4 / 4 eligible");
  });
});
