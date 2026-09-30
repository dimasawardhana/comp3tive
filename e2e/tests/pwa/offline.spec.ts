/**
 * The offline promise, proved against a real browser, and the deploy that
 * escapes the old cache.
 *
 * Everything here is deliberately *not* the `node:vm` harness in
 * `src/serviceWorker.test.ts`. That harness fakes `caches` and a `fetch`, and it
 * is good at what it is for — the strategy, the scoping, the purge's filter — but
 * the two Majors Task 11 shipped past it were invisible to it by construction,
 * and one of them only surfaced because a reviewer read the emitted `dist/sw.js`
 * by hand. A fake Cache Storage cannot be told "your worker's script 404s", and
 * it cannot be told "the new worker never activated". So this file drives a real
 * Chromium against a real `vite preview` serving a real `dist/`, with real HTTP,
 * real Cache Storage and a real activation, and it reads `caches.keys()` from the
 * page rather than from a stub.
 *
 * **The baseURL points at `/app/`**; the Landing Page is reached by absolute
 * path, the same convention `e2e/tests/landing/landing.spec.ts` uses.
 *
 * **Why every offline test primes with a reload.** The worker calls `skipWaiting`
 * but deliberately not `clients.claim()` (see the note in `public/sw.js`), so the
 * navigation that installed it is *not* the navigation it controls. Cutting the
 * network after a first load and reloading therefore proves nothing: the reload
 * would go to the network, fail, and land on the browser's error page, which is
 * indistinguishable from "the app is broken offline". `primeOffline` waits for a
 * controller instead, so a failure means the cache really is missing something.
 *
 * **Why the deploy test rebuilds instead of hand-editing `VERSION`.** A deploy is
 * a new `dist/` on disk, and `vite preview` re-reads it per request. Writing a
 * string into `dist/sw.js` proves the script is re-fetched; changing a real
 * precached source and running a real build proves the thing a user would hit —
 * that the version is *derived* from the bytes, and moves because the content
 * moved. Nothing here edits a constant by hand.
 *
 * **Two preconditions, and what breaks if either is violated.** The deploy test
 * runs a real `vite build`, which empties and rewrites `dist/` twice while the
 * preview server is serving from it.
 *
 * 1. **`workers: 1` in `e2e/playwright.config.ts`.** Violated, two workers run
 *    the build concurrently: the second `vite build` truncates `dist/` out from
 *    under the first, and the failing run is a 404 on a hashed asset somewhere
 *    unrelated, in a spec that never mentions this file.
 * 2. **This test is last in this file.** Playwright hands out tests in order, so
 *    last-in-file means last overall. Violated, every spec after it reads a
 *    `dist/` this file has just replaced — a font-size assertion or a snapshot
 *    from the previous build, failing for no reason anyone can see.
 *
 * Either one is a trap rather than a failure, which is why both are named here
 * instead of living in a reviewer's memory. The real fix, isolating the build in
 * a temporary outDir, is not this file's to make.
 */
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { gotoSeeded, hubButton, recordMatch, tournamentMeta, type SeedWorld } from "../../support/seed";

/** The repo root, three levels up from `e2e/tests/pwa/`. */
const repoRoot = new URL("../../../", import.meta.url);
/** The emitted worker: the one file a deploy replaces. */
const distWorker = new URL("dist/sw.js", repoRoot);
/** A precached document, so the version hash has something real to move with. */
const landingSource = new URL("index.html", repoRoot);

const ROLES = ["tank", "assassin", "mage", "marksman", "fighter"];

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

/** What `dist/sw.js` says about the build it belongs to. */
interface WorkerConstants {
  version: string;
  documents: string[];
  assets: string[];
}

const readWorker = async (): Promise<WorkerConstants> => {
  const source = await readFile(distWorker, "utf8");
  const list = (name: string) =>
    JSON.parse(source.match(new RegExp(`const ${name} = (\\[[^\\]]*\\])`))?.[1] ?? "[]") as string[];
  const version = source.match(/const VERSION = "([^"]+)"/)?.[1] ?? "";
  if (!version) throw new Error("dist/sw.js has no VERSION; was `npx vite build` run?");
  return { version, documents: list("DOCUMENTS"), assets: list("PRECACHE_ASSETS") };
};

