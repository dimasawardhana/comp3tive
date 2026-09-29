/**
 * A 3-team night can split, so it must be able to run a tournament: round robin
 * has every team play every other once, and the standings crown the most wins.
 *
 * Two things in here are not about round robin's shape but about what it must
 * stop claiming. It has no final, so nothing on its screen may say "Final" — the
 * word belongs to `BracketView`, and a round robin routed there would carry it
 * over a match that does not exist. And it has no frontier, so recording the
 * last round must not finish it: the first recording below is deliberately the
 * **last** round, and the tournament has to stay in progress afterwards, which
 * is the completion fix from Task 7 observed at the surface rather than in a
 * unit test.
 *
 * **Every text assertion here is case-insensitive, and that is not fussiness.**
 * `innerText` and `toHaveText` read the *rendered* text, so they carry
 * `text-transform`: the stylesheet uppercases `.status` (`index.css:775`),
 * `.tms-value` (`:1968`), `.rlabel` (`:1758`) and `.champ-name` (`:1910`), and
 * leaves `.standings-team`, `.bteam-name`, `.modal-section-preview` and
 * `.modal-section-hint` as written. A case-sensitive assertion against an
 * uppercased element fails for a styling reason, and one against `Final` would
 * pass vacuously while the word is on the page in caps. The app has two
 * registers on purpose — display surfaces shout, content surfaces speak — so a
 * test that crosses them has to normalise, or it is testing the stylesheet.
 */
import { test, expect, type Page } from "@playwright/test";
import { gotoHubSeeded, type SeedWorld } from "../../support/seed";

const ROLES = ["tank", "assassin", "mage", "marksman", "fighter"];

/** 15 players, three teams of five, all MLBB-eligible. */
const world = (): SeedWorld => ({
  communities: [{ id: "comm-rr", name: "Three Team Night", createdAt: 100 }],
  players: Array.from({ length: 15 }, (_, i) => ({
    id: `p${i + 1}`,
    communityId: "comm-rr",
    name: `Player ${i + 1}`,
    capabilities: [{
      disciplineId: "mlbb",
      attributeRatings: { mechanics: 4, "game-sense": 4, "hero-pool": 4, teamwork: 4 },
      eligibleRoles: ROLES,
      preferredRole: ROLES[i % 5],
    }],
  })),
  sessions: [],
  tournaments: [],
  squads: [],
  activeCommunityId: "comm-rr",
});

/** The count chip for exactly `n` teams, which the discipline and BO chips never are. */
const countChip = (page: Page, n: number) => page.locator(".modal-card .chip", { hasText: new RegExp(`^${n}$`) });

/** Record one match, giving it to the team listed first, over the tournament's BO3. */
const recordMatch = async (page: Page, nth: number) => {
  await page.locator(".bracket-match").nth(nth).click();
  const modal = page.locator(".modal-card");
  await expect(modal).toBeVisible();
  // A BO3 is decided at two games, so one picked game is not a result. This is
  // the step a plan of Task 8's got wrong: saving one game leaves the match,
  // and the tournament, undecided.
  for (let game = 0; game < 2; game++) {
    await modal.locator(".record-game").nth(game).locator(".chip").first().click();
  }
  await expect(modal.locator(".status")).toContainText(/series decided/i);
  await modal.locator(".btn-primary", { hasText: "Save result" }).click();
  await expect(modal).not.toBeVisible({ timeout: 5000 });
};

/** The tournament's own metadata strip, read by its label rather than its index. */
const meta = (page: Page, label: string) =>
  page.locator(".tournament-meta-strip .tms-item", { has: page.locator(".tms-label", { hasText: new RegExp(label, "i") }) }).locator(".tms-value");

