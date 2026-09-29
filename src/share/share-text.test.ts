import { describe, expect, it, vi } from "vitest";
import { teamsAsText } from "./share-text";
import { gapKind } from "../session/gapProvenance";
import { FUTSAL_DISCIPLINE } from "../domain/seed";
import type { Player, SplitResult } from "../domain/types";

// `gapKind` keeps its real behaviour everywhere except the one test that inverts
// its verdict. Reading `result.solver.optimal` inside `share-text.ts` is
// behaviour-identical to asking `gapKind` today, so nothing else in this file
// can tell the two apart — the mock is what makes the delegation observable.
vi.mock("../session/gapProvenance", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../session/gapProvenance")>();
  return { ...actual, gapKind: vi.fn(actual.gapKind) };
});

const cap = (technical: number, fitness: number, gameIq: number) => ({
  disciplineId: "futsal",
  attributeRatings: { technical, fitness, "game-iq": gameIq },
  eligibleRoles: ["goalkeeper", "defender", "winger", "pivot"],
  preferredRole: null,
});

const player = (id: string, name: string, ratings?: [number, number, number]): Player => ({
  id,
  communityId: "c1",
  name,
  capabilities: ratings ? [cap(...ratings)] : [],
});

const ROSTER: Player[] = [
  player("p1", "Andi", [5, 4, 4]),
  player("p2", "Budi", [3, 4, 4]),
  player("p3", "Citra", [4, 4, 4]),
  player("p4", "Dewi"),
  player("p5", "Eka", [4, 3, 4]),
  player("p6", "Fajar", [2, 3, 2]),
];

/** The four `solver` records the verdict is chosen from. */
const PROVEN: SplitResult["solver"] = { optimal: true, nodesExplored: 51, elapsedMs: 7 };
const BUDGET_SPENT: SplitResult["solver"] = { optimal: false, nodesExplored: 4_000_001, elapsedMs: 273 };
/** Proven with no search to speak of — proven is a property of the field, not the count. */
const PROVEN_WITHOUT_NODES: SplitResult["solver"] = { optimal: true, nodesExplored: 0, elapsedMs: 0 };
/** Exactly what `recomputeResult` stamps on a `swapPlayers` result (`src/session/edit.ts:72`). */
const HAND_EDITED: SplitResult["solver"] = { optimal: false, nodesExplored: 0, elapsedMs: 0 };

const slot = (playerId: string) => ({ playerId, roleId: null });

const TWO_TEAMS: SplitResult["teams"] = [
  { index: 0, slots: [slot("p2"), slot("p1")], totalStrength: 8.4, avgStrength: 4.2 },
  { index: 1, slots: [slot("p4"), slot("p3")], totalStrength: 7.6, avgStrength: 3.8 },
];

const THREE_TEAMS: SplitResult["teams"] = [
  ...TWO_TEAMS,
  { index: 2, slots: [slot("p5"), slot("p6")], totalStrength: 6, avgStrength: 3 },
];

const split = (solver: SplitResult["solver"], teams = TWO_TEAMS, unassigned: string[] = []): SplitResult => ({
  teams,
  gap: 0.4,
  flags: [],
  unassigned,
  solver,
});

const input = (solver: SplitResult["solver"], teams = TWO_TEAMS, unassigned: string[] = []) => ({
  communityName: "Thursday Crew",
  disciplineName: "Futsal",
  discipline: FUTSAL_DISCIPLINE,
  result: split(solver, teams, unassigned),
  roster: ROSTER,
});

const PROVEN_CLOSING = "Gap 0.4 — the proven minimum for this pool.";
const BEST_FOUND_CLOSING = "Gap 0.4 — the smallest gap found. The search ended before proving it minimal.";