/**
 * Install the worker and load `path` with it in control.
 *
 * Two facts this has to know, both of which the first draft of this file got
 * wrong and the run then told us:
 *
 * - The worker calls `skipWaiting` but deliberately not `clients.claim()`, so
 *   the navigation that installed it is not the navigation it controls. Cutting
 *   the network after a first load and reloading therefore proves nothing: the
 *   reload would go to the network, fail, and land on the browser's error page,
 *   which looks exactly like "the app is broken offline". So this waits for a
 *   controller, and a red assertion below means the precache is short.
 * - **Only the app registers the worker** (`src/main.tsx`; the Landing Page is
 *   plain HTML and never calls `register`). `navigator.serviceWorker.ready` on
 *   `/` therefore never resolves. This is not a defect to paper over, it is the
 *   condition the restored sentence has to carry: a device that has only ever
 *   read the Landing Page has no worker, and this primes through `/app/`.
 */
async function primeOffline(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: "load" });
  // `ready` resolves when a worker is *active*; the page itself is not controlled
  // by it, which is what the next navigation is for.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload({ waitUntil: "load" });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, { timeout: 20_000 });
  await page.evaluate(async () => {
    // Fonts are fetched lazily, so "ready" has to be asked for before the offline
    // claim is tested — otherwise the test proves the cache before it is asked to.
    await document.fonts.ready;
  });
}

/**
 * Wait until the seeded roster is actually on disk.
 *
 * `gotoSeeded` disposes its init script after the first load, so the rows exist
 * only once the seeding document's IndexedDB transactions have committed — and a
 * navigation tears that document down and aborts them. Every other spec in this
 * repo reads the roster without navigating in between, so the hazard never bit
 * them; this file navigates twice to install the worker, and the symptom it
 * produces is a match-setup screen that says "have 0" eligible players for a
 * world that seeded fifteen.
 */
async function waitForSeededRoster(page: Page, count: number): Promise<void> {
  await page.waitForFunction(async (expected) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open("comp3tive");
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    const rows = await new Promise<unknown[]>((resolve, reject) => {
      const read = db.transaction("players", "readonly").objectStore("players").getAll();
      read.onsuccess = () => resolve(read.result);
      read.onerror = () => reject(read.error);
    });
    db.close();
    return rows.length === expected;
  }, count, { timeout: 20_000 });
}

test("neither document reaches a host other than the origin", async ({ page }) => {
  const hosts = new Set<string>();
  page.on("request", (request) => hosts.add(new URL(request.url()).host));

  await page.goto("/app/", { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    await document.fonts.ready;
  });

  const origin = new URL(page.url()).host;
  expect([...hosts].filter((host) => host !== origin)).toEqual([]);
});

test("the app opens with no network", async ({ page, context }) => {
  await gotoSeeded(page, world());
  await primeOffline(page, "/app/");

  await context.setOffline(true);
  await page.reload({ waitUntil: "load" });

  // The shell renders: the app document came from the precache.
  await expect(page.locator(".app")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(".screen h1")).toHaveText("Dashboard");
  await context.setOffline(false);
});

test("the landing page opens with no network", async ({ page, context }) => {
  await primeOffline(page, "/app/");
  // Prime through the app, then cross to the Landing Page: the worker's scope is
  // `/`, so the page it precached is served by the same worker that installed it.
  // `?stay` is the shipped escape from the returning-organizer redirect, and it
  // has to be used here: having just run the app, this device has
  // `localStorage["tb-community"]` set, so a bare `/` bounces to `/app/`. The
  // query is also what proves the document fallback works — nothing is precached
  // under `/?stay`, so the worker has to fall back from the request to its
  // pathname before it can answer at all.
  const LANDING = "/?stay";
  await page.goto(LANDING, { waitUntil: "load" });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, { timeout: 20_000 });

  await context.setOffline(true);
  await page.reload({ waitUntil: "load" });

  // The shipped h1, verbatim: B14 scoped it to "it can prove" (an unqualified
  // optimality claim is false — the screen says "Best gap found."), so the
  // pre-B14 string can never be produced by the app and would fail here.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Pick the players. Get the fairest teams it can prove.",
  );
  await context.setOffline(false);
});

