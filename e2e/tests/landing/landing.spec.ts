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
import { SEED_DISCIPLINES } from "../../../src/domain/seed";
import type { TournamentFormat } from "../../../src/domain/types";
import type { Page } from "@playwright/test";

/** The Landing Page's own h1; the app's is "Dashboard" (or another screen title). */
const LANDING_H1 = "Pick the players. Get the fairest teams it can prove.";

/**
 * The formats a tournament can be run in, keyed by `TournamentFormat`
 * (src/domain/types.ts:25). The map is exhaustive by construction — the same
 * idiom the app's own label maps use (`Record<TournamentFormat, string>` in
 * src/tournament/GamesScreen.tsx:27, src/tournament/TournamentScreen.tsx:26,
 * src/DashboardScreen.tsx:6) — so it mirrors the code that owns the set instead
 * of adding a second list of formats. Adding "round-robin" to the union makes
 * this object literal a `tsc` error until the rail's number is rechecked, and
 * the count assertion then fails while the page still reads 3.
 */
const FORMATS: Record<TournamentFormat, true> = {
  series: true,
  "single-elim": true,
  swiss: true,
};

/** Navigate to the Landing Page by absolute path, independent of baseURL. */
const gotoLanding = (page: Page) => page.goto("/", { waitUntil: "load" });

test.describe("Landing Page", () => {
  test("the root serves the Landing Page, not the app", async ({ page }) => {
    await gotoLanding(page);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(LANDING_H1);
    await expect(page.locator("#root")).toHaveCount(0);
    await expect(page.locator(".app")).toHaveCount(0);
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
      "The screen says when the gap is the best it found, not proven",
      "stays on your device",
      "no account",
    ]);

    // B14: the offline promise is deleted, not softened. D02 restores it with the
    // manifest and service worker; until then the page must not make it at all.
    await expect(page.locator(".landing-trust")).not.toContainText("no signal");
    // B14 round 3: "for a two-team pool" was still a pool-size claim. Two-team
    // futsal pools of 32+ abort at NODE_BUDGET, so the row now promises the one
    // thing true at every size — the screen flags the best-found case.
    await expect(page.locator(".landing-trust")).not.toContainText("proven minimum");
    // The lede claims only what the solver can prove for every pool size.
    await expect(page.locator(".landing-lede")).toContainText("it can prove");
    // And "exact, not estimated" — the phrase that overclaimed — is gone.
    await expect(page.locator(".landing-lede")).not.toContainText("exact, not estimated");
    // B14 round 3: "honoring every role" promised the coverage the Roster row
    // had just been corrected for promising. The split weighs roles and names
    // the coverer; it does not guarantee the role.
    await expect(page.locator(".landing-lede")).toContainText("who is covering");
    await expect(page.locator(".landing-lede")).not.toContainText("honoring every role");

    // The Edit row is the fourth hand-written mirror of what the app says, and
    // this one was false: it read "You are never told the teams are fair", while
    // the split screen does tell you — "Dead even. Fair game."
    // (src/session/SplitScreen.tsx:140) and "All roles covered. Fair game."
    // (:234), the first of which e2e/tests/split/gap-provenance.spec.ts:174 pins
    // exactly. The claim that survives is the number, not the silence, so the
    // denial is asserted gone and what replaced it is asserted present.
    const editClaim = page.locator('section[aria-labelledby="landing-row-edit"] .landing-claim');
    await expect(editClaim).not.toContainText("never told the teams are fair");
    await expect(editClaim).toContainText("best it found");

    // The bracket preview's head was the last unqualified fairness claim on the
    // page. The split it sits above is not always a proof: the screen prints
    // "Best gap found." (src/session/gapProvenance.ts:32) whenever the search
    // did not prove the minimum, which is what the hero's own demo does on the
    // second click — so "the teams that are already fair" is false of the page
    // that ships it. The claim that survives is provenance, not fairness: the
    // tournament is handed the split's own teams (SplitScreen.tsx:421,
    // `onSubmitTournament(result.teams)`), which is what the Play row and the
    // lede already teach. Pinned exactly, so neither a reword nor a re-dropped
    // scope can pass here.
    const bracketHead = page.locator(".landing-tournament-head");
    await expect(bracketHead).toHaveText(
      "Then run the tournament on the teams the split made.",
    );
    await expect(bracketHead).not.toContainText("already fair");

    await expect(page.locator(".landing-action-note")).toContainText("no account");
    // The footer was the other unqualified fairness claim on the page: the
    // h1, the meta and the lede were scoped to "it can prove" in B14, and the
    // split screen says "Best gap found." (src/session/gapProvenance.ts:32),
    // pinned by e2e/tests/split/gap-provenance.spec.ts:144. Pinned exactly, so
    // neither a reword nor a dropped scope can pass here.
    await expect(page.locator(".landing-footer")).toHaveText(
      "comp3tive — the fairest teams it can prove, for futsal nights, MLBB sessions, and everything after.",
    );
    await expect(page.locator(".landing-footer")).not.toContainText("fair teams for futsal nights");

    // The Formats rail counts the formats the app can run, so it is asserted
    // against `TournamentFormat` — the union that owns the set — rather than a
    // typed number: Phase D's round-robin must not leave a stale 3.
    await expect(
      page.locator(".landing-fact", { hasText: "Formats" }).locator("dd"),
    ).toHaveText(String(Object.keys(FORMATS).length));

    // B14 round 2: the meta description repeated the unscoped claim the lede
    // had just dropped, and the offline promise is deleted rather than softened
    // — D02 restores it with the manifest and service worker.
    const described = (await page.locator('meta[name="description"]').getAttribute("content")) ?? "";
    expect(described).toContain("it can prove");
    expect(described).not.toContain("Works offline");
    expect(described).not.toContain("no signal");

    // The Roster rail counts the catalog, so it is asserted against the catalog
    // rather than a typed number: a fourth seed must not leave a stale count.
    await expect(
      page.locator(".landing-fact", { hasText: "Disciplines" }).locator("dd"),
    ).toHaveText(String(SEED_DISCIPLINES.length));

    // The cards are a hand-maintained mirror of the seeded disciplines, so the
    // mirror is pinned to the seed — the drift that made "3+" false cannot recur.
    await expect(page.locator(".landing-discipline-roles")).toHaveText(
      SEED_DISCIPLINES.map((d) => d.roles.map((r) => r.name).join(" · ")),
    );

    // B14 round 2: role coverage is soft — futsal is `rolesRequired: false`
    // (src/domain/seed.ts) and the app names a coverer
    // (`No goalkeeper on Team A. Budi is covering.`, src/session/flow.ts). The
    // page may say the split reports that; it may not promise it never happens.
    const rosterClaim = page
      .locator('section[aria-labelledby="landing-row-disciplines"] .landing-claim');
    await expect(rosterClaim).toContainText("who is covering");
    await expect(rosterClaim).not.toContainText("no goalkeeper");
    await expect(page.locator(".landing-disciplines-head")).toContainText("who is covering");
    await expect(page.locator(".landing-disciplines-head")).not.toContainText("accounted for");
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
