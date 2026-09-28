import { describe, expect, it } from "vitest";
import { gapKind, gapQualifier } from "./gapProvenance";
import type { SplitResult } from "../domain/types";

/** A minimal result whose gap is the only thing the module reads. */
const resultWith = (solver: SplitResult["solver"], gap = 0.3): SplitResult => ({
  teams: [
    { index: 0, slots: [], totalStrength: 0, avgStrength: 3 },
    { index: 1, slots: [], totalStrength: 0, avgStrength: 3 - gap },
  ],
  gap,
  flags: [],
  unassigned: [],
  solver,
});

describe("gapKind", () => {
  it("is proven when the search ran to completion", () => {
    expect(gapKind(resultWith({ optimal: true, nodesExplored: 51, elapsedMs: 7 }))).toBe("proven");
  });

  it("is best-found when the search stopped short", () => {
    expect(gapKind(resultWith({ optimal: false, nodesExplored: 4_000_001, elapsedMs: 273 }))).toBe("best-found");
  });

  it("reads only `optimal`: `nodesExplored` is provenance detail, not a rule input", () => {
    // The field is provenance, not a property of the current teams. A result
    // with `optimal: true` is proven whatever its node count.
    expect(gapKind(resultWith({ optimal: true, nodesExplored: 0, elapsedMs: 0 }))).toBe("proven");
  });

  it("does not infer provenance from the pool or the gap", () => {
    // Identical gaps, different provenance: the only honest rule is the field.
    const a = resultWith({ optimal: true, nodesExplored: 2, elapsedMs: 0 });
    const b = resultWith({ optimal: false, nodesExplored: 4_000_001, elapsedMs: 200 });
    expect(a.gap).toBe(b.gap);
    expect(gapKind(a)).not.toBe(gapKind(b));
  });
});

describe("gapQualifier", () => {
  it("returns null when proven, so the proven path emits no qualifier", () => {
    expect(gapQualifier(resultWith({ optimal: true, nodesExplored: 51, elapsedMs: 7 }))).toBeNull();
  });

  it("returns the three-word qualifier when best-found", () => {
    expect(gapQualifier(resultWith({ optimal: false, nodesExplored: 4_000_001, elapsedMs: 273 })))
      .toBe("Best gap found.");
  });

  it("never says what the engine did, only what the number is", () => {
    const words = gapQualifier(resultWith({ optimal: false, nodesExplored: 4_000_001, elapsedMs: 273 }))!;
    for (const banned of ["aborted", "node budget", "heuristic", "search", "exhaustive", "—"]) {
      expect(words.toLowerCase()).not.toContain(banned);
    }
    expect(words).not.toContain("\u2014");
  });
});
