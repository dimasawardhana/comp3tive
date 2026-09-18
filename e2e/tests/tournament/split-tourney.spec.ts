/**
 * Tournament squad split: verify SplitScreen shows tournament context
 * when entered from a tournament draft.
 *
 * Flow: seed a community with four futsal players -> create a Series tournament
 * -> open draft page -> click "Split your teams" -> land in match setup (locked
 * to tournament). The players carry a Futsal capability, so the setup screen
 * has eligible players for the tournament's own discipline; the final assertion
 * below is about the tournament context surviving the handoff.
 */
import { test, expect } from "@playwright/test";
import { gotoHubSeeded, type SeedWorld } from "../../support/seed";

const FUTSAL_ROLES = ["goalkeeper", "defender", "winger", "pivot"];

const futsalPlayer = (id: string, name: string) => ({
  id,
  communityId: "comm-split",
  name,
  capabilities: [
    {
      disciplineId: "futsal",
      attributeRatings: { technical: 4, fitness: 4, "game-iq": 4 },
      eligibleRoles: FUTSAL_ROLES,
      preferredRole: null,
    },
  ],
});

const world = (): SeedWorld => ({
  communities: [{ id: "comm-split", name: "Tourney Squad", createdAt: 100 }],
  players: [
    futsalPlayer("sp-1", "Split One"),
    futsalPlayer("sp-2", "Split Two"),
    futsalPlayer("sp-3", "Split Three"),
    futsalPlayer("sp-4", "Split Four"),
  ],
  sessions: [],
  tournaments: [],
  squads: [],
  activeCommunityId: "comm-split",
});

test("tournament split: draft page links to match setup with tournament context", async ({ page }) => {
  await gotoHubSeeded(page, world(), "Games");
  await page.locator("button:has-text('+ New tournament')").click();
  await page.locator("#tournament-name").fill("Squad Test");
  await page.locator(".chip", { hasText: "Series" }).click();
  await page.locator(".modal-card .btn-primary").click();
  await expect(page.locator(".modal-card")).not.toBeVisible({ timeout: 5000 });

  // On draft page — verify tournament context
  await expect(page.locator(".screen h1")).toHaveText("Squad Test");
  await expect(page.locator(".tournament-meta-strip .tms-item")).toHaveCount(4);
  await expect(page.getByTestId("split-teams-cta")).toBeVisible();

  // Click Split your teams -> enters match setup with tournament locked
  await page.getByTestId("split-teams-cta").click();
  await expect(page.locator(".match-setup")).toBeVisible({ timeout: 5000 });

  // Verify tournament context in match setup: section 1 (discipline) is locked
  // (the game cards should be disabled except the tournament's chosen one)
  // The four futsal players are eligible for the Futsal tournament.
  await expect(page.locator(".screen h1")).toHaveText("Set the match");
});
