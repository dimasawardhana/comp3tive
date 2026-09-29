/**
 * D37: the split screen says why the teams came out even, in the player's own
 * terms, and the sentence stays D37's.
 *
 * What this file is for, and what it is not for. The wiring itself — which
 * readouts mount the line, the empty `trade`, the unpunctuated not-playing list
 * — is pinned in `src/session/SplitScreen.fairness.test.ts`, which renders the
 * component with `react-dom/server` and runs in the `node` suite. What only a
 * browser can see is here: the line on a split the shipped solver actually
 * produced, the name it picks agreeing with the team cards on screen, the
 * computed type, and the Landing Page's hero, which mounts this same screen
 * (`src/landing.tsx:151-161`) on white paper instead of the app's ink panel.
 *
 * The banned-substring list is `src/share/fairness.test.ts`'s: verdict
 * vocabulary and mechanism vocabulary, which belong to
 * `src/session/gapProvenance.ts` and to nobody else. The readout directly above
 * this line may say `Best gap found.`; the explanation may neither restate nor
 * contradict it.
 *
 * ## How these pools are built, and why
 *
 * A first draft of this file reused `gap-provenance.spec.ts`'s PROVEN-10 pool
 * and asserted a sentence naming "Player 1". It passed in the module and failed
 * in the app, which named "Player 5". The cause: PROVEN-10 has **ten players
 * and three distinct strengths** — four players tie at 4.0 and five at 3.25 —
 * so the name the sentence prints is chosen by a positional tiebreak among the
 * tied, and which tied player sits first depends on the order the app hands the
 * pool to the solver. Two fixtures that differ only in that order produce two
 * different sentences for the same teams.
 *
 * So every pool here is built so that **no character of the expectation can come
 * from a tie**:
 *
 * - `spreadPlayers` (10) and `sitOutPlayers` (12) give every player a strength
 *   no other player holds, so each name is forced by the ratings.
 * - `flatPlayers` gives every player the same strength, so its sentence is
 *   `Every team averages 4.0.` with no name in it at all — nothing to break.
 *
 * What is left that the *data* does not determine is which players the solver
 * puts on which team. Two assertions cover that, and neither pretends otherwise:
 * the exact sentence (so any drift fails), and `the name is the strongest and
 * the weakest player on the team card it names`, checked against the ratings
 * the screen is actually showing. The second holds for every arrangement the
 * solver can return, which is why it is the one that will not rot.
 */
import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { gotoSeeded, type SeedWorld } from "../../support/seed";

const ROLES = ["tank", "assassin", "mage", "marksman", "fighter"];

const BANNED = [
  "proven", "best gap", "best-found", "exact", "minimum", "optimal",
  "solver", "search", "node", "heuristic", "aborted",
];

const COMMUNITY = { id: "comm-fair", name: "Fair Play", createdAt: 100 };

const world = (players: Record<string, unknown>[]): SeedWorld => ({
  communities: [COMMUNITY],
  players,
  sessions: [],
  tournaments: [],
  squads: [],
  activeCommunityId: "comm-fair",
});

const mlbbPlayer = (id: string, name: string, ratings: number[], i: number) => ({
  id,
  communityId: "comm-fair",
  name,
  capabilities: [{
    disciplineId: "mlbb",
    attributeRatings: { mechanics: ratings[0], "game-sense": ratings[1], "hero-pool": ratings[2], teamwork: ratings[3] },
    eligibleRoles: ROLES,
    preferredRole: ROLES[i % 5],
  }],
});

/** Everyone rated 4.0: any split of them is exactly even, so the line has no name in it. */
const flatPlayers = (count: number) =>
  Array.from({ length: count }, (_, i) => mlbbPlayer(`fp-${i + 1}`, `Player ${i + 1}`, [4, 4, 4, 4], i));

