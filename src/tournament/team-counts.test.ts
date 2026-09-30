import { describe, expect, it } from "vitest";
import { formatForTeamCount, TEAM_COUNTS } from "./GamesScreen";
import { validateTournamentSpec } from "./tournament-validation";
import { SELECTABLE_FORMATS } from "../ui/constants";
import { bracketSupports } from "../shell/useSplitFlow";
import { FUTSAL_DISCIPLINE } from "../domain/seed";
import type { TournamentFormat } from "../domain/types";

/**
 * The count a chip offers and the count a create accepts are two copies of one
 * rule, kept in two files: `TEAM_COUNTS` in GamesScreen decides which chips are
 * enabled, `getValidTeamCounts` in tournament-validation decides what
 * `validateTournamentSpec` will pass, and `bracketSupports` in useSplitFlow
 * decides whether the teams that come back can be seated at all.
 *
 * They drift apart silently and each drift is a dead end on the floor — an
 * enabled chip that creates nothing, a count the create accepts that no chip
 * offers, or a tournament whose own teams it then refuses to save. So this
 * imports the modal's real table and asserts the three agree, rather than
 * writing a fourth copy of the rule next to them.
 */

/** Does the create modal's validator accept this count for this format? */
const accepts = (format: TournamentFormat, teamCount: number): boolean =>
  validateTournamentSpec(
    { name: "T", disciplineId: FUTSAL_DISCIPLINE.id, format, seriesLength: 3, teamCount },
    FUTSAL_DISCIPLINE,
  ).every((issue) => issue.path !== "teamCount");

/** Every count a count chip can be clicked for, today and by the stepper's cap. */
const OFFERED = [1, 2, 3, 4, 5, 6, 7, 8, 9];

describe("team counts per format", () => {
  it.each(SELECTABLE_FORMATS)(
    "enables exactly the counts %s validates for, and no others",
    (format) => {
      for (const n of OFFERED) {
        expect(TEAM_COUNTS[format].includes(n), `${format} chip ${n}`).toBe(accepts(format, n));
      }
    },
  );

  it("opens every format on a count it can actually run", () => {
    // The first entry is what a visitor gets without touching the chips, so a
    // default the validator refuses is a modal that opens broken.
    for (const format of SELECTABLE_FORMATS) {
      expect(accepts(format, TEAM_COUNTS[format][0]), `${format} default`).toBe(true);
    }
  });

  it("opens single elimination on 4, not on 2", () => {
    // The order of each list is a product decision rather than part of the
    // rule, and this is the one it makes: a two-team single elimination is a
    // Series with extra steps, and the modal should not open on it.
    expect(TEAM_COUNTS["single-elim"][0]).toBe(4);
  });

  it("covers every count a squad can be split into, so no pre-fill dead-ends", () => {
    // A saved squad is pre-filled into the create modal by team count, and the
    // stepper runs 1..8. Every count from 2 up must have a format that takes
    // it, or that squad opens a modal whose create is refused.
    for (let n = 2; n <= 8; n++) {
      const home = SELECTABLE_FORMATS.find((f) => TEAM_COUNTS[f].includes(n));
      expect(home, `no format takes ${n} teams`).toBeDefined();
      expect(accepts(home!, n), `${home} rejects ${n}`).toBe(true);
    }
  });

  it("takes the odd counts for round robin, and no other format takes them", () => {
    // A 3-, 5- or 7-team night is what round robin is for, and the sizes other
    // formats cannot field must stay unfieldable rather than be misrouted.
    for (const n of [3, 5, 7]) {
      expect(accepts("round-robin", n), `round robin ${n}`).toBe(true);
      expect(bracketSupports("round-robin", n), `seating ${n}`).toBe(true);
    }
    for (const format of ["series", "single-elim", "swiss"] as const) {
      for (const n of [3, 5, 7]) {
        expect(accepts(format, n), `${format} ${n}`).toBe(false);
      }
    }
  });

  it("seats every count a team-saved tournament can carry, for every format", () => {
    // The other half of the same dead end, one step later: a tournament that
    // validates and then refuses its own teams when they are saved into it.
    for (const format of SELECTABLE_FORMATS) {
      for (const n of TEAM_COUNTS[format]) {
        expect(bracketSupports(format, n), `${format} seats ${n}`).toBe(true);
      }
    }
  });

  it("puts a chip on the row for every count a format takes, odd ones included", () => {
    // The row of count chips is derived from this table at the render, so this
    // is the claim about what a visitor can click: 2 through 8, with 3, 5 and 7
    // on the row. Before round robin the row was 2, 4, 6 and 8, and a 3- or
    // 5-team night had no chip to press at all.
    const taken = [...new Set(SELECTABLE_FORMATS.flatMap((f) => TEAM_COUNTS[f]))].sort((a, b) => a - b);
    expect(taken).toEqual([2, 3, 4, 5, 6, 7, 8]);
  });

  it("still refuses a 2-team round robin, which is the whole of the Series format", () => {
    expect(TEAM_COUNTS["round-robin"]).not.toContain(2);
    expect(accepts("round-robin", 2)).toBe(false);
  });

  it("names round robin's own counts in the refusal, so the message is actionable", () => {
    // The browser cannot reach this one: the chip is disabled, so the modal
    // never produces the refusal. The message is the only place a visitor who
    // wants 2 teams is told what round robin does take, and it has to quote
    // round robin's range rather than another format's.
    const issues = validateTournamentSpec(
      { name: "T", disciplineId: FUTSAL_DISCIPLINE.id, format: "round-robin", seriesLength: 3, teamCount: 2 },
      FUTSAL_DISCIPLINE,
    ).filter((issue) => issue.path === "teamCount");
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toBe("round-robin format only supports: 3, 4, 5, 6, 7, 8 teams.");
  });

  it("pre-fills a saved squad into a format that takes its team count", () => {
    // `newTournamentFromSquad` pre-fills the modal with the squad's own team
    // count, and the modal then creates from it. 3-, 5- and 7-team squads used
    // to pre-fill as Swiss, which the validator refused, so those squads
    // dead-ended on a tournament the app could have run.
    for (let n = 2; n <= 8; n++) {
      const format = formatForTeamCount(n);
      expect(accepts(format, n), `${n} teams pre-fills as ${format}`).toBe(true);
      expect(bracketSupports(format, n), `${format} seats a prefilled ${n}`).toBe(true);
    }
    // What the counts that already worked must keep doing, spelled out rather
    // than derived, because the fix is a fallback chain and a fallback can
    // quietly move a count that was never the subject of the bug.
    expect(formatForTeamCount(2)).toBe("series");
    expect(formatForTeamCount(4)).toBe("single-elim");
    expect(formatForTeamCount(6)).toBe("swiss");
    expect(formatForTeamCount(8)).toBe("single-elim");
    // And the odd counts land on the one format that takes them.
    expect(formatForTeamCount(3)).toBe("round-robin");
    expect(formatForTeamCount(5)).toBe("round-robin");
    expect(formatForTeamCount(7)).toBe("round-robin");
  });
});
