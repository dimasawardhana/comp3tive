import { describe, expect, it } from "vitest";
import { validateTournamentSpec } from "./tournament-validation";
import { FUTSAL_DISCIPLINE } from "../domain/seed";
import type { SeriesLength, TournamentFormat } from "../domain/types";

const spec = (format: TournamentFormat, teamCount: number) => ({
  name: "Thursday night",
  disciplineId: FUTSAL_DISCIPLINE.id,
  format,
  seriesLength: 3 as SeriesLength,
  teamCount,
});

/** The team-count complaint alone: the other rules pass for every case below. */
const countIssues = (format: TournamentFormat, teamCount: number) =>
  validateTournamentSpec(spec(format, teamCount), FUTSAL_DISCIPLINE).filter((i) => i.path === "teamCount");

describe("validateTournamentSpec: team counts per format", () => {
  it("accepts every count round robin can schedule, odd ones included", () => {
    // 3..8 is what the circle method can schedule (`roundRobinSchedule` answers
    // for any count from 2 up) inside the 8-team cap the team stepper enforces,
    // minus 2, where a round robin is one pairing and Series already says that.
    // The odd counts are the point: the bye is a real fixture, not a compromise.
    for (const teamCount of [3, 4, 5, 6, 7, 8]) {
      expect(countIssues("round-robin", teamCount), `n=${teamCount}`).toEqual([]);
    }
  });

  it("rejects a count round robin cannot schedule, and names the counts it can", () => {
    for (const teamCount of [2, 9]) {
      const issues = countIssues("round-robin", teamCount);
      expect(issues.map((i) => i.path)).toEqual(["teamCount"]);
      expect(issues[0].message).toBe("round-robin format only supports: 3, 4, 5, 6, 7, 8 teams.");
    }
  });

  it("leaves the other formats' counts as they were", () => {
    expect(countIssues("series", 2)).toEqual([]);
    expect(countIssues("series", 3)).toHaveLength(1);
    expect(countIssues("single-elim", 8)).toEqual([]);
    expect(countIssues("single-elim", 6)).toHaveLength(1);
    expect(countIssues("swiss", 4)).toEqual([]);
    expect(countIssues("swiss", 5)).toHaveLength(1);
  });
});