/**
 * Ten players, ten distinct strengths: 5.0, 4.75, 4.5, 4.0, 3.5, 3.25, 2.5,
 * 2.0, 1.5, 1.25. No two players tie, so the sentence's two names are decided
 * by the ratings rather than by a tiebreak. The solver balances this pool to a
 * 0.1 gap, which is wide enough for the band to have two ends at one decimal.
 */
const spreadPlayers = () => {
  const means: number[][] = [[5, 5, 5, 5], [5, 5, 5, 4], [5, 5, 4, 4], [4, 4, 4, 4], [4, 4, 3, 3],
    [4, 3, 3, 3], [3, 2, 3, 2], [2, 2, 2, 2], [2, 1, 2, 1], [1, 1, 1, 2]];
  return means.map((r, i) => mlbbPlayer(`sp-${i + 1}`, `Player ${i + 1}`, r, i));
};

/**
 * Twelve players: ten at 4.0, then two far below everyone else at 1.25 and
 * 1.0. A split of ten into two teams of five that leaves both weak players off
 * is the only arrangement with a zero gap, so the pair named by the
 * not-playing clause is the pair the ratings pick — and the two ratings differ,
 * so even their order in the clause is not a tie.
 */
const sitOutPlayers = () => [
  ...flatPlayers(10),
  mlbbPlayer("sp-11", "Player 11", [1, 1, 1, 2], 10),
  mlbbPlayer("sp-12", "Player 12", [1, 1, 1, 1], 11),
];

/** Walk the Dashboard's "Split match" flow to a split, with teamCount dialled in. */
async function splitWith(page: Page, disciplineName: string, teamCount: number) {
  await page.getByRole("button", { name: "Split match" }).click();
  await expect(page.locator(".match-setup")).toBeVisible({ timeout: 5000 });
  await page.locator(".game", { hasText: disciplineName }).click();
  await expect(page.locator(".chip-player").first()).toBeVisible({ timeout: 5000 });

  const chips = page.locator(".chip-player");
  const count = await chips.count();
  for (let i = 0; i < count; i++) {
    const chip = chips.nth(i);
    if ((await chip.getAttribute("aria-pressed")) !== "true") await chip.click();
  }

  for (let guard = 0; guard < 10; guard++) {
    const current = Number(await page.locator(".stepper .count").innerText());
    if (current === teamCount) break;
    await page.getByRole("button", { name: current < teamCount ? "More teams" : "Fewer teams" }).click();
  }
  await expect(page.locator(".stepper .count")).toHaveText(String(teamCount));
  await page.getByTestId("split-button").click();
  await expect(page.locator(".split-screen")).toBeVisible({ timeout: 15000 });
}

/** The line's text, whitespace collapsed: one reader-visible sentence run. */
const lineText = async (page: Page) =>
  ((await page.locator(".fairness").first().innerText()) ?? "").replace(/\s+/g, " ").trim();

/**
 * What the two team cards on screen say: the team label, and every player's
 * name with the strength the card printed. The card's number comes from the
 * same strength model the line does, so the two are comparable.
 */
const readTeamCards = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll(".pitch .team")].map((card) => {
      const names = [...card.querySelectorAll(".player-name")].map((n) => n.textContent?.trim() ?? "");
      const strengths = [...card.querySelectorAll(".player-overall")].map((n) => Number(n.textContent?.trim()));
      return {
        label: card.querySelector(".tname-label")?.textContent?.trim() ?? "",
        players: names.map((name, i) => ({ name, strength: strengths[i] ?? Number.NaN })),
      };
    }),
  );

/** Nothing the line prints may be verdict or mechanism vocabulary, or an em-dash. */
async function expectNoProvenanceWords(page: Page) {
  const text = (await lineText(page)).toLowerCase();
  for (const banned of BANNED) expect(text, `the fairness line says "${banned}"`).not.toContain(banned);
  expect(text).not.toContain("\u2014");
}

