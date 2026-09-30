/**
 * The split screen's sticky action bar, measured at the two widths a reader
 * actually meets.
 *
 * ## The defect this file exists for
 *
 * `.split-bar` is `display: flex; gap: 10px` and every child of it is
 * `.btn { flex: 1; white-space: nowrap }` (`src/split.css:113-133`). A flex
 * item's `min-width` defaults to `auto`, which floors it at its content's
 * intrinsic width, so each of the four actions was floored at the width of its
 * whole label. `flex: 1` cannot shrink an item below that floor, and the row
 * overran the content box: at 390 the document scrolled to **446** against a
 * **390** viewport, and the primary button's right edge sat at **445.97** — the
 * whole of "Re-roll" was off the right edge of the screen.
 *
 * `min-width: 0` is not the repair. It lets the boxes shrink and leaves the
 * nowrap text spilling out of them, which is the same overflow one level down.
 * The repair is `flex-wrap: wrap` scoped to `.split-bar`, and the reason that
 * works where `min-width` does not is that a wrapped line is never over-full:
 * the items move to the next line *instead of* being compressed, so no label is
 * ever asked for less room than it needs.
 *
 * ## Why this had to be measured rather than asserted
 *
 * Nothing in the suite had an opinion about the bar's *geometry*. Unit renders
 * of `SplitScreen` check which buttons exist; the modal suite checks that modal
 * action rows still work. Neither can see a box that is 56px outside the
 * viewport, and a DOM assertion on the bar's children would have gone green
 * over this defect for as long as it existed. The measurement is
 * `document.documentElement.scrollWidth` against `clientWidth`, which is the
 * number a user feels as sideways scroll.
 *
 * ## What is pinned here, and what is deliberately not
 *
 * Pinned: the split screen, on both documents that mount it (the app and the
 * Landing Page hero), in every bar state below. That is a claim about *this
 * screen*, and it is the claim the defect broke.
 *
 * Not pinned: a sweep asserting that no screen in the app ever overflows. Such a
 * sweep was measured while writing this file and came back clean on the six
 * hubs at both widths — but a whole-app claim is a different and much larger
 * assertion than "the split bar fits", it is not what broke, and adopting it
 * here would put this file in charge of every future screen's layout. The
 * per-screen result is recorded in the ticket report instead of being smuggled
 * in as a passing test.
 *
 * Not pinned either: the *advisory*. `bench-advice-visual.spec.ts:223-236`
 * measures the bench advisory as a difference — "it widens the page no further
 * than the rest of the screen already does" — precisely because the bar was
 * overflowing and that file did not own it. That is a correct scoping decision
 * and it stays, but it is why the real defect stayed green: the one number that
 * would have caught it was written to tolerate it. This file writes the number
 * that does not tolerate it, and it writes it against zero.
 *
 * ## The states, and why there are six
 *
 * The bar holds **one to four** actions. `onBack && !swapMode`, `onSaveSquad &&
 * !swapMode`, and a Share button gated on `share && result.teams.length > 1`
 * each decide independently (`src/session/SplitScreen.tsx:458-515`), and the
 * primary is one of three labels. A fix written against four actions holds only
 * on the day it was written, so every state is measured:
 *
 * | state | reached by | actions |
 * | --- | --- | --- |
 * | four, reopened from History | History → a seeded session | `← History`, `Save squad`, `Share`, `Re-roll` |
 * | four, from a tournament draft | Games → new tournament → Split your teams | `← Match setup`, `Save squad`, `Share`, `Save teams to tournament →` |
 * | three, share withheld | History → a one-team result, the "Solver failed" screen | `← History`, `Save squad`, `Re-roll` |
 * | one, the Landing Page hero | the root document | `Re-roll` |
 * | two, `onBack` absent | probed, see below | `Save squad`, `Re-roll` |
 * | one, swap mode | probed, see below | `Done swapping` |
 *
 * The tournament row is the widest bar the app can render — its primary label
 * is 24 characters where "Re-roll" is 7 — so it is the one that would break
 * first if the treatment were tuned to the other four.
 *
 * ### The two probed states, and what a probe is not
 *
 * Neither is reachable through the shipped app, and this file says which is
 * which rather than quietly dropping them:
 *
 * - **swap mode has no entry point.** `setSwapMode` is called from
 *   `toggleSwapMode` (`src/session/SplitScreen.tsx:348-351`) and from nowhere
 *   else, and `toggleSwapMode` is bound to the "Done swapping" button, which is
 *   rendered only when swap mode is already on (`src/session/SplitScreen.tsx:497-500`).
 *   The state cannot be entered. That is a finding, not a fixture problem, and
 *   it is not this file's to fix — but the bar it *would* render still has to fit.
 * - **two actions is unreachable** because the three conditions do not vary
 *   independently: the app's screen always passes `onBack`, `onSaveSquad` and
 *   `share` (`src/shell/ScreenSwitch.tsx:321-327`) and the Landing Page passes
 *   none of them (`src/landing.tsx:151-161`). One is the floor, four the ceiling.
 *
 * So those two rows are measured with a **layout probe**: the bar's children are
 * replaced with clones of the buttons the app rendered on that same screen, in
 * the order `SplitScreen` renders them. It is not a mock and not a hand-built
 * fixture — the nodes under measurement are the app's own nodes, so the class,
 * the font, the padding, the border, the line height and the measured string are
 * the app's. Only the choice of *which* buttons are in the row is composed, and
 * that composition is the variable under test. Every property asserted below —
 * the bar's box, the flex line breaking, the target sizes, the labels — is the
 * real stylesheet on real nodes in the real document, which is the only way to
 * measure a state the app will not enter.
 *
 * ## The floor the treatment must not buy its way past
 *
 * `DESIGN.md`'s accessibility section is explicit: "Mobile-first and
 * thumb-friendly (bottom bar actions, 44px+ targets)". A treatment that shrank a
 * button to make a row fit would trade the most important thing the bar is for
 * against the least important thing wrong with it, so **every** action in
 * **every** state is measured at 44px or taller, and no label is allowed to
 * truncate — an action cut to `…` is the treatment failing, not the layout
 * succeeding. A single row is not required: a bar that grows a line at 390 and
 * stays one row at 1280 is the honest shape, and a bar that stayed one row at
 * 390 could only get there by breaking one of the two rules above.
 */
