/**
 * D-ticket wiring: the bench advisory reaches the screen under both readouts,
 * as a sibling of the fairness line, and stays off it when the module has
 * nothing to say.
 *
 * Rendered with `react-dom/server`, the way `SplitScreen.fairness.test.ts`
 * renders the same component: no jsdom, no canvas, no browser, and it runs in
 * the `node` suite. That is enough to see what a reader sees, which is all the
 * wiring claims here are about.
 *
 * The numbers are not solver output. Each result is built with
 * `recomputeResult` over a hand-written arrangement, so the gap, the leftover
 * and the player count are the ones the fixture states rather than the ones a
 * search happened to find, and every expected sentence can be written out in
 * full from arithmetic on the ratings. `benchAdvice.test.ts` is the half that
 * does run the solver.
 *
 * Two rosters rather than one, because the two readouts need different shapes.
 * Mobile Legends requires exactly five a team, so a three-team counterfactual
 * needs a pool of sixteen: take one away and fifteen still fill three teams of
 * five. On a smaller pool the solver cannot re-split the remainder into
 * role-covering teams, the counterfactual comes back empty, and an empty
 * counterfactual is not advice. Both rosters are Mobile Legends so the only
 * thing that differs between them is size, which is what is under test.
 */
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SplitScreen } from "./SplitScreen";
import { recomputeResult } from "./edit";
import { MLBB_DISCIPLINE } from "../domain/seed";
import { SAFETY_BAN } from "../test-support/safetyCopy";
import type { Player, Session, SplitResult, TeamAssignment } from "../domain/types";

/**
 * A roster, and the four builders that need to know which roster they are
 * building for. One factory rather than a set of module-level helpers closing
 * over a single roster, because there are two rosters and every helper would
 * otherwise have to be duplicated for the second one.
 */
function squad(rated: readonly (readonly [name: string, rating: number])[]) {
  const roster: Player[] = rated.map(([name, rating], i) => ({
    id: `p${i + 1}`,
    communityId: "c1",
    name,
    capabilities: [
      {
        disciplineId: MLBB_DISCIPLINE.id,
        // Ratings, not strengths: MLBB strength is the mean of its four
        // attributes, so a single rating is the strength. Every role to
        // everyone, because this is about strength and a role shortfall would
        // move the gap for a reason that has nothing to do with the bench.
        attributeRatings: { mechanics: rating, "game-sense": rating, "hero-pool": rating, teamwork: rating },
        eligibleRoles: MLBB_DISCIPLINE.roles.map((r) => r.id),
        preferredRole: null,
      },
    ],
  }));
  const idOf = (name: string) => roster.find((p) => p.name === name)!.id;
  const team = (index: number, names: readonly string[]): TeamAssignment => ({
    index,
    slots: names.map((name) => ({ playerId: idOf(name), roleId: null })),
    totalStrength: 0,
    avgStrength: 0,
  });
  /** `recomputeResult` stamps the totals, averages, gap and flags the screen reads. */
  const arranged = (teams: TeamAssignment[], unassigned: readonly string[] = [], proven = true): SplitResult =>
    recomputeResult(
      teams,
      MLBB_DISCIPLINE,
      unassigned.map(idOf),
      roster,
      { optimal: proven, nodesExplored: 0, elapsedMs: 0 },
    );
  const screen = (result: SplitResult) =>
    renderToStaticMarkup(
      createElement(SplitScreen, {
        session: {
          id: "s1",
          communityId: "c1",
          disciplineId: MLBB_DISCIPLINE.id,
          createdAt: 0,
          poolPlayerIds: roster.map((p) => p.id),
          settings: { teamCount: result.teams.length },
          result,
        } satisfies Session,
        discipline: MLBB_DISCIPLINE,
        roster,
        onPersistResult: async () => {},
        source: "ad-hoc",
      }),
    );
  return { roster, team, arranged, screen };
}

/** The advisory's own text: no tags, entities decoded, whitespace collapsed. */
const line = (html: string): string | null => {
  const found = /<p class="bench-advice">([\s\S]*?)<\/p>/.exec(html);
  if (!found || found[1] === undefined) return null;
  return found[1].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
};

/**
 * Eleven for the 2-team readout. Rangga at 5 on Team A with four 4s makes 21,
 * five 4s on Team B make 20, and Kresna is the one left out: gap 0.2. The ten
 * who remain without Rangga are all 4 and split 20 and 20, so the gap behind
 * the sentence is 0.0.
 */
