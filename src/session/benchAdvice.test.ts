/**
 * The bench advisory: the one case it speaks for, and every case it must not.
 *
 * Every expected number below is arithmetic done by hand over the ratings in
 * the fixture, never the output of `benchAdvice` itself. Asserting the module
 * against the solver it already called would pass for any wiring at all, and
 * this module's whole value is that its numbers can be checked without it.
 *
 * The pools are Mobile Legends because that is the only shipped discipline the
 * advisory can fire on at all, and for a reason worth recording: futsal sizes
 * its teams from the pool (`solver.ts:477-481`), so its capacity is always at
 * least the pool and it never has a leftover to advise about. A leftover needs
 * a hard `maxTeamSize` that the pool overflows.
 */
import { describe, expect, it } from "vitest";
import futsalRoster from "../../sample-data/futsal-roster.json";
import mlbbRoster from "../../sample-data/mpl-id-roster.json";
import badmintonRoster from "../../sample-data/badminton-roster.json";
import { benchAdvice, benchAdviceLine } from "./benchAdvice";
import { recomputeResult } from "./edit";
import { buildSettings, fairSplit, poolFromPlayers, suggestTeamCount } from "../solver/solver";
import { BADMINTON_DISCIPLINE, FUTSAL_DISCIPLINE, MLBB_DISCIPLINE } from "../domain/seed";
import { SAFETY_BAN } from "../test-support/safetyCopy";
import type { Discipline, Player, SplitResult, TeamAssignment } from "../domain/types";

/** The v1 backup shape the three sample files hold. Only `players` is read. */
interface SampleBackup {
  players: Player[];
}

const FUTSAL_SAMPLE = futsalRoster as unknown as SampleBackup;
const MLBB_SAMPLE = mlbbRoster as unknown as SampleBackup;
const BADMINTON_SAMPLE = badmintonRoster as unknown as SampleBackup;

/** Ratings, not strengths: MLBB strength is the mean of its four attributes. */
const mlbbPlayer = (name: string, rating: number): Player => ({
  id: name,
  communityId: "c1",
  name,
  capabilities: [
    {
      disciplineId: MLBB_DISCIPLINE.id,
      attributeRatings: { mechanics: rating, "game-sense": rating, "hero-pool": rating, teamwork: rating },
      // Every role to everyone: this is about strength, and a role shortfall
      // would move the gap for a reason that has nothing to do with the bench.
      eligibleRoles: MLBB_DISCIPLINE.roles.map((r) => r.id),
      preferredRole: null,
    },
  ],
});

const futsalPlayer = (name: string, rating: number): Player => ({
  id: name,
  communityId: "c1",
  name,
  capabilities: [
    {
      disciplineId: FUTSAL_DISCIPLINE.id,
      attributeRatings: { technical: rating, fitness: rating, "game-iq": rating },
      eligibleRoles: FUTSAL_DISCIPLINE.roles.map((r) => r.id),
      preferredRole: null,
    },
  ],
});

const split = (players: Player[], discipline: Discipline, teamCount: number): SplitResult =>
  fairSplit(poolFromPlayers(players, discipline), discipline, buildSettings(discipline, teamCount));

const placed = (result: SplitResult): string[] =>
  result.teams.flatMap((t) => t.slots.map((s) => s.playerId));

/** The gap as the screen prints it, which is how every assertion here reads it. */
const printed = (gap: number): string => gap.toFixed(1);

/**
 * Every player in a result, by id and strength. `poolFromPlayers` is the
 * shipped computation, so the numbers the invariants below are checked against
 * are the ones the solver used.
 */
const strengthsOf = (players: Player[], discipline: Discipline): Map<string, number> =>
  new Map(poolFromPlayers(players, discipline).map((p) => [p.playerId, p.strength]));

/**
 * The module's sweep with the strength bound and the call cap both removed: the
 * control they are measured against. It re-derives nothing and reuses the
 * shipped `fairSplit`, so the only thing it changes is which candidates get
 * considered.
 */
const unbounded = (result: SplitResult, players: Player[], discipline: Discipline): string[] => {
  const everyone = new Set([...placed(result), ...result.unassigned]);
  const pool = poolFromPlayers(players.filter((p) => everyone.has(p.id)), discipline);
  const settings = buildSettings(discipline, result.teams.length);
  const found: string[] = [];
  for (const id of placed(result)) {
    const alternative = fairSplit(pool.filter((p) => p.playerId !== id), discipline, settings);
    if (alternative.teams.length !== result.teams.length) continue;
    if (Number(printed(alternative.gap)) < Number(printed(result.gap))) found.push(id);
  }
  return found;
};