import { test, expect, type Page } from "@playwright/test";
import { gotoSeeded, hubButton, type SeedWorld } from "../../support/seed";

const COMMUNITY = { id: "comm-bar", name: "Bar Crew", createdAt: 100 };
const ROLES = ["tank", "assassin", "mage", "marksman", "fighter"];

/** Ten MLBB players, three distinct ratings so no two players tie by accident. */
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

/** A stored result with `teamCount` teams of five, the shape the screen reads. */
const result = (teamCount: number) => ({
  teams: Array.from({ length: teamCount }, (_, index) => ({
    index,
    slots: Array.from({ length: 5 }, (_, k) => ({ playerId: `pb-${index * 5 + k + 1}`, roleId: null })),
    totalStrength: 0,
    avgStrength: 0,
  })),
  gap: 0,
  flags: [],
  unassigned: [],
  solver: { optimal: true, nodesExplored: 0, elapsedMs: 0 },
});

const session = (id: string, teamCount: number, createdAt: number) => ({
  id,
  communityId: COMMUNITY.id,
  disciplineId: "mlbb",
  createdAt,
  poolPlayerIds: players.map((p) => p.id),
  settings: { teamCount },
  result: result(teamCount),
});

/**
 * Two sessions and one draft tournament. Each earns its place by being the only
 * way into a bar state:
 *
 - a two-team session, the four-action bar a reader meets most;
 - a **one-team** session, which is not a fixture mistake. The screen renders its
   "Solver failed" empty state for a one-team result, and that is the one place
   the app withholds Share (`src/session/SplitScreen.tsx:487`), so it is the only
   route to a three-action bar in the shipped app.
 * - an **empty draft tournament**, which is the only route to the widest label
   the app renders. It is seeded rather than created through the Games screen on
   purpose: a tournament built by clicking is written to IndexedDB and survives
   the second `gotoSeeded` of the next width, which leaves the Games screen off
   its empty state and the flow with nothing to click.
 */
