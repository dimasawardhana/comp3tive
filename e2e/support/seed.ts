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
 * - A player row that carries its own `capabilities` keeps them; a row that
 *   supplies none gets `mlbbCap`. That is what makes a futsal-capable or a
 *   deliberately malformed player seedable.
 *
 * `gotoSeeded` disposes its init script as soon as the app has rendered. A
 * seeded world's only job is to establish the starting state, and Playwright
 * replays an init script on every navigation, so leaving it installed would
 * make a later `page.reload()` re-apply the seed over whatever the test did in
 * the app: deleted rows come back and edits are undone, and a persistence
 * assertion ends up testing the harness instead of the app. The seed has landed
 * once the app is on screen, so the script is removed there and no spec has to
 * remember to do it. (`e2e/tests/roster/delete-row.spec.ts` held the returned
 * Disposable by hand before this was built into the helper.)
 */
import { expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { DB_VERSION } from "../../src/storage/indexed-db";

/** Re-exported for specs that read IndexedDB themselves (e.g. persistence probes). */
export { DB_VERSION };

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
  // Capabilities pass through: a row that carries its own keeps it, so
  // futsal-capable and deliberately-malformed players are both seedable. A row
  // that supplies none gets the MLBB default, which is the only discipline the
  // unqualified worlds below mean.
  const players = world.players.map((p) => (p.capabilities ? p : { ...p, capabilities: [mlbbCap] }));
  const db = {
    communities: world.communities,
    players,
    sessions: world.sessions,
    tournaments: world.tournaments,
    "saved-squads": world.squads,
  };
  return `(() => {
    const STORES = ["communities", "players", "sessions", "tournaments", "saved-squads", "disciplines"];
    const request = indexedDB.open("comp3tive", ${DB_VERSION});
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
  const seed = await page.addInitScript(seedScript(world));
  await page.goto("./");
  await expect(page.locator(".app")).toBeVisible({ timeout: 15000 });
  // The world is on disk now; a later navigation must not replay it (see header).
  await seed.dispose();
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
