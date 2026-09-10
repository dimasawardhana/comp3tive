import { test, expect } from "@playwright/test";

const mlbbCap = (pref: string) => ({
  disciplineId: "mlbb",
  attributeRatings: { mechanics: 4, "game-sense": 4, "hero-pool": 4, teamwork: 4 },
  eligibleRoles: ["tank", "assassin", "mage", "marksman", "fighter"],
  preferredRole: pref,
});

test("saved squad flow: save from split, list, use in tournament", async ({ page }) => {
  await page.goto("http://localhost:4173/");
  await expect(page.locator(".app")).toBeVisible({ timeout: 15000 });

  // Work in the active community (Default on a fresh profile). Re-imports
  // upsert by id, so reruns converge on the same 10 players.
  await expect(page.locator(".squad-select-value")).toBeVisible({ timeout: 5000 });
    // The app lands on the Dashboard; the roster toolbar lives on the Roster hub.
  await page.getByRole("button", { name: "Roster" }).click();
  await expect(page.getByText("+ Add Player")).toBeVisible({ timeout: 5000 });

  // Import a players-only roster (10 MLBB-eligible players) via the toolbar input.
  const roles = ["tank", "assassin", "mage", "marksman", "fighter"];
  const names = ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel", "India", "Juliet"];
  const players = names.map((n, i) => ({
    id: `p${i + 1}`,
    name: n,
    capabilities: [mlbbCap(roles[i % 5])],
  }));
  const buffer = Buffer.from(JSON.stringify({ players }), "utf8");
  await page.setInputFiles('input[type="file"]', {
    name: "roster.json",
    mimeType: "application/json",
    buffer,
  });
  await expect(page.getByText("Alpha")).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("Juliet")).toBeVisible({ timeout: 5000 });

  // Ad-hoc split: switch to MLBB, confirm all 10 players on, split 2 teams.
  await page.getByRole("button", { name: "Split match" }).click();
  await expect(page.locator(".match-setup")).toBeVisible({ timeout: 5000 });
  await page.locator(".game", { hasText: "Mobile Legends" }).click();
  await expect(page.locator(".chip-player").first()).toBeVisible({ timeout: 5000 });
  const chipCount = await page.locator(".chip-player").count();
  expect(chipCount).toBe(10);
  for (let i = 0; i < chipCount; i++) {
    const chip = page.locator(".chip-player").nth(i);
    if ((await chip.getAttribute("aria-pressed")) !== "true") await chip.click();
  }
  // Raise team count to 2 if the discipline switch recomputed it down.
  for (let guard = 0; guard < 4; guard++) {
    if ((await page.locator(".stepper .count").innerText()) === "2") break;
    await page.getByRole("button", { name: "More teams" }).click();
  }
  await expect(page.locator(".stepper .count")).toHaveText("2");
  await page.getByTestId("split-button").click();
  await expect(page.locator(".split-screen")).toBeVisible({ timeout: 10000 });

  // Save as a named squad.
  await page.getByTestId("save-squad-button").click();
  const modal = page.locator(".modal-card");
  await expect(modal).toBeVisible();
  await page.locator("#squad-name").fill("Friday Scrims");
  await page.locator(".modal-card .btn-primary").click();
  await expect(modal).not.toBeVisible({ timeout: 5000 });

  // Squads tab lists it.
  await page.locator(".bottom-nav .nav-link").nth(4).click();
  await expect(page.locator(".screen h1")).toHaveText("Saved squads");
  await expect(page.getByText("Friday Scrims")).toBeVisible({ timeout: 5000 });

  // Detail view shows the two teams with real player names.
  await page.locator(".history-row", { hasText: "Friday Scrims" }).click();
  await expect(page.locator(".screen h1")).toHaveText("Friday Scrims");
  await expect(page.locator(".review-team")).toHaveCount(2);
  const detailNames = await page.locator(".review-team-players li").allTextContents();
  expect(detailNames.length).toBe(10);
  expect(detailNames.every((n) => names.includes(n))).toBe(true);

  // Back to the list.
  await page.getByRole("button", { name: "← Squads" }).click();

  // Create a 2-team MLBB Series tournament.
  await page.locator(".bottom-nav .nav-link").nth(1).click();
  await page.getByRole("button", { name: "+ New tournament" }).first().click();
  await page.locator("#tournament-name").fill("Smoke Series");
  await page.locator(".chip", { hasText: "MLBB" }).click();
  await page.locator(".chip", { hasText: "Series" }).click();
  await page.locator(".modal-card .btn-primary").click();
  await expect(page.locator(".modal-card")).not.toBeVisible({ timeout: 5000 });

  // Draft page surfaces the matching saved squad (Series = 2 teams, MLBB).
  await expect(page.getByTestId("split-teams-cta")).toBeVisible();
  await expect(page.getByText("Friday Scrims")).toBeVisible({ timeout: 5000 });

  // Consume it -> bracket built from the saved teams (snapshot semantics).
  await page.locator("[data-testid^='use-squad-']").click();
  await expect(page.locator(".tournament-header h1")).toHaveText("Smoke Series", { timeout: 5000 });
  await expect(page.locator(".bracket-match").first()).toContainText("Team A");
  await expect(page.locator(".bracket-match").first()).toContainText("Team B");
});
