import { test, expect } from "@playwright/test";
import { gotoHubSeeded, type SeedWorld } from "../../support/seed";
import { SEED_DISCIPLINES } from "../../../src/domain/seed";

const emptyWorld = (): SeedWorld => ({
  communities: [{ id: "comm-discipline", name: "Discipline Test", createdAt: 100 }],
  players: [],
  sessions: [],
  tournaments: [],
  squads: [],
  activeCommunityId: "comm-discipline",
});

/**
 * The lede's discipline list, in the English form it is written in:
 * "Futsal, MLBB and Badminton". The names are read from the catalog, never
 * typed here, so a fourth seed — or a rename — fails the assertion instead of
 * quietly making the sentence false. This is the same defect class as the
 * landing rail's "3+", and the same fix as `landing.spec.ts:109-113`.
 */
const englishList = (items: string[]) =>
  items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
const builtInList = englishList(SEED_DISCIPLINES.map((d) => d.shortName));

test("discipline: layout padding + list refreshes after creation", async ({ page }) => {
  await gotoHubSeeded(page, emptyWorld(), "Games");
  await expect(page.locator(".screen h1")).toHaveText("Games");
  await page.getByRole("button", { name: "Disciplines" }).click();
  await expect(page.locator(".screen h1")).toHaveText("Disciplines");

  // 1. .screen wrapper has padding
  const screen = page.locator(".screen");
  await expect(screen).toBeVisible();
  const screenPadding = await screen.evaluate((el) => {
    const cs = window.getComputedStyle(el);
    return { top: parseInt(cs.paddingTop), left: parseInt(cs.paddingLeft) };
  });
  expect(screenPadding.top).toBeGreaterThanOrEqual(12);
  expect(screenPadding.left).toBeGreaterThanOrEqual(12);

  // 2. Count initial disciplines
  const initialRows = await page.locator(".roster .row").count();
  expect(initialRows).toBeGreaterThanOrEqual(2);

  // 3. Open new discipline modal
  await page.getByRole("button", { name: /New Discipline/ }).click();
  const modal = page.locator(".modal-card");
  await expect(modal).toBeVisible();

  // 4. Fill name
  await modal.getByRole("textbox", { name: "Name", exact: true }).fill("Test Discipline");
  await modal.getByRole("button", { name: /Add attribute/ }).click();
  await modal.getByPlaceholder("e.g. Skill").fill("skill");
  await modal.getByRole("checkbox", { name: /Roles are required/ }).uncheck();
  const saveBtn = modal.getByRole("button", { name: /Add discipline/ });
  await expect(saveBtn).toBeEnabled({ timeout: 3000 });
  await saveBtn.click();

  // 7. Modal closes
  await expect(modal).not.toBeVisible({ timeout: 5000 });

  // 8. New discipline appears WITHOUT page refresh
  await expect(page.locator(".roster .row")).toHaveCount(initialRows + 1, { timeout: 5000 });
  await expect(page.getByText("Test Discipline")).toBeVisible();
});

test("discipline: the catalog lede names the disciplines the seed ships", async ({ page }) => {
  await gotoHubSeeded(page, emptyWorld(), "Games");
  await page.getByRole("button", { name: "Disciplines" }).click();
  await expect(page.locator(".screen h1")).toHaveText("Disciplines");

  // `The activities you build teams for. Futsal, MLBB and Badminton ship
  // built-in; add your own.` (src/domain/DisciplinesScreen.tsx:25) was the
  // last hand-maintained mirror of the catalog, with nothing tying it to
  // SEED_DISCIPLINES. Both halves are pinned: the list, and the claim that
  // these are the ones that ship.
  const lede = page.locator(".screen .page-header .lede");
  await expect(lede).toContainText("ship built-in");
  await expect(lede).toContainText(builtInList);

  // A fourth seed changes `builtInList`, so the sentence fails until the copy
  // follows the catalog — the drift that made the landing rail's "3+" false
  // cannot recur here.
});

test("discipline: a built-in discipline's attribute can be widened to 1-10 and labeled", async ({ page }) => {
  await gotoHubSeeded(page, emptyWorld(), "Games");
  await page.getByRole("button", { name: "Disciplines" }).click();
  await expect(page.locator(".screen h1")).toHaveText("Disciplines");

  // Open the first built-in discipline (Futsal) for editing. Editing a built-in
  // is the point: the catalog on a device belongs to the Organizer, and only
  // the delete is refused.
  await page.locator(".roster .row", { hasText: "Futsal" }).first().click();
  const modal = page.locator(".modal-card");
  await expect(modal).toBeVisible();
  await expect(modal.locator(".modal-title")).toHaveText("Edit discipline");

  // Widen the first attribute to 1-10 and name one value.
  const attr = modal.locator(".attr-editor").first();
  await attr.getByLabel(/maximum/).fill("10");
  await attr.getByLabel(/^Label for .* 10$/).fill("Elite");

  await modal.getByRole("button", { name: "Save changes" }).click();
  await expect(modal).not.toBeVisible();

  // Reopen: the change persisted, and the banner still says what a backup does.
  await page.locator(".roster .row", { hasText: "Futsal" }).first().click();
  await expect(modal).toBeVisible();
  await expect(modal.locator(".attr-editor").first().getByLabel(/maximum/)).toHaveValue("10");
  await expect(modal.locator(".attr-editor").first().getByLabel(/^Label for .* 10$/)).toHaveValue("Elite");
  await expect(modal.locator(".modal-banner")).toContainText("editable on this device");

  // And the delete is still refused: no Delete button on a built-in.
  await expect(modal.getByRole("button", { name: "Delete" })).toHaveCount(0);
});