const world = (): SeedWorld => ({
  communities: [COMMUNITY],
  players,
  sessions: [session("sess-bar-2", 2, 500), session("sess-bar-1", 1, 400)],
  tournaments: [{
    id: "tour-bar",
    communityId: COMMUNITY.id,
    disciplineId: "mlbb",
    name: "Bar Cup",
    format: "series",
    seriesLength: 3,
    teamCount: 2,
    thirdPlace: false,
    createdAt: 600,
    status: "draft",
    teams: [],
    matches: [],
  }],
  squads: [],
  activeCommunityId: COMMUNITY.id,
});

/** The two widths a reader actually meets, and the height each is read at. */
const WIDTHS = [
  { width: 390, height: 844 },
  { width: 1280, height: 900 },
] as const;

interface ActionReading {
  name: string;
  width: number;
  height: number;
  right: number;
  top: number;
  /** the button's own content fits inside its own box */
  clipped: boolean;
  /** DESIGN.md forbids truncating an action; pinned as `none` on every one */
  textOverflow: string;
  whiteSpace: string;
}

interface BarReading {
  /** the user-visible claim: the document sideways-scrolls or it does not */
  document: { scrollWidth: number; clientWidth: number };
  bar: {
    position: string;
    bottom: string;
    flexWrap: string;
    scrollWidth: number;
    clientWidth: number;
    /** the content box, padding excluded — the right edge a button may not cross */
    contentRight: number;
    /** the bar's own box, so "sticky above the tab bar" can be read, not assumed */
    boxTop: number;
    boxBottom: number;
    height: number;
  };
  actions: ActionReading[];
  /**
   * The tab bar's top edge, and whether there is one to read. From 1024px the
   * bottom nav is `display: none` and a rail takes its place
   * (`src/index.css:1712`), so at 1280 there is no bar for the action bar to sit
   * above and `tabBarTop` is `null`. The test branches on the measured flag
   * rather than on the width, so it cannot read a box that is not on the page.
   */
  tabBarTop: number | null;
  viewportHeight: number;
}

const readBar = (page: Page): Promise<BarReading> => page.evaluate(() => {
  const bar = document.querySelector<HTMLElement>(".split-bar");
  if (!bar) throw new Error("no .split-bar on screen");
  const nav = document.querySelector<HTMLElement>(".bottom-nav");
  const barStyle = getComputedStyle(bar);
  const content = bar.getBoundingClientRect();
  return {
    document: {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    },
    bar: {
      position: barStyle.position,
      bottom: barStyle.bottom,
      flexWrap: barStyle.flexWrap,
      scrollWidth: bar.scrollWidth,
      clientWidth: bar.clientWidth,
      contentRight: content.right - parseFloat(barStyle.paddingRight),
      boxTop: Math.round(content.top * 100) / 100,
      boxBottom: Math.round(content.bottom * 100) / 100,
      height: Math.round(content.height * 100) / 100,
    },
    actions: [...bar.querySelectorAll<HTMLButtonElement>("button")].map((b) => {
      const rect = b.getBoundingClientRect();
      const style = getComputedStyle(b);
      return {
        // `textContent` carries the rendered text of the label; `.btn-primary`
        // uppercases via CSS, which `textContent` does not apply, so the string
        // here is the string the component wrote.
        name: (b.textContent ?? "").replace(/\s+/g, " ").trim(),
        width: Math.round(rect.width * 100) / 100,
        height: rect.height,
        right: Math.round(rect.right * 100) / 100,
        top: Math.round(rect.top * 100) / 100,
        clipped: b.scrollWidth > b.clientWidth + 1,
        textOverflow: style.textOverflow,
        whiteSpace: style.whiteSpace,
      };
    }),
    // `getClientRects().length` is 0 for a `display: none` element, which is the
    // test for "is this layout's tab bar on the page" without hard-coding the
    // breakpoint number here.
    tabBarTop: nav && nav.getClientRects().length > 0 ? nav.getBoundingClientRect().top : null,
    viewportHeight: window.innerHeight,
  };
});

