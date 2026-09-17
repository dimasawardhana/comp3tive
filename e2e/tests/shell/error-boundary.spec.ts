/**
 * Error boundary (ticket 05). A malformed persisted capability reaches a real
 * render path and must show a message instead of a blank page:
 *   SplitScreen:230 → describeFlags → strongestOnTeam → strengthOf → computeStrength
 * computeStrength throws when a capability omits an attribute rating. It throws
 * only with TWO OR MORE eligible covering candidates, because a single one is
 * returned without sorting — hence two malformed players on the flagged team.
 *
 * The world below is seeded by hand rather than through `gotoSeeded`: the shared
 * `seedScript` maps every player to the valid `mlbbCap`, so a deliberately
 * malformed capability is overwritten before it reaches IndexedDB. A11 moves the
 * helper to a capabilities pass-through; until it lands, this spec installs its
 * own script with the helper's structure.
 */
import { expect, test } from "@playwright/test";
import { hubButton, MLBB_ID } from "../../support/seed";

/** An MLBB capability deliberately missing the "teamwork" rating. */
const malformedCap = (role: string) => ({
  disciplineId: MLBB_ID,
  attributeRatings: { mechanics: 4, "game-sense": 4, "hero-pool": 4 },
  eligibleRoles: ["tank", "assassin", "mage", "marksman", "fighter"],
  preferredRole: role,
});

/**
 * IndexedDB seed for the broken world. Same database, stores and keyPath the
 * shared helper uses; the only difference is that each player keeps the
 * capability written here instead of being given `mlbbCap`.
 *
 * The version literal mirrors `DB_VERSION` (`src/storage/indexed-db.ts:18`)
 * exactly as the shared helper does; A11/Task 10 Step 1 adds the project
 * reference that lets both import it instead.
 */
function seedBrokenWorld(): string {
  const db = {
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
    "saved-squads": [],
  };
  return `(() => {
    const STORES = ["communities", "players", "sessions", "tournaments", "saved-squads", "disciplines"];
    const request = indexedDB.open("comp3tive", 6);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: "id" });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      localStorage.setItem("tb-community", "comm-eb");
      for (const [storeName, rows] of Object.entries(${JSON.stringify(db)})) {
        if (!rows.length) continue;
        const tx = db.transaction(storeName, "readwrite");
        for (const row of rows) tx.objectStore(storeName).put(row);
      }
      db.close();
    };
    request.onerror = () => console.error("seed failed");
  })();`;
}

test("a render throw shows the boundary message instead of a blank page", async ({ page }) => {
  await page.addInitScript(seedBrokenWorld());
  await page.goto("./");
  await expect(page.locator(".app")).toBeVisible({ timeout: 15000 });

  await hubButton(page, "History").click();
  await expect(page.locator(".history-row")).toHaveCount(1);

  // Reopening the session renders SplitScreen, which throws.
  await page.locator(".history-row").first().click();

  await expect(page.locator('[data-testid="error-boundary"]')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('[data-testid="error-boundary"]')).toContainText("missing rating");
  await expect(page.getByRole("button", { name: "Reload" })).toBeVisible();
});