const TWO_TEAM = squad([
  ["Rangga", 5],
  ["Budi", 4],
  ["Citra", 4],
  ["Dewi", 4],
  ["Eka", 4],
  ["Fajar", 4],
  ["Gita", 4],
  ["Hana", 4],
  ["Irfan", 4],
  ["Joko", 4],
  ["Kresna", 4],
  ["Lina", 2],
  ["Miko", 2],
]);

/** Rangga with four 4s, 21 against five 4s at 20, Kresna on the bench. */
const TWO = TWO_TEAM.arranged(
  [TWO_TEAM.team(0, ["Rangga", "Budi", "Citra", "Dewi", "Eka"]), TWO_TEAM.team(1, ["Fajar", "Gita", "Hana", "Irfan", "Joko"])],
  ["Kresna"],
);
/** Nobody out at all, so there is no bench to argue about. */
const FULL = TWO_TEAM.arranged([
  TWO_TEAM.team(0, ["Rangga", "Budi", "Citra", "Dewi", "Eka"]),
  TWO_TEAM.team(1, ["Fajar", "Gita", "Hana", "Irfan", "Joko", "Kresna"]),
]);
/** Even at 4.0 and 4.0 with the two weakest in the room on the bench. */
const EVEN = TWO_TEAM.arranged(
  [TWO_TEAM.team(0, ["Budi", "Citra", "Dewi", "Eka", "Fajar"]), TWO_TEAM.team(1, ["Gita", "Hana", "Irfan", "Joko", "Kresna"])],
  ["Lina", "Miko"],
);
/** The strongest player in the room is the one on the bench, at a real 0.4. */
const BEST_ON_BENCH = TWO_TEAM.arranged(
  [TWO_TEAM.team(0, ["Budi", "Citra"]), TWO_TEAM.team(1, ["Dewi", "Eka", "Fajar", "Gita", "Hana", "Irfan", "Joko", "Kresna", "Lina", "Miko"])],
  ["Rangga"],
);
/** The failure state: no teams at all. */
const NO_TEAMS: SplitResult = { teams: [], gap: 0, flags: [], unassigned: [], solver: { optimal: true, nodesExplored: 0, elapsedMs: 0 } };

/**
 * Sixteen for the 3+ readout: Rangga at 5, six 4s and nine 3s. The fifteen who
 * play sum to 53, which does not divide by three, and 17 against 18 against 18
 * is the best available: gap 0.2. Take Rangga out and fifteen players fill
 * three teams of five outright, and 4+4+3+3+3 is 17 three times over: gap 0.0.
 * Oscar is the leftover, being last in the name tie-break among the nine 3s.
 */
const THREE_TEAM = squad([
  ["Rangga", 5],
  ["Adi", 4],
  ["Bayu", 4],
  ["Cahya", 4],
  ["Dimas", 4],
  ["Eko", 4],
  ["Fajar", 4],
  ["Galih", 3],
  ["Hendra", 3],
  ["Indra", 3],
  ["Joko", 3],
  ["Krisna", 3],
  ["Lukman", 3],
  ["Maia", 3],
  ["Nanda", 3],
  ["Oscar", 3],
]);
const THREE = THREE_TEAM.arranged(
  [
    THREE_TEAM.team(0, ["Adi", "Bayu", "Galih", "Hendra", "Indra"]), // 17
    THREE_TEAM.team(1, ["Cahya", "Dimas", "Eko", "Joko", "Krisna"]), // 18
    THREE_TEAM.team(2, ["Rangga", "Fajar", "Lukman", "Maia", "Nanda"]), // 18
  ],
  ["Oscar"],
);

