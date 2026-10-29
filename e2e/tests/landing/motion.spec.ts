/**
 * The Landing Page's motion, measured against the fold.
 *
 * Why this had to be measured rather than asserted: the page has carried an
 * authored deal loop since the Split row was built, and every existing test
 * touching it passed the whole time, because `.deal` existed and its chips
 * moved. None of that is the claim this file makes. The claim is that a visitor
 * *sees* it, and that is a number: where the stage sits relative to
 * `innerHeight` when the document loads, with `scrollY` still zero.
 *
 * The numbers behind the assertions, read off the built bundle at 1280x900
 * before the Split row was reordered: the deal began at y979 in a viewport that
 * ended at 900. Ten chips, two teams, a five-phase scheduler and a
 * reduced-motion path, all of it 79px below the fold, while the page above it
 * read as a still picture. A class-name assertion cannot see that, and neither
 * can a screenshot that scrolls to its subject.
 *
 * The second claim is about *which* properties move. A chip's geometry is
 * measured from real layout and written inline, so `transition-property` is the
 * only thing standing between a reflow per frame and a composited animation.
 * Reading it, and sweeping `document.getAnimations()` for a transitioned layout
 * property, is what keeps that true as the loop is edited.
 *
 * Colour is deliberately allowed. `.deal-dot` transitions `background-color`
 * when a chip lands, which is paint, not layout, and the page's whole colour
 * argument is that the dot *becomes* the team's identity at that moment.
 */
import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

/** The Landing Page's own h1; the app's is "Dashboard". */
const LANDING_H1 = "Fairest teams it can prove";

/** Navigate by absolute path, independent of the suite's `/app/` baseURL. */
const gotoLanding = (page: Page) => page.goto("/", { waitUntil: "load" });

/**
 * Properties whose animation costs a layout pass. None of these may be
 * transitioned on this page: the deal moves ten absolutely positioned chips
 * every frame, and a width or top in that list turns each frame into a reflow.
 */
const LAYOUT_PROPS = [
  "width",
  "height",
  "top",
  "left",
  "right",
  "bottom",
  "inset",
  "margin",
  "padding",
  "gap",
  "flex",
  "flex-basis",
  "font-size",
  "line-height",
  "grid-template-columns",
  "grid-template-rows",
  "justify-content",
  "align-items",
];

test.describe("Landing Page motion", () => {
  test("the deal starts and finishes inside the first viewport on a laptop", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoLanding(page);

    const stage = page.locator(".deal-stage");
    await expect(stage).toBeVisible();

    // `boundingBox` is viewport-relative, which is the whole point: this is
    // what a visitor sees before touching the scroll wheel.
    const box = await stage.boundingBox();
    expect(box).not.toBeNull();
    const { y, height } = box!;

    // Top of the stage is inside the first screen...
    expect(y).toBeLessThan(900);
    // ...and so is the bottom, so the settled teams are read without a scroll.
    expect(y + height).toBeLessThanOrEqual(900);
    // The whole `.deal` including its caption, which is where the reader is
    // told what they just watched.
    const deal = await page.locator(".deal").boundingBox();
    expect(deal!.y + deal!.height).toBeLessThanOrEqual(900);

    // Nothing moved to make that true: the fold is measured at scroll 0.
    expect(await page.evaluate(() => window.scrollY)).toBe(0);

    // And it is actually dealing, not merely present.
    await expect(stage).toHaveAttribute("data-dealt", "true", { timeout: 5000 });
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test("the first chip's whole travel happens inside a phone's first viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoLanding(page);

    const stage = page.locator(".deal-stage");
    await expect(stage).toBeVisible();

    // 390x844 cannot hold the headline and all 532px of the stage, and shrinking
    // the stage to make it fit would cost the loop its readable chip pitch. What
    // it can hold is the pool plus the first slot of each team, so the authored
    // moment is one chip's full flight: where it starts and where it lands both
    // have to be on screen.
    const stageBox = await stage.boundingBox();
    expect(stageBox!.y).toBeLessThan(844);

    const chip = page.locator(".deal-chip").first();
    const poolBox = await chip.boundingBox();
    expect(poolBox!.y + poolBox!.height).toBeLessThanOrEqual(844);

    await expect(stage).toHaveAttribute("data-phase", "holding", { timeout: 15000 });
    const landedBox = await chip.boundingBox();
    expect(landedBox!.y + landedBox!.height).toBeLessThanOrEqual(844);

    // The chip really did move; this is a travel, not a relabel.
    expect(Math.abs(landedBox!.y - poolBox!.y)).toBeGreaterThan(100);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test("no layout property animates anywhere on the page", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoLanding(page);

    // Sample mid-deal, when the most transitions are in flight at once.
    await expect(page.locator(".deal-stage")).toHaveAttribute("data-dealt", "true", { timeout: 5000 });

    const running = await page.evaluate(() => {
      return document.getAnimations().map((a) => {
        const kind = a.constructor.name;
        const prop = (a as CSSTransition).transitionProperty ?? null;
        return { kind, prop };
      });
    });

    // Something must be moving, or this test proves nothing about the moment.
    expect(running.length).toBeGreaterThan(0);

    const transitioned = running.filter((a) => a.kind === "CSSTransition").map((a) => a.prop);
    for (const prop of transitioned) {
      expect(LAYOUT_PROPS).not.toContain(prop);
    }

    // A keyframe animation is a second timing system beside the loop's
    // constants; the page is meant to have exactly one.
    expect(running.filter((a) => a.kind === "CSSAnimation")).toEqual([]);

    // The chips themselves are pinned to the two composited properties.
    const chipProps = await page
      .locator(".deal-chip")
      .first()
      .evaluate((el) => getComputedStyle(el).transitionProperty);
    expect(chipProps).toBe("transform, opacity");
  });

  test("reduced motion leaves nothing to animate, and nothing pending", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoLanding(page);

    // The deal is settled rather than looping, and it is settled in view.
    const stage = page.locator(".deal-stage");
    await expect(stage).toHaveAttribute("data-dealt", "true");
    const box = await stage.boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(900);

    // The scroll-entry states are in src/landing.tsx, not CSS alone: nothing may
    // be parked at opacity 0 waiting for an observer that will never fire.
    const pending = await page.evaluate(() =>
      [...document.querySelectorAll(".landing-ledger > .landing-row, .landing-close")].filter(
        (el) => getComputedStyle(el).opacity !== "1",
      ).length,
    );
    expect(pending).toBe(0);

    // And there is no transition left to run, anywhere.
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  });
});

/**
 * The motion is an addition to a page that has to work without it. `landing.tsx`
 * mounts the deal, so with scripting off the demonstration is absent; what must
 * survive is the argument the page makes in words, and the one action.
 */
test.describe("Landing Page motion without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the page still reads and hides nothing", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/", { waitUntil: "load" });

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(LANDING_H1);
    await expect(page.getByRole("link", { name: "Open comp3tive" })).toBeVisible();

    // The scroll-entry rule parks rows at opacity 0 only once `landing.tsx`
    // runs, so a blocked or failed bundle cannot leave the ledger invisible.
    const hidden = await page.evaluate(() =>
      [...document.querySelectorAll(".landing-ledger > .landing-row, .landing-close")].filter(
        (el) => getComputedStyle(el).opacity !== "1",
      ).length,
    );
    expect(hidden).toBe(0);
  });
});
