/**
 * The bench advisory, looked at.
 *
 * ## Why this file exists at all
 *
 * `.bench-advice` shipped set in exactly the `.fairness` treatment: 13px,
 * 500 weight, body face, `opacity: 0.8`, centred, in the same dark panel,
 * immediately below it. Every unit and e2e case passed, because nothing in the
 * suite had an opinion about the line's *register* — only about its text and
 * about `.fairness`'s contrast. A human opened the screen, saw two identical
 * lines and read the advisory as a third clause of the gap figure rather than
 * as advice about it.
 *
 * So this file asserts the thing a DOM assertion can assert, which is that the
 * advisory is **set differently from the fairness line above it**, and then
 * attaches a screenshot of the rendered panel in all four combinations a reader
 * actually meets: 1280 and 390, light and dark. The numbers below keep the
 * treatment from being undone; the pictures keep it from being *badly* undone,
 * and they land in the HTML report where the next person who opens
 * `.bench-advice` will see them.
 *
 * The contrast measurement is not restated here: it comes from the same
 * `e2e/support/contrast.ts` the landing-hero `.fairness` case measures with, on
 * the same 4.5:1 bar, on the same rendered blend.
 *
 * ## The fixture, and the trap in it
 *
 * Eleven players, Rangga at 5 on Team A with four 4s (21 against 20), Kresna on
 * the bench. That is the arrangement `src/session/SplitScreen.bench-advice.test.ts`
 * builds and the one sentence that module pins.
 *
 * It cannot be written as literal seed data. The screen reads `avgStrength`,
 * `totalStrength` and `gap` off the stored result, and a hand-written row with
 * `avgStrength: 0` renders as a *plausible-looking* 0.0 gap with a readout that
 * contradicts the team cards above it — a fixture trap, not an app bug, and one
 * that would make the screenshot actively misleading. So this file calls the
 * same `recomputeResult` the unit fixture calls, over the same roster, and
 * seeds the result it returns.
 */
