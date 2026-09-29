import { describe, expect, it } from "vitest";
import { bracketSupports, rerollPool, splitFlowRule, type SplitSource } from "./useSplitFlow";
import type { TeamAssignment, TournamentFormat } from "../domain/types";

const teams = (a: string[], b: string[]): TeamAssignment[] => [
  { index: 0, slots: a.map((playerId) => ({ playerId, roleId: null })), totalStrength: 0, avgStrength: 0 },
  { index: 1, slots: b.map((playerId) => ({ playerId, roleId: null })), totalStrength: 0, avgStrength: 0 },
];

const SOURCES: SplitSource[] = ["ad-hoc", "tournament", "session", "squad"];

describe("splitFlowRule", () => {
  it("persists a Session only for an ad-hoc split (FLOW §2 rule 3)", () => {
    expect(splitFlowRule("ad-hoc")).toEqual({ persistsSession: true, submitsTournament: false, isSynthetic: false });
  });

  it("submits to the bracket only for a tournament split", () => {
    expect(splitFlowRule("tournament")).toEqual({ persistsSession: false, submitsTournament: true, isSynthetic: false });
  });

  it("treats a reopened session as synthetic — it must not mutate the archived log", () => {
    expect(splitFlowRule("session")).toEqual({ persistsSession: false, submitsTournament: false, isSynthetic: true });
  });

  it("treats a squad re-split as synthetic — it persists only when saved as a new squad", () => {
    expect(splitFlowRule("squad")).toEqual({ persistsSession: false, submitsTournament: false, isSynthetic: true });
  });

  it("has exactly one true flag per source", () => {
    for (const source of SOURCES) {
      const rule = splitFlowRule(source);
      const trues = [rule.persistsSession, rule.submitsTournament, rule.isSynthetic].filter(Boolean);
      expect(trues).toHaveLength(1);
    }
  });
});

describe("rerollPool", () => {
  it("returns the session's own pool when supplied", () => {
    const pool = ["p1", "p2", "p3", "p4", "p5", "p6"];
    expect(rerollPool("ad-hoc", pool, teams(["p1", "p2", "p3"], ["p4", "p5", "p6"]))).toEqual(pool);
  });

  it("returns the session's own pool even when it names a player in no team", () => {
    const pool = ["p1", "p2", "p3", "p4", "p5", "p6", "p7"];
    const result = rerollPool("ad-hoc", pool, teams(["p1", "p2", "p3"], ["p4", "p5", "p6"]));
    expect(result).toContain("p7");
    expect(result).toEqual(pool);
  });

  it("flattens the current teams when the session pool is null", () => {
    expect(rerollPool("squad", null, teams(["p1", "p2"], ["p3", "p4"]))).toEqual(["p1", "p2", "p3", "p4"]);
  });

  it("flattens the current teams when the session pool is empty", () => {
    expect(rerollPool("squad", [], teams(["p1", "p2"], ["p3", "p4"]))).toEqual(["p1", "p2", "p3", "p4"]);
  });

  it("flattens in team order, slot by slot", () => {
    expect(rerollPool("session", null, teams(["a", "b"], ["c"]))).toEqual(["a", "b", "c"]);
  });
});

describe("bracketSupports", () => {
  const FORMATS: TournamentFormat[] = ["series", "single-elim", "swiss", "round-robin"];

  it("answers for every format, so none of them falls through to the series rule", () => {
    // The refusal message names `tournament.format`, so a format with no arm
    // would be told it had been checked when it had not. Five teams is the
    // count that tells them apart: odd, so swiss refuses it; not 2, so series
    // refuses it; not a single-elim count; and the one round robin runs.
    for (const format of FORMATS) {
      expect(bracketSupports(format, 5), format).toBe(format === "round-robin");
    }
  });

  it("accepts the round robin counts the circle method can schedule, odd ones included", () => {
    for (const n of [3, 4, 5, 6, 7, 8]) {
      expect(bracketSupports("round-robin", n), `n=${n}`).toBe(true);
    }
    for (const n of [0, 1, 2, 9]) {
      expect(bracketSupports("round-robin", n), `n=${n}`).toBe(false);
    }
  });

  it("leaves the other formats' counts exactly as they were", () => {
    expect([2, 3, 4].map((n) => bracketSupports("series", n))).toEqual([true, false, false]);
    expect([2, 4, 6, 8, 3].map((n) => bracketSupports("single-elim", n))).toEqual([true, true, false, true, false]);
    expect([2, 4, 6, 8, 5].map((n) => bracketSupports("swiss", n))).toEqual([true, true, true, true, false]);
  });
});
