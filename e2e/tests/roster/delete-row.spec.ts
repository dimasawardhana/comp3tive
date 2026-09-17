/**
 * Deletes (ticket 04). The defect: the store dropped the id while the row stayed
 * on screen, because the handler wrote past the hook that owns the list. A spec
 * that reloads between steps passes today, which is why this one does not.
 */
import { expect, test } from "@playwright/test";
import { hubButton, MLBB_ID, seedScript, splitOf, type SeedWorld } from "../../support/seed";

const world = (): SeedWorld => ({
  communities: [{ id: "comm-del", name: "Delete Crew", createdAt: 100 }],
  players: [
    { id: "p1", communityId: "comm-del", name: "Player 1", capabilities: [] },
    { id: "p2", communityId: "comm-del", name: "Player 2", capabilities: [] },
    { id: "p3", communityId: "comm-del", name: "Player 3", capabilities: [] },
  ],
  sessions: [
    {
      id: "s1",
      communityId: "comm-del",
      disciplineId: MLBB_ID,
      createdAt: 100,
      poolPlayerIds: ["p1", "p2"],
      settings: { teamCount: 2 },
      result: splitOf(["p1", "p2"]),
    },
    {
      id: "s2",
      communityId: "comm-del",
      disciplineId: MLBB_ID,
      createdAt: 200,
      poolPlayerIds: ["p1", "p2"],
      settings: { teamCount: 2 },
      result: splitOf(["p1", "p2"]),
    },
  ],
  tournaments: [
    {
      id: "tr-del",
      communityId: "comm-del",
      disciplineId: MLBB_ID,
      name: "Delete Cup",
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
  squads: [],
  activeCommunityId: "comm-del",
});

test("deleting a player, a tournament and a session removes the row without a reload", async ({ page }) => {
  // The seed is installed directly rather than through `gotoHubSeeded` because
  // Playwright replays every init script on navigation: seeding through it would
  // make the reload below re-create the deleted record, so the persistence half
  // of this test would be asserting the harness instead of the app. Holding the
  // disposable keeps the reload a real one while stopping the replay.
  const seed = await page.addInitScript(seedScript(world()));
  await page.goto("./");
  await expect(page.locator(".app")).toBeVisible({ timeout: 15000 });
  await hubButton(page, "Roster").click();
  await expect(page.locator(".screen h1")).toBeVisible();
  await expect(page.locator(".roster .row")).toHaveCount(3);

  // Playwright dismisses native dialogs by default; the audit found the confirm
  // blocking automation until a handler accepted it.
  page.once("dialog", (dialog) => void dialog.accept());
  await page.locator(".roster .row").first().click();
  await expect(page.locator(".modal-title")).toHaveText("Edit player");
  await page.getByRole("button", { name: "Delete", exact: true }).click();

  // The row must go WITHOUT a reload: the store and the list currently diverge.
  await expect(page.locator(".roster .row")).toHaveCount(2, { timeout: 5000 });

  // And the delete must be persisted, so it survives one.
  await seed.dispose();
  await page.reload();
  await expect(page.locator(".screen h1")).toBeVisible({ timeout: 15000 });
  await hubButton(page, "Roster").click();
  await expect(page.locator(".roster .row")).toHaveCount(2);

  // A tournament delete from Games behaves the same way.
  await hubButton(page, "Games").click();
  await expect(page.locator(".roster .row")).toHaveCount(1);
  // exact: the row itself is role=button and its accessible name contains this
  // text, so a substring match would resolve to two elements.
  await page.getByRole("button", { name: "Delete tournament", exact: true }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.locator(".roster .row")).toHaveCount(0, { timeout: 5000 });

  // The History row's onDelete was the third handler writing past its hook.
  await hubButton(page, "History").click();
  await expect(page.locator(".history-row")).toHaveCount(2);
  page.once("dialog", (dialog) => void dialog.accept());
  await page.locator(".history-row").first().getByRole("button", { name: "Delete session", exact: true }).click();
  await expect(page.locator(".history-row")).toHaveCount(1, { timeout: 5000 });

  await page.reload();
  await expect(page.locator(".screen h1")).toBeVisible({ timeout: 15000 });
  await hubButton(page, "History").click();
  await expect(page.locator(".history-row")).toHaveCount(1);
});
