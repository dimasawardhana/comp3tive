/**
 * Manual swap, performed (ticket 39, `docs/ROADMAP.md` R1).
 *
 * ## Why this file exists
 *
 * The feature shipped, worked, and lost its entry point on 2026-09-07. `36d32b6`
 * rewrote `.split-bar` to add the `inTournament` prop and, in the same hunk,
 * dropped both `Swap` buttons while keeping `toggleSwapMode`, the `swapMode ?`
 * arm, the "Done swapping" exit and the banner. **The only control bound to the
 * mode was its own exit**, so `swapMode` stayed `false` for ten weeks.
 *
 * **The reason that survived every review is the reason this file is written the
 * way it is.** `swapPlayers` has had unit coverage since Phase A
 * (`src/session/edit.test.ts`), and the swap affordances on the card have been in
 * `SplitScreen.tsx` untouched the whole time — so the suite had a green test for
 * *the arithmetic* and no test at all for *the reaching*. Every test that touched
 * the mode asserted it was off, or asserted a button count, or said nothing. A
 * defect that lives entirely in the space between a correct function and a
 * reachable control cannot be caught by testing the function.
 *
 * So the first test here **clicks `Swap`**, and it does not assert on a DOM
 * fixture: it drives the real screen from History and asserts on what the screen
 * then says. Run against `497aa8b` — the commit immediately before this fix —
 * it fails on the first line, because the button it clicks is not on the bar.
 *
 * ## What is asserted, and why each part
 *
 * - **The trade, and the gap.** A swap that moved two names around without
 *   moving the number would still look like the feature working to a reader
 *   glancing at the teams. The seed is built so the gap is wide before and
 *   materially different after, so "the gap moved" is a fact about the numbers
 *   and not about a rendering.
 * - **The provenance stamp.** `swapPlayers` routes through `recomputeResult`,
 *   which defaults to `solver.optimal: false` (`src/session/edit.ts:72`), so a
 *   hand edit must stop claiming to be a proven minimum. This is the one part of
 *   the swap that a user pastes into a group chat, and `README.md:16` reasons
 *   about exactly this.
 * - **The same-team tap clears the pick.** Two taps on one team are the mistake
 *   every user makes first, and the screen has to recover rather than swap a
 *   player for themselves.
 * - **The keyboard affordances.** The `li` is given `role="button"` and
 *   `tabIndex={0}` and handles Enter and Space
 *   (`src/session/SplitScreen.tsx:76-88`). All three are decorative until
 *   someone drives one, and a decorative affordance is the kind of thing a
 *   rewrite drops silently.
 * - **The transitions.** Entering the mode hides Back, Save squad and Share and
 *   relabels the primary; leaving restores all three. A mode that could be
 *   entered but not left, or that left the bar's other actions live underneath
 *   it, would be a different bug of the same family.
 */
import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { gotoHubSeeded, MLBB_ID, type SeedWorld } from "../../support/seed";

const ROLES = ["tank", "assassin", "mage", "marksman", "fighter"];

/**
 * Two teams five apart, on purpose. Every Team A player is rated 5 on all four
 * attributes and every Team B player 1, so the gap before the swap is 4.0 and the
 * gap after is 2.0 — the swap moves the number by the largest amount this seed
 * can produce, which is what makes "the gap moved" an assertion about the
 * arithmetic rather than about a rounding difference.
 *
 * A seed of near-equal players would be the easier fixture and the worse test:
 * with everyone within a few tenths, a swap that recomputed nothing could still
 * move the displayed number by chance.
 */
const players = [
  ["pa-1", "Alfa", 5], ["pa-2", "Bravo", 5], ["pa-3", "Cahya", 5], ["pa-4", "Delta", 5], ["pa-5", "Echo", 5],
  ["pb-1", "Foxtrot", 1], ["pb-2", "Golf", 1], ["pb-3", "Hotel", 1], ["pb-4", "India", 1], ["pb-5", "Juli", 1],
].map(([id, name, rating]) => ({
  id: String(id),
  communityId: "comm-swap",
  name: String(name),
  capabilities: [{
    disciplineId: MLBB_ID,
    attributeRatings: {
      mechanics: Number(rating),
      "game-sense": Number(rating),
      "hero-pool": Number(rating),
      teamwork: Number(rating),
    },
    eligibleRoles: ROLES,
    preferredRole: null,
  }],
}));