describe("teamsAsText", () => {
  it("renders the proven case with the headline, one block per team and the proven closing line", () => {
    // Fails if: `closingLine` loses its `gapKind` branch and always hedges, if
    // `teamName` is bypassed for a literal "Team A", or if the block separators
    // move — this is the whole string, so any of them breaks it.
    expect(teamsAsText(input(PROVEN))).toBe(
      [
        "Futsal · Thursday Crew — 2 teams",
        "",
        "Team A · avg 4.2",
        "• Andi (4.3)",
        "• Budi (3.7)",
        "",
        "Team B · avg 3.8",
        "• Citra (4.0)",
        "• Dewi",
        "",
        PROVEN_CLOSING,
      ].join("\n"),
    );
  });

  it("renders the best-found case with the hedged closing line and nothing else changed", () => {
    // Fails if: the two branches are transposed — the identical teams and gap
    // make the closing line the only thing this assertion can catch.
    expect(teamsAsText(input(BUDGET_SPENT))).toBe(
      [
        "Futsal · Thursday Crew — 2 teams",
        "",
        "Team A · avg 4.2",
        "• Andi (4.3)",
        "• Budi (3.7)",
        "",
        "Team B · avg 3.8",
        "• Citra (4.0)",
        "• Dewi",
        "",
        BEST_FOUND_CLOSING,
      ].join("\n"),
    );
  });

  it("counts the teams in the headline and labels the third one", () => {
    // Fails if: the headline hardcodes a count, or `teamName(2)` stops being
    // derived from the index (a 3-team pool is where "Team C" first appears).
    const text = teamsAsText(input(PROVEN, THREE_TEAMS));
    expect(text.split("\n")[0]).toBe("Futsal · Thursday Crew — 3 teams");
    expect(text).toContain("Team C · avg 3.0");
  });

  it("lists a player without a capability in the discipline last, with no parenthesis", () => {
    // Dewi has no futsal capability, so her line is bare and it is the last in her
    // block. Fails if the two `null` arms of the comparator are flipped (she would
    // read first) or if the line renders `strengthOf(...) ?? 0` — she would read
    // "• Dewi (0.0)", a Strength of zero she was never rated.
    const text = teamsAsText(input(PROVEN));
    const block = text.split("Team B · avg 3.8\n")[1];
    expect(block.split("\n")[0]).toBe("• Citra (4.0)");
    expect(block.split("\n")[1]).toBe("• Dewi");
    expect(text).not.toContain("Dewi (");

    // Authored with her first and two rated teammates behind her, so her position
    // can only come from the comparator. A two-member block cannot tell a correct
    // comparator from a contradictory one — this one can.
    const authoredFirst: SplitResult["teams"] = [
      { index: 0, slots: [slot("p4"), slot("p1"), slot("p3")], totalStrength: 8.33, avgStrength: 2.8 },
    ];
    expect(teamsAsText(input(PROVEN, authoredFirst))).toContain(
      ["Team A · avg 2.8", "• Andi (4.3)", "• Citra (4.0)", "• Dewi"].join("\n"),
    );
  });

  it("orders each team strongest first", () => {
    // Fails if: the `sb - sa` term is dropped or flipped from `orderedSlots`, or
    // if Team C's slots keep their authored order (Fajar 2.3 before Eka 3.7).
    expect(teamsAsText(input(PROVEN, THREE_TEAMS))).toContain(
      ["Team C · avg 3.0", "• Eka (3.7)", "• Fajar (2.3)"].join("\n"),
    );
  });

  it("keeps the solver's order among equally strong players instead of alphabetising", () => {
    // Eka and Budi both mean 11/3, so the only thing that can order them is the
    // `|| a.position - b.position` tiebreak. Fails if the tiebreak is replaced
    // by a name comparison: the block would read Budi before Eka.
    const tied: SplitResult["teams"] = [
      { index: 0, slots: [slot("p5"), slot("p2")], totalStrength: 7.33, avgStrength: 3.7 },
    ];
    expect(teamsAsText(input(PROVEN, tied))).toContain(["Team A · avg 3.7", "• Eka (3.7)", "• Budi (3.7)"].join("\n"));
  });

  it("appends the not-playing line only when someone is unassigned", () => {
    // Fails if the `unassigned.length > 0` guard is dropped (every share would end
    // in a bare "Not playing:"), or if the push is removed (a sit-out would be
    // silently dropped and the group chat would think they are playing).
    expect(teamsAsText(input(PROVEN))).not.toContain("Not playing:");
    const withSits = teamsAsText(input(PROVEN, TWO_TEAMS, ["p1", "p3"]));
    expect(withSits.endsWith("Not playing: Andi, Citra")).toBe(true);
    expect(withSits).toContain(`${PROVEN_CLOSING}\n\nNot playing: Andi, Citra`);
  });
});

describe("the gap verdict", () => {
  it("states the best-found verdict in full, because a chat message has no surrounding sentence", () => {
    // Fails if the best-found branch is dropped for a bare number, or if the
    // module copies the screen's approach and only appends a qualifier when one
    // is missing — a chat message gets no surrounding sentence to carry it.
    expect(teamsAsText(input(BUDGET_SPENT)).endsWith(BEST_FOUND_CLOSING)).toBe(true);
  });

  it("never prints a proof claim for a best-found result, and never hedges a proven one", () => {
    // Fails if `closingLine` collapses to one unconditional string: the best-found
    // text would then contain "proven minimum", and the proven text would then
    // contain "smallest gap found".
    const bestFound = teamsAsText(input(BUDGET_SPENT));
    expect(bestFound).toContain(BEST_FOUND_CLOSING);
    for (const banned of ["proven", "minimum"]) {
      expect(bestFound).not.toContain(banned);
    }

    const proven = teamsAsText(input(PROVEN));
    expect(proven).toContain(PROVEN_CLOSING);
    for (const banned of ["smallest gap found", "search ended", "before proving"]) {
      expect(proven).not.toContain(banned);
    }
  });

  it("reads provenance from the record, not the node count", () => {
    // `gapKind` keys on `optimal` alone. A `nodesExplored` test would call this
    // best-found, and a zero-node proven record is exactly the shape a caller
    // gets when a search found the answer immediately.
    expect(teamsAsText(input(PROVEN_WITHOUT_NODES)).endsWith(PROVEN_CLOSING)).toBe(true);
  });

  it("asks `gapKind` for the verdict instead of reading `solver.optimal` itself", () => {
    // Both records get the opposite verdict to the one their own `solver` block
    // states, so a module that re-derives provenance from the field prints the
    // other line and fails. This is the duplication `contracts.md` §5 exists to
    // prevent: two rules for one question, free to drift apart.
    vi.mocked(gapKind).mockReturnValueOnce("best-found").mockReturnValueOnce("proven");
    expect(teamsAsText(input(PROVEN)).endsWith(BEST_FOUND_CLOSING)).toBe(true);
    expect(teamsAsText(input(BUDGET_SPENT)).endsWith(PROVEN_CLOSING)).toBe(true);
  });

  it("calls a hand-edited arrangement best-found, because no search produced it", () => {
    // The hazard `contracts.md` §5 records: a result the organizer rearranged by
    // hand used to be stamped `optimal: true`, so the share text would have quoted
    // the app's own fairness claim for teams the user put together. `edit.test.ts`
    // pins that `swapPlayers` writes this record; this asserts the share text does
    // the right thing with it. Fails if `edit.ts:72` returns to `optimal: true`,
    // or if `teamsAsText` reads provenance from anywhere but `gapKind`.
    expect(teamsAsText(input(HAND_EDITED)).endsWith(BEST_FOUND_CLOSING)).toBe(true);
    expect(teamsAsText(input(HAND_EDITED))).not.toContain("proven");
  });
});
