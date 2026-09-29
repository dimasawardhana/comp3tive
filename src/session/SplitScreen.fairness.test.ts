/**
 * D37 wiring: the split screen explains itself under both readouts.
 *
 * Rendered with `react-dom/server`, the way `SplitScreen.share.test.ts` renders
 * the same component: no jsdom, no canvas, no browser. That is enough to see
 * what a reader sees, which is all the wiring claims here are about, and it
 * runs in the `node` suite. The browser-facing half — that the line is styled
 * and legible in the app and on the Landing Page's hero — is
 * `e2e/tests/split/fairness.spec.ts`.
 *
 * Every expected string here is arithmetic done by hand over
 * `FUTSAL_DISCIPLINE`'s `mean` strength model (the mean of technical, fitness
 * and game IQ), never the output of `explainFairness` itself: asserting the
 * render against the module that produced it would pass for any wiring at all.
 */
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SplitScreen } from "./SplitScreen";
import { recomputeResult } from "./edit";
import { FUTSAL_DISCIPLINE } from "../domain/seed";
import type { Player, Session, SplitResult, TeamAssignment } from "../domain/types";

const ROLES = ["goalkeeper", "defender", "winger", "pivot"];

/** Ratings, not strengths: the mean of the three futsal attributes is the strength. */
const RATED: [name: string, technical: number, fitness: number, iq: number][] = [
  ["Andi", 5, 5, 5], // 5.0
  ["Budi", 4, 4, 4], // 4.0
  ["Citra", 3, 3, 3], // 3.0
  ["Dewi", 2, 2, 2], // 2.0
  ["Eka", 1, 1, 1], // 1.0
  ["Fajar", 5, 5, 5], // 5.0
  ["Gita", 5, 5, 5], // 5.0
  ["Hana", 4, 4, 4], // 4.0
  ["Irfan", 4, 4, 4], // 4.0
  ["Joko", 3, 3, 3], // 3.0
  ["Kris", 5, 5, 5], // 5.0
  ["Lina", 4, 4, 4], // 4.0
  ["Mira", 3, 3, 3], // 3.0
  ["Nino", 2, 2, 2], // 2.0
  ["Omar", 1, 1, 1], // 1.0
];

const ROSTER: Player[] = RATED.map(([name, technical, fitness, iq], i) => ({
  id: `p${i + 1}`,
  communityId: "c1",
  name,
  capabilities: [
    {
      disciplineId: FUTSAL_DISCIPLINE.id,
      attributeRatings: { technical, fitness, "game-iq": iq },
      eligibleRoles: ROLES,
      preferredRole: null,
    },
  ],
}));

const team = (index: number, names: readonly string[]): TeamAssignment => ({
  index,
  slots: names.map((name) => ({
    playerId: ROSTER.find((p) => p.name === name)!.id,
    roleId: null,
  })),
  totalStrength: 0,
  avgStrength: 0,
});

/** `recomputeResult` is what stamps totals, averages, gap and flags, so the numbers the line reads are the ones the app would show. */
const arranged = (teams: TeamAssignment[], unassigned: string[] = []): SplitResult =>
  recomputeResult(
    teams,
    FUTSAL_DISCIPLINE,
    unassigned.map((name) => ROSTER.find((p) => p.name === name)!.id),
    ROSTER,
  );

/** 5+4+3+2+1 = 3.0 and 5+5+4+4+3 = 4.2, so the band is 3.0 to 4.2. */
const WEAK = ["Andi", "Budi", "Citra", "Dewi", "Eka"];
const STRONG = ["Fajar", "Gita", "Hana", "Irfan", "Joko"];
/** The same 3.0 as WEAK, and the index tiebreak picks WEAK's team as the low side. */
const EVEN = ["Kris", "Lina", "Mira", "Nino", "Omar"];

const TWO_UNEVEN = arranged([team(0, WEAK), team(1, STRONG)]);
const TWO_EVEN = arranged([team(0, WEAK), team(1, EVEN)]);
const TWO_WITH_SITOUT = arranged([team(0, WEAK), team(1, STRONG)], ["Lina", "Mira"]);
const THREE = arranged([team(0, WEAK), team(1, STRONG), team(2, EVEN)]);

/** What an empty pool produces, and what a partial role cover produces: the "Solver failed" state. */
const NO_TEAMS: SplitResult = {
  teams: [],
  gap: 0,
  flags: [],
  unassigned: [],
  solver: { optimal: true, nodesExplored: 0, elapsedMs: 0 },
};
const ONE_TEAM = arranged([team(0, WEAK)], ["Fajar", "Gita", "Hana", "Irfan", "Joko"]);

