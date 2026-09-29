/**
 * The export nudge and the storage note: the only two places this app talks
 * about whether a roster is safe, proved against a real browser.
 *
 * `useDurability.test.ts` owns the decision, `decideDurability` owns the truth
 * table, and this file owns the two things a static render cannot reach — what
 * the browser actually answers, and what a person reads off the screen.
 */
import { test, expect } from "@playwright/test";
import { gotoSeeded, hubButton, type SeedWorld } from "../../support/seed";

/**
 * A world with `n` players, no export record, and no dismissal recorded. The
 * players carry no capabilities of their own, so `seedScript` gives them the
 * MLBB default and this file never has to repeat it.
 */
const world = (n: number): SeedWorld => ({
  communities: [{ id: "comm-nudge", name: "Nudge Crew", createdAt: 100 }],
  players: Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    communityId: "comm-nudge",
    name: `Player ${i + 1}`,
  })),
  sessions: [],
  tournaments: [],
  squads: [],
  activeCommunityId: "comm-nudge",
});

const NUDGE_COPY = "This browser does not promise to keep this app's data. Export a backup from Roster.";

test("a roster worth losing, with no export and no persistence, gets one nudge", async ({ page }) => {
  await gotoSeeded(page, world(6));
  // Chromium refuses persist() for an origin with no install and no engagement
  // history, so an unseeded-storage profile is the *refused* case, measured.
  const nudge = page.locator(".nudge");
  await expect(nudge).toBeVisible({ timeout: 10000 });
  await expect(nudge).toContainText(NUDGE_COPY);
});

test("dismissing the nudge is the hook's snooze, not a hidden row", async ({ page }) => {
  await gotoSeeded(page, world(6));
  const nudge = page.locator(".nudge");
  await expect(nudge).toBeVisible({ timeout: 10000 });

  await nudge.getByRole("button", { name: "Dismiss" }).click();
  await expect(nudge).toHaveCount(0);

  // The dismissal is the hook's, so it is the hook's shape: when it was made
  // and how big the roster was then. A `useState(false)` in the screen would
  // leave this key absent and the snooze silently lost on reload.
  const stored = await page.evaluate(() => localStorage.getItem("tb-export-nudge-dismissed"));
  expect(stored).not.toBeNull();
  const dismissal = JSON.parse(String(stored)) as { at: number; playerCount: number };
  expect(dismissal.playerCount).toBe(6);
  expect(Number.isFinite(dismissal.at)).toBe(true);

  await page.reload({ waitUntil: "load" });
  await expect(page.locator(".app")).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".nudge")).toHaveCount(0);
});

test("a roster too small to lose never gets a nudge", async ({ page }) => {
  await gotoSeeded(page, world(2));
  await expect(page.locator(".app")).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".nudge")).toHaveCount(0);
  // Give the effect time to settle before concluding the nudge is absent.
  await page.waitForTimeout(1000);
  await expect(page.locator(".nudge")).toHaveCount(0);
});

test("a recent export suppresses the nudge", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("tb-last-export", String(Date.now()));
  });
  await gotoSeeded(page, world(6));
  await expect(page.locator(".app")).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(1000);
  await expect(page.locator(".nudge")).toHaveCount(0);
});

test("the stat cards are untouched by the nudge", async ({ page }) => {
  await gotoSeeded(page, world(6));
  await expect(page.locator(".dashboard-stats")).toBeVisible({ timeout: 10000 });
  await expect(page.locator(".dashboard-stats .dashboard-stat")).toHaveCount(3);
  // The nudge sits between the stat cards and the teasers, so the cards keep their place.
  const nudgeY = await page.locator(".nudge").boundingBox();
  const statsY = await page.locator(".dashboard-stats").boundingBox();
  const teasersY = await page.locator(".dashboard-teasers").first().boundingBox();
  expect(nudgeY!.y).toBeGreaterThan(statsY!.y);
  expect(nudgeY!.y).toBeLessThan(teasersY!.y);
});

test("exporting the roster is what records the export and lifts the nudge", async ({ page }) => {
  await gotoSeeded(page, world(6));
  await expect(page.locator(".nudge")).toBeVisible({ timeout: 10000 });
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("tb-last-export")))
    .toBeNull();

  await hubButton(page, "Roster").click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await download;

  // The escape exists because the export records itself. Without this the only
  // way out of a nudge would be to dismiss it forever, which is not the same
  // promise: one user answered the question, the other is ignoring it.
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("tb-last-export")))
    .toMatch(/^\d+$/);
  // And a dismissal does not outlive the act it was standing in for.
  expect(await page.evaluate(() => localStorage.getItem("tb-export-nudge-dismissed"))).toBeNull();

  await hubButton(page, "Home").click();
  await expect(page.locator(".app")).toBeVisible();
  await expect(page.locator(".nudge")).toHaveCount(0);
});

test("a browser with no storage API shows an unknown note and never errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "storage", { get: () => undefined, configurable: true });
  });
  await gotoSeeded(page, world(6));
  await hubButton(page, "Roster").click();
  // Nobody answered, which is not a refusal: the note says so and stops there.
  await expect(page.locator(".durability-note")).toHaveText(
    "Storage protection unknown in this browser. Keep a backup.",
  );
  await expect(page.locator(".nudge")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("a browser that granted persistence is reported, never called safe", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "storage", {
      get: () => ({ persisted: () => Promise.resolve(true), persist: () => Promise.resolve(true) }),
      configurable: true,
    });
  });
  await gotoSeeded(page, world(6));
  await hubButton(page, "Roster").click();
  // A grant is the state of the world, not a guarantee: the line is attributed
  // to the browser, and it still ends in an instruction.
  await expect(page.locator(".durability-note")).toHaveText(
    "This browser reports persistent storage for this app. Keep a backup anyway.",
  );
  // A browser that keeps its data has nothing to nudge about.
  await hubButton(page, "Home").click();
  await page.waitForTimeout(1000);
  await expect(page.locator(".nudge")).toHaveCount(0);
});

test("a browser that refused persistence says so, beside the Export button", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "storage", {
      get: () => ({ persisted: () => Promise.resolve(false), persist: () => Promise.resolve(false) }),
      configurable: true,
    });
  });
  await gotoSeeded(page, world(6));
  await hubButton(page, "Roster").click();
  await expect(page.locator(".durability-note")).toHaveText(
    "This browser reports this app's data is not stored persistently. Keep a backup.",
  );
  // The note and the nudge are one policy, not two: the same measured refusal
  // that writes this sentence is the only thing that raises the nudge.
  await hubButton(page, "Home").click();
  await expect(page.locator(".nudge")).toBeVisible({ timeout: 10000 });
});

test("the note is a status line, not an event: it is still there after the export", async ({ page }) => {
  await gotoSeeded(page, world(6));
  await hubButton(page, "Roster").click();
  const note = page.locator(".durability-note");
  await expect(note).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await download;
  // The export lifts the *request*. It does not change what the browser reports
  // about storage, so the status line does not get to leave with it.
  await expect(note).toBeVisible();
  await expect(page.getByRole("button", { name: "Export", exact: true })).toBeVisible();
});