/**
 * Replace the bar's children with clones of the buttons the app just rendered,
 * matched **by label** and not by position, secondaries first and one primary
 * last — the order `SplitScreen` renders them. Matching by label rather than
 * taking the first N is what lets "two actions, `onBack` absent" ask for
 * `Save squad` and not inherit `← History` from the row it was composed from.
 * See the header for what a probe is and is not.
 */
async function probeBar(page: Page, labels: readonly string[]): Promise<void> {
  await page.evaluate((wanted) => {
    const bar = document.querySelector(".split-bar");
    if (!bar) throw new Error("no .split-bar to probe");
    const row = wanted.slice(0, -1).map((label) => {
      const found = [...bar.querySelectorAll<HTMLButtonElement>(".btn-ghost")].find(
        (b) => (b.textContent ?? "").replace(/\s+/g, " ").trim() === label,
      );
      if (!found) throw new Error(`the rendered bar has no "${label}" to clone`);
      return found.cloneNode(true) as HTMLButtonElement;
    });
    const primary = bar.querySelector<HTMLButtonElement>(".btn-primary");
    if (!primary) throw new Error("the rendered bar has no primary to clone");
    // The primary keeps the app's own node and the app's own class; only the
    // string is the one the component would have written in that state
    // (`src/session/SplitScreen.tsx:499`).
    const last = primary.cloneNode(true) as HTMLButtonElement;
    last.textContent = wanted[wanted.length - 1];
    row.push(last);
    bar.replaceChildren(...row);
  }, labels);
}

/**
 * Seed the world, then History → the row at `nth` → the split screen for that
 * stored result. Seeding happens per call and not once per test because the
 * states are looped over two widths, and a second `goto` in the same test would
 * otherwise be a navigation into whatever the last state left behind.
 */
async function openSession(page: Page, nth: number): Promise<void> {
  await gotoSeeded(page, world());
  await hubButton(page, "History").click();
  await expect(page.locator(".history-row")).toHaveCount(2);
  await page.locator(".history-row").nth(nth).click();
  await expect(page.locator(".split-screen")).toBeVisible({ timeout: 10000 });
}

/** Games → the seeded draft → Split your teams → the locked match setup → Split. */
async function openTournamentSplit(page: Page): Promise<void> {
  await gotoSeeded(page, world());
  await hubButton(page, "Games").click();
  await expect(page.locator(".screen h1")).toBeVisible();
  await page.getByText("Bar Cup", { exact: true }).first().click();
  await expect(page.locator(".screen h1")).toHaveText("Bar Cup");
  await page.getByTestId("split-teams-cta").click();
  await expect(page.locator(".match-setup")).toBeVisible({ timeout: 10000 });
  await page.getByTestId("split-button").click();
  await expect(page.locator(".split-screen")).toBeVisible({ timeout: 15000 });
}

/** The Landing Page hero mounts the same screen with none of the three props. */
async function openLandingHero(page: Page): Promise<void> {
  await page.goto("/", { waitUntil: "load" });
  await expect(page.locator("#landing-hero .split-screen")).toBeVisible({ timeout: 15000 });
}

