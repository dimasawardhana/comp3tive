import { describe, expect, it } from "vitest";
import { recentActiveTournaments, recentPlayers } from "./dashboardTeasers";
import type { Player, Tournament } from "./domain/types";

/** A minimal player; the helpers only read order, never player fields. */
const player = (id: string): Player => ({
  id,
  communityId: "c1",
  name: `Player ${id}`,
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
  it("returns the last three players of the roster, in roster order", () => {
    const roster = [player("a"), player("b"), player("c"), player("d"), player("e")];
    expect(recentPlayers(roster)).toEqual([player("c"), player("d"), player("e")]);
  });

  it("keeps roster order when more than three players exist (no reversal)", () => {
    const roster = [player("a"), player("b"), player("c"), player("d")];
    expect(recentPlayers(roster).map((p) => p.id)).toEqual(["b", "c", "d"]);
  });

  it("returns the whole roster when it has fewer than three players", () => {
    const roster = [player("a"), player("b")];
    expect(recentPlayers(roster)).toEqual([player("a"), player("b")]);
  });

  it("returns a single player unchanged", () => {
    expect(recentPlayers([player("a")])).toEqual([player("a")]);
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