const session = (id: string, teamCount: number, createdAt: number, result: SeedWorld["sessions"][number]["result"]) => ({
  id,
  communityId: "comm-swap",
  disciplineId: MLBB_ID,
  createdAt,
  poolPlayerIds: players.map((p) => p.id),
  settings: { teamCount },
  result,
});

const teamA = {
  index: 0,
  slots: ["pa-1", "pa-2", "pa-3", "pa-4", "pa-5"].map((playerId, i) => ({ playerId, roleId: ROLES[i] })),
  totalStrength: 25,
  avgStrength: 5,
};

const teamB = {
  index: 1,
  slots: ["pb-1", "pb-2", "pb-3", "pb-4", "pb-5"].map((playerId, i) => ({ playerId, roleId: ROLES[i] })),
  totalStrength: 5,
  avgStrength: 1,
};

const world = (): SeedWorld => ({
  communities: [{ id: "comm-swap", name: "Swap Crew", createdAt: 100 }],
  players,
  sessions: [session("sess-swap", 2, 500, {
    teams: [teamA, teamB],
    // `balanced` is `gap <= 0.1`, and this seed starts far from it, so the readout
    // is a number rather than the word "OK". A swap has to be able to move a
    // number before a test can claim that one moved.
    gap: 4,
    flags: [],
    unassigned: [],
    solver: { optimal: true, nodesExplored: 0, elapsedMs: 0 },
  })],
  tournaments: [],
  squads: [],
  activeCommunityId: "comm-swap",
});

/**
 * The same world with the second team removed, which is what puts the screen on
 * its "Solver failed" branch (`src/session/SplitScreen.tsx:434-440`: `=== 2`,
 * then `> 2`, else the empty state). Not a fixture mistake — the screen treats a
 * one-team result as a failure to build, and that is the only state where Share
 * and Swap are both withheld.
 */
const oneTeamWorld = (): SeedWorld => ({
  communities: [{ id: "comm-swap", name: "Swap Crew", createdAt: 100 }],
  players,
  sessions: [session("sess-swap-1", 1, 500, {
    teams: [teamA],
    gap: 0,
    flags: [],
    unassigned: [],
    solver: { optimal: true, nodesExplored: 0, elapsedMs: 0 },
  })],
  tournaments: [],
  squads: [],
  activeCommunityId: "comm-swap",
});

/** History → the stored session → the split screen, which is the only way in. */
async function openSplit(page: Page): Promise<void> {
  await gotoHubSeeded(page, world(), "History");
  await expect(page.locator(".history-row")).toHaveCount(1);
  await page.locator(".history-row").first().click();
  await expect(page.locator(".split-screen")).toBeVisible({ timeout: 10000 });
}

/** The `li` for one named player, read by the name the roster renders. */
const card = (page: Page, name: string): Locator =>
  page.locator(".split-screen .team li").filter({ hasText: name });

/** The two teams' membership in DOM order: `Team A` first, then `Team B`. */
async function teams(page: Page): Promise<string[][]> {
  return page.locator(".split-screen .team").evaluateAll((nodes) =>
    nodes.map((t) => [...t.querySelectorAll(".player-name")].map((n) => (n.textContent ?? "").trim())),
  );
}

/**
 * The gap as the reader sees it: `.tag-gap` in the pitch header, which prints
 * `OK` when balanced and one decimal otherwise. Read as text rather than from
 * the model so a test cannot pass on a number the user would never be shown.
 */
const gapText = (page: Page): Locator => page.locator(".split-screen .mid .tag-gap");

