/**
 * D37: the split screen says why the teams came out even, in the player's own
 * terms, and the sentence stays D37's.
 *
 * What this file is for, and what it is not for. The wiring itself — which
 * readouts mount the line, the empty `trade`, the unpunctuated not-playing list
 * — is pinned in `src/session/SplitScreen.fairness.test.ts`, which renders the
 * component with `react-dom/server` and runs in the `node` suite. What only a
 * browser can see is here: the line on a split the shipped solver actually
 * produced, legible where it is painted, and the Landing Page's hero, which
 * mounts this same screen (`src/landing.tsx:151-161`) on white paper instead
 * of the app's ink panel.
 *
 * The banned-substring list is `src/share/fairness.test.ts`'s: verdict
 * vocabulary and mechanism vocabulary, which belong to
 * `src/session/gapProvenance.ts` and to nobody else. The readout directly above
 * this line may say `Best gap found.`; the explanation may neither restate nor
 * contradict it.
 *
 * Every expectation below was measured on this branch by running the shipped
 * `freshSplit` over the same pool (`npx vitest run` on a scratch probe, since
 * deleted), not read off a hand-built result:
 *
 *   PROVEN-10, 10 MLBB, teamCount 2 -> sizes 5/5, gap 0.1
 *     "Every team averages 3.6 to 3.7. Player 1 (4.0) is Team B's best;
 *      Player 10 (3.3) is Team A's weakest."
 *   FLAT-10, 10 MLBB all rated 4, teamCount 2 -> sizes 5/5, gap 0, nobody out
 *     "Every team averages 4.0."
 *   FLAT-12, 12 MLBB all rated 4, teamCount 2 -> sizes 5/5, two left off
 *     "Every team averages 4.0. Not playing: Player 8, Player 9"
 *   FLAT-15, 15 MLBB all rated 4, teamCount 3 -> sizes 5/5/5, gap 0
 *     "Every team averages 4.0."
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

/**
 * PROVEN-10: the pool `e2e/tests/split/gap-provenance.spec.ts` already measures,
 * kept because it is the one pool whose band has two ends (3.6 and 3.7), so
 * the second sentence is reachable without a hand-edited result.
 */
const PROVEN_TEN: [number, number, number, number][] = [
  [4, 4, 3, 5], [3, 3, 3, 4], [5, 4, 4, 4], [3, 4, 3, 3], [4, 4, 4, 4],
  [3, 3, 4, 3], [4, 5, 4, 3], [4, 3, 3, 3], [4, 4, 3, 5], [3, 4, 3, 3],
];

const mlbbPlayer = (id: string, name: string, ratings: Record<string, number>, i: number) => ({
  id,
  communityId: "comm-fair",
  name,
  capabilities: [{ disciplineId: "mlbb", attributeRatings: ratings, eligibleRoles: ROLES, preferredRole: ROLES[i % 5] }],
});

/** FLAT-10 / FLAT-12 / FLAT-15: one rating for everyone, so the split is even whatever the solver returns. */
const flatPlayers = (count: number) =>
  Array.from({ length: count }, (_, i) =>
    mlbbPlayer(`fp-${i + 1}`, `Player ${i + 1}`, { mechanics: 4, "game-sense": 4, "hero-pool": 4, teamwork: 4 }, i),
  );

const provenPlayers = () =>
  PROVEN_TEN.map((r, i) =>
    mlbbPlayer(`pp-${i + 1}`, `Player ${i + 1}`,
      { mechanics: r[0], "game-sense": r[1], "hero-pool": r[2], teamwork: r[3] }, i),
  );

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

/** Nothing the line prints may be verdict or mechanism vocabulary, or an em-dash. */
async function expectNoProvenanceWords(page: Page) {
  const text = (await lineText(page)).toLowerCase();
  for (const banned of BANNED) expect(text, `the fairness line says "${banned}"`).not.toContain(banned);
  expect(text).not.toContain("\u2014");
}

