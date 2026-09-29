/**
 * The share surface: the finished teams as one block of text, onto the
 * clipboard.
 *
 * This spec is the only place the clipboard itself is exercised. The unit tests
 * beside the sheet (`src/share/ShareSheet.test.ts`) render it statically, which
 * cannot see a resolved promise or a rejected one — and "the text left the
 * building" is the whole claim of this feature, so it is worth a real browser.
 *
 * The pool is uniform MLBB, ten players at two teams: a measured, proven split
 * (`e2e/tests/split/gap-provenance.spec.ts` records this pool at
 * `optimal=true, gap=0.1`), so the closing line is the proven one. The flow is
 * walked exactly as that spec walks it — pick the game, select everyone, dial
 * the stepper — rather than jumping straight to `split-button`, because a
 * shortcut that only works on the day it is written proves nothing on the day
 * the split screen changes.
 */
import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { gotoHubSeeded, type SeedWorld } from "../../support/seed";

/** Ten uniform all-rounders, two teams of five: the proven pool above. */
const NAMES = ["Andi", "Budi", "Citra", "Dewi", "Eka", "Fajar", "Gita", "Hana", "Irfan", "Joko"];

const world = (): SeedWorld => ({
  communities: [{ id: "comm-share", name: "Thursday Crew", createdAt: 100 }],
  players: NAMES.map((name, i) => ({
    id: `p${i + 1}`,
    communityId: "comm-share",
    name,
    capabilities: [
      {
        disciplineId: "mlbb",
        attributeRatings: { mechanics: 4, "game-sense": 4, "hero-pool": 4, teamwork: 4 },
        eligibleRoles: ["tank", "assassin", "mage", "marksman", "fighter"],
        preferredRole: null,
      },
    ],
  })),
  sessions: [],
  tournaments: [],
  squads: [],
  activeCommunityId: "comm-share",
});

/** Roster → Split match → Match setup with MLBB and two teams → the split screen. */
async function splitTwoTeams(page: Page) {
  await gotoHubSeeded(page, world(), "Roster");
  await page.getByRole("button", { name: "Split match" }).click();
  await expect(page.locator(".match-setup")).toBeVisible({ timeout: 10000 });

  await page.locator(".game", { hasText: "Mobile Legends" }).click();
  await expect(page.locator(".chip-player").first()).toBeVisible({ timeout: 10000 });

  const chips = page.locator(".chip-player");
  const count = await chips.count();
  for (let i = 0; i < count; i++) {
    const chip = chips.nth(i);
    if ((await chip.getAttribute("aria-pressed")) !== "true") await chip.click();
  }

  await page.getByTestId("split-button").click();
  await expect(page.locator(".split-screen")).toBeVisible({ timeout: 15000 });
}

/** The sheet, opened from the split screen. */
async function openSheet(page: Page) {
  const share = page.getByTestId("share-teams");
  await expect(share).toBeVisible();
  await share.click();
  const sheet = page.locator(".modal-card");
  await expect(sheet).toBeVisible();
  return sheet;
}

test.describe("the share sheet", () => {
  // Clipboard reads need an explicit grant, and the grant is per browser
  // context — `test.use` puts it on the context this spec runs in.
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  test("copies the finished teams as text, provenance included", async ({ page }) => {
    await splitTwoTeams(page);
    const sheet = await openSheet(page);

    // The sheet shows the text before it is copied, so the organizer sees what
    // they are about to send. This pool is proven, so the verdict is the
    // proven one — stated in full, because a chat message has no surrounding
    // sentence to carry a qualifier.
    const preview = sheet.locator("textarea.share-preview");
    await expect(preview).toHaveValue(
      /^Mobile Legends · Thursday Crew — 2 teams\n[\s\S]*\nGap 0\.0 — the proven minimum for this pool\.$/,
    );

    await sheet.getByTestId("share-copy-text").click();
    await expect(sheet.locator(".share-status")).toHaveText("Copied.");

    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied.startsWith("Mobile Legends · Thursday Crew — 2 teams\n")).toBe(true);
    for (const name of NAMES) expect(copied).toContain(name);
    expect(copied).toContain("Gap 0.0 — the proven minimum for this pool.");

    // Byte for byte what the organizer read, because the preview and the
    // clipboard are one string: a sheet that re-rendered the text on copy would
    // send something nobody saw.
    expect(copied).toBe(await preview.inputValue());
  });

  test("keeps the text and says so when the clipboard API is unavailable", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, "clipboard", { get: () => undefined, configurable: true });
    });
    await splitTwoTeams(page);
    const sheet = await openSheet(page);

    await sheet.getByTestId("share-copy-text").click();
    await expect(sheet.locator(".share-status")).toHaveText(
      "Copy failed. Select the text above and copy it.",
    );

    // The text is never lost, and it is left selected so a manual copy is one
    // keystroke rather than a re-selection by hand.
    const preview = sheet.locator("textarea.share-preview");
    await expect(preview).toHaveValue(/Thursday Crew/);
    const selection = await preview.evaluate((el) => {
      const t = el as HTMLTextAreaElement;
      return { start: t.selectionStart, end: t.selectionEnd, len: t.value.length };
    });
    expect(selection.end - selection.start).toBe(selection.len);
  });

  test("the landing hero gains no share control", async ({ page }) => {
    // `landing.spec.ts` asserts the hero renders the split screen; it must
    // still render there WITHOUT the affordance, which is why `share` is
    // optional and `src/landing.tsx:151-161` passes nothing.
    await page.goto("/");
    await expect(page.locator("#landing-hero .split-screen")).toBeVisible();
    await expect(page.locator("#landing-hero").getByTestId("share-teams")).toHaveCount(0);
  });
});