describe("the bench advisory on the split screen", () => {
  it("speaks under the 2-team readout, beside the gap and not inside it", () => {
    const html = TWO_TEAM.screen(TWO);
    expect(html).toContain("scale");
    // This result is stamped proven, which is the strongest claim the module
    // can make about the figure the sentence scopes.
    expect(line(html)).toBe(
      "Gap 0.2 is the closest these 10 players come in 2 teams of 5, each covering every role. Rangga sitting out instead of Kresna would bring the gap to 0.0.",
    );
    // `.readout` carries the gap's own provenance and is pinned as exact text
    // by `e2e/tests/split/gap-provenance.spec.ts`. The advisory is a sibling of
    // it, never a child: a second voice inside the readout would break those
    // cells and merge two claims that must stay separable.
    const readout = /<div class="readout">([\s\S]*?)<\/div>/.exec(html)?.[1] ?? "";
    expect(readout).toContain("Gap 0.2.");
    expect(readout).not.toContain("sitting out");
    expect(readout).not.toContain("closest the 10");
    // And it cannot be read as part of the figure itself: the readout holds no
    // paragraph at all. Its number is the only thing in there, in the display
    // face, and the advisory is a whole sentence in the 13px body face the
    // fairness line already uses, in its own element. The first clause quotes
    // "Gap 0.2" on purpose, so this is the assertion that keeps the quote from
    // turning into an edit of the readout.
    expect(readout).not.toContain("<p");
    expect(html.indexOf("</div>")).toBeLessThan(html.indexOf('class="bench-advice"'));
  });

  it("speaks under the 3+ readout too, in the same words", () => {
    // The 3+ site renders its own `.readout` and no GapMeter, so the advisory
    // has to be mounted there separately. Same module, same inputs, same
    // sentence: the two readouts are the same situation in two frames.
    const html = THREE_TEAM.screen(THREE);
    expect(html).toContain("team-stack");
    expect(html).not.toContain('class="scale"');
    expect(line(html)).toBe(
      "Gap 0.2 is the closest these 15 players come in 3 teams of 5, each covering every role. Rangga sitting out instead of Oscar would bring the gap to 0.0.",
    );
  });

  it("hedges the scope when the search was not proven", () => {
    // A re-roll stamps `optimal: false` (`solver.ts:685`) and can still leave a
    // real gap, and `gapProvenance` is the one place that decides what the app
    // may claim about a search's completeness, so the wording follows it.
    const rolled = TWO_TEAM.arranged(
      [TWO_TEAM.team(0, ["Rangga", "Budi", "Citra", "Dewi", "Eka"]), TWO_TEAM.team(1, ["Fajar", "Gita", "Hana", "Irfan", "Joko"])],
      ["Kresna"],
      false,
    );
    expect(line(TWO_TEAM.screen(rolled))).toBe(
      "Gap 0.2 is the best split found for these 10 players in 2 teams of 5, each covering every role. Rangga sitting out instead of Kresna would bring the gap to 0.0.",
    );
  });

  it("renders one line per screen, and none at all where there is nothing to say", () => {
    // A second line would double the same two sentences, and a line on the
    // empty state would advise about a result the screen is already calling a
    // failure. The three silences a reader meets most are a split that is
    // already even, a split with nobody on the bench, and a bench that holds
    // the strongest player in the room.
    expect(TWO_TEAM.screen(TWO).match(/class="bench-advice"/g)).toHaveLength(1);
    expect(THREE_TEAM.screen(THREE).match(/class="bench-advice"/g)).toHaveLength(1);
    expect(line(TWO_TEAM.screen(EVEN))).toBeNull();
    expect(line(TWO_TEAM.screen(FULL))).toBeNull();
    expect(line(TWO_TEAM.screen(BEST_ON_BENCH))).toBeNull();
    expect(line(TWO_TEAM.screen(NO_TEAMS))).toBeNull();
    // Each silence is the one it claims: an even split, a full bench, the
    // bound, and a result with no teams.
    expect(EVEN.gap).toBe(0);
    expect(EVEN.unassigned).toHaveLength(2);
    expect(FULL.unassigned).toHaveLength(0);
    expect(BEST_ON_BENCH.gap).toBeCloseTo(0.4, 10);
    expect(BEST_ON_BENCH.unassigned).toEqual(["p1"]);
  });

  it("prints a sentence neither copy guard allows past", () => {
    // `SAFETY_BAN` is the shared guard from `src/test-support/safetyCopy.ts`,
    // and `src/emDash.test.ts` sweeps every string literal under `src/` for the
    // em-dash and its entity forms, which includes `benchAdviceLine`. Asserted
    // on the rendered text as well, so a reword fails where a reader sees it.
    const text = line(TWO_TEAM.screen(TWO))!;
    expect(text).not.toMatch(SAFETY_BAN);
    expect(text).not.toMatch(/—|&mdash;|&#8212;|&#x2014;/i);
    // The advisory does not tell the organizer what to do. It names a player,
    // it quotes two numbers, and it stops: the roster they picked is the pool,
    // and dropping their best player is their call, not the metric's.
    expect(text).not.toMatch(/\b(you|your|should|could|try|consider|recommend|worth|why not)\b/i);
    expect(text.split(". ")).toHaveLength(2);
  });

  it("leaves the fairness line and the flags exactly where they were", () => {
    // The mount is additive: the advisory sits after the fairness line, in a
    // paragraph of its own class, and nothing about the line above it or the
    // referee's flags may move.
    const html = TWO_TEAM.screen(TWO);
    expect(html.match(/class="fairness"/g)).toHaveLength(1);
    expect(html.indexOf('class="fairness"')).toBeLessThan(html.indexOf('class="bench-advice"'));
    // The bench the app already reported is still reported by the app, in the
    // fairness line and in the flags list, exactly as before.
    expect(html).toContain("Not playing: Kresna");
  });
});