test("the bar's Swap button starts a swap, and two taps trade the players and move the gap", async ({ page }) => {
  await openSplit(page);

  // The precondition, asserted rather than assumed: a bar with no way into the
  // mode looks exactly like a bar whose mode works until you try to enter it.
  const before = await teams(page);
  expect(before[0]).toEqual(["Alfa", "Bravo", "Cahya", "Delta", "Echo"]);
  expect(before[1]).toEqual(["Foxtrot", "Golf", "Hotel", "India", "Juli"]);
  expect((await gapText(page).innerText()).trim()).toBe("4.0");

  await page.getByTestId("swap-mode").click();

  // Entering the mode is observable in three independent ways, and all three
  // are checked because a mode that only showed a banner would be a mode whose
  // cards are not targets.
  await expect(page.locator(".swap-banner")).toContainText("Tap one player on each team to swap them.");
  await expect(card(page, "Alfa")).toHaveAttribute("role", "button");
  await expect(page.getByRole("button", { name: "Done swapping", exact: true })).toBeVisible();

  // First pick.
  await card(page, "Alfa").click();
  await expect(page.locator(".swap-banner")).toContainText("Now tap a player on the other team to swap with Alfa");
  await expect(card(page, "Alfa")).toHaveClass(/picked/);

  // Second pick, on the other team: this is the tap that used to be impossible.
  await card(page, "Hotel").click();

  // The trade. Alfa left Team A and Hotel joined it; Hotel left Team B and Alfa
  // took its place. Asserted positionally as well as by membership, so a swap
  // that duplicated a player and dropped another cannot satisfy it.
  const after = await teams(page);
  expect(after[0]).toEqual(["Hotel", "Bravo", "Cahya", "Delta", "Echo"]);
  expect(after[1]).toEqual(["Foxtrot", "Golf", "Alfa", "India", "Juli"]);

  // The gap moved under the user's finger. Team A drops from 5.0 average to
  // 4.2 (one player of 1 among five of 5) and Team B rises from 1.0 to 1.8, so
  // the gap closes from 4.0 to exactly 2.4. `swapPlayers` recomputes totals, gap
  // and flags in one pass (`src/session/edit.ts:99-104`); a swap that renamed the
  // players without recomputing would leave this at 4.0.
  expect((await gapText(page).innerText()).trim()).toBe("2.4");

  // And the pick cleared itself: the mode is still on, but nothing is half
  // chosen, so the next tap starts a fresh swap rather than completing this one.
  await expect(page.locator(".swap-banner")).toContainText("Tap one player on each team to swap them.");
  await expect(page.locator(".split-screen .team li.picked")).toHaveCount(0);
});

test("a hand swap stops claiming to be a proven minimum", async ({ page }) => {
  // The provenance half of the feature, and the part most likely to be true on
  // paper and false on screen: `recomputeResult` stamps `optimal: false`
  // (`src/session/edit.ts:72`), so the readout gains the qualifier. This is the
  // claim `README.md:16` makes about what a manual swap means, asserted on the
  // screen rather than on the model.
  await openSplit(page);
  await expect(page.locator(".split-screen")).not.toContainText("Best gap found.");

  await page.getByTestId("swap-mode").click();
  await card(page, "Alfa").click();
  await card(page, "Hotel").click();

  // `gapKind` reads `solver.optimal` and nothing else (`src/session/gapProvenance.ts`),
  // so the qualifier appearing is the stamp arriving.
  await expect(page.locator(".split-screen")).toContainText("Best gap found.");
});

test("two taps on one team clear the pick instead of swapping a player for themselves", async ({ page }) => {
  await openSplit(page);
  const before = await teams(page);

  await page.getByTestId("swap-mode").click();
  await card(page, "Alfa").click();
  await expect(card(page, "Alfa")).toHaveClass(/picked/);
  // The same team again. `handlePick` (`src/session/SplitScreen.tsx:312-315`)
  // clears the pick on this branch rather than trading, so the mistake a new user
  // makes first costs them nothing and the screen invites a fresh choice.
  await card(page, "Bravo").click();
  await expect(page.locator(".split-screen .team li.picked")).toHaveCount(0);
  await expect(page.locator(".swap-banner")).toContainText("Tap one player on each team to swap them.");
  expect(await teams(page)).toEqual(before);

  // And the mode is still usable afterwards: a third tap starts a real swap
  // rather than resuming the abandoned one.
  await card(page, "Alfa").click();
  await card(page, "Golf").click();
  const after = await teams(page);
  expect(after[0]).not.toContain("Alfa");
  expect(after[1]).toContain("Alfa");
  expect(after[1]).not.toContain("Golf");
  expect(after[0]).toContain("Golf");
});