/** The line, given one result. `null` when the module has nothing to say. */
const say = (result: SplitResult, discipline: Discipline, roster: Player[]): string | null => {
  const advice = benchAdvice({ result, discipline, roster });
  return advice === null ? null : benchAdviceLine(advice, { result, discipline, roster });
};

/**
 * One standout at 5 against a field of ten at 4. Two teams of five hold ten,
 * so the eleventh sits out, and the leftover is the weakest: Kresna, last in
 * the name tie-break. The ten who play carry a 5 and nine 4s, so the closest
 * any two teams of five come is 21 against 20, a gap of 0.2. Take the 5 out and
 * the remaining ten are all 4, which split 20 against 20: gap 0.0.
 *
 * This is the finding, in one pool.
 */
const OUTSTAND_FIELD = ["Budi", "Citra", "Dewi", "Eka", "Fajar", "Gita", "Hana", "Irfan", "Joko", "Kresna"];
const OUTSTAND: Player[] = [mlbbPlayer("Rangga", 5), ...OUTSTAND_FIELD.map((n) => mlbbPlayer(n, 4))];
const OUTSTAND_RESULT = split(OUTSTAND, MLBB_DISCIPLINE, 2);

/**
 * Five at 4, five at 2, one at 1: a pool that improves without ever reaching
 * zero. The ten who play sum to 30, and every five-player split of them sums
 * to an even number, so 15 is out of reach and the best is 14 against 16: a
 * gap of 0.4. Drop any of the 4s and the ten are 4,4,4,4,2,2,2,2,2,1, which
 * sums to 27 and splits 13 against 14: gap 0.2.
 */
const PARTIAL: Player[] = [
  ...["A1", "A2", "A3", "A4", "A5"].map((n) => mlbbPlayer(n, 4)),
  ...["B1", "B2", "B3", "B4", "B5"].map((n) => mlbbPlayer(n, 2)),
  mlbbPlayer("Z9", 1),
];
const PARTIAL_RESULT = split(PARTIAL, MLBB_DISCIPLINE, 2);

/**
 * A leftover that survives the swap, which is the case the `insteadOf` list is
 * for. Twelve players, two teams of five: Rangga at 4, Sari at 3, two at 2 and
 * eight at 1. The ten who play are 4,3,2,2 and six 1s, summing to 17, and 17
 * cannot be halved, so the best is 8 against 9: gap 0.2. Take Rangga out and
 * the ten are 3,2,2 and seven 1s, summing to 14, which splits 7 against 7:
 * gap 0.0. The bench was the last two 1s by name, Yoga and Zaki, and with
 * Rangga gone only Zaki is still out, so the sentence may name Yoga and must
 * not imply that nobody is sitting out any more.
 */
const RESIDUAL: Player[] = [
  mlbbPlayer("Rangga", 4),
  mlbbPlayer("Sari", 3),
  mlbbPlayer("Tomi", 2),
  mlbbPlayer("Umar", 2),
  ...["Vino", "Wati", "Yoga", "Zaki", "Andi", "Bela", "Candra", "Dewi"].map((n) => mlbbPlayer(n, 1)),
];
const RESIDUAL_RESULT = split(RESIDUAL, MLBB_DISCIPLINE, 2);

/**
 * Five at 5, one at 4, five at 3, one at 1. The ten who play are 5,5,5,5,5,4
 * and four 3s, summing to 41, which cannot be halved: 5+5+4+3+3 is 20 against
 * 5+5+5+3+3 at 21, so gap 0.2. And there is nothing better available from any
 * other bench: dropping a 5 or a 3 leaves the same 0.2, and dropping the 4
 * makes it worse at 0.4. This is the ticket's second case, the strong form of
 * it: the solver's bench is already the best one, at a gap that is not zero.
 */
const CROWDED: Player[] = [
  ...["S1", "S2", "S3", "S4", "S5"].map((n) => mlbbPlayer(n, 5)),
  mlbbPlayer("M1", 4),
  ...["W1", "W2", "W3", "W4", "W5"].map((n) => mlbbPlayer(n, 3)),
  mlbbPlayer("Z9", 1),
];
const CROWDED_RESULT = split(CROWDED, MLBB_DISCIPLINE, 2);

