/**
 * The offline promise, proved against the DEPLOYED origin — gates 2 and 3 of
 * `docs/ROADMAP.md`.
 *
 * `e2e/tests/pwa/offline.spec.ts` proves the same claim against `vite preview`,
 * and `README.md` says exactly what that is worth: "No production deploy has
 * happened, so none of that has been shown against a deployed origin." This file
 * is that second half. It drives a real Chromium against Cloudflare's edge, so
 * the things a preview server cannot exercise are the things it is here for — the
 * host's own `Vary` and `Cache-Control` headers, `cache.match` against them, and
 * an activation that purges a cache this device really holds.
 *
 * Run by hand, not by `npm run e2e` (see `e2e/live.playwright.config.ts`):
 *
 * ```bash
 * npx playwright test --config=e2e/live.playwright.config.ts
 * ```
 *
 * Recorded 2026-10-13 against `https://comp3tive.dimasawardhana.workers.dev/`,
 * serving `master` at `3683974` — byte-identical to that commit's `dist/`, and to
 * all three documents, proven by `diff` on a clean worktree build.
 */
import { createHash } from "node:crypto";
import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { gotoSeeded, hubButton, recordMatch, tournamentMeta, type SeedWorld } from "../support/seed";

const ROLES = ["roam", "jungle", "mid-lane", "gold-lane", "exp-lane"];

/** 15 players, three teams of five, all MLBB-eligible: a whole tournament's worth. */
const world = (): SeedWorld => ({
  communities: [{ id: "comm-pwa", name: "Offline Crew", createdAt: 100 }],
  players: Array.from({ length: 15 }, (_, i) => ({
    id: `p${i + 1}`,
    communityId: "comm-pwa",
    name: `Player ${i + 1}`,
    capabilities: [{
      disciplineId: "mlbb",
      attributeRatings: { mechanics: 4, "game-sense": 4, "hero-pool": 4, teamwork: 4 },
      eligibleRoles: ROLES,
      preferredRole: ROLES[i % 5],
    }],
  })),
  sessions: [],
  tournaments: [],
  squads: [],
  activeCommunityId: "comm-pwa",
});

/** The same wait the repo's own spec needs: `skipWaiting` without `clients.claim()`. */
async function primeOffline(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: "load" });
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload({ waitUntil: "load" });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, { timeout: 20_000 });
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