test("a self-hosted font is served from the cache with no network", async ({ page, context }) => {
  const { assets } = await readWorker();
  // Read out of the emitted precache list rather than typed: the file name carries
  // a content hash, so a hard-coded one is a test that fails on an unrelated font
  // edit and, worse, one that could name a file this build never cached.
  const font = assets.find((url) => url.startsWith("/fonts/") && url.endsWith(".woff2"));
  expect(font, "the build precached no font").toBeTruthy();
  const onDisk = await readFile(new URL(`dist${font}`, repoRoot));

  await primeOffline(page, "/app/");
  await context.setOffline(true);

  const served = await page.evaluate(async (url: string) => {
    const response = await fetch(url);
    return { status: response.status, bytes: (await response.arrayBuffer()).byteLength };
  }, font!);

  // A status alone would be enough for a claim and not enough for this one: 200
  // with an empty body is what a browser error page looks like from the inside.
  // The bytes are compared against the file the build hashed, so "the real font
  // arrived" is what is asserted, not "something answered".
  expect(served.status).toBe(200);
  expect(served.bytes).toBe(onDisk.byteLength);
  await context.setOffline(false);
});

test("a roster behind an await import() is fetched with no network", async ({ page, context }) => {
  // The one thing a precache of the entry chunk cannot cover: the app reaches
  // `./data/sample-data` behind an `await import()` (src/App.tsx), and that
  // module reaches a third JSON behind a second one (src/data/sample-data.ts).
  // Two chunks, neither in the entry, both fetched at the moment the button is
  // pressed — which is exactly the moment a user on a court presses it.
  await gotoSeeded(page, world());
  await waitForSeededRoster(page, 15);
  await primeOffline(page, "/app/");
  await context.setOffline(true);
  await page.reload({ waitUntil: "load" });

  await hubButton(page, "Games").click();
  await page.getByRole("button", { name: "Disciplines" }).click();
  await expect(page.locator(".screen h1")).toHaveText("Disciplines");

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download sample data for Mobile Legends" }).click();
  const file = await download;

  // The file name is the one `sample-registry.ts` publishes for MLBB, not the
  // name of the chunk the bytes came out of; both matter and they are different
  // strings, so the download is checked against the registry's.
  expect(file.suggestedFilename()).toBe("mlbb-roster.json");
  const roster = JSON.parse(await readFile(await file.path(), "utf8")) as { players: unknown[] };
  expect(roster.players).toHaveLength(25);
  // The failure this guards is not a crash: `downloadSampleData` catches and
  // notifies, so a chunk that could not be fetched produces a polite message
  // rather than an error. Nothing failing is part of the claim.
  await expect(page.locator(".toast, .toasts")).toHaveCount(0);
  await context.setOffline(false);
});

test("a whole tournament runs with no network", async ({ page, context }) => {
  // The Landing Page's offline claim is "once comp3tive has run with a network,
  // it opens and runs a tournament with no signal", so this is the test that
  // claim is written against: not a shell render, but the whole arc a
  // user's evening is — create the tournament, split fifteen players into three
  // teams (the solver, the split screen and its 240 kB chunk), hand the teams to
  // the bracket, play all three fixtures to a decided series each, and crown a
  // champion off the standings. Anything missing from the precache fails here as
  // a hang on a real interaction, which is the failure a user would meet.
  test.setTimeout(120_000);
  await gotoSeeded(page, world());
  await waitForSeededRoster(page, 15);
  await primeOffline(page, "/app/");
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

  // Fifteen players into the three teams a round robin needs.
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

  // Three fixtures, each decided over a BO3. This is the writing the store does,
  // and it is the last thing to survive with no network.
  for (const nth of [0, 1, 2]) await recordMatch(page, nth);

  await expect(tournamentMeta(page, "Status")).toHaveText(/^complete$/i);
  // `.champ-name` is uppercased by the stylesheet, so the name is compared
  // against the standings row rather than against a literal.
  const champion = (await page.locator(".champ-name").innerText()).trim().toLowerCase();
  const leader = (await page.locator(".standings-team").first().innerText()).trim().toLowerCase();
  expect(champion).not.toBe("");
  expect(champion).toBe(leader);

  await context.setOffline(false);
});