/**
 * The pool the call cap costs an answer on. Six at 3, one at 2, five at 1: the
 * ten who play are six 3s, a 2 and three 1s, summing to 23, which cannot be
 * halved either, and 3+3+3+1+1 at 11 against 3+3+2+1+1 at 12 is gap 0.2.
 *
 * The one player whose absence evenest this is the 2, and it is neither the
 * strongest nor the weakest: taking the 2 out leaves six 3s and four 1s, 22,
 * which is 11 and 11. Every 3 is useless here, and the four strongest
 * candidates are all 3s, so the cut falls above the answer. That is the cap's
 * bill, stated exactly rather than assumed: this pool is silent with it and
 * would speak without it.
 */
const BELOW_THE_CUT: Player[] = [
  ...["R1", "R2", "R3", "R4", "R5", "R6"].map((n) => mlbbPlayer(n, 3)),
  mlbbPlayer("Q1", 2),
  ...["P1", "P2", "P3", "P4", "P5"].map((n) => mlbbPlayer(n, 1)),
];
const BELOW_THE_CUT_RESULT = split(BELOW_THE_CUT, MLBB_DISCIPLINE, 2);

describe("the bench advisory", () => {
  it("names the one player whose absence would have evened these teams", () => {
    // The fixture is only worth asserting against if it is the case it claims.
    expect(printed(OUTSTAND_RESULT.gap)).toBe("0.2");
    expect(OUTSTAND_RESULT.unassigned).toEqual(["Kresna"]);
    expect(OUTSTAND_RESULT.solver.optimal).toBe(true);
    // The one flag is the bench itself (`solver.ts:678`), which is the app
    // telling the reader the same thing this advisory is.
    expect(OUTSTAND_RESULT.flags).toEqual([{ kind: "leftover", playerId: "Kresna" }]);

    expect(benchAdvice({ result: OUTSTAND_RESULT, discipline: MLBB_DISCIPLINE, roster: OUTSTAND })).toEqual({
      sitOutInstead: "Rangga",
      // Kresna plays in the alternative: ten players fill two teams of five
      // outright, so the alternative has nobody out at all and every one of the
      // current bench is given a game back.
      insteadOf: ["Kresna"],
      gapNow: OUTSTAND_RESULT.gap,
      gapInstead: 0,
    });
  });

  it("states the scope of the gap, the name, and the number, and then stops", () => {
    expect(say(OUTSTAND_RESULT, MLBB_DISCIPLINE, OUTSTAND)).toBe(
      "Gap 0.2 is the closest the 10 players on these teams can be split. Rangga sitting out instead of Kresna would bring the gap to 0.0.",
    );
  });

  it("claims no more about the figure it scopes than the search proved", () => {
    // The first clause is a claim about the ten on the teams, so it is checked
    // against the ten on the teams: every way of picking five of them, done
    // here rather than asked of the solver. 21 against 20 is the best of the
    // 252 splits, which is the 0.2 the readout prints.
    const field = OUTSTAND.filter((p) => p.id !== "Kresna");
    expect(field).toHaveLength(10);
    const strength = (id: string) => field.find((p) => p.id === id)!.capabilities[0]!.attributeRatings.mechanics;
    const total = field.reduce((s, p) => s + strength(p.id), 0);
    let best = Infinity;
    for (let mask = 0; mask < 1 << field.length; mask++) {
      const a = field.filter((_, i) => mask & (1 << i));
      if (a.length !== 5) continue;
      const sumA = a.reduce((s, p) => s + strength(p.id), 0);
      best = Math.min(best, Math.abs(sumA - (total - sumA)) / 5);
    }
    expect(best).toBe(0.2);
    expect(OUTSTAND_RESULT.gap).toBeCloseTo(best, 10);

    // And the advisory changes nothing: the teams on screen are the ones the
    // solver produced, gap and all. It is a sentence, not an action.
    const before = JSON.stringify(OUTSTAND_RESULT);
    say(OUTSTAND_RESULT, MLBB_DISCIPLINE, OUTSTAND);
    expect(JSON.stringify(OUTSTAND_RESULT)).toBe(before);
  });

  it("hides nothing: the strength bound keeps every answer the sweep would have found", () => {
    // The bound is a direction argument, not a theorem, so it is measured. On
    // every pool where the advisory speaks, the player it names is one the
    // unbounded sweep would also have tried and found.
    for (const [players, result] of [
      [OUTSTAND, OUTSTAND_RESULT],
      [PARTIAL, PARTIAL_RESULT],
      [RESIDUAL, RESIDUAL_RESULT],
    ] as const) {
      const advice = benchAdvice({ result, discipline: MLBB_DISCIPLINE, roster: players });
      expect(advice, "this pool is expected to speak").not.toBeNull();
      expect(unbounded(result, players, MLBB_DISCIPLINE)).toContain(advice!.sitOutInstead);
    }
  });

  it("quotes the gap at the precision the screen prints, and never calls it even", () => {
    // The case that makes "would even them" a lie. The gap improves and stops
    // at 0.2, so the sentence quotes 0.2 and says nothing about evening.
    const advice = benchAdvice({ result: PARTIAL_RESULT, discipline: MLBB_DISCIPLINE, roster: PARTIAL });
    expect(printed(advice!.gapNow)).toBe("0.4");
    expect(printed(advice!.gapInstead)).toBe("0.2");
    const line = benchAdviceLine(advice!, { result: PARTIAL_RESULT, discipline: MLBB_DISCIPLINE, roster: PARTIAL });
    expect(line).toBe(
      "Gap 0.4 is the closest the 10 players on these teams can be split. A1 sitting out instead of Z9 would bring the gap to 0.2.",
    );
    expect(line).not.toMatch(/even|perfect|level|tie/i);
  });

  it("hedges the scope when the search did not run to completion", () => {
    // `gapProvenance` owns what the app may claim about a search's
    // completeness, so the scope clause changes with it and nowhere else. A
    // re-roll stamps `optimal: false` (`solver.ts:685`) and can still leave a
    // real gap, which is the arrangement this wording is for.
    const rolled = { ...OUTSTAND_RESULT, solver: { optimal: false, nodesExplored: 0, elapsedMs: 0 } };
    expect(say(rolled, MLBB_DISCIPLINE, OUTSTAND)).toBe(
      "Gap 0.2 is the best split found for the 10 players on these teams. Rangga sitting out instead of Kresna would bring the gap to 0.0.",
    );
  });

  it("names only the players the swap actually gives a game, and no more", () => {
    // The alternative still has somebody on the bench, so "instead of" may name
    // the one who now plays and must not imply the bench is empty.
    const advice = benchAdvice({ result: RESIDUAL_RESULT, discipline: MLBB_DISCIPLINE, roster: RESIDUAL });
    expect(printed(RESIDUAL_RESULT.gap)).toBe("0.2");
    expect(RESIDUAL_RESULT.unassigned).toEqual(["Yoga", "Zaki"]);
    expect(advice).toEqual({
      sitOutInstead: "Rangga",
      insteadOf: ["Yoga"],
      gapNow: RESIDUAL_RESULT.gap,
      gapInstead: 0,
    });
    expect(say(RESIDUAL_RESULT, MLBB_DISCIPLINE, RESIDUAL)).toBe(
      "Gap 0.2 is the closest the 10 players on these teams can be split. Rangga sitting out instead of Yoga would bring the gap to 0.0.",
    );
    // The alternative is what the field is derived from, so the field cannot
    // name somebody the alternative left out.
    const alternative = split(RESIDUAL.filter((p) => p.id !== "Rangga"), MLBB_DISCIPLINE, 2);
    expect(alternative.unassigned).toEqual(["Zaki"]);
  });
});