test("no request leaves the deployed origin", async ({ page }) => {
  const hosts = new Set<string>();
  page.on("request", (request) => hosts.add(new URL(request.url()).host));

  await page.goto("/app/", { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page.goto("/?stay", { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    await document.fonts.ready;
  });

  const origin = new URL(page.url()).host;
  expect([...hosts].filter((host) => host !== origin)).toEqual([]);
});

test("a whole tournament runs with no network, on the deployed build", async ({ page, context, request }) => {
  test.setTimeout(150_000);

  // The deployed worker's own version string, read from the live origin.
  const workerSource = await (await request.get("/sw.js")).text();
  const version = workerSource.match(/const VERSION = "([^"]+)"/)?.[1] ?? "";
  expect(version, "the deployed /sw.js has no VERSION").not.toBe("");

  await gotoSeeded(page, world());
  await primeOffline(page, "/app/");

  // What the device holds after one online visit, read from the page.
  const installed = await page.evaluate(() => caches.keys());
  expect(installed).toEqual([`comp3tive-${version}`]);

  await context.setOffline(true);
  await page.reload({ waitUntil: "load" });
  await expect(page.locator(".screen h1")).toHaveText("Dashboard");

  await hubButton(page, "Games").click();
  await page.locator("button:has-text('+ New tournament')").click();
  const modal = page.locator(".modal-card");
  await modal.locator("#tournament-name").fill("Offline night");
  await modal.locator(".chip", { hasText: "MLBB" }).click();
  await modal.locator(".chip", { hasText: "Round robin" }).click();
  await modal.locator(".btn-primary", { hasText: "Create" }).click();
  await expect(modal).not.toBeVisible({ timeout: 5000 });

  await page.getByTestId("split-teams-cta").click();
  await expect(page.locator(".match-setup")).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("split-button").click();
  await expect(page.locator(".split-screen")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Save teams to tournament →" }).click();

  await page.locator(".standings, [data-testid='review-panel']").first().waitFor();
  if ((await page.getByTestId("review-panel").count()) > 0) {
    await page.getByTestId("confirm-teams").click();
  }
  await expect(page.locator(".standings")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".bracket-match")).toHaveCount(3);

  for (const nth of [0, 1, 2]) await recordMatch(page, nth);

  await expect(tournamentMeta(page, "Status")).toHaveText(/^complete$/i);
  const champion = (await page.locator(".champ-name").innerText()).trim().toLowerCase();
  const leader = (await page.locator(".standings-team").first().innerText()).trim().toLowerCase();
  expect(champion).not.toBe("");
  expect(champion).toBe(leader);

  // The purge claim: this origin holds exactly the deployed build's cache and
  // nothing else — no straggler from an earlier deploy of this Worker.
  const afterTournament = await page.evaluate(async () => {
    const name = (await caches.keys())[0];
    const cache = await caches.open(name);
    return {
      caches: await caches.keys(),
      entries: (await cache.keys()).map((r) => new URL(r.url).pathname),
    };
  });
  expect(afterTournament.caches).toEqual([`comp3tive-${version}`]);

  // And a navigation still resolves from the cache after the tournament.
  await page.reload({ waitUntil: "load" });
  await expect(page.locator(".app")).toBeVisible({ timeout: 20_000 });

  await context.setOffline(false);

  console.log(
    `gate 3 receipt — origin ${new URL(page.url()).host}, deployed version ${version}, ` +
      `caches ${JSON.stringify(afterTournament.caches)}, ` +
      `${afterTournament.entries.length} precached entries, champion "${champion}"`,
  );
});

test("the deployed version is derived from the deployed bytes, not typed", async ({ request }) => {
  // `vite.config.ts`'s own algorithm, re-implemented here against the live
  // origin's own responses. If the deployed worker's VERSION were hand-edited, or
  // if the deploy were older than the assets beside it, this is the arithmetic
  // that would disagree — and the ROADMAP names exactly this as the thing to
  // check: "If the version does not change after a real build, the hash is not
  // seeing your content."

  const swSource = await (await request.get("/sw.js")).text();
  const version = swSource.match(/const VERSION = "([^"]+)"/)?.[1] ?? "";
  const urls = (name: string) =>
    JSON.parse(swSource.match(new RegExp(`const ${name} = (\\[[^\\]]*\\])`))?.[1] ?? "[]") as string[];
  const documents = urls("DOCUMENTS");
  const assets = urls("PRECACHE_ASSETS");

  // The URL→file pairing the build uses, restated: a document URL is not a path
  // inside `dist`, so its file has to be named (vite.config.ts DOCUMENTS); a
  // precache URL already is one.
  const FILE_FOR_URL: Record<string, string> = {
    "/": "index.html",
    "/index.html": "index.html",
    "/app/": "app/index.html",
    "/app/index.html": "app/index.html",
    "/404.html": "404.html",
    "/manifest.webmanifest": "manifest.webmanifest",
  };

  const fingerprint = async (url: string) => {
    const file = FILE_FOR_URL[url] ?? url.replace(/^\//, "");
    const response = await request.get(`/${file}`);
    expect(response.status(), `${file} did not serve`).toBe(200);
    const digest = createHash("sha256").update(Buffer.from(await response.body())).digest("hex");
    return `${url}\n${digest}`;
  };

  const parts = await Promise.all([...documents, ...assets].map(fingerprint));
  const recomputed = createHash("sha256").update(parts.join("\n")).digest("hex").slice(0, 12);

  expect(recomputed).toBe(version);
  console.log(`gate 3 receipt — version ${version} recomputed from ${parts.length} live responses: ${recomputed}`);
});

test("the deployed worker purges a stale cache and only its own", async ({ page }) => {
  // The purge claim, against the deployed worker's own bytes.
  //
  // **The caches are planted from the Landing Page, because the Landing Page never
  // registers a worker** (`src/main.tsx` is the only `register` call). Planting
  // them on `/app/` instead would race the registration the app itself starts on
  // load, and the `activate` handler under test would already have run — so the
  // assertion would pass or fail on timing rather than on the worker's filter.
  // Cache Storage is origin-scoped, so what this page plants is what the app's
  // first install meets.
  await page.goto("/?stay", { waitUntil: "load" });
  await page.evaluate(async () => {
    await caches.open("comp3tive-deadbeefdead");
    await caches.open("some-other-app-cache");
  });

  // The app's first load on this origin: install → activate, which is the only
  // place the purge filter runs. Re-registering an unchanged script would not
  // re-activate — the browser byte-compares it and stops — so this must be the
  // genuine first install, not a forced one.
  await page.goto("/app/", { waitUntil: "load" });
  const observed = await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    return { controller: navigator.serviceWorker.controller !== null, caches: await caches.keys() };
  });

  // The stale `comp3tive-` cache is gone; a cache that is not this app's is left
  // alone — `public/sw.js` says deleting one would be "reaching outside its own
  // name". The foreign key is asserted present, not merely unmentioned.
  expect(observed.caches, "the stale comp3tive cache survived activation").not.toContain("comp3tive-deadbeefdead");
  expect(observed.caches, "a cache that is not ours was deleted").toContain("some-other-app-cache");
  expect(
    observed.caches.some((key) => key.startsWith("comp3tive-") && key !== "comp3tive-deadbeefdead"),
    `the current build's cache was not created (caches: ${observed.caches.join(", ")})`,
  ).toBe(true);

  console.log(
    `gate 3 receipt — planted ["comp3tive-deadbeefdead","some-other-app-cache"], ` +
      `after first activation: ${observed.caches.join(", ")}`,
  );
});