test("a 3-team round robin is selectable, runs, and crowns a champion from the standings", async ({ page }) => {
  await gotoHubSeeded(page, world(), "Games");

  await page.locator("button:has-text('+ New tournament')").click();
  const modal = page.locator(".modal-card");
  await modal.locator("#tournament-name").fill("Three team night");
  // The chip reads the discipline's short name, "MLBB"; the full name is in the
  // preview under it, not on the chip.
  await modal.locator(".chip", { hasText: "MLBB" }).click();
  await modal.locator(".chip", { hasText: "Round robin" }).click();

  // The chip row is every count from 2 to 8 and round robin enables 3 to 8, so a
  // 3-team night is one click away and 2 — the whole of the Series format — is
  // visibly not on offer.
  await expect(countChip(page, 2)).toBeDisabled();
  for (const n of [3, 4, 5, 6, 7, 8]) await expect(countChip(page, n)).toBeEnabled();
  await expect(countChip(page, 3)).toHaveAttribute("aria-pressed", "true");
  await expect(modal.locator(".modal-section-hint", { hasText: "Round robin: 3 to 8 teams" })).toBeVisible();
  // Three is an odd field, and it is a hint, not a complaint: it is stated in a
  // section hint, with no validation error raised for choosing it.
  await expect(modal.locator(".modal-section-hint", { hasText: "one team sits out each round" })).toBeVisible();
  await expect(modal.locator(".validation-errors")).toHaveCount(0);

  // Five teams is the other odd field the other formats could not field at all.
  await countChip(page, 5).click();
  await expect(modal.locator(".modal-section-preview").last()).toContainText("5 teams");
  await expect(modal.locator(".modal-section-preview").last()).toContainText("5 rounds");
  await expect(modal.locator(".validation-errors")).toHaveCount(0);
  await countChip(page, 3).click();

  await modal.locator(".btn-primary", { hasText: "Create" }).click();
  await expect(modal).not.toBeVisible({ timeout: 5000 });
  await expect(meta(page, "Format")).toHaveText(/^round robin$/i);
  await expect(meta(page, "Teams")).toHaveText("0/3");

  // The new tournament is a draft with no teams, so split three teams into it.
  await page.getByTestId("split-teams-cta").click();
  await expect(page.locator(".match-setup")).toBeVisible({ timeout: 10000 });
  await expect(page.locator(".status", { hasText: /locked to 3 teams by the tournament\./i })).toBeVisible();
  await page.getByTestId("split-button").click();
  await expect(page.locator(".split-screen")).toBeVisible({ timeout: 15000 });
  // Reach it by role and label: the `submit-tournament-squad` testid was removed
  // as dead, not renamed, so there is nothing to grep for. See .scratch/debt/issues/31.
  await page.getByRole("button", { name: "Save teams to tournament →" }).click();

  // The saved teams open for review and the bracket sits behind its confirmation,
  // so wait for whichever of the two the app has landed on rather than assuming.
  await page.locator(".standings, [data-testid='review-panel']").first().waitFor();
  if ((await page.getByTestId("review-panel").count()) > 0) {
    await page.getByTestId("confirm-teams").click();
  }

  // Three teams round robin: three matches, one per round, each team resting once.
  await expect(page.locator(".standings")).toBeVisible({ timeout: 10000 });
  await expect(page.locator(".standings-row")).toHaveCount(3);
  await expect(page.locator(".bracket-match")).toHaveCount(3);
  await expect(page.locator(".swiss-round .rlabel")).toHaveText([/^round 1$/i, /^round 2$/i, /^round 3$/i]);

  // No final: the round labels are all rounds, the bracket chrome is absent, and
  // the word is nowhere on the page.
  await expect(page.locator(".bracket-column-head")).toHaveCount(0);
  await expect(page.getByText(/^final$/i)).toHaveCount(0);

  // Record the **last** round first. A round robin books every fixture up front
  // and has no frontier, so the last round is only the last column: finishing it
  // leaves earlier fixtures unplayed and the tournament must stay in progress,
  // with no champion. If `requiredMatches` ever falls through to the last-round
  // rule again, this is the assertion that catches it.
  await recordMatch(page, 2);
  await expect(meta(page, "Status")).toHaveText(/^in progress$/i);
  await expect(page.locator(".champ")).toHaveCount(0);

  // Now the other two, and the tournament is finished.
  await recordMatch(page, 0);
  await recordMatch(page, 1);
  await expect(meta(page, "Status")).toHaveText(/^complete$/i);

  // `innerText` is the *rendered* text, so it carries `text-transform`. The
  // champion banner is uppercase (`.champ-name`, `src/index.css:1910`) and the
  // standings row is not (`.standings-team`, `:1862`), so comparing them raw
  // asserts the stylesheet rather than the claim. Normalise, and state the claim
  // the phase cares about: the two surfaces name the same team, and that team is
  // the one at the top of the table.
  const championName = (await page.locator(".champ-name").innerText()).trim().toLowerCase();
  expect(championName).not.toBe("");
  const leader = (await page.locator(".standings-team").first().innerText()).trim().toLowerCase();
  expect(championName).toBe(leader);
  // Two wins, one, none: the most wins takes it, and the table says so.
  await expect(page.locator(".standings-wins")).toHaveText(["2", "1", "0"]);
});

test("an odd team count is offered as a normal round robin, and 2 is not offered at all", async ({ page }) => {
  await gotoHubSeeded(page, world(), "Games");
  await page.locator("button:has-text('+ New tournament')").click();
  const modal = page.locator(".modal-card");
  await modal.locator("#tournament-name").fill("Odd field");
  await modal.locator(".chip", { hasText: "MLBB" }).click();
  await modal.locator(".chip", { hasText: "Round robin" }).click();

  // The round count, at both parities, because the bug this caught is invisible
  // at one of them. `roundRobinSchedule(n).length` is a count of *rows* — one
  // per pairing and one per bye — so it came out at 6 rounds for a 3-team night
  // and 6 again at 4 teams, from two different causes. A single case cannot
  // tell "twice the rounds" from "rows plus the byes"; these two can.
  //   even field, 2 pairings a round: 4 -> 3,  8 -> 7
  //   odd field,  a pairing and a bye: 3 -> 3,  5 -> 5,  7 -> 7
  const ROUNDS: Record<number, number> = { 3: 3, 4: 3, 5: 5, 7: 7, 8: 7 };

  // Every odd count from 3 up is enabled, and none of them raises an error:
  // an odd field is what the circle method pads for, not a compromise.
  for (const n of [3, 5, 7]) {
    await countChip(page, n).click();
    await expect(countChip(page, n)).toBeEnabled();
    await expect(modal.locator(".validation-errors")).toHaveCount(0);
    await expect(modal.locator(".modal-section-hint", { hasText: `${n} teams is an odd field` })).toBeVisible();
    // The bye is explained where the count is chosen, because that is where an
    // organizer will ask. `\b` so a doubled count cannot satisfy the assertion.
    await expect(modal.locator(".modal-section-preview").last())
      .toContainText(new RegExp(`\\b${ROUNDS[n]} rounds\\b`));
  }

  // The even fields, which is where rows are twice the rounds on their own.
  for (const n of [4, 8]) {
    await countChip(page, n).click();
    await expect(modal.locator(".modal-section-hint", { hasText: "odd field" })).toHaveCount(0);
    await expect(modal.locator(".modal-section-preview").last())
      .toContainText(new RegExp(`\\b${ROUNDS[n]} rounds\\b`));
  }

  // Two teams is a Series, so round robin does not offer it and says the range
  // that it does offer instead.
  await expect(countChip(page, 2)).toBeDisabled();
  await expect(modal.locator(".modal-section-hint", { hasText: "Round robin: 3 to 8 teams" })).toBeVisible();
});
