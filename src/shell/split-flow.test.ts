import { describe, expect, it } from "vitest";
import { bracketSupports, rerollPool, splitFlowRule, type SplitSource } from "./useSplitFlow";
import type { TeamAssignment, TournamentFormat } from "../domain/types";
import { FORMAT_LABEL } from "../ui/constants";

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
  // The union, at runtime. `FORMAT_LABEL` is typed by `TournamentFormat`, so a
  // member that arrives with no arm in `bracketSupports` is named here and
  // fails the probe below — the plain array this replaced was a list the union
  // could outgrow in silence. Deriving a *test* fact from the union costs
  // nothing; deriving a page's number from it is what the landing guard learned
  // not to do.
  const NAMED = Object.keys(FORMAT_LABEL).filter((f): f is TournamentFormat => f in FORMAT_LABEL);

  /**
   * One count each format must accept. Typed by the union, so a new member is a
   * `tsc` error until it gets a probe, and the probe is what catches a missing
   * arm: a format without one falls through to the series rule and answers
   * false for everything except 2. Series probes 2, which is that fallthrough's
   * own answer, so series itself is covered by the `n=3` case in the third test
   * below rather than here.
   */
  const PROBE: Record<TournamentFormat, number> = {
    series: 2,
    "single-elim": 8,
    swiss: 6,
    "round-robin": 5,
  };

  it("answers for every format the union names, with an arm of its own", () => {
    expect(NAMED.slice().sort()).toEqual(Object.keys(PROBE).sort());
    for (const format of NAMED) {
      expect(bracketSupports(format, PROBE[format]), format).toBe(true);
    }
  });

  it("tells the formats apart at five teams, so none answers with another's rule", () => {
    // The refusal message names `tournament.format`, so a format with no arm
    // here would be told it had been checked when it had not. Five teams is the
    // count that tells them apart: odd, so swiss refuses it; not 2, so series
    // refuses it; not a single-elim count; and the one round robin runs.
    for (const format of NAMED) {
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
