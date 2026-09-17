import { test, expect } from "@playwright/test";
import {
  MLBB_ID,
  gotoHubSeeded,
  gotoSeeded,
  hubButton,
  mlbbCap,
  splitOf,
  statValue,
  type SeedWorld,
} from "../../support/seed";

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

test("fresh load lands on the Dashboard with the five hub tabs", async ({ page }) => {
  await gotoSeeded(page, twoCommunities());

  // ADR-0005: the view stack root is the dashboard view; every fresh load lands here.
  await expect(page.locator(".screen h1")).toHaveText("Dashboard");

  // The five-slot layout. The nav buttons carry no aria-label: their accessible
  // name IS their visible label (the icon span is aria-hidden), which is what
  // hubButton resolves. Exactly one control matches each name at this width.
  for (const hub of ["Home", "Roster", "Games", "History", "Squads"] as const) {
    await expect(hubButton(page, hub)).toHaveCount(1);
    await expect(hubButton(page, hub)).toBeVisible();
  }
  // Home marks the dashboard as current (the stack root is the dashboard view).
  await expect(hubButton(page, "Home")).toHaveAttribute("aria-current", "page");
});

test("Home tab returns to the Dashboard from each hub", async ({ page }) => {
  await gotoSeeded(page, twoCommunities());

  // [nav label hubButton resolves, the .screen h1 that hub renders]
  const hubs = [
    ["Roster", "comp3tive"],
    ["Games", "Games"],
    ["History", "History"],
    ["Squads", "Saved squads"],
  ] as const;
  for (const [navLabel, hubH1] of hubs) {
    await hubButton(page, navLabel).click();
    await expect(page.locator(".screen h1")).toHaveText(hubH1);
    await hubButton(page, "Home").click();
    await expect(page.locator(".screen h1")).toHaveText("Dashboard");
    await expect(hubButton(page, "Home")).toHaveAttribute("aria-current", "page");
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
  await expect(hubButton(page, "Home")).toHaveAttribute("aria-current", "page");
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
  await hubButton(page, "Home").click();
  await expect(page.locator(".screen h1")).toHaveText("Dashboard");

  // Browse saved squads -> the Squads hub.
  await page.getByRole("button", { name: "Browse saved squads" }).click();
  await expect(page.locator(".screen h1")).toHaveText("Saved squads");
  await hubButton(page, "Home").click();
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
  await hubButton(page, "History").click();
  await expect(page.locator(".screen h1")).toHaveText("History");
  await expect(page.locator(".history-row")).toHaveCount(1);

  // Alpha Games: its one tournament is listed.
  await hubButton(page, "Games").click();
  await expect(page.locator(".screen h1")).toHaveText("Games");
  await expect(page.locator(".roster .row")).toHaveCount(1);
  await expect(page.locator(".roster .row").first()).toContainText("Alpha Cup");

  // Switch to Beta via the community dropdown.
  await page.getByRole("button", { name: "Active community" }).click();
  await page.locator(".squad-menu-item", { hasText: "Beta Guild" }).click();
  await expect(page.locator(".squad-select-value")).toHaveText("Beta Guild");

  // Beta owns nothing of its own: History and Games show their empty states,
  // not Alpha's records.
  await hubButton(page, "History").click();
  await expect(page.locator(".empty .big")).toHaveText("Sessions appear here");
  await hubButton(page, "Games").click();
  await expect(page.locator(".empty .big")).toHaveText("Run a competition");

  // The dashboard counts follow the active community: 1 Beta player, 0 / 0.
  await hubButton(page, "Home").click();
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
  await hubButton(page, "Home").click();
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
  await expect(page.locator(".screen h1")).toHaveText("Live Cup");
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
  await hubButton(page, "Home").click();
  await expect(page.locator(".screen h1")).toHaveText("Dashboard");

  // Switch to Beta: nothing of its own, so its only roster entry is gone.
  await page.getByRole("button", { name: "Active community" }).click();
  await page.locator(".squad-menu-item", { hasText: "Beta Guild" }).click();
  await expect(page.locator(".squad-select-value")).toHaveText("Beta Guild");
  await expect(page.locator(".screen h1")).toHaveText("Dashboard");
  await expect(activeSection).toContainText("No active tournaments.");
});