test.describe("the fairness line", () => {
  test("the 2-team site names the strongest and weakest player on the teams it names", async ({ page }) => {
    await gotoSeeded(page, world(spreadPlayers()));
    await splitWith(page, "Mobile Legends", 2);

    // The 2-team branch mounts the `GapMeter` fragment, which draws the scale
    // and the readout; the line is mounted there too, after the readout.
    await expect(page.locator(".pitch .scale")).toBeVisible();
    const line = page.locator(".fairness");
    await expect(line).toBeVisible();
    await expect(line).toContainText("Every team averages");

    // The sentence as the app prints it, so any drift in the copy, the band or
    // the arrangement fails here rather than passing unnoticed.
    await expect(line).toHaveText(
      "Every team averages 3.2 to 3.3. Player 3 (4.5) is Team B's best; Player 10 (1.3) is Team A's weakest.",
    );

    // The same claim, as an invariant rather than a snapshot: the player the
    // line calls the best is the strongest player on the card it names, and the
    // one it calls the weakest is the weakest there, with the strengths the
    // cards printed. This holds for every arrangement the solver can return, so
    // it is what keeps the test honest if the solver ever returns a different
    // one.
    const cards = await readTeamCards(page);
    const named = await line.evaluate((el) => el.textContent ?? "");
    // `.fairness` renders the band sentence and then the trade sentence, so the
    // trade is what follows the band's full stop. Anchoring a pattern at the
    // element instead is the trap: bound at `^`, `(.+?)` takes the *shortest*
    // prefix that reaches a " (", which is the band sentence plus the name, and
    // the card lookup then hunts for a player called
    // "Every team averages 3.2 to 3.3. Player 3". The band is therefore matched
    // and consumed first, and the pattern below is anchored on what remains.
    //
    // Limit worth knowing: a pool that also benched somebody would put the
    // not-playing clause between the two sentences, and where that clause ends
    // is not recoverable from the rendered text — "Sari Wira" is two list
    // items or one name plus one name, and the DOM cannot say. This pool
    // benches nobody, and a pool that did would fail this lookup loudly rather
    // than pass quietly.
    const band = /^(Every team averages \d+\.\d+ to \d+\.\d+\.)/.exec(named);
    expect(band, `the line does not open with a two-ended band sentence: ${named}`).not.toBeNull();
    const trade = /^(.+?) \(([\d.]+)\) is (Team [A-Z])'s best; (.+?) \(([\d.]+)\) is (Team [A-Z])'s weakest\.$/.exec(named.slice(band![1].length).trimStart());
    expect(trade, `the text after the band sentence is not a two-clause trade: ${named}`).not.toBeNull();
    const [, bestName, bestStrength, bestTeam, worstName, worstStrength, worstTeam] = trade!;
    for (const [name, strength, team] of [[bestName!, bestStrength!, bestTeam!], [worstName!, worstStrength!, worstTeam!]] as const) {
      const card = cards.find((c) => c.label === team);
      expect(card, `no team card labelled ${team}`).toBeTruthy();
      const onCard = card!.players.find((p) => p.name === name);
      expect(onCard, `${name} is not on the card labelled ${team}`).toBeTruthy();
      expect(onCard!.strength, `${name} is printed at ${onCard!.strength} on the card and ${strength} in the line`).toBeCloseTo(Number(strength), 1);
    }
    const highCard = cards.find((c) => c.label === bestTeam)!;
    const lowCard = cards.find((c) => c.label === worstTeam)!;
    expect(Math.max(...highCard.players.map((p) => p.strength))).toBeCloseTo(Number(bestStrength), 1);
    expect(Math.min(...lowCard.players.map((p) => p.strength))).toBeCloseTo(Number(worstStrength), 1);
    // Neither end is a tie: no second player on that card shares the strength.
    expect(highCard.players.filter((p) => p.strength === Number(bestStrength))).toHaveLength(1);
    expect(lowCard.players.filter((p) => p.strength === Number(worstStrength))).toHaveLength(1);

    await expectNoProvenanceWords(page);

    // A sibling of the readout, never a child of it. The readout's own text is
    // pinned as exact text by gap-provenance.spec.ts, and the gap's provenance
    // is one voice: this line is an explanation beside it, not a second verdict
    // inside it.
    await expect(page.locator(".readout .fairness")).toHaveCount(0);
    await expect(page.locator(".fairness")).toHaveCount(1);
    // The readout keeps its own claim, whatever it is: these pools split to a
    // gap of 0.1 or less, so the screen says "Dead even." rather than printing
    // a gap number. What matters here is that the two claims stay two elements.
    await expect(page.locator(".readout").first()).not.toContainText("Every team averages");

    // Painted in the readout's own quiet face, not at body size.
    const type = await line.evaluate((el) => {
      const s = getComputedStyle(el);
      return { size: s.fontSize, weight: s.fontWeight, align: s.textAlign };
    });
    expect(parseFloat(type.size)).toBeLessThan(15);
    expect(Number(type.weight)).toBeLessThan(600);
  });

  test("an even split prints one sentence and names no side", async ({ page }) => {
    // A flat roster is exactly even whatever the solver returns: every player
    // is 4.0, so both teams land on 4.0, the band has one end, and there is no
    // higher side and no lower one to name. There is no name in this sentence to
    // be decided by a tiebreak.
    await gotoSeeded(page, world(flatPlayers(10)));
    await splitWith(page, "Mobile Legends", 2);

    await expect(page.locator(".readout").first()).toContainText("Dead even.");
    const line = page.locator(".fairness");
    await expect(line).toHaveText("Every team averages 4.0.");
    // The empty `trade` renders nothing at all: no placeholder, and no
    // sentence that would name a "best" and a "weakest" across a distinction
    // the result does not contain.
    await expect(line).not.toContainText("is Team");
    await expectNoProvenanceWords(page);
  });

  test("the 3+ site carries the same line, under its own readout", async ({ page }) => {
    await gotoSeeded(page, world(flatPlayers(15)));
    await splitWith(page, "Mobile Legends", 3);

    // The 3+ branch renders its own `.readout` and no GapMeter, so the line is
    // mounted there separately (src/session/SplitScreen.tsx). The two sites are
    // the same situation in two frames; asserting `.scale` is absent and the
    // line present pins that this is the second mount, not the first.
    await expect(page.locator(".team-stack")).toBeVisible();
    await expect(page.locator(".pitch .scale")).toHaveCount(0);
    const line = page.locator(".fairness");
    await expect(line).toBeVisible();
    // Fifteen players at one strength: three teams of five, every average 4.0,
    // nobody left off, so the band has one end and the sentence has no name.
    await expect(line).toHaveText("Every team averages 4.0.");
    await expect(page.locator(".readout .fairness")).toHaveCount(0);
    await expect(page.locator(".fairness")).toHaveCount(1);
    await expectNoProvenanceWords(page);
  });

  test("a pool the split cannot absorb names who is not playing, unpunctuated", async ({ page }) => {
    // Twelve players, two of them far below the rest. The split puts the ten
    // 4.0s on the teams and leaves the two weak ones off, the band is even, so
    // `trade` is empty and the not-playing clause is the last thing on the line.
    // This is the cell where the empty `trade` and the missing full stop meet.
    await gotoSeeded(page, world(sitOutPlayers()));
    await splitWith(page, "Mobile Legends", 2);

    const line = page.locator(".fairness");
    await expect(line).toHaveText("Every team averages 4.0. Not playing: Player 11, Player 12");
    const text = await lineText(page);
    // No full stop after the list. The clause is lifted whole from `teamsAsText`
    // (src/share/share-text.ts:83) and the poster, and a stop here would print
    // `?.` for an id the roster no longer holds — the one string in this
    // sentence the reader can get wrong.
    expect(text.endsWith(".")).toBe(false);
    await expectNoProvenanceWords(page);
  });

  test("the landing hero shows the line in ink on paper, without overflowing", async ({ page }) => {
    // The hero mounts this same screen (src/landing.tsx), on `--surface-2`
    // rather than the app's ink `--panel`. `.pitch` hands its children
    // `--panel-text` and `landing.css` corrects the readout to `--text`; this
    // line sits directly under that readout, so without the same correction it
    // would be near-white on near-white.
    await page.goto("/");
    const hero = page.locator("#landing-hero");
    await expect(hero.locator(".split-screen")).toBeVisible();
    const line = hero.locator(".fairness");
    await expect(line).toBeVisible();
    // Measured on this branch over the hero's own roster and the shipped
    // solver: band 3.6 to 3.7, two teams of five, nobody left off. Two of the
    // hero's players tie at 4.0, so which of them the line names is not
    // asserted here; the band is, and the second sentence's presence is.
    await expect(line).toContainText("Every team averages 3.6 to 3.7.");
    await expect(line).toContainText("is Team");
    await expectNoProvenanceWords(page);

    // Legibility, in this colour scheme and in the other one. The claim is that
    // the line is painted in the readout's own ink and stays legible on the
    // hero's paper, so it is measured on the 0.8-opacity blend rather than on
    // the declared colour.
    const channel = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    const luminance = ([r, g, b]: number[]) =>
      0.2126 * channel(r / 255) + 0.7152 * channel(g / 255) + 0.0722 * channel(b / 255);
    const rgb = (value: string) => {
      const parts = (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
      // Readable in the failure message: a mistyped character class here once
      // matched no digits at all and the ratio came out NaN, which reads as a
      // failed threshold rather than as a broken helper.
      expect(parts, `could not read three colour channels out of "${value}"`).toHaveLength(3);
      expect(parts.every((c) => Number.isFinite(c)), `"${value}" parsed to ${JSON.stringify(parts)}`).toBe(true);
      return parts as [number, number, number];
    };

    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      const painted = await line.evaluate((el) => {
        const s = getComputedStyle(el);
        return { color: s.color, opacity: Number(s.opacity) };
      });
      const paper = await hero.locator(".pitch").evaluate((el) => getComputedStyle(el).backgroundColor);
      const readoutInk = await hero.locator(".readout").evaluate((el) => getComputedStyle(el).color);
      // Painted in the same ink as the readout directly above it. That is the
      // claim; a contrast ratio is a proxy for it.
      expect(painted.color, `in ${scheme} the line is ${painted.color} and the readout is ${readoutInk}`).toBe(readoutInk);
      // The 0.8 the rule sets, asserted rather than assumed: the blend below is
      // only the honest measurement while the opacity is the one in the sheet.
      expect(painted.opacity, `in ${scheme} the line's opacity`).toBeCloseTo(0.8, 2);

      const [fr, fg, fb] = rgb(painted.color);
      const paperRgb = rgb(paper);
      const blended = paperRgb.map((c, i) => painted.opacity * [fr, fg, fb][i]! + (1 - painted.opacity) * c) as [number, number, number];
      const a = luminance(blended);
      const b = luminance(paperRgb);
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      expect(Number.isFinite(ratio), `in ${scheme} the ratio came out ${ratio} for ${painted.color} on ${paper}`).toBe(true);
      expect(ratio, `in ${scheme}: ${painted.color} at ${painted.opacity} on ${paper} blends to rgb(${blended.map(Math.round).join(", ")})`).toBeGreaterThan(4.5);
    }
    await page.emulateMedia({ colorScheme: null });

    // The line adds a wrapped sentence to a hero the capture script also
    // measures; it must not push the page sideways at a phone width.
    await page.setViewportSize({ width: 390, height: 844 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBe(0);
  });
});