const session = (result: SplitResult): Session => ({
  id: "s1",
  communityId: "c1",
  disciplineId: FUTSAL_DISCIPLINE.id,
  createdAt: 0,
  poolPlayerIds: ROSTER.map((p) => p.id),
  settings: { teamCount: result.teams.length },
  result,
});

const screen = (result: SplitResult) =>
  renderToStaticMarkup(
    createElement(SplitScreen, {
      session: session(result),
      discipline: FUTSAL_DISCIPLINE,
      roster: ROSTER,
      onPersistResult: async () => {},
      source: "ad-hoc",
    }),
  );

/** The line's own text: no tags, entities decoded, whitespace collapsed. */
const line = (html: string): string | null => {
  const found = /<p class="fairness">([\s\S]*?)<\/p>/.exec(html);
  if (!found || found[1] === undefined) return null;
  return found[1]
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
};

describe("the fairness line on the split screen", () => {
  it("explains the split under the 2-team readout, beside the gap and not inside it", () => {
    // The 2-team site is the `GapMeter` fragment, which also draws `.scale`.
    const html = screen(TWO_UNEVEN);
    expect(html).toContain("scale");
    expect(line(html)).toBe(
      "Every team averages 3.0 to 4.2. Fajar (5.0) is Team B's best; Eka (1.0) is Team A's weakest.",
    );
    // `.readout` carries the gap's provenance verdict and is pinned as exact
    // text by `e2e/tests/split/gap-provenance.spec.ts`. The explanation is a
    // sibling of it, never a child: a second voice inside the readout would
    // break those four cells and merge two claims that must stay separable.
    const readout = /<div class="readout">([\s\S]*?)<\/div>/.exec(html)?.[1] ?? "";
    expect(readout).not.toContain("Every team averages");
    expect(readout).toContain("Gap 1.2.");
  });

  it("explains the split under the 3+ readout too, in the same words", () => {
    // The 3+ site renders its own `.readout` and no GapMeter, so the line has
    // to be mounted there separately. Same module, same inputs, same sentence:
    // the two readouts are the same situation (a split with two or more teams)
    // in two different frames, and the only screen with no line is the empty
    // state, which has no teams to explain.
    const html = screen(THREE);
    expect(html).toContain("team-stack");
    expect(html).not.toContain("class=\"scale\"");
    expect(line(html)).toBe(
      "Every team averages 3.0 to 4.2. Fajar (5.0) is Team B's best; Eka (1.0) is Team A's weakest.",
    );
  });

  it("renders one line per screen, and none at all on the failure state", () => {
    // A second line would double the same two sentences; a line on the empty
    // state would explain a result the screen is already calling a failure.
    expect(screen(TWO_UNEVEN).match(/class="fairness"/g)).toHaveLength(1);
    expect(screen(THREE).match(/class="fairness"/g)).toHaveLength(1);
    expect(line(screen(NO_TEAMS))).toBeNull();
    expect(line(screen(ONE_TEAM))).toBeNull();
  });

  it("prints one sentence and no sides on an even split", () => {
    // Both teams average 3.0. There is no higher side and no lower one, so
    // there is no trade to describe, and the band has already said the whole
    // thing in one number. Fails if the empty `trade` is filled in with a
    // careful sentence: `Kris (5.0) is Team B's best; Eka (1.0) is Team A's
    // weakest.` names a "best" and a "weakest" across a distinction that is
    // not in the result.
    const text = line(screen(TWO_EVEN));
    expect(text).toBe("Every team averages 3.0.");
    expect(text).not.toContain("is Team");
    expect(screen(TWO_EVEN)).not.toContain("Eka (1.0)");
  });

  it("leaves the not-playing list unpunctuated, as the other three surfaces print it", () => {
    // The clause is lifted whole from `teamsAsText` (src/share/share-text.ts:83)
    // and the poster, and a full stop after the list would print `?.` for a
    // stale id. The line is unpunctuated after the list, and the sentence that
    // follows it starts with the trade, not with a second stop.
    const text = line(screen(TWO_WITH_SITOUT));
    expect(text).toContain("Every team averages 3.0 to 4.2. Not playing: Lina, Mira");
    expect(text).not.toContain("Mira.");
    expect(text).not.toContain("?.");
    expect(text).toContain("Not playing: Lina, Mira Fajar (5.0) is Team B's best;");
  });
});