type State = {
  /** the row's name, used in every assertion message so a failure says which */
  name: string;
  open: (page: Page) => Promise<void>;
  /** the exact labels, in render order: nothing added, nothing renamed, nothing hidden */
  labels: readonly string[];
  /** probed states compose the row instead of reaching it; see the header */
  probed?: boolean;
};

const STATES: readonly State[] = [
  {
    name: "four actions, a session reopened from History",
    open: (page) => openSession(page, 0),
    labels: ["← History", "Save squad", "Share", "Re-roll"],
  },
  {
    name: "four actions, from a tournament draft",
    open: openTournamentSplit,
    labels: ["← Match setup", "Save squad", "Share", "Save teams to tournament →"],
  },
  {
    name: "three actions, Share withheld on a solver failure",
    open: (page) => openSession(page, 1),
    labels: ["← History", "Save squad", "Re-roll"],
  },
  {
    name: "one action, the Landing Page hero",
    open: openLandingHero,
    labels: ["Re-roll"],
  },
  {
    name: "two actions, onBack absent",
    open: (page) => openSession(page, 0),
    labels: ["Save squad", "Re-roll"],
    probed: true,
  },
  {
    name: "one action, swap mode",
    open: (page) => openSession(page, 0),
    labels: ["Done swapping"],
    probed: true,
  },
];