test("a player can be picked with Enter and with Space, and both are real controls", async ({ page }) => {
  await openSplit(page);
  await page.getByTestId("swap-mode").click();

  // The affordances themselves. `tabIndex={0}` is what puts a non-focusable `li`
  // in the tab order, and `role="button"` is what tells assistive technology
  // that Enter and Space mean something here. Both are assertions about the DOM
  // because both are invisible to a click, and a `li` that is focusable but not
  // announced as a control is the specific failure this pins.
  const alfa = card(page, "Alfa");
  await expect(alfa).toHaveAttribute("role", "button");
  await expect(alfa).toHaveAttribute("tabindex", "0");
  // Outside swap mode a card is not a control at all, which is the same
  // assertion's other half: the affordances belong to the mode, not to the card.
  await page.getByRole("button", { name: "Done swapping", exact: true }).click();
  await expect(card(page, "Alfa")).not.toHaveAttribute("role", "button");
  await page.getByTestId("swap-mode").click();

  // Enter.
  await alfa.focus();
  await expect(alfa).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator(".swap-banner")).toContainText("Now tap a player on the other team to swap with Alfa");

  // Space completes the swap on the other team. It is asserted separately from
  // Enter because the handler names both keys explicitly and a Space that fell
  // through would scroll the page instead of picking.
  await card(page, "Hotel").focus();
  await page.keyboard.press(" ");
  const after = await teams(page);
  expect(after[0]).toContain("Hotel");
  expect(after[0]).not.toContain("Alfa");
  expect(after[1]).toContain("Alfa");
  expect(after[1]).not.toContain("Hotel");
});

test("entering the mode hides the bar's other actions, and leaving restores all three", async ({ page }) => {
  await openSplit(page);

  // Out of the mode: the three actions that compete with "pick two players" are
  // all on screen, and so is the way in.
  for (const label of ["← History", "Save squad", "Share", "Swap", "Re-roll"]) {
    await expect(page.getByRole("button", { name: label, exact: true }), label).toBeVisible();
  }

  await page.getByTestId("swap-mode").click();

  // In the mode the bar is a single exit. With five actions on this row the three
  // `!swapMode` guards matter more than they did with four: a reader in swap mode
  // is being told to tap cards, and a live `Re-roll` or `Share` one thumb-width
  // away is a mis-tap that throws the arrangement away. Pinned by count as well
  // as by name, so a bar that grew an action here would fail rather than pass.
  await expect(page.locator(".split-bar button")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Done swapping", exact: true })).toBeVisible();

  // Leaving restores every action, in the order it was there before.
  await page.getByRole("button", { name: "Done swapping", exact: true }).click();
  await expect(page.locator(".swap-banner")).toHaveCount(0);
  expect(await page.locator(".split-bar button").allTextContents()).toEqual([
    "← History",
    "Save squad",
    "Share",
    "Swap",
    "Re-roll",
  ]);
});

test("the solver-failure screen withholds Swap, because a swap needs two teams", async ({ page }) => {
  // A swap needs a team on each side. Below two teams the screen renders its
  // "Solver failed" empty state, and `Swap` is withheld on the same gate Share
  // is (`src/session/SplitScreen.tsx:513`). Restoring the button without
  // the gate would put an edit affordance on a screen with no teams to edit, so
  // the negative half is pinned here next to the positive half above.
  await gotoHubSeeded(page, oneTeamWorld(), "History");
  await expect(page.locator(".history-row")).toHaveCount(1);
  await page.locator(".history-row").first().click();
  await expect(page.locator(".split-screen")).toBeVisible({ timeout: 10000 });

  await expect(page.locator(".split-screen .empty")).toContainText("Couldn");
  await expect(page.getByTestId("swap-mode")).toHaveCount(0);
  await expect(page.locator(".split-bar button")).toHaveCount(3);
});