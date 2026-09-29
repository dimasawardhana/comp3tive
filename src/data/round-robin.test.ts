import { describe, expect, it } from "vitest";
import { roundRobinRounds, roundRobinSchedule, type RoundRobinPairing } from "./round-robin";

/**
 * Every `n` the schedule has to be right for, past the 8-team cap the app
 * allows: odd and even, and both residues mod 4, because the ring and the bye
 * hand off to each other at every size. A schedule that is right at 6 and
 * wrong at 7 is the failure this file exists to prevent, and a table of
 * expected arrays cannot see it.
 */
const RANGE = Array.from({ length: 63 }, (_, i) => i + 2);

/** `n - 1` rounds when `n` is even, `n` rounds when it is odd. */
const roundsFor = (n: number) => (n % 2 === 0 ? n - 1 : n);

const pairKey = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`);

/**
 * Everything a schedule has to satisfy, as a list of complaints rather than
 * assertions, so the same function can be pointed at a real schedule (which
 * must produce nothing) and at a deliberately broken one (which must produce
 * something). A checker that can only say "yes" proves nothing.
 */
function violations(n: number, schedule: RoundRobinPairing[]): string[] {
  const problems: string[] = [];
  const rounds = roundsFor(n);
  const pairingsPerRound = Math.floor(n / 2);
  const byesPerRound = n % 2;
  const present = [...new Set(schedule.map((p) => p.round))];

  // Every row names real teams and a round inside the schedule.
  for (const p of schedule) {
    for (const t of [p.teamA, p.teamB]) {
      if (t !== null && (!Number.isInteger(t) || t < 0 || t >= n)) {
        problems.push(`round ${p.round} names team ${String(t)}, which is not one of the ${n} teams`);
      }
    }
    if (!Number.isInteger(p.round) || p.round < 1 || p.round > rounds) {
      problems.push(`round ${String(p.round)} is outside 1..${rounds}`);
    }
  }

  // Every round of the schedule is there, and holds floor(n/2) pairings plus a
  // bye when n is odd. A round of nothing but a bye decides nothing, so it is
  // called out separately even when the counts above would allow it.
  for (let r = 1; r <= rounds; r++) {
    if (!present.includes(r)) problems.push(`round ${r} is missing`);
  }
  for (const r of present) {
    const rows = schedule.filter((p) => p.round === r);
    const byes = rows.filter((p) => p.teamB === null).length;
    if (byes !== byesPerRound) problems.push(`round ${r} has ${byes} byes, expected ${byesPerRound}`);
    if (rows.length - byes !== pairingsPerRound) {
      problems.push(`round ${r} has ${rows.length - byes} pairings, expected ${pairingsPerRound}`);
    }
    if (byes > 0 && rows.length - byes === 0) problems.push(`round ${r} is nothing but a bye`);
  }

  // No team appears twice in a round, counting the team that rests.
  for (const r of present) {
    const inRound = schedule
      .filter((p) => p.round === r)
      .flatMap((p) => (p.teamB === null ? [p.teamA] : [p.teamA, p.teamB]));
    for (const t of new Set(inRound)) {
      if (inRound.filter((x) => x === t).length > 1) problems.push(`round ${r} books team ${t} more than once`);
    }
  }

  // Every two teams meet, and meet exactly once.
  const meetings = new Map<string, number>();
  for (const p of schedule) {
    if (p.teamB === null) continue;
    const k = pairKey(p.teamA, p.teamB);
    meetings.set(k, (meetings.get(k) ?? 0) + 1);
  }
  for (let a = 0; a < n; a++) {
    for (let b = a + 1; b < n; b++) {
      const count = meetings.get(pairKey(a, b)) ?? 0;
      if (count !== 1) problems.push(`teams ${a} and ${b} meet ${count} times, expected once`);
    }
  }

  // Byes: none at an even count, exactly one per team at an odd count.
  const rests = new Map<number, number>();
  for (const p of schedule) {
    if (p.teamB === null && p.teamA >= 0 && p.teamA < n) {
      rests.set(p.teamA, (rests.get(p.teamA) ?? 0) + 1);
    }
  }
  if (byesPerRound === 0) {
    if (rests.size > 0) problems.push("an even field has no byes, but the schedule gives one");
  } else {
    for (let t = 0; t < n; t++) {
      const count = rests.get(t) ?? 0;
      if (count !== 1) problems.push(`team ${t} rests ${count} times, expected once`);
    }
  }

  // Rows are grouped by round, ascending: buildBracket turns them into match
  // positions in the order it receives them.
  const order = schedule.map((p) => p.round);
  if (order.some((r, i) => i > 0 && r < order[i - 1])) problems.push("rows are not grouped by round");

  return problems;
}

describe("roundRobinSchedule", () => {
  it.each(RANGE)("schedules every pair once, never twice in a round, for n=%i", (n) => {
    expect(violations(n, roundRobinSchedule(n))).toEqual([]);
  });

  it.each([2, 3, 4, 5, 6, 7, 8])("runs n-1 rounds when even and n rounds when odd, for n=%i", (n) => {
    const schedule = roundRobinSchedule(n);
    expect(new Set(schedule.map((p) => p.round))).toEqual(
      new Set(Array.from({ length: roundsFor(n) }, (_, i) => i + 1)),
    );
    expect(schedule.filter((p) => p.teamB !== null)).toHaveLength((n * (n - 1)) / 2);
  });

  it("spreads the byes instead of always benching the first team", () => {
    const byes5 = roundRobinSchedule(5).filter((p) => p.teamB === null).map((p) => p.teamA);
    const byes7 = roundRobinSchedule(7).filter((p) => p.teamB === null).map((p) => p.teamA);
    // The order the ring hands the empty slot out in. It is a consequence of
    // the rotation, not a choice, and it is not the identity map: at 5 and 7
    // teams the first team rests once, in the first round, and then the ring
    // moves on to somebody else.
    expect(byes5).toEqual([0, 3, 1, 4, 2]);
    expect(byes7).toEqual([0, 5, 3, 1, 6, 4, 2]);
    // No team is ever chosen to rest twice, at any size in the range.
    for (const n of RANGE.filter((n) => n % 2 === 1)) {
      const rests = roundRobinSchedule(n).filter((p) => p.teamB === null).map((p) => p.teamA);
      expect(new Set(rests).size).toBe(n);
    }
  });

  it("pairs the two ends of the field first, so seeding reads strongest against weakest", () => {
    // The Berger table, in full, because it is the convention buildBracket and
    // the spec's seeding rule both inherit, and a literal is where a reader
    // sees it. Deleting it would not unpick the rotation direction anyway: the
    // bye order above pins that independently at odd parity.
    expect(roundRobinSchedule(4)).toEqual([
      { round: 1, teamA: 0, teamB: 3 },
      { round: 1, teamA: 1, teamB: 2 },
      { round: 2, teamA: 0, teamB: 2 },
      { round: 2, teamA: 3, teamB: 1 },
      { round: 3, teamA: 0, teamB: 1 },
      { round: 3, teamA: 2, teamB: 3 },
    ]);
  });

  describe("fewer than two teams", () => {
    it("returns nothing for zero teams", () => {
      expect(roundRobinSchedule(0)).toEqual([]);
    });

    it("returns nothing for one team, and not a round that is only a bye", () => {
      expect(roundRobinSchedule(1)).toEqual([]);
      // The rule that decides it: a round of nothing but a bye is not a round.
      expect(violations(1, [{ round: 1, teamA: 0, teamB: null }])).toEqual([
        "round 1 is nothing but a bye",
      ]);
    });

    it("returns one round with one pairing for two teams", () => {
      expect(roundRobinSchedule(2)).toEqual([{ round: 1, teamA: 0, teamB: 1 }]);
    });

    it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
      "refuses %p, which is not a count of teams",
      (n) => {
        expect(() => roundRobinSchedule(n)).toThrow("is not a count of teams");
      },
    );
  });

  describe("the property itself is not vacuous", () => {
    const n = 7;
    const real = roundRobinSchedule(n);

    it("says nothing about the real schedule", () => {
      expect(violations(n, real)).toEqual([]);
    });

    it("catches a team booked twice in one round", () => {
      // Round 1 at 7 teams is (0 bye), (1,6), (2,5), (3,4); put team 0 in again.
      const doubled = real.map((p) => (p.round === 1 && p.teamA === 1 ? { ...p, teamB: 0 } : p));
      expect(violations(n, doubled).join("; ")).toMatch(/books team 0 more than once/);
    });

    it("catches a pair that never meets", () => {
      // Round 2 at 7 teams is (0,6), (5 bye), (1,4), (2,3); drop (1,4).
      const dropped = real.filter((p) => !(p.round === 2 && p.teamA === 1));
      expect(violations(n, dropped).join("; ")).toMatch(/teams 1 and 4 meet 0 times, expected once/);
    });

    it("catches a pair that meets twice", () => {
      const repeated = [...real, { round: 1, teamA: 2, teamB: 5 }];
      expect(violations(n, repeated).join("; ")).toMatch(/teams 2 and 5 meet 2 times, expected once/);
    });

    it("catches one team resting twice and another never resting", () => {
      const biased = real
        .filter((p) => !(p.round === 2 && p.teamB === null))
        .map((p) => (p.round === 2 && p.teamA === 0 ? { ...p, teamB: null } : p));
      const said = violations(n, biased).join("; ");
      expect(said).toMatch(/team 0 rests 2 times, expected once/);
      expect(said).toMatch(/team 5 rests 0 times, expected once/);
    });

    it("catches a missing round", () => {
      const holed = real.filter((p) => p.round !== 3);
      expect(violations(n, holed).join("; ")).toMatch(/round 3 is missing/);
    });
  });
});

describe("roundRobinRounds", () => {
  /**
   * The count an organizer reads before committing an evening to the format, so
   * it is the number that must be right, and the one that was wrong: it came
   * from `roundRobinSchedule(n).length`, which counts *rows* — one per pairing
   * and one per bye — and so came out at 6 rounds for a 3-team night.
   *
   * Both parities are pinned because neither alone catches it. On an even
   * field the row count is `n / 2` times the rounds; on an odd one the bye adds
   * a row as well, so a round is `ceil(n / 2)` rows. A test at 3 teams sees
   * "twice the rounds" and cannot tell that apart from "rows plus byes", and a
   * test at 4 teams sees the same doubling from a different cause.
   */
  it.each([2, 4, 6, 8])("counts the rounds, not the rows, on an even field of %i", (n) => {
    expect(roundRobinRounds(n)).toBe(roundsFor(n));
    // The specific trap: at 4 teams the schedule is 3 rounds of 2 pairings, so
    // `.length` is 6 and the rounds are 3. Two teams is the one even field where
    // the two agree — one pairing in one round — and the app does not offer a
    // 2-team round robin anyway, since a single pairing is the Series format.
    if (n > 2) expect(roundRobinRounds(n)).not.toBe(roundRobinSchedule(n).length);
  });

  it.each([3, 5, 7])("counts the rounds, not the rows plus the byes, on an odd field of %i", (n) => {
    expect(roundRobinRounds(n)).toBe(roundsFor(n));
    // At 5 teams the schedule is 5 rounds of a pairing and a bye: 15 rows, 5
    // rounds, and the bye must not be counted as a game.
    expect(roundRobinRounds(n)).not.toBe(roundRobinSchedule(n).length);
  });

  it.each(RANGE)("is the games a team plays, plus its one bye when it has one, for n=%i", (n) => {
    // The property that decides which of the two numbers is right, stated
    // without reference to either: a team plays every round except the one it
    // rests, and rests once. It holds only if the count is rounds.
    //
    // This is the assertion that catches the bug on its own. `.length` gives
    // `2 * rounds` on an even field, so a team would be credited with twice the
    // games it can play, and the double counting grows with `n`.
    const gamesPerTeam = new Map<number, number>();
    for (const p of roundRobinSchedule(n)) {
      if (p.teamB === null) continue;
      gamesPerTeam.set(p.teamA, (gamesPerTeam.get(p.teamA) ?? 0) + 1);
      gamesPerTeam.set(p.teamB, (gamesPerTeam.get(p.teamB) ?? 0) + 1);
    }
    const expected = roundsFor(n) - (n % 2);
    for (const team of gamesPerTeam.keys()) expect(gamesPerTeam.get(team), `team ${team} at n=${n}`).toBe(expected);
  });

  it("has no round to count below two teams, where there is no schedule", () => {
    expect(roundRobinRounds(0)).toBe(0);
    expect(roundRobinRounds(1)).toBe(0);
  });

  it.each([-1, 1.5, Number.NaN])("refuses a count that is not a count, like the scheduler does", (n) => {
    // Inheriting the scheduler's refusal rather than answering a nonsense input
    // quietly: `roundRobinRounds` is the scheduler read the other way, so the
    // two must not disagree about what is a team count.
    expect(() => roundRobinRounds(n)).toThrow("is not a count of teams");
  });
});
