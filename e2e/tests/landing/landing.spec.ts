/**
 * The Landing Page at `/` and the app at `/app` (ADR-0006).
 *
 * These specs deliberately do NOT use the suite's baseURL: the baseURL points at
 * the app (`/app/`), and this file exists to prove the two documents are distinct
 * and that the boundary between them behaves. There are two ways to navigate to
 * the Landing Page, and they are not interchangeable:
 *
 * - `page.goto("/")` resolves against the *origin*, so it lands on the Landing
 *   Page regardless of the baseURL's path.
 * - `page.goto("./")` resolves against the baseURL, so it lands on the app.
 *
 * The redirect spec seeds `localStorage["tb-community"]` — the key the app's own
 * community hook writes (`src/domain/useCommunities.ts`) — because that key is
 * exactly what the returning-organizer check reads.
 */
import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

/** The Landing Page's own h1; the app's is "Dashboard" (or another screen title). */
const LANDING_H1 = "Pick the players. Get the fairest teams.";

/** Navigate to the Landing Page by absolute path, independent of baseURL. */
const gotoLanding = (page: Page) => page.goto("/", { waitUntil: "load" });

test.describe("Landing Page", () => {
  test("the root serves the Landing Page, not the app", async ({ page }) => {
    await gotoLanding(page);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(LANDING_H1);
    await expect(page.locator("#root")).toHaveCount(0);
    await expect(page.locator(".app")).toHaveCount(0);
    // The app's shell is absent: no SPA root, no bottom tab bar.
    await expect(page.locator(".tabbar")).toHaveCount(0);
    // The landing hero is a React island (src/landing.tsx), which is how the
    // split screen is demonstrated. The page around it stays a document: no
    // framework router, no app bundle.
    await expect(page.locator("#landing-hero .split-screen")).toBeVisible();
  });

  test("states what the product is, in the product's voice", async ({ page }) => {
    await gotoLanding(page);

    // The wordmark is an SVG whose accessible name is its <title>.
    await expect(page.locator(".landing-wordmark")).toHaveRole("img");
    await expect(page.locator(".landing-wordmark")).toHaveAccessibleName("comp3tive");
    await expect(page.locator(".landing-lede")).toContainText("smallest strength gap");
    // The ledger rails are the product's own verbs, in reading order.
    await expect(page.locator(".landing-rail-label")).toHaveText([
      "Split",
      "Edit",
      "Play",
      "Roster",
      "Open",
    ]);

    const trust = page.locator(".landing-trust li");
    await expect(trust).toHaveCount(3);
    await expect(trust).toContainText([
      "proven minimum",
      "no signal",
      "stays on your device",
    ]);

    await expect(page.locator(".landing-action-note")).toContainText("no account");
    await expect(page.locator(".landing-footer")).toContainText("fair teams for futsal nights");
  });

  test("the primary action is a real link into the app", async ({ page }) => {
    await gotoLanding(page);

    const cta = page.getByRole("link", { name: "Open comp3tive" });
    await expect(cta).toHaveAttribute("href", "/app/");

    await cta.click();
    await expect(page).toHaveURL(/\/app\/$/);
    await expect(page.locator(".app")).toBeVisible({ timeout: 15_000 });
  });

  test("keyboard focus reaches the action with a visible outline", async ({ page }) => {
    await gotoLanding(page);

    // The action is reachable by keyboard, and carries a real focus ring. It is
    // not first in tab order: the live split screen above it contributes its own
    // controls, which is exactly what a working demonstration costs.
    const cta = page.getByRole("link", { name: "Open comp3tive" });
    await cta.focus();
    await expect(cta).toBeFocused();
    await expect(cta).toHaveAttribute("href", "/app/");

    const outline = await cta.evaluate((el) => getComputedStyle(el).outlineWidth);
    expect(parseFloat(outline)).toBeGreaterThanOrEqual(2);
  });

  test("the hero renders the split screen component with teams and gap meter", async ({ page }) => {
    await gotoLanding(page);
    const hero = page.locator(".landing-hero");

    // The React component renders the split screen, not an image.
    await expect(hero.locator(".split-screen")).toBeVisible();
    await expect(hero.locator(".split-head")).toBeVisible();

    // Team cards should be rendered in the split screen.
    const teamCards = hero.locator(".team");
    await expect(teamCards).toHaveCount(2);

    // The gap meter should be present.
    await expect(hero.locator(".pitch")).toBeVisible();


    // Swap at the mobile breakpoint — component must not overflow.
    await page.setViewportSize({ width: 390, height: 900 });
    await expect(hero).toBeVisible();

    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(hero).toBeVisible();
  });

  test("the split animation deals ten players into two teams", async ({ page }) => {
    await gotoLanding(page);
    const deal = page.locator(".deal");

    await expect(deal).toBeVisible();
    // Ten chips, two teams, each team holding five slots.
    await expect(deal.locator(".deal-chip")).toHaveCount(10);
    await expect(deal.locator(".deal-team")).toHaveCount(2);
    await expect(deal.locator(".deal-team").first().locator(".deal-slot, .deal-anchor")).toHaveCount(5);

    // The chips carry real solver output, not placeholder text.
    await expect(deal.locator(".deal-chip-name")).toHaveText([
      "Budi", "Andi", "Citra", "Dewi", "Eka", "Fajar", "Gita", "Hana", "Irfan", "Joko",
    ]);

    // The deal runs while the stage is on screen: the pool resolves into teams.
    await page.locator(".deal-stage").scrollIntoViewIfNeeded();
    await expect(deal.locator(".deal-stage")).toHaveAttribute("data-dealt", "true");

    const chips = deal.locator(".deal-chip");
    const columns = async () =>
      new Set(
        await chips.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().left))),
      );

    // The travel is long enough to catch mid-flight, so more than one column.
    await expect.poll(async () => (await columns()).size, { timeout: 5000 }).toBeGreaterThan(1);
    // And it settles on exactly two: the two teams.
    await expect.poll(async () => (await columns()).size, { timeout: 8000 }).toBe(2);
  });

  test("the split animation holds its layout on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoLanding(page);

    await page.locator(".deal-stage").scrollIntoViewIfNeeded();
    await page.waitForTimeout(1600);

    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return [...document.querySelectorAll(".deal-chip")].filter((el) => {
        const rect = el.getBoundingClientRect();
        return rect.right > doc.clientWidth + 1 || rect.left < -1;
      }).length;
    });
    expect(overflow).toBe(0);

    // No player's name is truncated at the narrowest target width.
    const clipped = await page.locator(".deal-chip-name").evaluateAll((els) =>
      els.filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => el.textContent),
    );
    expect(clipped).toEqual([]);
  });

  test("the deal is shown settled, with no loop, when motion is reduced", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await gotoLanding(page);

    const deal = page.locator(".deal");
    await expect(deal.locator(".deal-stage")).toHaveAttribute("data-dealt", "true");
    await page.locator(".deal-stage").scrollIntoViewIfNeeded();

    const first = deal.locator(".deal-chip").first();
    await expect(first).toHaveCSS("opacity", "1");
    // The chips carry no transition, so nothing moves.
    await expect(first).toHaveCSS("transition-duration", "0s");
    const before = await first.evaluate((el) => Math.round(el.getBoundingClientRect().left));
    await page.waitForTimeout(2500);
    const after = await first.evaluate((el) => Math.round(el.getBoundingClientRect().left));
    expect(after).toBe(before);
  });

  test("the deal repeats, holding the settled teams before it clears", async ({ page }) => {
    await gotoLanding(page);
    const stage = page.locator(".deal-stage");
    await stage.scrollIntoViewIfNeeded();

    // The pool clears and reassembles on its own, without anyone asking.
    const cycleAtStart = await stage.getAttribute("data-cycle");
    await expect
      .poll(async () => stage.getAttribute("data-cycle"), { timeout: 15000 })
      .not.toBe(cycleAtStart);

    // The settled teams were held, not flashed past: `holding` lasts 2s.
    await expect(stage).toHaveAttribute("data-phase", "holding", { timeout: 15000 });
  });

  test("the loop can be paused and resumed", async ({ page }) => {
    await gotoLanding(page);
    const stage = page.locator(".deal-stage");
    const control = page.locator(".deal-control");
    await stage.scrollIntoViewIfNeeded();

    await expect(control).toHaveText("Pause");
    await control.click();
    await expect(control).toHaveText("Play");
    await expect(control).toHaveAttribute("aria-pressed", "true");

    // Paused: the phase stops advancing.
    const phase = await stage.getAttribute("data-phase");
    await page.waitForTimeout(3000);
    expect(await stage.getAttribute("data-phase")).toBe(phase);

    await control.click();
    await expect(control).toHaveText("Pause");
  });

  test("renders in both light and dark mode from the shared tokens", async ({ page }) => {
    await gotoLanding(page);
    const body = page.locator("body");

    const light = await body.evaluate((el) => getComputedStyle(el).backgroundColor);
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "dark";
    });
    const dark = await body.evaluate((el) => getComputedStyle(el).backgroundColor);

    expect(dark).not.toBe(light);
    // The app's own tokens, not the Landing Page's copies of them.
    expect(light).toBe("rgb(250, 248, 245)");
    expect(dark).toBe("rgb(28, 25, 23)");
  });
});

