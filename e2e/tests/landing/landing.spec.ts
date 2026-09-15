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
const LANDING_H1 = "Split the group into fair teams.";

/** Navigate to the Landing Page by absolute path, independent of baseURL. */
const gotoLanding = (page: Page) => page.goto("/", { waitUntil: "load" });

test.describe("Landing Page", () => {
  test("the root serves the Landing Page, not the app", async ({ page }) => {
    await gotoLanding(page);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(LANDING_H1);
    await expect(page.locator("#root")).toHaveCount(0);
    await expect(page.locator(".app")).toHaveCount(0);
    // No React bundle is loaded: the page is a document, not an application.
    await expect(page.locator("script[src]")).toHaveCount(0);
  });

  test("states what the product is, in the product's voice", async ({ page }) => {
    await gotoLanding(page);

    await expect(page.locator(".landing-wordmark")).toHaveText("comp3tive");
    await expect(page.locator(".landing-lede")).toContainText("balanced teams");
    await expect(page.locator(".landing-features dt")).toHaveText(["Split", "Edit", "Play"]);

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
    await page.keyboard.press("Tab");

    const cta = page.getByRole("link", { name: "Open comp3tive" });
    await expect(cta).toBeFocused();
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
