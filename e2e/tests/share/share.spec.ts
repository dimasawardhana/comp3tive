/**
 * The share surface: the finished teams as one block of text for a chat, and
 * as a poster for anywhere a picture is what lands.
 *
 * This spec is the only place the clipboard itself is exercised, in both of
 * its forms. The unit tests beside the sheet (`src/share/ShareSheet.test.ts`)
 * render it statically, which cannot see a resolved promise or a rejected one
 * — and "the teams left the building", in text or in pixels, is the whole
 * claim of this feature, so it is worth a real browser.
 *
 * Three of the specs here take a capability away and assert the honest
 * fallback rather than a crash: no clipboard API (text), no `ClipboardItem`
 * (poster download), and no 2D context (no poster at all, and a sentence
 * saying so).
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
import { readFileSync } from "node:fs";
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
      /^Mobile Legends · Thursday Crew, 2 teams\n[\s\S]*\nGap 0\.0\. The proven minimum for this pool\.$/,
    );

    await sheet.getByTestId("share-copy-text").click();
    await expect(sheet.locator(".share-status")).toHaveText("Copied.");

    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied.startsWith("Mobile Legends · Thursday Crew, 2 teams\n")).toBe(true);
    for (const name of NAMES) expect(copied).toContain(name);
    expect(copied).toContain("Gap 0.0. The proven minimum for this pool.");

    // Byte for byte what the organizer read, because the preview and the
    // clipboard are one string: a sheet that re-rendered the text on copy would
    // send something nobody saw.
    expect(copied).toBe(await preview.inputValue());

    // Dismissal through the overlay. `Modal` owns that handler and four other
    // modals are built on it, and nothing in the repo exercised it — this is
    // the one place the share sheet pays for it. The click is at the overlay's
    // own corner so it lands outside `.modal-card`, whose `stopPropagation` is
    // what keeps a click inside the sheet from closing it.
    await page.locator(".modal-overlay").click({ position: { x: 5, y: 5 } });
    await expect(sheet).toBeHidden();
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

  // ---------------------------------------------------------------------
  // The poster. Same sheet, same split, one more way out — and the one that
  // can fail in a way copying text cannot, because it draws to a canvas first.
  // ---------------------------------------------------------------------

  test("copies the poster to the clipboard as a PNG", async ({ page }) => {
    await splitTwoTeams(page);
    const sheet = await openSheet(page);
    // The label is a feature detection, so a browser that would refuse an
    // image says so before the click rather than after it.
    await expect(sheet.getByTestId("share-image")).toHaveText("Copy image");

    await sheet.getByTestId("share-image").click();
    await expect(sheet.locator(".share-status")).toHaveText("Copied.", { timeout: 15_000 });

    // The first item's *own* type list, unfiltered. Filtering to image/png and
    // then asserting the first result is `image/png` proves only that the
    // filter worked; `:521` asks whether the first thing on the clipboard is
    // the poster, which a filter cannot answer.
    const items = await page.evaluate(async () => {
      const list = await navigator.clipboard.read();
      return Promise.all(
        list.map(async (item) => ({
          types: [...item.types],
          size: item.types.includes("image/png") ? (await item.getType("image/png")).size : 0,
        })),
      );
    });
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].types).toContain("image/png");
    // A legible poster at 1080 px wide, not a blank or truncated bitmap.
    expect(items[0].size).toBeGreaterThan(10_000);
  });

  test("downloads the poster when the browser cannot write an image to the clipboard", async ({ page }) => {
    await page.addInitScript(() => {
      // The constructor is defined away rather than deleted: `delete` on a
      // global interface is a silent no-op where the property is not
      // configurable, and a silently no-opped stub would leave this asserting
      // the copy path it is here to disprove. This is the same shape as the
      // clipboard stub in the spec above.
      Object.defineProperty(window, "ClipboardItem", { get: () => undefined, configurable: true });
    });
    await splitTwoTeams(page);
    const sheet = await openSheet(page);
    await expect(sheet.getByTestId("share-image")).toHaveText("Download image");

    const download = page.waitForEvent("download");
    await sheet.getByTestId("share-image").click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^comp3tive-teams-\d{4}-\d{2}-\d{2}\.png$/);
    await expect(sheet.locator(".share-status")).toHaveText("Downloaded the image.");

    // The filename is not the file: assert the bytes on disk are a PNG of
    // poster size, so a save that produced a zero-byte or HTML body cannot
    // pass by naming itself correctly.
    const path = await file.path();
    expect(path).not.toBeNull();
    const bytes = readFileSync(path as string);
    expect(bytes.length).toBeGreaterThan(10_000);
    // PNG magic number.
    expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  });

  test("says so and keeps the text when the poster cannot be drawn", async ({ page }) => {
    await page.addInitScript(() => {
      // `renderShareImage` draws on an `OffscreenCanvas` wherever the browser
      // has one, so breaking `HTMLCanvasElement` alone would never be reached.
      // Take the constructor away and both paths end up asking a canvas for a
      // 2D context, which is the one failure `renderShareImage` documents.
      Object.defineProperty(window, "OffscreenCanvas", { get: () => undefined, configurable: true });
      HTMLCanvasElement.prototype.getContext = (() =>
        null) as typeof HTMLCanvasElement.prototype.getContext;
    });
    await splitTwoTeams(page);
    const sheet = await openSheet(page);

    await sheet.getByTestId("share-image").click();
    // The point of the whole path: a control that cannot deliver says so in the
    // one region the sheet already speaks through, rather than doing nothing
    // visible at all.
    // 15 s, not the 10 s config default: `renderShareImage` awaits the two CDN
    // faces *before* it asks for a 2D context, so this status sits behind the
    // same font wait the copy spec above gives 15 s.
    await expect(sheet.locator(".share-status")).toHaveText("Image failed. Select the text above and copy it.", {
      timeout: 15_000,
    });

    // The recovery is the text path's, unchanged: the split is still there and
    // it is left selected, because it is the only thing left that can be sent.
    const preview = sheet.locator("textarea.share-preview");
    await expect(preview).toHaveValue(/Thursday Crew/);
    const selection = await preview.evaluate((el) => {
      const t = el as HTMLTextAreaElement;
      return { start: t.selectionStart, end: t.selectionEnd, len: t.value.length };
    });
    expect(selection.end - selection.start).toBe(selection.len);
  });



  test("says so and keeps the text when the poster cannot be written to a file either", async ({ page }) => {
    await page.addInitScript(() => {
      // The download is the fallback that is supposed to always work, so it
      // cannot be allowed to throw out of the handler it is called from: the
      // copy path calls it from inside its own `catch`, and an exception here
      // would escape that and leave the button doing nothing at all. Which
      // call refuses is the browser's business — here it is the object URL,
      // because a refused `createObjectURL` leaks nothing and so pins the
      // sentence without also pinning a revocation order.
      Object.defineProperty(window, "ClipboardItem", { get: () => undefined, configurable: true });
      URL.createObjectURL = () => {
        throw new Error("injected: this browser will not mint an object URL");
      };
    });
    await splitTwoTeams(page);
    const sheet = await openSheet(page);

    await sheet.getByTestId("share-image").click();
    await expect(sheet.locator(".share-status")).toHaveText("Image failed. Select the text above and copy it.", {
      timeout: 15_000,
    });

    // The same recovery the draw failure gives, because it is the same
    // recovery: the split is still on screen and it is left selected.
    const preview = sheet.locator("textarea.share-preview");
    await expect(preview).toHaveValue(/Thursday Crew/);
    const selection = await preview.evaluate((el) => {
      const t = el as HTMLTextAreaElement;
      return { start: t.selectionStart, end: t.selectionEnd, len: t.value.length };
    });
    expect(selection.end - selection.start).toBe(selection.len);
  });
});