test.describe("the split screen's action bar", () => {
  for (const state of STATES) {
    test(`it does not widen the page, in ${state.name}`, async ({ page }) => {
      for (const { width, height } of WIDTHS) {
        await page.setViewportSize({ width, height });
        await state.open(page);
        const bar = page.locator(".split-bar");
        await expect(bar, `${state.name} at ${width}: the bar is on screen`).toBeVisible();

        if (state.probed) {
          await probeBar(page, state.labels);
          await expect(bar.locator("button"), `${state.name}: the probed row`).toHaveCount(state.labels.length);
        }

        // The row is the one this state is for. A treatment that dropped,
        // renamed or hid an action to make the geometry work would fail here
        // rather than pass quietly.
        expect((await readBar(page)).actions.map((a) => a.name), state.name).toEqual([...state.labels]);

        const read = await readBar(page);
        const where = `${state.name} at ${width}`;

        // The claim a user feels. `scrollWidth` is measured on the document
        // element and `clientWidth` on the same element, so the two are the same
        // box by construction and no window/rounding fudge is needed.
        expect(
          read.document.scrollWidth,
          `${where}: the document sideways-scrolls by ${read.document.scrollWidth - read.document.clientWidth}px`,
        ).toBeLessThanOrEqual(read.document.clientWidth);

        // The same claim one level tighter, so a future regression cannot be
        // argued away as "something else on the page is wide". A bar that is
        // itself wider than its own content box is the bar's defect regardless
        // of what any ancestor measures.
        expect(read.bar.scrollWidth, `${where}: the bar is wider than its own content box`).toBeLessThanOrEqual(
          read.bar.clientWidth,
        );

        for (const action of read.actions) {
          // Nothing crosses the bar's own right edge.
          expect(action.right, `${where}: "${action.name}" ends at ${action.right}, past the bar's ${read.bar.contentRight}`).toBeLessThanOrEqual(
            read.bar.contentRight + 1,
          );
          // DESIGN.md: 44px+ targets. A shorter button is a worse trade than a
          // taller bar, so this is a floor and not a target to be met "as far as
          // it goes".
          expect(action.height, `${where}: "${action.name}" is ${action.height}px tall`).toBeGreaterThanOrEqual(44);
          expect(action.width, `${where}: "${action.name}" is ${action.width}px wide`).toBeGreaterThanOrEqual(44);
          // No label is cut. `clipped` catches content escaping its own box;
          // the `text-overflow` reading closes the other door, where a label is
          // truncated to a fitting width instead.
          expect(action.clipped, `${where}: "${action.name}" has content wider than its box`).toBe(false);
          expect(action.textOverflow, `${where}: "${action.name}" truncates its label`).toBe("clip");
        }
      }
    });
  }

  test("the bar is still sticky above the tab bar, and is two lines at 390 and one at 1280", async ({ page }) => {
    for (const { width, height } of WIDTHS) {
      await page.setViewportSize({ width, height });
      await openSession(page, 0);
      const read = await readBar(page);
      const where = `the four-action bar at ${width}`;

      expect(read.bar.position, `${where}: the bar is no longer sticky`).toBe("sticky");
      // `--tabbar-h` is `calc(64px + env(safe-area-inset-bottom))`
      // (`src/tokens.css:63`), and a headless Chromium reports no safe-area inset,
      // so the token resolves to 64px. This pins the resolved offset, which is
      // the offset the bar is actually seated at. That the declaration still
      // *spells* the token rather than the number is not something a reading can
      // tell — `bottom: 64px` computes to the same value — so that half of the
      // claim is carried by the diff on `src/split.css`, which touches no
      // declaration on the shared `.match-bar, .split-bar` rule.
      expect(read.bar.bottom, `${where}: the bar is not offset by the tab-bar token`).toBe("64px");
      expect(read.bar.flexWrap, `${where}: the bar does not wrap`).toBe("wrap");

      // The line count is the shape of the treatment, so it is pinned rather
      // than described. One line at 1280 is the desktop bar nobody changed; two
      // at 390 is the phone bar growing a line rather than shrinking its
      // actions. A repair that bought the second by flattening the first would
      // fail here.
      const lines = new Set(read.actions.map((a) => a.top)).size;
      expect(lines, `${where}: the bar is ${lines} line(s) tall`).toBe(width === 390 ? 2 : 1);

      // Geometric, where there is a tab bar to sit above. From 1024px the bottom
      // nav is `display: none` and a rail takes its place, so at 1280 the claim
      // reduces to "still sticky, still on screen" and saying otherwise would be
      // reading a box that is not painted.
      if (read.tabBarTop !== null) {
        expect(
          read.bar.boxBottom,
          `${where}: the bar's bottom edge is ${read.bar.boxBottom}, past the tab bar's ${read.tabBarTop}`,
        ).toBeLessThanOrEqual(read.tabBarTop + 1);
      }

      // Sticky means it holds its seat while the content above it moves, so the
      // measurement is taken again at the foot of the page — and the scroll is
      // confirmed to have happened first, because a page that does not scroll
      // would make this pass for the wrong reason. `position: sticky` on its own
      // is not the evidence: a bar that had quietly become `static` still
      // computes as `sticky` if the declaration survived and the containing
      // block had grown. The scroll is what separates the two.
      const before = await readBar(page);
      const scrolled = await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
        return window.scrollY;
      });
      expect(scrolled, `${where}: the page did not scroll, so stickiness was not exercised`).toBeGreaterThan(0);
      await page.waitForTimeout(120);
      const after = await readBar(page);

      // The bar is the last child of `.screen`, so sticky can only hold it until
      // the column's own bottom edge reaches the threshold — the 28px it then
      // sits above the nav is `.screen`'s bottom padding (`src/split.css:49`),
      // and it is the same before and after this change. What must hold is that
      // the bar never rides *up* behind the tab bar and never leaves the screen:
      // both are what a reader would notice.
      if (after.tabBarTop !== null) {
        expect(
          after.bar.boxBottom,
          `${where}: scrolled to the foot, the bar's bottom edge is ${after.bar.boxBottom}, behind the tab bar's ${after.tabBarTop}`,
        ).toBeLessThanOrEqual(after.tabBarTop + 1);
      }
      expect(
        after.bar.boxTop,
        `${where}: scrolled to the foot, the bar has scrolled off the top of the viewport`,
      ).toBeGreaterThanOrEqual(0);
      expect(
        after.bar.boxBottom,
        `${where}: scrolled to the foot, the bar runs past the bottom of the viewport`,
      ).toBeLessThanOrEqual(after.viewportHeight);
      // The bar is sticky, not nailed: it travels *less* than the page did. A
      // `static` bar would move by exactly the scroll distance, and at 1280 the
      // page scrolls 135px without ever reaching the threshold, so the bar does
      // not move at all — both are "less than the page moved", and both fail if
      // the bar stops being sticky. Asserting it moved by a fixed amount would
      // be asserting the scroll range, which is not this file's subject.
      expect(
        Math.abs(after.bar.boxTop - before.bar.boxTop),
        `${where}: the bar moved ${Math.abs(after.bar.boxTop - before.bar.boxTop)}px for a ${scrolled}px scroll, so it is not sticking`,
      ).toBeLessThan(scrolled);
    }
  });

  test("a modal's own action row is the layout it was", async ({ page }) => {
    // `.bar` and `.btn` are shared with every modal's action row
    // (`.modal-card .bar`, `src/split.css:120`), and the modal suite proves those
    // rows still *work* — it would not notice a modal that got worse. So the
    // scoping claim is measured rather than argued: the Save squad modal's row
    // is read for the properties the treatment could have cost it.
    await page.setViewportSize({ width: 390, height: 844 });
    await openSession(page, 0);
    await page.getByTestId("save-squad-button").click();
    const card = page.locator(".modal-card");
    await expect(card).toBeVisible();

    const row = await card.locator(".bar").evaluate((el) => {
      const buttons = [...el.querySelectorAll<HTMLButtonElement>("button")];
      const rects = buttons.map((b) => b.getBoundingClientRect());
      const style = getComputedStyle(el);
      return {
        flexWrap: style.flexWrap,
        // One row means every action shares a top edge. A bar that had picked
        // up `flex-wrap` from this change would put the second action a row
        // lower, and that is the whole regression.
        tops: rects.map((r) => Math.round(r.top)),
        heights: rects.map((r) => r.height),
        overflows: el.scrollWidth > el.clientWidth + 1,
        right: Math.round(el.getBoundingClientRect().right * 100) / 100,
      };
    });
    const where = "the Save squad modal's action row at 390";

    expect(row.flexWrap, `${where}: the modal row inherited the wrap`).toBe("nowrap");
    expect(new Set(row.tops).size, `${where}: the actions are not on one line`).toBe(1);
    expect(row.overflows, `${where}: the modal row is wider than its box`).toBe(false);
    // And the wrapping did not fix the modal by accident: the page-level number
    // is back to zero with the modal open, which is the same reading the modal
    // screens were never asserting.
    const read = await readBar(page);
    expect(read.document.scrollWidth, `${where}: the document sideways-scrolls`).toBeLessThanOrEqual(
      read.document.clientWidth,
    );
    for (const height of row.heights) {
      expect(height, `${where}: an action is ${height}px tall`).toBeGreaterThanOrEqual(44);
    }
  });

  test("every action in the bar is still reachable by its own name", async ({ page }) => {
    // The suite's other specs click these buttons by name. This is the assertion
    // that a treatment cannot pass by hiding or renaming one of them: the name
    // the component writes is the name the user finds, at both widths.
    await page.setViewportSize({ width: 390, height: 844 });
    await openSession(page, 0);
    for (const label of ["← History", "Save squad", "Share", "Re-roll"]) {
      await expect(page.getByRole("button", { name: label, exact: true }), label).toBeVisible();
    }
    // The tournament bar's primary is the widest label in the app, and the one
    // an overflow fix is most tempted to shorten. It is pinned by name at the
    // width where the bar wraps.
    await openTournamentSplit(page);
    await expect(page.getByRole("button", { name: "Save teams to tournament →", exact: true })).toBeVisible();
    const read = await readBar(page);
    expect(read.document.scrollWidth, "the tournament bar at 390: the document sideways-scrolls").toBeLessThanOrEqual(
      read.document.clientWidth,
    );
  });
});
