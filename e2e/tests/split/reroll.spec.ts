/**
 * Re-roll (ticket 03). The defect, reproduced live: ten players, two teams, two
 * clicks on Re-roll, identical teams both times while the badge advanced to
 * "Roll #3".
 *
 * The seed is the settled split exactly as `fairSplit` produces it for the ten
 * placed players, which is what makes the pre-fix no-op reproducible: `reroll`
 * rebuilt its pool from `result.teams`, so the deterministic solver returned
 * the same ten again. `poolPlayerIds` holds an eleventh player (Player 11) who
 * sat out — eligible again only once the pool is the session's own.
 */
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { gotoHubSeeded, MLBB_ID, type SeedWorld } from "../../support/seed";

const MLBB_ROLES = ["tank", "assassin", "mage", "marksman", "fighter"];

/** One MLBB team whose slots fill the five roles in order; the ledger needs no more. */
const mlbbTeam = (index: number, playerIds: string[]) => ({
  index,
  slots: playerIds.map((playerId, i) => ({ playerId, roleId: MLBB_ROLES[i] ?? null })),
  totalStrength: playerIds.length * 4,
  avgStrength: 4,
});

const elevenPlayersWorld = (): SeedWorld => {
  const players = Array.from({ length: 11 }, (_, i) => ({
    id: `p${i + 1}`,
    communityId: "comm-reroll",
    name: `Player ${i + 1}`,
    capabilities: [
      {
        disciplineId: MLBB_ID,
        attributeRatings: { mechanics: 4, "game-sense": 4, "hero-pool": 4, teamwork: 4 },
        eligibleRoles: MLBB_ROLES,
        preferredRole: null,
      },
    ],
  }));
  const ids = players.map((p) => p.id);
  return {
    communities: [{ id: "comm-reroll", name: "Reroll Crew", createdAt: 100 }],
    players,
    sessions: [
      {
        id: "sess-reroll",
        communityId: "comm-reroll",
        disciplineId: MLBB_ID,
        createdAt: 500,
        poolPlayerIds: ids,
        settings: { teamCount: 2 },
        result: {
          teams: [mlbbTeam(0, ["p1", "p2", "p4", "p6", "p8"]), mlbbTeam(1, ["p10", "p3", "p5", "p7", "p9"])],
          gap: 0,
          flags: [{ kind: "leftover", playerId: "p11" }],
          unassigned: ["p11"],
          solver: { optimal: true, nodesExplored: 0, elapsedMs: 0 },
        },
      },
    ],
    tournaments: [],
    squads: [],
    activeCommunityId: "comm-reroll",
  };
};

/** The rendered membership, in DOM order: each team is a `.team`, each slot a `.player-name`. */
async function renderedTeams(page: Page): Promise<string> {
  return (await page.locator(".split-screen .team .player-name").allTextContents()).join("|");
}

test("re-roll renders different teams and counts only real rolls", async ({ page }) => {
  await gotoHubSeeded(page, elevenPlayersWorld(), "History");

  // Reopen the seeded session: the split screen is reachable from History.
  await expect(page.locator(".history-row")).toHaveCount(1);
  await page.locator(".history-row").first().click();
  await expect(page.locator(".split-screen")).toBeVisible({ timeout: 10000 });

  // Roll #1 is the settled split; the badge only appears past that.
  await expect(page.locator(".split-head-meta")).not.toContainText("Roll #");

  const before = await renderedTeams(page);
  expect(before).not.toBe("");
  expect(before).not.toContain("Player 11"); // sat out on roll #1

  await page.getByRole("button", { name: "Re-roll" }).click();
  await expect(page.locator(".split-head-meta")).toContainText("Roll #2", { timeout: 10000 });
  const afterFirst = await renderedTeams(page);
  expect(afterFirst).not.toBe(before);
  // The pool is the session's own, so the player who sat out is eligible again.
  expect(afterFirst).toContain("Player 11");

  await page.getByRole("button", { name: "Re-roll" }).click();
  await expect(page.locator(".split-head-meta")).toContainText("Roll #3", { timeout: 10000 });
  expect(await renderedTeams(page)).not.toBe(afterFirst);
});
