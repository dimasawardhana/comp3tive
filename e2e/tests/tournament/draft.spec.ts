import { test, expect } from "@playwright/test";
import { gotoHubSeeded, type SeedWorld } from "../../support/seed";

const world = (): SeedWorld => ({
  communities: [{ id: "comm-draft", name: "Draft Test", createdAt: 100 }],
  players: [
    { id: "dr-1", communityId: "comm-draft", name: "Draft One" },
    { id: "dr-2", communityId: "comm-draft", name: "Draft Two" },
    { id: "dr-3", communityId: "comm-draft", name: "Draft Three" },
    { id: "dr-4", communityId: "comm-draft", name: "Draft Four" },
  ],
  sessions: [],
  tournaments: [],
  squads: [],
  activeCommunityId: "comm-draft",
});

test("tournament draft: h1, meta cards, pre-split preview", async ({ page }) => {
  await gotoHubSeeded(page, world(), "Games");

  // Create a tournament
  await page.locator("button:has-text('+ New tournament')").click();
  await page.locator("#tournament-name").fill("Draft League");
  await page.locator(".chip", { hasText: "Futsal" }).click();
  await page.locator(".chip", { hasText: "Single elimination" }).click();
  await page.locator(".modal-card .btn-primary").click();

  // On tournament page


  // Meta strip present (ruled strip of format / series / teams / status)
  const metaItems = page.locator(".tournament-meta-strip .tms-item");
  await expect(metaItems).toHaveCount(4);
  await expect(metaItems.nth(0).locator(".tms-value")).toHaveText(/Single elimination/);
  await expect(metaItems.nth(1).locator(".tms-value")).toHaveText("BO3");
  await expect(metaItems.nth(2).locator(".tms-value")).toHaveText("0/4");
  await expect(metaItems.nth(3).locator(".tms-value")).toHaveText("Draft");

  // Pre-split preview visible
  await expect(page.locator(".tournament-preview")).toBeVisible();
  await expect(page.locator(".tournament-preview-text").first()).toContainText("eligible players");

  // Split CTA
  const splitCta = page.getByTestId("split-teams-cta");
  await expect(splitCta).toBeVisible();
  await expect(splitCta).toHaveText(/Split your teams/);
});
