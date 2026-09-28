/**
 * B13: the split screen says whether its gap was proven minimal or is the best
 * the search found before it stopped.
 *
 * This spec seeds its own capabilities rather than using e2e/support/seed.ts's
 * world: that helper normalises every player to one uniform all-rounder, which
 * measures `gap=0, optimal=true, nodes=2` at every team count and can therefore
 * never exercise the best-found path. Both states are the subject here.
 *
 * Measured on HEAD dc58bd5 (shipped solver, 2026-09-28):
 *   PROVEN-A    10 MLBB, teamCount 2 -> optimal=true,  nodes=48,      gap=0.1  "Gap 0.1. Team B leads."
 *   BESTFOUND-A 25 futsal, teamCount 3 -> optimal=false, nodes=4,000,001, gap=0.1323 "Gap 0.1. Team C leads. Best gap found."
 *   BESTFOUND-B 25 futsal, teamCount 5 -> optimal=false, nodes=4,000,001, gap=0     "Dead even. Best gap found."
 */
import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

const MLBB_ROLES = ["tank", "assassin", "mage", "marksman", "fighter"];
const FUTSAL_ROLES = ["goalkeeper", "defender", "winger", "pivot"];

/** teamCount 2 against 10 players is proven: 5+5, gap 0.1 (avg 3.60 / 3.70). */
const PROVEN_TEN = [
  [4, 4, 3, 5], [3, 3, 3, 4], [5, 4, 4, 4], [3, 4, 3, 3], [4, 4, 4, 4],
  [3, 3, 4, 3], [4, 5, 4, 3], [4, 3, 3, 3], [4, 4, 3, 5], [3, 4, 3, 3],
] as const;

interface Seed {
  world: Record<string, unknown[]>;
  activeCommunityId: string;
}

/** Seed IndexedDB before app code runs, then load the app. */
async function gotoSeeded(page: Page, seed: Seed) {
  const script = `(() => {
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
      localStorage.setItem("tb-community", ${JSON.stringify(seed.activeCommunityId)});
      for (const [storeName, rows] of Object.entries(${JSON.stringify(seed.world)})) {
        if (!rows.length) continue;
        const tx = db.transaction(storeName, "readwrite");
        for (const row of rows) tx.objectStore(storeName).put(row);
      }
      db.close();
    };
    request.onerror = () => console.error("seed failed");
  })();`;
  const installed = await page.addInitScript(script);
  await page.goto("./");
  await expect(page.locator(".app")).toBeVisible({ timeout: 15000 });
  // The world is on disk now; a later navigation must not replay it.
  await installed.dispose();
}

const community = { id: "comm-gap", name: "Gap Crew", createdAt: 100 };

/** The 10-player proven pool above. */
const provenPlayers = () =>
  PROVEN_TEN.map((r, i) => ({
    id: `pp-${i + 1}`,
    communityId: "comm-gap",
    name: `Player ${i + 1}`,
    capabilities: [{
      disciplineId: "mlbb",
      attributeRatings: { mechanics: r[0], "game-sense": r[1], "hero-pool": r[2], teamwork: r[3] },
      eligibleRoles: MLBB_ROLES,
      preferredRole: MLBB_ROLES[i % 5],
    }],
  }));

/** 25 futsal players, all four roles eligible, varied ratings: the budget is exhausted. */
const exhaustedPlayers = () =>
  Array.from({ length: 25 }, (_, i) => ({
    id: `fp-${i + 1}`,
    communityId: "comm-gap",
    name: `Player ${i + 1}`,
    capabilities: [{
      disciplineId: "futsal",
      attributeRatings: {
        technical: 1 + ((i * 7) % 5),
        fitness: 1 + ((i * 5) % 5),
        "game-iq": 1 + ((i * 3) % 5),
      },
      eligibleRoles: FUTSAL_ROLES,
      preferredRole: FUTSAL_ROLES[i % 4],
    }],
  }));

