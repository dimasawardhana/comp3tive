/**
 * Dashboard hub coverage (ticket 05). Every test seeds a known world directly
 * through IndexedDB (same "direct store manipulation" seam setup.spec uses —
 * the dashboard is view composition over the existing community-scoped lists,
 * so the fast, deterministic path is to control the lists themselves). Seeding
 * happens in addInitScript so it lands before app code reads the stores.
 *
 * DB shape notes the seeds rely on:
 * - All stores live in one database ("team-builder"), one object store per
 *   aggregate, keyed by id, ordered by key within the store. Object-store keys
 *   are written in the same order the app expects its lists: communities by
 *   creation (first-created = first item), players/sessions/squads/tournaments
 *   with newest LAST so the app's newest-first sort puts the newest FIRST.
 * - localStorage "tb-community" pins the active community; an unknown value
 *   makes the app fall back to the first community in list order.
 * - The discipline catalog is seeded on first open (futsal, mlbb). Disciplines
 *   are global (not community-scoped) so both communities share them.
 *
 * The app under test lands on the Dashboard on every fresh load (ADR-0005).
 */
import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

/** mlbb discipline id is stable: futsal and mlbb are seeded in key order. */
const MLBB_ID = "mlbb";

interface SeedWorld {
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

const mlbbCap = {
  disciplineId: MLBB_ID,
  attributeRatings: { mechanics: 4, "game-sense": 4, "hero-pool": 4, teamwork: 4 },
  eligibleRoles: ["tank", "assassin", "mage", "marksman", "fighter"],
  preferredRole: null,
};

/** One split team with a real player on it; the ledger only needs ids. */
const teamOf = (index: number, playerId: string) => ({
  index,
  slots: [{ playerId, roleId: index === 0 ? "tank" : "assassin" }],
  totalStrength: 16,
  avgStrength: 4,
});

/** A minimal fair-split result; the dashboard never reads past the shape. */
const splitOf = (playerIds: string[]) => ({
  teams: playerIds.map((id, i) => teamOf(i, id)),
  gap: 0,
  flags: [],
  unassigned: [],
  solver: { optimal: true, nodesExplored: 0, elapsedMs: 0 },
});

/** Turn a world into an init script that seeds IndexedDB before app code runs. */
function seedScript(world: SeedWorld): string {
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
    const request = indexedDB.open("team-builder", 6);
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
async function gotoSeeded(page: Page, world: SeedWorld) {
  await page.addInitScript(seedScript(world));
  await page.goto("http://localhost:4173/");
  await expect(page.locator(".app")).toBeVisible({ timeout: 15000 });
}

/** Click a bottom-nav slot by its accessible label. */
const hub = (page: Page, name: string) => page.getByRole("button", { name, exact: true });

/** The stat card on the Dashboard whose label matches <label>. */
const statCard = (page: Page, label: string) =>
  page.locator(".dashboard-stat", { has: page.locator(".tournament-meta-card-label", { hasText: label }) });

const statValue = async (page: Page, label: string) =>
  (await statCard(page, label).locator(".tournament-meta-card-value").innerText()).trim();

const twoCommunities = (): SeedWorld => ({
  communities: [
    { id: "comm-alpha", name: "Alpha Crew", createdAt: 100 },
    { id: "comm-beta", name: "Beta Guild", createdAt: 200 },
  ],
  players: [],
  sessions: [],
  tournaments: [],
  squads: [],
  activeCommunityId: "comm-alpha",
});

test("fresh load lands on the Dashboard with a centered Home tab", async ({ page }) => {
  await gotoSeeded(page, twoCommunities());

  // ADR-0005: the view stack root is the dashboard view; every fresh load lands here.
  await expect(page.locator(".screen h1")).toHaveText("Dashboard");

  // The five-slot layout: Roster · Games · Home · History · Squads, Home centered.
  const nav = page.locator(".bottom-nav .nav-link");
  await expect(nav).toHaveCount(5);
  // The visible text carries the glyphs ("⌂Home"); assert the accessible slot
  // labels (aria-labels) instead of rendered text.
  await expect(nav.nth(0)).toHaveAttribute("aria-label", "Roster");
  await expect(nav.nth(1)).toHaveAttribute("aria-label", "Games");
  await expect(nav.nth(2)).toHaveAttribute("aria-label", "Home");
  await expect(nav.nth(3)).toHaveAttribute("aria-label", "History");
  await expect(nav.nth(4)).toHaveAttribute("aria-label", "Saved squads");
  // Home marks the dashboard as current (the stack root is the dashboard view).
  await expect(hub(page, "Home")).toHaveAttribute("aria-current", "page");
});

test("Home tab returns to the Dashboard from each hub", async ({ page }) => {
  await gotoSeeded(page, twoCommunities());

  // The Squads nav slot carries the accessible label "Saved squads" (its h1 too).
  const hubs = [
    ["Roster", "comp3tive"],
    ["Games", "Games"],
    ["History", "History"],
    ["Saved squads", "Saved squads"],
  ] as const;
  for (const [navLabel, hubH1] of hubs) {
    await hub(page, navLabel).click();
    await expect(page.locator(".screen h1")).toHaveText(hubH1);
    await hub(page, "Home").click();
    await expect(page.locator(".screen h1")).toHaveText("Dashboard");
    await expect(hub(page, "Home")).toHaveAttribute("aria-current", "page");
  }
});

test("dashboard stat cards are community-scoped and update on community switch", async ({ page }) => {
  const world: SeedWorld = {
    communities: [
      { id: "comm-alpha", name: "Alpha Crew", createdAt: 100 },
      { id: "comm-beta", name: "Beta Guild", createdAt: 200 },
    ],
    // Alpha owns 4 players, 1 saved squad, 1 tournament; Beta owns none.
    players: [
      { id: "al-1", communityId: "comm-alpha", name: "Alpha One" },
      { id: "al-2", communityId: "comm-alpha", name: "Alpha Two" },
      { id: "al-3", communityId: "comm-alpha", name: "Alpha Three" },
      { id: "al-4", communityId: "comm-alpha", name: "Alpha Four" },
    ],
    squads: [
      {
        id: "sq-alpha",
        communityId: "comm-alpha",
        name: "Alpha Squad",
        disciplineId: MLBB_ID,
        createdAt: 300,
        poolPlayerIds: ["al-1", "al-2", "al-3", "al-4"],
        settings: { teamCount: 2 },
        result: splitOf(["al-1", "al-2", "al-3", "al-4"]),
      },
    ],
    tournaments: [
      {
        id: "tr-alpha",
        communityId: "comm-alpha",
        disciplineId: MLBB_ID,
        name: "Alpha Cup",
        format: "series",
        seriesLength: 3,
        teamCount: 2,
        thirdPlace: false,
        createdAt: 400,
        status: "draft",
        teams: [],
        matches: [],
      },
    ],
    sessions: [],
    activeCommunityId: "comm-alpha",
  };
  await gotoSeeded(page, world);

  // Alpha: 4 players / 1 squad / 1 tournament (draft counts on the dashboard).
  await expect(page.locator(".screen h1")).toHaveText("Dashboard");
  const lede = page.locator(".screen .lede");
  await expect(lede).toContainText("Alpha Crew");
  await expect(page.locator(".dashboard-stats")).toBeVisible();
  expect(await statValue(page, "Players")).toBe("4");
  expect(await statValue(page, "Saved squads")).toBe("1");
  expect(await statValue(page, "Tournaments")).toBe("1");

  // Switch to Beta via the community dropdown (squad-switcher in the topbar).
  await page.getByRole("button", { name: "Active community" }).click();
  await page.locator(".squad-menu-item", { hasText: "Beta Guild" }).click();
  await expect(page.locator(".squad-select-value")).toHaveText("Beta Guild");

  // Beta has no players: the guided empty state replaces the stat cards, and
  // the lede names the newly active community.
  await expect(page.locator(".screen h1")).toHaveText("Dashboard");
  await expect(lede).toContainText("Beta Guild");
  await expect(page.locator(".dashboard-stats")).not.toBeVisible();
  await expect(page.locator(".dashboard-empty")).toBeVisible();
  await expect(page.locator(".dashboard-empty .big")).toHaveText("Run your first split");
});

test("a fresh community shows the guided empty state instead of stat cards", async ({ page }) => {
  // One community, zero players: the first-run state on the landing hub.
  await gotoSeeded(page, {
    communities: [{ id: "comm-fresh", name: "Fresh Start", createdAt: 100 }],
    players: [],
    sessions: [],
    tournaments: [],
    squads: [],
    activeCommunityId: "comm-fresh",
  });

  await expect(page.locator(".screen h1")).toHaveText("Dashboard");
  await expect(page.locator(".dashboard-empty")).toBeVisible();
  await expect(page.locator(".dashboard-empty .big")).toHaveText("Run your first split");
  await expect(page.locator(".dashboard-empty")).toContainText("Add players to the roster");
  // The stat cards are gone (zero cards would otherwise read as empty zeros).
  await expect(page.locator(".dashboard-stats")).not.toBeVisible();

  // Without players nothing can be split yet: the primary CTA is disabled and
  // the guided empty state offers the add-players entry instead.
  const split = page.getByRole("button", { name: "Split match", exact: true });
  await expect(split).toBeDisabled();
  await expect(page.locator(".dashboard-empty .btn-primary")).toHaveText("+ Add players");

  // Home still marks the dashboard as current (the dashboard is the root hub).
  await expect(hub(page, "Home")).toHaveAttribute("aria-current", "page");
});

test("dashboard actions land on their destinations", async ({ page }) => {
  const world: SeedWorld = {
    communities: [{ id: "comm-alpha", name: "Alpha Crew", createdAt: 100 }],
    players: [
      { id: "al-1", communityId: "comm-alpha", name: "Alpha One" },
      { id: "al-2", communityId: "comm-alpha", name: "Alpha Two" },
      { id: "al-3", communityId: "comm-alpha", name: "Alpha Three" },
      { id: "al-4", communityId: "comm-alpha", name: "Alpha Four" },
    ],
    sessions: [],
    tournaments: [],
    squads: [],
    activeCommunityId: "comm-alpha",
  };
  await gotoSeeded(page, world);

  await expect(page.locator(".screen h1")).toHaveText("Dashboard");

  // Split match -> the match setup screen (the ad-hoc split flow's first stop).
  await page.getByRole("button", { name: "Split match", exact: true }).click();
  await expect(page.locator(".screen h1")).toHaveText("Set the match");
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.locator(".screen h1")).toHaveText("Dashboard");

  // + New tournament -> the Games hub with the create modal open.
  await page.getByRole("button", { name: "+ New tournament" }).click();
  // The modal's h1 also lives inside .screen, so assert the hub title via the
  // non-modal heading only (same pattern as the add-player assertion below).
  await expect(page.locator(".screen h1:not(.modal-title)")).toHaveText("Games");
  await expect(page.locator(".modal-title")).toHaveText("New tournament");
  // The modal overlays the nav, so close it (X) before travelling Home.
  await page.locator(".modal-card .modal-close").click();
  await expect(page.locator(".modal-card")).not.toBeVisible();
  await hub(page, "Home").click();
  await expect(page.locator(".screen h1")).toHaveText("Dashboard");

  // Browse saved squads -> the Squads hub.
  await page.getByRole("button", { name: "Browse saved squads" }).click();
  await expect(page.locator(".screen h1")).toHaveText("Saved squads");
  await hub(page, "Home").click();
  await expect(page.locator(".screen h1")).toHaveText("Dashboard");

  // + Add player -> the Roster hub with the add-player modal open. The roster
  // h1 ("comp3tive") sits in the same .screen as the modal, so assert the
  // modal directly — it is only reachable from the Roster hub.
  await page.getByRole("button", { name: "+ Add player" }).click();
  await expect(page.locator(".modal-card")).toBeVisible();
  await expect(page.locator(".modal-title")).toHaveText("Add player");
});

test("History and Games show only the active community's records and counts match", async ({ page }) => {
  const world: SeedWorld = {
    communities: [
      { id: "comm-alpha", name: "Alpha Crew", createdAt: 100 },
      { id: "comm-beta", name: "Beta Guild", createdAt: 200 },
    ],
    players: [
      { id: "al-1", communityId: "comm-alpha", name: "Alpha One" },
      { id: "al-2", communityId: "comm-alpha", name: "Alpha Two" },
      { id: "al-3", communityId: "comm-alpha", name: "Alpha Three" },
      { id: "al-4", communityId: "comm-alpha", name: "Alpha Four" },
      { id: "be-1", communityId: "comm-beta", name: "Beta One" },
    ],
    sessions: [
      {
        id: "ss-alpha",
        communityId: "comm-alpha",
        disciplineId: MLBB_ID,
        createdAt: 500,
        poolPlayerIds: ["al-1", "al-2", "al-3", "al-4"],
        settings: { teamCount: 2 },
        result: splitOf(["al-1", "al-2", "al-3", "al-4"]),
      },
    ],
    tournaments: [
      {
        id: "tr-alpha",
        communityId: "comm-alpha",
        disciplineId: MLBB_ID,
        name: "Alpha Cup",
        format: "series",
        seriesLength: 3,
        teamCount: 2,
        thirdPlace: false,
        createdAt: 400,
        status: "active",
        teams: [],
        matches: [],
      },
    ],
    squads: [
      {
        id: "sq-alpha",
        communityId: "comm-alpha",
        name: "Alpha Squad",
        disciplineId: MLBB_ID,
        createdAt: 300,
        poolPlayerIds: ["al-1", "al-2", "al-3", "al-4"],
        settings: { teamCount: 2 },
        result: splitOf(["al-1", "al-2", "al-3", "al-4"]),
      },
    ],
    activeCommunityId: "comm-alpha",
  };
  await gotoSeeded(page, world);

  // Alpha dashboard: 4 players / 1 squad / 1 tournament.
  await expect(page.locator(".screen h1")).toHaveText("Dashboard");
  expect(await statValue(page, "Players")).toBe("4");
  expect(await statValue(page, "Saved squads")).toBe("1");
  expect(await statValue(page, "Tournaments")).toBe("1");

  // Alpha History: its one session is listed (Beta has no sessions to leak).
  await hub(page, "History").click();
  await expect(page.locator(".screen h1")).toHaveText("History");
  await expect(page.locator(".history-row")).toHaveCount(1);

  // Alpha Games: its one tournament is listed.
  await hub(page, "Games").click();
  await expect(page.locator(".screen h1")).toHaveText("Games");
  await expect(page.locator(".roster .row")).toHaveCount(1);
  await expect(page.locator(".roster .row").first()).toContainText("Alpha Cup");

  // Switch to Beta via the community dropdown.
  await page.getByRole("button", { name: "Active community" }).click();
  await page.locator(".squad-menu-item", { hasText: "Beta Guild" }).click();
  await expect(page.locator(".squad-select-value")).toHaveText("Beta Guild");

  // Beta owns nothing of its own: History and Games show their empty states,
  // not Alpha's records.
  await hub(page, "History").click();
  await expect(page.locator(".empty .big")).toHaveText("Sessions appear here");
  await hub(page, "Games").click();
  await expect(page.locator(".empty .big")).toHaveText("Run a competition");

  // The dashboard counts follow the active community: 1 Beta player, 0 / 0.
  await hub(page, "Home").click();
  await expect(page.locator(".screen h1")).toHaveText("Dashboard");
  expect(await statValue(page, "Players")).toBe("1");
  expect(await statValue(page, "Saved squads")).toBe("0");
  expect(await statValue(page, "Tournaments")).toBe("0");
});
test("dashboard teasers show the newest players and active tournaments and drill in", async ({ page }) => {
  const world: SeedWorld = {
    communities: [{ id: "comm-alpha", name: "Alpha Crew", createdAt: 100 }],
    players: [
      { id: "al-1", communityId: "comm-alpha", name: "Alpha One" },
      { id: "al-2", communityId: "comm-alpha", name: "Alpha Two" },
      { id: "al-3", communityId: "comm-alpha", name: "Alpha Three" },
      { id: "al-4", communityId: "comm-alpha", name: "Alpha Four" },
    ],
    sessions: [],
    tournaments: [
      // Newest first per the seed convention; two active + one draft + one complete.
      {
        id: "tr-live",
        communityId: "comm-alpha",
        disciplineId: MLBB_ID,
        name: "Live Cup",
        format: "series",
        seriesLength: 3,
        teamCount: 2,
        thirdPlace: false,
        createdAt: 900,
        status: "active",
        teams: [
          { id: "team-1", bibIndex: 0, name: "Team A", strength: 4, players: ["al-1", "al-2"] },
          { id: "team-2", bibIndex: 1, name: "Team B", strength: 4, players: ["al-3", "al-4"] },
        ],
        matches: [{ id: "m-1-0", round: 1, position: 0, teamAId: "team-1", teamBId: "team-2", games: [], winnerTeamId: null, winnerNext: null, loserNext: null }],
      },
      {
        id: "tr-draft",
        communityId: "comm-alpha",
        disciplineId: MLBB_ID,
        name: "Draft Cup",
        format: "swiss",
        seriesLength: 3,
        teamCount: 4,
        thirdPlace: false,
        createdAt: 800,
        status: "draft",
        teams: [],
        matches: [],
      },
      {
        id: "tr-complete",
        communityId: "comm-alpha",
        disciplineId: MLBB_ID,
        name: "Old Cup",
        format: "series",
        seriesLength: 1,
        teamCount: 2,
        thirdPlace: false,
        createdAt: 700,
        status: "complete",
        teams: [],
        matches: [],
      },
    ],
    squads: [],
    activeCommunityId: "comm-alpha",
  };
  await gotoSeeded(page, world);

  await expect(page.locator(".screen h1")).toHaveText("Dashboard");
  // Recent players: the three newest, in roster order (last three of the
  // insertion order: Two, Three, Four), each with an MLBB badge.
  const playerTeasers = page.locator('section[aria-label="Recent players"] .row');
  await expect(playerTeasers).toHaveCount(3);
  await expect(playerTeasers.first()).toContainText("Alpha Two");
  await expect(playerTeasers.nth(1)).toContainText("Alpha Three");
  await expect(playerTeasers.nth(2)).toContainText("Alpha Four");
  await expect(page.locator('section[aria-label="Recent players"] .badge--mlbb')).toHaveCount(3);

  // Tapping a player teaser opens that player's edit modal on the Roster.
  await playerTeasers.nth(2).click();
  await expect(page.locator(".modal-title")).toHaveText("Edit player");
  await expect(page.locator("#player-name")).toHaveValue("Alpha Four");
  await page.locator(".modal-card .modal-close").click();
  await expect(page.locator(".modal-card")).not.toBeVisible();
  await hub(page, "Home").click();
  await expect(page.locator(".screen h1")).toHaveText("Dashboard");

  // Active tournaments: the single active one only (draft and complete excluded),
  // showing name, discipline, format, teams filled and status.
  const tourneyTeasers = page.locator('section[aria-label="Active tournaments"] .row');
  await expect(tourneyTeasers).toHaveCount(1);
  await expect(tourneyTeasers.first()).toContainText("Live Cup");
  await expect(tourneyTeasers.first()).toContainText("MLBB");
  await expect(tourneyTeasers.first()).toContainText("Series");
  await expect(tourneyTeasers.first()).toContainText("2/2 teams");
  await expect(tourneyTeasers.first()).toContainText("In progress");
  await expect(page.locator('section[aria-label="Active tournaments"]')).not.toContainText("Draft Cup");

  // Tapping the tournament teaser opens that tournament.
  await tourneyTeasers.first().click();
  await expect(page.locator(".tournament-header h1")).toHaveText("Live Cup");
});

test("dashboard teasers empty invites reach the create flows and follow the community", async ({ page }) => {
  const world: SeedWorld = {
    communities: [
      { id: "comm-alpha", name: "Alpha Crew", createdAt: 100 },
      { id: "comm-beta", name: "Beta Guild", createdAt: 200 },
    ],
    // Alpha: players but no tournaments. Beta: nothing at all.
    players: [
      { id: "al-1", communityId: "comm-alpha", name: "Alpha One" },
      { id: "be-1", communityId: "comm-beta", name: "Beta One" },
    ],
    sessions: [],
    tournaments: [],
    squads: [],
    activeCommunityId: "comm-alpha",
  };
  await gotoSeeded(page, world);

  // Alpha has players (so the stat view shows) but no active tournaments:
  // the Active tournaments section shows the one-line invite.
  await expect(page.locator(".screen h1")).toHaveText("Dashboard");
  const activeSection = page.locator('section[aria-label="Active tournaments"]');
  await expect(activeSection).toContainText("No active tournaments.");
  await activeSection.getByRole("button", { name: "+ Create one" }).click();
  await expect(page.locator(".modal-title")).toHaveText("New tournament");
  await page.locator(".modal-card .modal-close").click();
  await hub(page, "Home").click();
  await expect(page.locator(".screen h1")).toHaveText("Dashboard");

  // Switch to Beta: nothing of its own, so its only roster entry is gone.
  await page.getByRole("button", { name: "Active community" }).click();
  await page.locator(".squad-menu-item", { hasText: "Beta Guild" }).click();
  await expect(page.locator(".squad-select-value")).toHaveText("Beta Guild");
  await expect(page.locator(".screen h1")).toHaveText("Dashboard");
  await expect(activeSection).toContainText("No active tournaments.");
});
