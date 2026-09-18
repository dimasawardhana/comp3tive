import { test, expect } from "@playwright/test";
import { gotoHubSeeded, type SeedWorld } from "../../support/seed";

/** A futsal-capable player: the seed's default capability is MLBB, not futsal. */
const futsalPlayer = (id: string, name: string, rating: number) => ({
  id,
  communityId: "comm-match",
  name,
  capabilities: [
    {
      disciplineId: "futsal",
      attributeRatings: { technical: rating, fitness: rating, "game-iq": rating },
      eligibleRoles: ["goalkeeper", "defender", "winger", "pivot"],
      preferredRole: "goalkeeper",
    },
  ],
});

const world = (): SeedWorld => ({
  communities: [{ id: "comm-match", name: "Match Test", createdAt: 100 }],
  players: [futsalPlayer("m1", "Player 1", 4), futsalPlayer("m2", "Player 2", 4)],
  sessions: [],
  tournaments: [],
  squads: [],
  activeCommunityId: "comm-match",
});

test("match-setup: discipline first, then players, then teams", async ({ page }) => {
  await gotoHubSeeded(page, world(), "Roster");

  // Trigger match setup — click Split match button
  const splitMatchBtn = page.getByRole("button", { name: /Split match/ }).first();
  await expect(splitMatchBtn).toBeVisible({ timeout: 5000 });
  await splitMatchBtn.click();

  // Now on match setup screen
  await expect(page.locator(".match-setup")).toBeVisible({ timeout: 5000 });

  // 1. Heading "Set the match"
  await expect(page.locator(".match-setup h1")).toHaveText("Set the match");

  // 2. Section order: Discipline (1) → Players (2) → Teams (3)
  const steps = page.locator(".match-step");
  await expect(steps).toHaveCount(3);
  await expect(steps.nth(0)).toHaveText("1");
  await expect(steps.nth(1)).toHaveText("2");
  await expect(steps.nth(2)).toHaveText("3");

  // 3. Section titles in order
  await expect(page.locator(".match-section-title").nth(0)).toHaveText(/What are we playing/);
  await expect(page.locator(".match-section-title").nth(1)).toHaveText(/Who's playing/);
  await expect(page.locator(".match-section-title").nth(2)).toHaveText(/How many teams/);

  // 4. Game cards present
  const gameCards = page.locator(".match-setup .game");
  const gameCount = await gameCards.count();
  expect(gameCount).toBeGreaterThanOrEqual(2);
  const activeGames = page.locator(".match-setup .game.active");
  await expect(activeGames.first()).toBeVisible();

  // 5. Player count badge
  await expect(page.locator(".match-count").first()).toBeVisible();
  await expect(page.locator(".match-count").first()).toHaveText(/\d+ \/ \d+ eligible/);

  // 6. Stepper present
  await expect(page.locator(".stepper .count")).toBeVisible();

  // 7. Sticky Split button
  const splitBtn = page.getByTestId("split-button");
  await expect(splitBtn).toBeVisible();
  await expect(splitBtn).toContainText(/Split/);
});