describe("what the bench advisory keeps quiet about", () => {
  it("stays silent on every shipped roster, at every team count that fits", () => {
    // The measurement said it would be quiet here, and quiet is the property
    // worth pinning: nine configurations across the three rosters, and not one
    // of them has a leftover another bench choice would have beaten.
    const rosters: [string, Player[], Discipline][] = [
      ["futsal-roster.json", FUTSAL_SAMPLE.players, FUTSAL_DISCIPLINE],
      ["mpl-id-roster.json", MLBB_SAMPLE.players, MLBB_DISCIPLINE],
      ["badminton-roster.json", BADMINTON_SAMPLE.players, BADMINTON_DISCIPLINE],
    ];
    let configurations = 0;
    for (const [fileName, players, discipline] of rosters) {
      for (const teamCount of [2, 3, 4]) {
        const result = split(players, discipline, teamCount);
        if (result.teams.length !== teamCount) continue;
        configurations++;
        expect(benchAdvice({ result, discipline, roster: players }), `${fileName} at ${teamCount} teams`).toBeNull();
      }
    }
    // All nine of the configurations the finding measured, so the loop above
    // cannot quietly stop covering them.
    expect(configurations).toBe(9);
  });

  it("stays silent when nobody is sitting out", () => {
    // Ten futsal players at 5,5,5,5,4,4,4,3,3,1. The two teams of five sum to
    // 39 between them, so they come out 19 against 20, a gap of 0.2, and there
    // is no leftover to argue about. Futsal sizes its teams from the pool, so
    // this is not a corner case: it is every futsal split there is.
    const ratings = [5, 5, 5, 5, 4, 4, 4, 3, 3, 1];
    const players = ratings.map((r, i) => futsalPlayer(`F${i + 1}`, r));
    const result = split(players, FUTSAL_DISCIPLINE, 2);
    expect(printed(result.gap)).toBe("0.2");
    expect(result.unassigned).toEqual([]);
    expect(benchAdvice({ result, discipline: FUTSAL_DISCIPLINE, roster: players })).toBeNull();
  });

  it("stays silent when the gap already reads 0.0, and not on the bound's account", () => {
    // Twelve players: two 5s, six 4s, two 3s and two 1s. The ten who play are
    // the two 5s, the six 4s and one 3, summing to 40, and 5+5+4+3+3 is 20
    // against four 4s at 20, so the gap is 0.0. The two on the bench are the
    // two 1s, which leaves all ten on the teams above the strength bound, so
    // the bound has candidates and it is the zero that silences this. Written
    // this way on purpose: an earlier version of this case used eleven
    // identical players, where the bound would have said nothing anyway and the
    // test would have passed for the wrong reason.
    const players = [
      ...["R1", "R2"].map((n) => mlbbPlayer(n, 5)),
      ...["M1", "M2", "M3", "M4", "M5", "M6"].map((n) => mlbbPlayer(n, 4)),
      ...["L1", "L2"].map((n) => mlbbPlayer(n, 3)),
      ...["W1", "W2"].map((n) => mlbbPlayer(n, 1)),
    ];
    const result = split(players, MLBB_DISCIPLINE, 2);
    expect(printed(result.gap)).toBe("0.0");
    expect(result.unassigned).toHaveLength(2);
    const strength = strengthsOf(players, MLBB_DISCIPLINE);
    expect(Math.min(...result.unassigned.map((id) => strength.get(id)!))).toBe(1);
    expect(placed(result).every((id) => (strength.get(id) ?? 0) > 1)).toBe(true);
    expect(benchAdvice({ result, discipline: MLBB_DISCIPLINE, roster: players })).toBeNull();
  });

  it("stays silent when nobody on a team outranks the best player on the bench", () => {
    // The bound's own silence, and the one case where it hides a bench the
    // reader might have expected. A leftover stronger than everyone playing is
    // a real state (role coverage can force it), the gap is the largest on this
    // page, and there is nobody worth moving, so the screen says nothing.
    const roster = [
      mlbbPlayer("Rangga", 5),
      ...["A", "B", "C", "D", "E"].map((n) => mlbbPlayer(n, 4)),
      ...["F", "G", "H", "I", "J"].map((n) => mlbbPlayer(n, 2)),
    ];
    const teams: TeamAssignment[] = [
      { index: 0, slots: roster.slice(1, 6).map((p) => ({ playerId: p.id, roleId: null })), totalStrength: 0, avgStrength: 0 },
      { index: 1, slots: roster.slice(6, 11).map((p) => ({ playerId: p.id, roleId: null })), totalStrength: 0, avgStrength: 0 },
    ];
    const result = recomputeResult(teams, MLBB_DISCIPLINE, ["Rangga"], roster);
    expect(printed(result.gap)).toBe("2.0");
    expect(result.unassigned).toEqual(["Rangga"]);
    expect(benchAdvice({ result, discipline: MLBB_DISCIPLINE, roster })).toBeNull();
  });

  it("stays silent on the shapes with no gap to advise about", () => {
    const roster = OUTSTAND;
    const oneTeam: TeamAssignment[] = [
      { index: 0, slots: roster.slice(0, 5).map((p) => ({ playerId: p.id, roleId: null })), totalStrength: 0, avgStrength: 0 },
    ];
    // One team: there is no second average to be apart from, and the screen
    // shows its own empty state rather than a gap.
    expect(
      benchAdvice({ result: recomputeResult(oneTeam, MLBB_DISCIPLINE, [], roster), discipline: MLBB_DISCIPLINE, roster }),
    ).toBeNull();
    // Nobody at all, which is what a degenerate role pool produces.
    const nothing: SplitResult = {
      teams: [],
      gap: 0,
      flags: [],
      unassigned: [],
      solver: { optimal: true, nodesExplored: 0, elapsedMs: 0 },
    };
    expect(benchAdvice({ result: nothing, discipline: MLBB_DISCIPLINE, roster })).toBeNull();
  });

  it("stays silent rather than advise about a pool it cannot rebuild", () => {
    // An id the roster does not hold. The advisory rebuilds the pool from the
    // result, and a pool missing a player is not the pool the app split, so
    // every number it could print would be about a different set of people.
    const ghosted: SplitResult = { ...OUTSTAND_RESULT, unassigned: [...OUTSTAND_RESULT.unassigned, "p-ghost"] };
    expect(printed(OUTSTAND_RESULT.gap)).toBe("0.2");
    expect(benchAdvice({ result: ghosted, discipline: MLBB_DISCIPLINE, roster: OUTSTAND })).toBeNull();
    // A player with no rating in this discipline is the same hole from the
    // other side: the solver could not have placed them.
    const unrated = OUTSTAND.map((p) => (p.id === "Joko" ? { ...p, capabilities: [] } : p));
    expect(benchAdvice({ result: OUTSTAND_RESULT, discipline: MLBB_DISCIPLINE, roster: unrated })).toBeNull();
  });

  it("stays silent where the solver's bench is already the best of every bench choice", () => {
    // The ticket's second case, and not the trivial version of it: the gap is
    // 0.2, so "nothing could be better" is not a fact about zero. It is a fact
    // about this pool, and it is checked by running the sweep with no bound and
    // no cap over every player who could have been moved, which finds nobody.
    expect(printed(CROWDED_RESULT.gap)).toBe("0.2");
    expect(CROWDED_RESULT.unassigned).toHaveLength(2);
    expect(unbounded(CROWDED_RESULT, CROWDED, MLBB_DISCIPLINE)).toEqual([]);
    expect(benchAdvice({ result: CROWDED_RESULT, discipline: MLBB_DISCIPLINE, roster: CROWDED })).toBeNull();
  });

  it("stays silent on a pool whose answer sits below the call cap, and says what that cost", () => {
    // The cap's bill, measured rather than assumed. The answer exists and is
    // reachable, and the cap is the only reason it is not given: the four
    // strongest candidates are all useless here and the 2 that would have
    // worked is sixth.
    expect(printed(BELOW_THE_CUT_RESULT.gap)).toBe("0.2");
    expect(unbounded(BELOW_THE_CUT_RESULT, BELOW_THE_CUT, MLBB_DISCIPLINE)).toEqual(["Q1"]);
    expect(benchAdvice({ result: BELOW_THE_CUT_RESULT, discipline: MLBB_DISCIPLINE, roster: BELOW_THE_CUT })).toBeNull();
  });
});

