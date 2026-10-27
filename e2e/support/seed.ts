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

/** Every destination a spec can reach by name: the five hubs in their bar, plus
 *  Settings, which is a utility rather than a sixth slot. */
export type HubName = "Home" | "Roster" | "Games" | "History" | "Squads" | "Settings";

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

/** The mlbb discipline id is stable: the e2e seed writes no disciplines, so the app seeds its own catalog. */
export const MLBB_ID = "mlbb";

export const mlbbCap = {
  disciplineId: MLBB_ID,
  attributeRatings: { mechanics: 4, "game-sense": 4, "hero-pool": 4, teamwork: 4 },
  eligibleRoles: ["roam", "jungle", "mid-lane", "gold-lane", "exp-lane"],
  preferredRole: null,
};

/** One split team with a real player on it; the ledger only needs ids. */
export const teamOf = (index: number, playerId: string) => ({
  index,
  slots: [{ playerId, roleId: index === 0 ? "roam" : "jungle" }],
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
  // `createdAt` is filled in only when a spec did not set it, so the value is
  // monotonic in roster order and "newest last" (the interface comment above)
  // stays true for the Dashboard's "recently added", which ranks by it. A spec
  // that cares about a specific instant passes its own.
  const players = world.players.map((p, i) => ({
    createdAt: 1000 + i,
    ...p,
    ...(p.capabilities ? {} : { capabilities: [mlbbCap] }),
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
 * visible label: the SVG icon is `aria-hidden`, so only the text is in the
 * name. Exactly one element matches per name at both widths, because the
 * inactive layout is `display: none` and therefore absent from the
 * accessibility tree. No media-query awareness and no nth() index, so there is
 * no index left to go stale.
 */
export function hubButton(page: Page, name: HubName): Locator {
  return page.getByRole("button", { name, exact: true });
}

/**
 * Open Settings, whichever surface holds it at this width.
 *
 * Settings is a destination but not one of the five hubs, so it does not hold a
 * slot in the bottom bar. On desktop it is the sidebar footer button; on a
 * phone it is inside the menu sheet. This helper is the one place that
 * difference lives, so a spec does not have to know the viewport.
 */
export async function openSettings(page: Page): Promise<void> {
  if (await hubButton(page, "Settings").count() === 0) {
    await page.locator(".topbar-menu").click();
    await expect(page.locator("#phone-menu")).toBeVisible();
  }
  await hubButton(page, "Settings").click();
  await expect(page.locator(".screen h1")).toHaveText("Settings");
}

/** Seed, then load the app, then land on a hub by its accessible name. */
export async function gotoHubSeeded(page: Page, world: SeedWorld, hub: HubName): Promise<void> {
  await gotoSeeded(page, world);
  if (hub === "Settings") {
    await openSettings(page);
    return;
  }
  await hubButton(page, hub).click();
  await expect(page.locator(".screen h1")).toBeVisible();
}

/**
 * Press one of the Roster toolbar's controls by its accessible name.
 *
 * The toolbar's actions are direct buttons (TASK-139 folded the old Actions
 * dropdown away): "Add player" is the primary, and importing and the CSV
 * template are icon buttons that resolve by aria-label. Resolving by name
 * rather than position is unchanged — it is the same contract the menu items
 * carried, one hop shorter.
 */
export async function rosterAction(
  page: Page,
  label: string,
): Promise<void> {
  await page.getByRole("button", { name: label, exact: true }).click();
}

/** The stat card on the Dashboard whose label matches <label>. */
export const statCard = (page: Page, label: string) =>
  page.locator(".dashboard-stat", { has: page.locator(".tournament-meta-card-label", { hasText: label }) });

export const statValue = async (page: Page, label: string): Promise<string> =>
  (await statCard(page, label).locator(".tournament-meta-card-value").innerText()).trim();

/**
 * The tournament's own metadata strip, read by its label rather than its index,
 * so a strip that gains or loses an item does not shift every assertion onto
 * its neighbour.
 */
export const tournamentMeta = (page: Page, label: string) =>
  page
    .locator(".tournament-meta-strip .tms-item", { has: page.locator(".tms-label", { hasText: new RegExp(label, "i") }) })
    .locator(".tms-value");

/**
 * Record one match of a bracket, giving it to the team listed first, over the
 * tournament's BO3.
 *
 * A BO3 is decided at two games, so one picked game is not a result: saving one
 * game leaves the match, and the tournament, undecided. That step is the one a
 * plan got wrong, and it is here rather than in each tournament spec because a
 * second copy is a second thing to keep right.
 */
export async function recordMatch(page: Page, nth: number): Promise<void> {
  await page.locator(".bracket-match").nth(nth).click();
  const modal = page.locator(".modal-card");
  await expect(modal).toBeVisible();
  for (let game = 0; game < 2; game++) {
    await modal.locator(".record-game").nth(game).locator(".chip").first().click();
  }
  await expect(modal.locator(".status")).toContainText(/series decided/i);
  await modal.locator(".btn-primary", { hasText: "Save result" }).click();
  await expect(modal).not.toBeVisible({ timeout: 5000 });
}
