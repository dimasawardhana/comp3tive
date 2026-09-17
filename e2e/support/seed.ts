/**
 * Shared e2e world-building (ticket 01, extended by ticket 11).
 *
 * Every spec seeds a known world directly through IndexedDB in `addInitScript`,
 * so it lands before app code reads the stores. Shape notes the seeds rely on:
 * - All stores live in one database ("comp3tive"), one object store per
 *   aggregate, keyed by id. Object-store keys are written in the order the app
 *   expects its lists: communities by creation (first-created = first item),
 *   players/sessions/squads/tournaments newest LAST, so the app's newest-first
 *   sort puts the newest FIRST.
 * - localStorage "tb-community" pins the active community; an unknown value
 *   makes the app fall back to the first community in list order.
 * - The discipline catalog is deliberately left empty: useDisciplines restores
 *   SEED_DISCIPLINES when the catalog is empty.
 */
import { test, expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

/** The five hub destinations, matching NAV_ITEMS (src/App.tsx:62-68). */
export type HubName = "Home" | "Roster" | "Games" | "History" | "Squads";

export interface SeedWorld {
  communities: { id: string; name: string; createdAt: number }[];
  /** Roster players, newest last. */
  players: Array<Record<string, unknown>>;
  /** Sessions (history rows), newest last. */
  sessions: Array<Record<string, unknown>>;
  /** Tournaments (draft/active count on the dashboard), newest last. */
  tournaments: Array<Record<string, unknown>>;
  /** Saved squads, newest last. */
  squads: Array<Record<string, unknown>>;
  /** id of the community the app should treat as active. */
  activeCommunityId: string;
}

/** The mlbb discipline id is stable: futsal and mlbb are seeded in key order. */
export const MLBB_ID = "mlbb";

export const mlbbCap = {
  disciplineId: MLBB_ID,
  attributeRatings: { mechanics: 4, "game-sense": 4, "hero-pool": 4, teamwork: 4 },
  eligibleRoles: ["tank", "assassin", "mage", "marksman", "fighter"],
  preferredRole: null,
};

/** One split team with a real player on it; the ledger only needs ids. */
export const teamOf = (index: number, playerId: string) => ({
  index,
  slots: [{ playerId, roleId: index === 0 ? "tank" : "assassin" }],
  totalStrength: 16,
  avgStrength: 4,
});

/** A minimal fair-split result; the dashboard never reads past the shape. */
export const splitOf = (playerIds: string[]) => ({
  teams: playerIds.map((id, i) => teamOf(i, id)),
  gap: 0,
  flags: [],
  unassigned: [],
  solver: { optimal: true, nodesExplored: 0, elapsedMs: 0 },
});

/** Turn a world into an init script that seeds IndexedDB before app code runs. */
export function seedScript(world: SeedWorld): string {
  const players = world.players.map((p) => ({
    id: p.id,
    communityId: p.communityId,
    name: p.name,
    capabilities: [mlbbCap],
  }));
  const db = {
    communities: world.communities,
    players,
    sessions: world.sessions,
    tournaments: world.tournaments,
    "saved-squads": world.squads,
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
      localStorage.setItem("tb-community", ${JSON.stringify(world.activeCommunityId)});
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

/** Seed a world, then load the app (which lands on the Dashboard). */
export async function gotoSeeded(page: Page, world: SeedWorld): Promise<void> {
  await page.addInitScript(seedScript(world));
  await page.goto("./");
  await expect(page.locator(".app")).toBeVisible({ timeout: 15000 });
}

/**
 * Click a hub by its accessible name. Each nav button's accessible name IS its
 * visible label: the icon span carries aria-hidden="true" (src/App.tsx:1273), so
 * the glyph is excluded. Exactly one element matches per name at both widths,
 * because the inactive layout is display: none and therefore absent from the
 * accessibility tree (src/index.css:1677-1679). No media-query awareness, no
 * nth() index — and so no index left to go stale.
 */
export function hubButton(page: Page, name: HubName): Locator {
  return page.getByRole("button", { name, exact: true });
}

/** Seed, then load the app, then land on a hub by its accessible name. */
export async function gotoHubSeeded(page: Page, world: SeedWorld, hub: HubName): Promise<void> {
  await gotoSeeded(page, world);
  await hubButton(page, hub).click();
  await expect(page.locator(".screen h1")).toBeVisible();
}

/** The stat card on the Dashboard whose label matches <label>. */
export const statCard = (page: Page, label: string) =>
  page.locator(".dashboard-stat", { has: page.locator(".tournament-meta-card-label", { hasText: label }) });

export const statValue = async (page: Page, label: string): Promise<string> =>
  (await statCard(page, label).locator(".tournament-meta-card-value").innerText()).trim();