describe("the bench advisory rests on one solver invariant", () => {
  it("the bench never holds anyone stronger than the weakest person playing", () => {
    // Both the strength bound and the scope sentence rest on this: the leftover
    // branch (`solver.ts:631`) is only reachable once every team is full, and
    // players are dealt strongest-first, so who sits out is the tail of the
    // order rather than a choice the search gets to make. If this ever fails,
    // the bound is looking in the wrong direction and "the closest these N
    // players can be split" is no longer a claim about the field on screen.
    const pools: [string, Player[], Discipline, number][] = [
      ["outstand", OUTSTAND, MLBB_DISCIPLINE, 2],
      ["partial", PARTIAL, MLBB_DISCIPLINE, 2],
      ["crowded", CROWDED, MLBB_DISCIPLINE, 2],
      ["below the cut", BELOW_THE_CUT, MLBB_DISCIPLINE, 2],
      ["badminton", BADMINTON_SAMPLE.players, BADMINTON_DISCIPLINE, 3],
      ["mlbb roster", MLBB_SAMPLE.players, MLBB_DISCIPLINE, 3],
    ];
    for (const [name, players, discipline, teamCount] of pools) {
      const result = split(players, discipline, teamCount);
      if (result.unassigned.length === 0) continue;
      const strength = strengthsOf(players, discipline);
      const weakestPlaying = Math.min(...placed(result).map((id) => strength.get(id)!));
      const strongestBenched = Math.max(...result.unassigned.map((id) => strength.get(id)!));
      expect(weakestPlaying, name).toBeGreaterThanOrEqual(strongestBenched);
    }
  });

  it("the bench is the tail of the order fairSplit deals in, ties included", () => {
    // The same fact read the way the search reads it. Asserted on strengths
    // rather than ids, because a tie is exactly why an id-ordered assertion
    // would be the wrong one to write: eight players in `RESIDUAL` are all at 1,
    // and which of them is left out is the name tie-break's business.
    const strength = strengthsOf(RESIDUAL, MLBB_DISCIPLINE);
    const ordered = [...strength.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const benched = ordered.slice(ordered.length - RESIDUAL_RESULT.unassigned.length).map(([id]) => id);
    expect(benched).toEqual(RESIDUAL_RESULT.unassigned);
  });
});

describe("the bench advisory's copy", () => {
  it("carries no word that would turn a measurement into a promise", () => {
    // `SAFETY_BAN` is the shared guard (`src/test-support/safetyCopy.ts`), and
    // the em-dash rule is held against every string literal under `src/` by
    // `src/emDash.test.ts`, which sweeps this module too. Both are asserted on
    // the sentences themselves, so a reword fails at the sentence rather than
    // only at the sweep.
    for (const [players, result] of [
      [OUTSTAND, OUTSTAND_RESULT],
      [PARTIAL, PARTIAL_RESULT],
      [RESIDUAL, RESIDUAL_RESULT],
    ] as const) {
      const line = say(result, MLBB_DISCIPLINE, players)!;
      expect(line).not.toMatch(SAFETY_BAN);
      expect(line).not.toMatch(/—|&mdash;|&#8212;|&#x2014;/i);
      // And it does not tell the organizer what to do. No imperative, no
      // suggestion, no second number to weigh: the roster they picked is the
      // pool, and dropping their best player to win a displayed number is their
      // call, not the metric's.
      expect(line).not.toMatch(/\b(you|your|should|could|try|consider|recommend|worth|why not|fairest|best of)\b/i);
    }
  });

  it("names the player once and quotes the gap, and says nothing else", () => {
    const line = say(OUTSTAND_RESULT, MLBB_DISCIPLINE, OUTSTAND)!;
    expect(line.match(/Rangga/g)).toHaveLength(1);
    // Both figures are quoted at the screen's precision, so the two numbers a
    // reader compares are the two the readout would print.
    expect(line).toContain("Gap 0.2");
    expect(line).toContain("0.0");
    // The only numbers in the sentence are the two gaps and the count of
    // players the first clause is about.
    expect(line.match(/\d+(\.\d+)?/g)).toEqual(["0.2", "10", "0.0"]);
  });
});

describe("the shipped rosters stay exactly as they were", () => {
  it("still split to gap 0, proven, zero flags at their suggested counts", () => {
    // The assertion `src/data/sample-data.validation.test.ts` makes, run here
    // because this is the module that reads those results: the advisory is only
    // allowed to be quiet because the splits it is quiet about are still the
    // splits the app makes.
    for (const [name, players, discipline] of [
      ["futsal", FUTSAL_SAMPLE.players, FUTSAL_DISCIPLINE],
      ["mlbb", MLBB_SAMPLE.players, MLBB_DISCIPLINE],
      ["badminton", BADMINTON_SAMPLE.players, BADMINTON_DISCIPLINE],
    ] as const) {
      const teamCount = suggestTeamCount(players.length, discipline);
      const result = split(players, discipline, teamCount);
      expect(result.teams.length, name).toBe(teamCount);
      expect(printed(result.gap), name).toBe("0.0");
      expect(result.solver.optimal, name).toBe(true);
      expect(result.flags, name).toEqual([]);
    }
  });
});
