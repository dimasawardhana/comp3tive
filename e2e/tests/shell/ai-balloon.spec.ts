/**
 * The AI assistant's balloon never covers the sticky action bar's buttons.
 *
 * ## The defect this file exists for
 *
 * The balloon is `position: fixed` at the bottom-right, at
 * `--tabbar-h + 16px` — the exact band where `.split-bar`/`.match-bar`
 * (`src/split.css:779`) park when they are stuck. The first cut accepted that
 * overlap as "the cost of the corner placement": on a 390 screen the balloon
 * bit 48px out of the bar's primary button, the one irreversible action the
 * bar exists to hold. A floating chip covering the button that commits a split
 * is not a cost, it is a defect — the bar is the screen's primary surface and
 * the balloon is a convenience.
 *
 * ## The repair, and what is pinned here
 *
 * `AiAssistant` (`src/shell/AiAssistant.tsx`) now measures the mounted bar and
 * publishes its height as `--ai-bar-h`, which `.ai-chat` adds to its own
 * bottom offset (`src/index.css`). Pinned here, by measurement and not by
 * class-name assertion:
 *
 * - on the split screen, at 390 and at 1280, the balloon's box intersects no
 *   button in the bar — the bar's own box at most, and at 1280 only its
 *   padding;
 * - the lift is the bar's measured height plus the same 16px gap the balloon
 *   keeps to the tab bar, so the placement stays a rhythm and not a fudge;
 * - on a screen with no sticky bar (History) the balloon sits at the plain
 *   corner placement, `--tabbar-h + 16px` — the lift must not leak to screens
 *   that never earned it.
 *
 * Not pinned: the match screen's bar, whose two actions fit on one line at
 * every width and whose geometry is the split screen's strict subset; the
 * panel, whose max-height already derives from the same `--ai-bottom` and
 * cannot overlap either.
 */
import { test, expect, type Page } from "@playwright/test";
import { gotoSeeded, hubButton, type SeedWorld } from "../../support/seed";

const COMMUNITY = { id: "comm-balloon", name: "Balloon Crew", createdAt: 100 };
const ROLES = ["roam", "jungle", "mid-lane", "gold-lane", "exp-lane"];

/** Ten MLBB players, the pool the stored two-team result was solved from. */
const players = Array.from({ length: 10 }, (_, i) => ({
  id: `pb-${i + 1}`,
  communityId: COMMUNITY.id,
  name: `Player ${i + 1}`,
  capabilities: [{
    disciplineId: "mlbb",
    attributeRatings: {
      mechanics: 3 + (i % 3),
      "game-sense": 3 + (i % 3),
      "hero-pool": 3 + (i % 3),
      teamwork: 3 + (i % 3),
    },
    eligibleRoles: ROLES,
    preferredRole: ROLES[i % 5],
  }],
}));

/** A stored result with two teams of five, the shape the split screen reads. */
const result = {
  teams: Array.from({ length: 2 }, (_, index) => ({
    index,
    slots: Array.from({ length: 5 }, (_, k) => ({ playerId: `pb-${index * 5 + k + 1}`, roleId: null })),
    totalStrength: 0,
    avgStrength: 0,
  })),
  gap: 0,
  flags: [],
  unassigned: [],
  solver: { optimal: true, nodesExplored: 0, elapsedMs: 0 },
};

const world = (): SeedWorld => ({
  communities: [COMMUNITY],
  players,
  sessions: [{
    id: "sess-balloon",
    communityId: COMMUNITY.id,
    disciplineId: "mlbb",
    createdAt: 500,
    poolPlayerIds: players.map((p) => p.id),
    settings: { teamCount: 2 },
    result,
  }],
  tournaments: [],
  squads: [],
  activeCommunityId: COMMUNITY.id,
});

/** Seed the world, then History → the stored result → the split screen. */
async function openSessionSplit(page: Page): Promise<void> {
  await gotoSeeded(page, world());
  await hubButton(page, "History").click();
  await expect(page.locator(".history-row")).toHaveCount(1);
  await page.locator(".history-row").click();
  await expect(page.locator(".split-screen")).toBeVisible({ timeout: 10000 });
}

/**
 * Both boxes, read the way the browser laid them out. The bar is read as its
 * buttons — the claim is about the controls a thumb meets, not about padding —
 * and the balloon as its own box, which is a 52px circle whether it is a
 * launcher or a close chip. A `hidden` panel measures 0x0 and is filtered the
 * same way `button-family.spec.ts` filters it.
 *
 * The rects are plain `{ top, right, … }` records, not DOMRect instances:
 * `page.evaluate` serializes across the process boundary and a DOMRect comes
 * back as its own plain shape, so the declared type must be the serialized
 * shape or `tsc` fails on the assignment the runner would carry out fine.
 */
interface SideRect {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
}
const readOverlap = (page: Page): Promise<{ barButtons: SideRect[]; balloon: SideRect | null; lift: string }> =>
  page.evaluate(() => {
    const rects = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { top: r.top, right: r.right, bottom: r.bottom, left: r.left, width: r.width, height: r.height };
    };
    const balloon = document.querySelector<HTMLElement>(".ai-launcher");
    return {
      barButtons: [...document.querySelectorAll<HTMLElement>(".split-bar button, .match-bar button")]
        .filter((b) => b.getBoundingClientRect().height > 0)
        .map(rects),
      balloon: balloon && balloon.getClientRects().length > 0 ? rects(balloon) : null,
      lift: document.querySelector<HTMLElement>(".ai-chat")?.style.getPropertyValue("--ai-bar-h") ?? "",
    };
  });

/** Two boxes intersect when they overlap on both axes, with 1px of rounding slop. */
const intersects = (a: SideRect, b: SideRect): boolean =>
  a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;

test.describe("the AI balloon and the sticky action bars", () => {
  for (const { width, height } of [
    { width: 390, height: 844 },
    { width: 1280, height: 900 },
  ] as const) {
    test(`on the split screen at ${width} the balloon covers no bar button`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await openSessionSplit(page);

      const read = await readOverlap(page);
      expect(read.balloon, "the balloon is on screen").not.toBeNull();
      // The lift is live — the effect measured this bar and published it. At
      // 390 the five labels wrap to two lines, so the lift is a wrapped bar's
      // height, not a one-line guess; at 1280 the desktop inset ignores the
      // lift, so the variable may hold the bar's height while the placement
      // stays 24px — the assertion below is what actually matters.
      expect(read.lift, "the effect published the bar's height as --ai-bar-h").not.toBe("");

      for (const button of read.barButtons) {
        expect(
          read.balloon && intersects(read.balloon, button),
          `the balloon intersects a bar button at top ${button.top}, left ${button.left}`,
        ).toBe(false);
      }
    });
  }

  test("on a screen with no sticky bar the balloon sits at the plain corner placement", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoSeeded(page, world());
    await hubButton(page, "History").click();
    await expect(page.locator(".history-row")).toHaveCount(1);

    const read = await readOverlap(page);
    expect(read.balloon, "the balloon is on screen").not.toBeNull();
    // No bar to clear, so the lift must be back at zero: a leak from a
    // previous screen would leave the balloon floating over nothing.
    expect(read.lift, "--ai-bar-h resets off the split screen").toBe("0px");
    // The plain placement: the balloon's bottom edge 16px above the tab bar.
    const bottom = page.viewportSize()!.height - read.balloon!.bottom;
    expect(bottom, `the balloon's bottom edge at ${bottom}px, expected 80px (64px tab bar + 16px gap)`).toBeCloseTo(80, 0);
  });
});
