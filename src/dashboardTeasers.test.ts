import { describe, expect, it } from "vitest";
import { recentActiveTournaments, recentPlayers } from "./dashboardTeasers";
import type { Player, Tournament } from "./domain/types";

/**
 * A minimal player. `createdAt` drives "recently added" and nothing else here,
 * so the name is derived from the id and the rest stays empty.
 */
const player = (id: string, createdAt: number): Player => ({
  id,
  communityId: "c1",
  name: `Player ${id}`,
  createdAt,
  capabilities: [],
});

/** A minimal tournament; only id, createdAt, and status drive selection. */
const tourney = (
  id: string,
  createdAt: number,
  status: Tournament["status"] = "active",
): Tournament => ({
  id,
  communityId: "c1",
  disciplineId: "futsal",
  name: `Tournament ${id}`,
  format: "series",
  seriesLength: 3,
  teamCount: 2,
  thirdPlace: true,
  createdAt,
  status,
  teams: [],
  matches: [],
});

describe("recentPlayers", () => {
  it("ranks by createdAt descending, deterministically from a shuffled input", () => {
    const roster = [player("a", 100), player("b", 300), player("c", 200)];
    // Shuffled on purpose: the input order is not the answer, which is the
    // property `slice(-3)` never had. It returned the tail of whatever order
    // the store happened to hand over.
    const shuffled = [roster[1], roster[2], roster[0]];
    expect(recentPlayers(shuffled).map((p) => p.id)).toEqual(["b", "c", "a"]);
  });

  it("ranks an insertion-ordered roster the same way the store used to imply", () => {
    // The shape the app actually produces: createdAt ascending with the roster.
    // This case pins the visible Dashboard row for a normal device, and it is
    // the one the old `slice(-3)` got right by accident.
    const roster = [
      player("a", 100),
      player("b", 200),
      player("c", 300),
      player("d", 400),
      player("e", 500),
    ];
    expect(recentPlayers(roster).map((p) => p.id)).toEqual(["e", "d", "c"]);
  });

  it("breaks equal timestamps by id ascending, so the result cannot depend on input order", () => {
    const tied = [player("z", 100), player("a", 100), player("m", 100)];
    expect(recentPlayers(tied).map((p) => p.id)).toEqual(["a", "m", "z"]);
    // The same three, reversed: an unstable sort or an input-ordered tie-break
    // would answer differently here, which is why both directions are asserted.
    expect(recentPlayers([...tied].reverse()).map((p) => p.id)).toEqual(["a", "m", "z"]);
  });

  it("returns the three latest, not the first three", () => {
    // Ids sort the opposite way to the timestamps, so anything keying off id
    // order answers with the wrong end of the roster.
    const roster = [player("z", 100), player("y", 200), player("x", 500), player("w", 900)];
    expect(recentPlayers(roster).map((p) => p.id)).toEqual(["w", "x", "y"]);
  });

  it("returns the whole roster when it has fewer than three players", () => {
    const roster = [player("a", 100), player("b", 200)];
    expect(recentPlayers(roster).map((p) => p.id)).toEqual(["b", "a"]);
  });

  it("returns a single player unchanged", () => {
    expect(recentPlayers([player("a", 100)]).map((p) => p.id)).toEqual(["a"]);
  });

  it("returns an empty list for an empty roster", () => {
    expect(recentPlayers([])).toEqual([]);
  });
});

describe("recentActiveTournaments", () => {
  it("returns the three most recent active tournaments, newest first", () => {
    const list = [
      tourney("oldest", 100),
      tourney("mid", 200),
      tourney("newest", 300),
      tourney("fourth", 400),
    ];
    expect(recentActiveTournaments(list).map((t) => t.id)).toEqual([
      "fourth",
      "newest",
      "mid",
    ]);
  });

  it("excludes drafts from the ranking", () => {
    const list = [
      tourney("draft-recent", 300, "draft"),
      tourney("active-older", 100),
      tourney("active-newer", 200),
    ];
    expect(recentActiveTournaments(list).map((t) => t.id)).toEqual([
      "active-newer",
      "active-older",
    ]);
  });

  it("excludes complete tournaments from the ranking", () => {
    const list = [
      tourney("done-newest", 300, "complete"),
      tourney("live", 100),
    ];
    expect(recentActiveTournaments(list).map((t) => t.id)).toEqual(["live"]);
  });

  it("returns fewer than three when fewer than three are active", () => {
    const list = [
      tourney("only-active", 100),
      tourney("draft", 200, "draft"),
      tourney("complete", 300, "complete"),
    ];
    expect(recentActiveTournaments(list)).toEqual([tourney("only-active", 100)]);
  });

  it("returns an empty list when no tournaments exist", () => {
    expect(recentActiveTournaments([])).toEqual([]);
  });

  it("returns an empty list when no tournament is active", () => {
    const list = [tourney("draft", 100, "draft"), tourney("done", 200, "complete")];
    expect(recentActiveTournaments(list)).toEqual([]);
  });

  it("breaks equal-createdAt ties deterministically (by id), regardless of input order", () => {
    const shuffled = [tourney("zeta", 100), tourney("alpha", 100), tourney("old", 50)];
    const reversed = [tourney("old", 50), tourney("alpha", 100), tourney("zeta", 100)];
    expect(recentActiveTournaments(shuffled).map((t) => t.id)).toEqual([
      "alpha",
      "zeta",
      "old",
    ]);
    expect(recentActiveTournaments(reversed).map((t) => t.id)).toEqual([
      "alpha",
      "zeta",
      "old",
    ]);
  });
});