test.describe("the fairness line", () => {
  test("the 2-team site explains the split and borrows no verdict word", async ({ page }) => {
    await gotoSeeded(page, world(provenPlayers()));
    await splitWith(page, "Mobile Legends", 2);

    // The 2-team branch mounts the `GapMeter` fragment, which draws the scale
    // and the readout; the line is mounted there too, after the readout.
    await expect(page.locator(".pitch .scale")).toBeVisible();
    const line = page.locator(".fairness");
    await expect(line).toBeVisible();
    await expect(line).toHaveText(
      "Every team averages 3.6 to 3.7. Player 1 (4.0) is Team B's best; Player 10 (3.3) is Team A's weakest.",
    );
    await expectNoProvenanceWords(page);

    // A sibling of the readout, never a child of it. The readout's own text is
    // pinned as exact text by gap-provenance.spec.ts, and the gap's provenance
    // is one voice: this line is an explanation beside it, not a second verdict
    // inside it.
    await expect(page.locator(".readout .fairness")).toHaveCount(0);
    await expect(page.locator(".fairness")).toHaveCount(1);
    await expect(page.locator(".readout").first()).toContainText("Gap 0.1.");

    // Painted in the readout's own quiet face, not at body size.
    const type = await line.evaluate((el) => {
      const s = getComputedStyle(el);
      return { size: s.fontSize, weight: s.fontWeight, align: s.textAlign };
    });
    expect(parseFloat(type.size)).toBeLessThan(15);
    expect(Number(type.weight)).toBeLessThan(600);
    expect(type.align).toBe("center");
  });

  test("an even split prints one sentence and names no side", async ({ page }) => {
    // A flat roster is exactly even whatever the solver returns: every player
    // is 4.0, so both teams land on 4.0, the band has one end, and there is no
    // higher side and no lower one to name.
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
    await expect(line).toHaveText("Every team averages 4.0.");
    await expect(page.locator(".readout .fairness")).toHaveCount(0);
    await expect(page.locator(".fairness")).toHaveCount(1);
    await expectNoProvenanceWords(page);
  });

  test("a pool the split cannot absorb names who is not playing, unpunctuated", async ({ page }) => {
    // Twelve players into two teams of five: two are left off, the band is
    // even, so `trade` is empty and the not-playing clause is the last thing on
    // the line. This is the cell the empty `trade` and the missing full stop
    // meet in, and it is the only place on the screen that says who sat out.
    await gotoSeeded(page, world(flatPlayers(12)));
    await splitWith(page, "Mobile Legends", 2);

    const text = await lineText(page);
    expect(text).toMatch(/^Every team averages \d+\.\d+\. Not playing: Player \d+, Player \d+$/);
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
    await expect(line).toContainText("Every team averages");
    // Measured on this branch over the hero's own roster and the shipped
    // solver: band 3.6 to 3.7, two teams of five, nobody left off. The second
    // sentence names Eka (4.0) and Andi (3.3); which of two equally strong
    // players a side is "best" is the module's own pin, so this spec asserts
    // the band and that a second sentence is there at all.
    await expect(line).toContainText("Every team averages 3.6 to 3.7.");
    await expect(line).toContainText("is Team");
    await expectNoProvenanceWords(page);

    const painted = await line.evaluate((el) => {
      const s = getComputedStyle(el);
      return { color: s.color, opacity: Number(s.opacity) };
    });
    const paper = await hero.locator(".pitch").evaluate((el) => getComputedStyle(el).backgroundColor);
    const rgb = (value: string) => (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
    const channel = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    const luminance = ([r, g, b]: number[]) => 0.2126 * channel(r! / 255) + 0.7152 * channel(g! / 255) + 0.0722 * channel(b! / 255);
    // The line is set at 0.8 opacity, so the pixels are a blend of the declared
    // ink and the paper behind it. Contrast is measured on that blend, not on
    // the declared colour.
    const [fr, fg, fb] = rgb(painted.color);
    const paperRgb = rgb(paper);
    const blended = paperRgb.map((c, i) => painted.opacity * [fr, fg, fb][i]! + (1 - painted.opacity) * c);
    const a = luminance(blended);
    const b = luminance(paperRgb);
    const contrast = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    expect(contrast, `${painted.color} at ${painted.opacity} on ${paper}`).toBeGreaterThan(4.5);

    // The line adds a wrapped sentence to a hero the capture script also
    // measures; it must not push the page sideways at a phone width.
    await page.setViewportSize({ width: 390, height: 844 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBe(0);
  });
});