test.describe("Returning organizer redirect", () => {
  test("a fresh visit shows the Landing Page", async ({ page }) => {
    await gotoLanding(page);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(LANDING_H1);
    expect(new URL(page.url()).pathname).toBe("/");
  });

  test("an existing app user is forwarded into the app", async ({ page }) => {
    // The app writes this key on its own first refresh; pre-seeding it is the
    // same state a returning organizer arrives in.
    await page.addInitScript(() => {
      localStorage.setItem("tb-community", "community-default");
    });
    await gotoLanding(page);

    await expect(page).toHaveURL(/\/app\/$/);
    await expect(page.locator(".app")).toBeVisible({ timeout: 15_000 });
  });

  test("?stay keeps the Landing Page reachable for an existing app user", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("tb-community", "community-default");
    });
    await page.goto("/?stay", { waitUntil: "load" });

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(LANDING_H1);
    expect(new URL(page.url()).pathname).toBe("/");
  });

  test("Back after the redirect leaves the site instead of bouncing", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("tb-community", "community-default");
    });
    await gotoLanding(page);
    await expect(page.locator(".app")).toBeVisible({ timeout: 15_000 });

    // `location.replace` keeps the Landing Page out of the history, so going back
    // cannot land on `/` and re-run the redirect.
    await page.goBack();
    await page.waitForTimeout(500);
    expect(new URL(page.url()).pathname).not.toBe("/");
  });

  test("storage that throws shows the Landing Page rather than erroring", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        get() {
          throw new Error("storage blocked");
        },
      });
    });
    await gotoLanding(page);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(LANDING_H1);
    expect(errors).toEqual([]);
  });
});