test("a new deploy activates, purges the old cache, and fills the new one", async ({ page }) => {
  // Last in the file on purpose: this is the only test that rebuilds `dist/`, and
  // `workers: 1` is what keeps the other specs off the tree while it does.
  test.setTimeout(180_000);

  const before = await readWorker();
  await primeOffline(page, "/app/");

  // What the device holds now, read from the page rather than from the build log.
  const installed = await page.evaluate(() => caches.keys());
  expect(installed).toEqual([`comp3tive-${before.version}`]);

  // The deploy: change a real precached source and run a real build, so the
  // version the build computes moves because the content moved. The hashed asset
  // names do not move — only a document's bytes changed — so the running build's
  // chunks stay fetchable and the only thing being tested is the swap.
  const landing = await readFile(landingSource, "utf8");
  await writeFile(landingSource, landing.replace("</body>", "<!-- a new deploy -->\n  </body>"), "utf8");
  let after: WorkerConstants;
  try {
    execFileSync("npx", ["vite", "build"], { cwd: repoRoot, stdio: "pipe" });
    after = await readWorker();
    expect(after.version).not.toBe(before.version);
    expect(after.assets).toEqual(before.assets);

    // **The activation is awaited, and that is the whole point.** `skipWaiting`
    // makes the swap asynchronous relative to the navigation that triggered it, so
    // a test that reads `caches.keys()` after a reload and no more sees the OLD
    // cache and concludes the purge is broken — the exact misreading this test was
    // written to prevent. So the worker is watched from `updatefound`, through
    // installing → installed → activating → activated, and only then is anything
    // read. `activated` is not a state the browser may leave early: it is set
    // after the activate handler's `waitUntil` has settled, which is the promise
    // that deletes the old cache.
    const observed = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) throw new Error("the app registered no service worker");

      const states: string[] = [];
      const watch = (worker: ServiceWorker | null) => {
        if (!worker) return;
        states.push(worker.state);
        worker.addEventListener("statechange", () => states.push(worker.state));
      };
      watch(registration.installing);
      watch(registration.waiting);
      registration.addEventListener("updatefound", () => watch(registration.installing));

      const previous = registration.active;
      await registration.update();

      const deadline = Date.now() + 30_000;
      while (Date.now() < deadline) {
        const current = registration.active;
        if (current && current !== previous && current.state === "activated") break;
        const { promise, resolve } = Promise.withResolvers<void>();
        setTimeout(resolve, 50);
        await promise;
      }
      const active = registration.active;
      return {
        states,
        replaced: Boolean(active && active !== previous),
        activated: active?.state === "activated",
        caches: await caches.keys(),
      };
    });

    expect(observed.replaced, "the old worker was never replaced").toBe(true);
    expect(observed.activated, `the new worker never activated (saw ${observed.states.join(" → ")})`).toBe(true);
    expect(observed.states).toContain("activated");
    expect(observed.caches).toEqual([`comp3tive-${after.version}`]);

    // And a reload, now that the swap is known to be done — the second observation,
    // so the purge is proven from a navigation as well as from a promise.
    await page.reload({ waitUntil: "load" });
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, { timeout: 20_000 });
    const reloaded = await page.evaluate(async (name: string) => {
      const cache = await caches.open(name);
      return { caches: await caches.keys(), entries: (await cache.keys()).map((request) => new URL(request.url).pathname) };
    }, `comp3tive-${after.version}`);
    expect(reloaded.caches).toEqual([`comp3tive-${after.version}`]);

    // "Purged" and "filled" are two claims. The old cache is gone; the new one
    // holds every precached URL, documents included — an empty new cache would
    // look identical to a working one until the next offline reload.
    expect([...reloaded.entries].sort()).toEqual([...after.documents, ...after.assets].sort());

    // The receipt the report quotes, printed so the run itself carries the evidence.
    console.log(
      `purge: ${installed.join(", ") || "(none)"} → ${observed.caches.join(", ")}` +
        ` (states: ${observed.states.join(" → ")})`,
    );
  } finally {
    await writeFile(landingSource, landing, "utf8");
    execFileSync("npx", ["vite", "build"], { cwd: repoRoot, stdio: "pipe" });
  }

  // The tree is back where the phase found it, so every spec after this one reads
  // the build it was written against.
  expect((await readWorker()).version).toBe(before.version);
});