/** Walk the Dashboard's "Split match" flow to a split, with teamCount dialled in. */
async function splitWith(page: Page, disciplineName: string, teamCount: number) {
  await page.getByRole("button", { name: "Split match" }).click();
  await expect(page.locator(".match-setup")).toBeVisible({ timeout: 5000 });
  await page.locator(".game", { hasText: disciplineName }).click();
  await expect(page.locator(".chip-player").first()).toBeVisible({ timeout: 5000 });

  // Every eligible player on.
  const chips = page.locator(".chip-player");
  const count = await chips.count();
  for (let i = 0; i < count; i++) {
    const chip = chips.nth(i);
    if ((await chip.getAttribute("aria-pressed")) !== "true") await chip.click();
  }

  // Dial the stepper to the requested team count.
  for (let guard = 0; guard < 10; guard++) {
    const current = Number(await page.locator(".stepper .count").innerText());
    if (current === teamCount) break;
    await page.getByRole("button", { name: current < teamCount ? "More teams" : "Fewer teams" }).click();
  }
  await expect(page.locator(".stepper .count")).toHaveText(String(teamCount));

  await page.getByTestId("split-button").click();
  await expect(page.locator(".split-screen")).toBeVisible({ timeout: 15000 });
}

test.describe("gap provenance", () => {
  test("a proven 2-team split carries no provenance word (the GapMeter site)", async ({ page }) => {
    await gotoSeeded(page, {
      activeCommunityId: "comm-gap",
      world: { communities: [community], players: provenPlayers(), sessions: [], tournaments: [], "saved-squads": [] },
    });
    await splitWith(page, "Mobile Legends", 2);

    // The 2-team branch mounts GapMeter (src/session/SplitScreen.tsx:351).
    await expect(page.locator(".pitch .scale")).toBeVisible();
    // `gapQualifier` returns null when proven, so the readout is the pre-B13 string.
    await expect(page.locator(".readout").first()).toHaveText("Gap 0.1. Team B leads.");
    await expect(page.locator(".readout").first()).not.toContainText("Best gap found.");
  });

  test("an exhausted 3-team split says so (the 3+ stack site)", async ({ page }) => {
    await gotoSeeded(page, {
      activeCommunityId: "comm-gap",
      world: { communities: [community], players: exhaustedPlayers(), sessions: [], tournaments: [], "saved-squads": [] },
    });
    await splitWith(page, "Futsal", 3);

    // The 3+ branch renders its own `.readout` (src/session/SplitScreen.tsx:355-366)
    // and no GapMeter, so this asserts the second site independently.
    await expect(page.locator(".team-stack")).toBeVisible();
    await expect(page.locator(".pitch .scale")).toHaveCount(0);
    await expect(page.locator(".readout").first()).toHaveText("Gap 0.1. Team C leads. Best gap found.");
  });

  test("an exhausted but balanced split says so", async ({ page }) => {
    await gotoSeeded(page, {
      activeCommunityId: "comm-gap",
      world: { communities: [community], players: exhaustedPlayers(), sessions: [], tournaments: [], "saved-squads": [] },
    });
    await splitWith(page, "Futsal", 5);

    await expect(page.locator(".team-stack")).toBeVisible();
    await expect(page.locator(".readout").first()).toHaveText("Dead even. Best gap found.");
  });

  test("re-rolling a proven split makes the qualifier appear", async ({ page }) => {
    await gotoSeeded(page, {
      activeCommunityId: "comm-gap",
      world: { communities: [community], players: provenPlayers(), sessions: [], tournaments: [], "saved-squads": [] },
    });
    await splitWith(page, "Mobile Legends", 2);

    await expect(page.locator(".readout").first()).toHaveText("Gap 0.1. Team B leads.");

    // Re-roll goes through varietySplit, which stamps optimal: false.
    await page.getByRole("button", { name: "Re-roll" }).click();
    await expect(page.locator(".readout").first()).toContainText("Best gap found.");
  });
});
