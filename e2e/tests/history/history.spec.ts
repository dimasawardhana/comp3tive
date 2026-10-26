import { test, expect } from "@playwright/test";
import { gotoHubSeeded, hubButton, type SeedWorld } from "../../support/seed";

const world = (): SeedWorld => ({
  communities: [{ id: "comm-history", name: "History Test", createdAt: 100 }],
  players: [],
  sessions: [],
  tournaments: [],
  squads: [],
  activeCommunityId: "comm-history",
});

test("history: layout padding + title + lede + empty state", async ({ page }) => {
  await gotoHubSeeded(page, world(), "History");

  // 1. .screen wrapper exists with proper padding
  const screen = page.locator(".screen");
  await expect(screen).toBeVisible();
  const padding = await screen.evaluate((el) => {
    const cs = window.getComputedStyle(el);
    return { top: parseInt(cs.paddingTop), left: parseInt(cs.paddingLeft) };
  });
  expect(padding.top).toBeGreaterThanOrEqual(12);
  expect(padding.left).toBeGreaterThanOrEqual(12);

  // 2. Title "History". There is deliberately no kicker: an eyebrow above the
  // heading either repeated it or carried a category the heading should have
  // said itself, so the masthead is an h1 and one lede line.
  const h1 = page.locator(".screen h1");
  await expect(h1).toHaveText("History");
  await expect(page.locator(".screen .kicker")).toHaveCount(0);

  // 3. Lede description
  await expect(page.locator(".screen .lede")).toBeVisible();

  // 4. Empty state shows when no sessions
  await expect(page.locator(".empty")).toBeVisible();
  await expect(page.locator(".empty .big")).toHaveText(/Sessions appear here/);
});

/**
 * A split writes a Session, and History must show it without a reload.
 *
 * The defect this pins: the split wrote through the raw store, so the session
 * reached IndexedDB but not the `useSessions` list the screen renders from —
 * History showed "Sessions appear here" until the page was reloaded, which read
 * as data loss. The assertion is deliberately made in the same page load as the
 * split, because a reload is what used to hide it.
 */
test("history: a split appears without a reload", async ({ page }) => {
  const roster = (id: string, name: string) => ({
    id,
    communityId: "comm-history",
    name,
    capabilities: [
      {
        disciplineId: "futsal",
        attributeRatings: { technical: 4, fitness: 4, "game-iq": 4 },
        eligibleRoles: ["goalkeeper", "defender", "winger", "pivot"],
        preferredRole: null,
      },
    ],
  });

  await gotoHubSeeded(
    page,
    {
      ...world(),
      players: [
        roster("h-1", "One"),
        roster("h-2", "Two"),
        roster("h-3", "Three"),
        roster("h-4", "Four"),
        roster("h-5", "Five"),
        roster("h-6", "Six"),
      ],
    },
    "Roster",
  );

  // Ad-hoc split: Roster -> Split match -> Match setup -> Split.
  await page.getByRole("button", { name: "Split match", exact: true }).click();
  await expect(page.locator(".match-setup")).toBeVisible({ timeout: 5000 });
  await page.locator(".game", { hasText: "Futsal" }).click();
  await expect(page.locator(".chip-player").first()).toBeVisible({ timeout: 5000 });
  const chips = page.locator(".chip-player");
  for (let i = 0; i < (await chips.count()); i++) {
    const chip = chips.nth(i);
    if ((await chip.getAttribute("aria-pressed")) !== "true") await chip.click();
  }
  await page.getByTestId("split-button").click();
  await expect(page.locator(".split-screen")).toBeVisible({ timeout: 15000 });

  // Same page load, no reload: the row is there.
  await hubButton(page, "History").click();
  await expect(page.locator(".history-row")).toHaveCount(1);
  await expect(page.locator(".empty")).toHaveCount(0);
});