import { test, expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { alphaOf, blendedRatio, expectBlendedContrast } from "../../support/contrast";
import { gotoHubSeeded, type SeedWorld } from "../../support/seed";
import { recomputeResult } from "../../../src/session/edit";
import { MLBB_DISCIPLINE } from "../../../src/domain/seed";
import type { Player, TeamAssignment } from "../../../src/domain/types";

const COMMUNITY = { id: "comm-advice", name: "Advisory Crew", createdAt: 100 };

/** Rangga at 5, the ten who fill the two teams at 4. No one else is on the bench. */
const ROSTER: readonly (readonly [name: string, rating: number])[] = [
  ["Rangga", 5],
  ["Budi", 4], ["Citra", 4], ["Dewi", 4], ["Eka", 4], ["Fajar", 4],
  ["Gita", 4], ["Hana", 4], ["Irfan", 4], ["Joko", 4], ["Kresna", 4],
];

const roster: Player[] = ROSTER.map(([name, rating], i) => ({
  id: `pa-${i + 1}`,
  communityId: COMMUNITY.id,
  name,
  capabilities: [{
    disciplineId: MLBB_DISCIPLINE.id,
    attributeRatings: { mechanics: rating, "game-sense": rating, "hero-pool": rating, teamwork: rating },
    eligibleRoles: MLBB_DISCIPLINE.roles.map((r) => r.id),
    preferredRole: null,
  }],
}));

const idOf = (name: string) => roster.find((p) => p.name === name)!.id;
const team = (index: number, names: readonly string[]): TeamAssignment => ({
  index,
  slots: names.map((name) => ({ playerId: idOf(name), roleId: null })),
  totalStrength: 0,
  avgStrength: 0,
});

/**
 * Rangga with four 4s is 21, five 4s are 20, Kresna is the one left off: gap
 * 0.2, with 0.0 behind the sentence. `recomputeResult` stamps the averages the
 * screen reads and marks the search proven, which is the wording the unit
 * fixture pins.
 */
const world = (): SeedWorld => ({
  communities: [COMMUNITY],
  players: roster.map((p) => ({ ...p })),
  sessions: [{
    id: "sess-advice",
    communityId: COMMUNITY.id,
    disciplineId: MLBB_DISCIPLINE.id,
    createdAt: 500,
    poolPlayerIds: roster.map((p) => p.id),
    settings: { teamCount: 2 },
    result: recomputeResult(
      [
        team(0, ["Rangga", "Budi", "Citra", "Dewi", "Eka"]),
        team(1, ["Fajar", "Gita", "Hana", "Irfan", "Joko"]),
      ],
      MLBB_DISCIPLINE,
      [idOf("Kresna")],
      roster,
      { optimal: true, nodesExplored: 0, elapsedMs: 0 },
    ),
  }],
  tournaments: [],
  squads: [],
  activeCommunityId: COMMUNITY.id,
});

/** History → the one seeded session → the split screen, with the advisory on it. */
async function openAdvisory(page: Page): Promise<Locator> {
  await gotoHubSeeded(page, world(), "History");
  await expect(page.locator(".history-row")).toHaveCount(1);
  await page.locator(".history-row").first().click();
  await expect(page.locator(".split-screen")).toBeVisible({ timeout: 10000 });
  const advice = page.locator(".bench-advice");
  await expect(advice).toBeVisible();
  await expect(advice).toHaveText(
    "Gap 0.2 is the closest these 10 players come in 2 teams of 5, each covering every role. " +
    "Rangga sitting out instead of Kresna would bring the gap to 0.0.",
  );
  return advice;
}

test.describe("the bench advisory's own register", () => {
  test("it is set apart from the fairness line above it, in both schemes at both widths", async ({ page }, testInfo) => {
    const advice = await openAdvisory(page);
    const fairness = page.locator(".fairness");

    for (const width of [1280, 390] as const) {
      for (const scheme of ["light", "dark"] as const) {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
        await page.emulateMedia({ colorScheme: scheme });
        const panel = page.locator(".pitch");
        await expect(advice).toBeVisible();
        await expect(fairness).toBeVisible();

        // The distinction is *register*, and a register has more than one
        // dimension. The rule is the one that carries it: an inset left rule
        // is how a note is set in every typographic tradition this design is
        // borrowing from, and unlike a tint it cannot vanish when the theme's
        // palette shifts. The indent and the alignment are what keep the rule
        // attached to the text instead of floating in the panel's gutter, and
        // the alignment is what makes the block read as a margin note rather
        // than as a centred figure with a stray line down its side.
        const type = await advice.evaluate((el) => {
          const s = getComputedStyle(el);
          return {
            ruleWidth: s.borderLeftWidth,
            ruleStyle: s.borderLeftStyle,
            padLeft: parseFloat(s.paddingLeft),
            align: s.textAlign,
            size: parseFloat(s.fontSize),
          };
        });
        const neighbour = await fairness.evaluate((el) => {
          const s = getComputedStyle(el);
          return {
            ruleWidth: parseFloat(s.borderLeftWidth),
            padLeft: parseFloat(s.paddingLeft),
            align: s.textAlign,
            size: parseFloat(s.fontSize),
          };
        });
        const where = `at ${width} in ${scheme}`;

        expect(parseFloat(type.ruleWidth), `${where}: the advisory has no left rule`).toBeGreaterThan(0);
        expect(type.ruleStyle, `${where}: the left rule is not drawn`).not.toBe("none");
        // Padding, or the rule crowds the first letter. The advisory is set
        // indented and the line above it is not, which is the difference a
        // reader sees before they read a word.
        expect(type.padLeft, `${where}: no indent between the rule and the text`).toBeGreaterThanOrEqual(12);
        expect(neighbour.padLeft, `${where}: the fairness line is indented too, so the rule says nothing`).toBe(0);
        expect(neighbour.ruleWidth, `${where}: the fairness line has a left rule too`).toBe(0);
        expect(type.align, `${where}: the advisory is centred, so it reads as more of the figure`).not.toBe(neighbour.align);
        // And it is a step quieter than the line above it, never the same
        // size: 12px is the floor (see the report), 13px is what `.fairness`
        // uses, and "smaller than its neighbour" is the third leg of the
        // distinction. Asserted as a strict step so the floor is the only
        // thing that has to change if the sheet is ever retyped.
        expect(type.size, `${where}: the advisory is the same size as the line above it`).toBeLessThan(neighbour.size);
        expect(type.size, `${where}: the advisory is below the 12px legibility floor`).toBeGreaterThanOrEqual(12);

        // Legibility on the ink panel, in this scheme and the other one, on the
        // same harness and the same 4.5:1 bar the landing-hero `.fairness` case
        // uses. The panel is dark in *both* schemes (`--panel` is ink under
        // light), which is the reason the treatment cannot be a tint.
        await expectBlendedContrast({
          line: advice,
          panel,
          scheme,
          expectOpacity: 0.8,
          min: 4.5,
        });
        // The line it has to read as different from, measured on the same call.
        await expectBlendedContrast({
          line: fairness,
          panel,
          scheme,
          expectOpacity: 0.8,
          min: 4.5,
        });

        // The rule itself has to be visible, and it is the one part of the
        // treatment a theme can undo: it is mixed from the advisory's own ink,
        // so it follows `.landing-hero`'s correction to `--text` with no second
        // rule to keep in step, and it is a *tint* so it cannot compete with the
        // text it marks. Both halves are measured: the alpha proves the tint,
        // and the ratio proves the tint still separates from the panel. 3:1 is
        // WCAG 1.4.11's bar for a meaningful non-text shape, which is what a
        // rule that carries the whole distinction has to clear. It is measured
        // by the same `blendedRatio` the text uses, so a `color(srgb ...)`
        // serialisation cannot quietly read as near-black.
        const rule = await advice.evaluate((el) => getComputedStyle(el).borderLeftColor);
        const ink = await advice.evaluate((el) => getComputedStyle(el).color);
        const panelBg = await panel.evaluate((el) => getComputedStyle(el).backgroundColor);
        expect(rule, `at ${width} in ${scheme}: the rule is the advisory's ink at full strength, not a tint of it`).not.toBe(ink);
        expect(alphaOf(rule), `at ${width} in ${scheme}: the rule ${rule} is opaque`).toBeLessThan(1);
        expect(
          blendedRatio({ color: rule, opacity: alphaOf(rule) }, panelBg).ratio,
          `at ${width} in ${scheme}: the rule (${rule}) is not visible on the panel (${panelBg})`,
        ).toBeGreaterThan(3);

        // The advisory must not widen the page. Measured as a difference rather
        // than as zero, because the split screen's own sticky action bar
        // already overflows a 390px viewport by 56px — its primary button hangs
        // off the right edge — and that is a shell defect this file does not own
        // and must not go red over. What is pinned here is that the ruled block
        // contributes nothing to that number.
        const overflowWith = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        const overflowWithout = await page.evaluate(() => {
          for (const el of document.querySelectorAll(".bench-advice")) (el as HTMLElement).style.display = "none";
          const o = document.documentElement.scrollWidth - window.innerWidth;
          for (const el of document.querySelectorAll(".bench-advice")) (el as HTMLElement).style.display = "";
          return o;
        });
        expect(overflowWith, `at ${width} in ${scheme}: the advisory widens the page`).toBe(overflowWithout);

        await testInfo.attach(`bench-advice ${width}-${scheme}`, {
          body: await panel.screenshot(),
          contentType: "image/png",
        });
      }
    }
    await page.emulateMedia({ colorScheme: null });
  });

  test("the landing hero's own correction carries the rule with it", async ({ page }) => {
    // The hero mounts the real split screen on `--surface-2`, which is *paper*
    // in light — so a rule mixed from `--panel-text` would be near-white on
    // near-white, and 45% of it would measure 1.0:1. The rule survives that
    // because it is mixed from the advisory's own `color`, and
    // `.landing-hero .bench-advice` already corrects that to `--text`.
    //
    // The hero's roster is ten players in two teams of five, so nothing is left
    // off and `benchAdvice` renders nothing there today: the advisory does not
    // appear on the landing page and this file does not pretend it does. What
    // is pinned instead is the behaviour the hero's correction has to keep —
    // that a `.bench-advice` inside the hero resolves to ink on paper and a
    // rule that can be seen against it — by asking the browser what that class
    // computes to *inside the hero*, in both schemes. If the hero's roster ever
    // gains a bench, this is the assertion that already holds.
    await page.goto("/");
    const hero = page.locator("#landing-hero");
    await expect(hero.locator(".split-screen")).toBeVisible();
    await expect(hero.locator(".bench-advice")).toHaveCount(0);

    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      const resolved = await hero.evaluate((root) => {
        const probe = document.createElement("p");
        probe.className = "bench-advice";
        probe.textContent = "probe";
        root.querySelector(".pitch")!.appendChild(probe);
        const s = getComputedStyle(probe);
        const panel = getComputedStyle(root.querySelector(".pitch")!).backgroundColor;
        const readout = getComputedStyle(root.querySelector(".readout")!).color;
        const out = { color: s.color, opacity: Number(s.opacity), rule: s.borderLeftColor, panel, readout };
        probe.remove();
        return out;
      });
      // In ink on the hero's paper, in both schemes — the same correction
      // `.landing-hero .fairness` already makes, reached through the same rule.
      expect(resolved.color, `hero in ${scheme}: the advisory would be ${resolved.color} on ${resolved.panel}`).toBe(resolved.readout);
      expect(resolved.opacity, `hero in ${scheme}: the advisory's opacity`).toBeCloseTo(0.8, 2);
      expect(
        blendedRatio({ color: resolved.color, opacity: resolved.opacity }, resolved.panel).ratio,
        `hero in ${scheme}: ${resolved.color} at ${resolved.opacity} on ${resolved.panel}`,
      ).toBeGreaterThan(4.5);
      // And the rule travels with it, rather than being pinned to a token the
      // hero overrides.
      expect(alphaOf(resolved.rule), `hero in ${scheme}: the rule ${resolved.rule} is opaque`).toBeLessThan(1);
      expect(
        blendedRatio({ color: resolved.rule, opacity: alphaOf(resolved.rule) }, resolved.panel).ratio,
        `hero in ${scheme}: the rule (${resolved.rule}) is invisible on the paper (${resolved.panel})`,
      ).toBeGreaterThan(3);
    }
    await page.emulateMedia({ colorScheme: null });
  });
});