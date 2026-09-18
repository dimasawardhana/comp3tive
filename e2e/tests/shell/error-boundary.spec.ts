/**
 * Error boundary (ticket 05). A malformed persisted capability reaches a real
 * render path and must show a message instead of a blank page:
 *   SplitScreen:230 → describeFlags → strongestOnTeam → strengthOf → computeStrength
 * computeStrength throws when a capability omits an attribute rating. It throws
 * only with TWO OR MORE eligible covering candidates, because a single one is
 * returned without sorting — hence two malformed players on the flagged team.
 *
 * The world is seeded through the shared helper, which passes each row's own
 * capabilities through instead of overwriting them with the valid `mlbbCap`.
 */
import { expect, test } from "@playwright/test";
import { gotoHubSeeded, MLBB_ID, type SeedWorld } from "../../support/seed";

/** An MLBB capability deliberately missing the "teamwork" rating. */
const malformedCap = (role: string) => ({
  disciplineId: MLBB_ID,
  attributeRatings: { mechanics: 4, "game-sense": 4, "hero-pool": 4 },
  eligibleRoles: ["tank", "assassin", "mage", "marksman", "fighter"],
  preferredRole: role,
});

const world = (): SeedWorld => ({
  communities: [{ id: "comm-eb", name: "Boundary Crew", createdAt: 100 }],
  players: [
    { id: "p1", communityId: "comm-eb", name: "Player One", capabilities: [malformedCap("tank")] },
    { id: "p2", communityId: "comm-eb", name: "Player Two", capabilities: [malformedCap("fighter")] },
  ],
  sessions: [
    {
      id: "sess-eb",
      communityId: "comm-eb",
      disciplineId: MLBB_ID,
      createdAt: 500,
      poolPlayerIds: ["p1", "p2"],
      settings: { teamCount: 1 },
      result: {
        teams: [
          {
            index: 0,
            slots: [
              { playerId: "p1", roleId: null },
              { playerId: "p2", roleId: null },
            ],
            totalStrength: 8,
            avgStrength: 4,
          },
        ],
        gap: 0,
        // The flag is what routes describeFlags into strongestOnTeam; without
        // it the throw is never reached.
        flags: [{ kind: "role-uncovered", teamIndex: 0, roleId: "tank", coveringPlayerId: null }],
        unassigned: [],
        solver: { optimal: true, nodesExplored: 0, elapsedMs: 0 },
      },
    },
  ],
  tournaments: [],
  squads: [],
  activeCommunityId: "comm-eb",
});

test("a render throw shows the boundary message instead of a blank page", async ({ page }) => {
  await gotoHubSeeded(page, world(), "History");
  await expect(page.locator(".history-row")).toHaveCount(1);

  // Reopening the session renders SplitScreen, which throws.
  await page.locator(".history-row").first().click();

  await expect(page.locator('[data-testid="error-boundary"]')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('[data-testid="error-boundary"]')).toContainText("missing rating");
  await expect(page.getByRole("button", { name: "Reload" })).toBeVisible();
});
