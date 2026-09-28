import { describe, expect, it } from "vitest";
import { scopeCommunities } from "./useCommunityScope";
import { FUTSAL_DISCIPLINE, MLBB_DISCIPLINE } from "../domain/seed";
import type {
  Community,
  Player,
  SavedSquad,
  Session,
  SplitResult,
  Tournament,
} from "../domain/types";

const A: Community = { id: "c-a", name: "Sunday League", createdAt: 1 };
const B: Community = { id: "c-b", name: "Tuesday Crew", createdAt: 2 };

const ids = (list: { id: string }[]): string[] => list.map((r) => r.id);
const holdsRecordOf = (list: { communityId: string }[], communityId: string): boolean =>
  list.some((r) => r.communityId === communityId);

const player = (id: string, communityId: string): Player => ({
  id,
  communityId,
  name: id,
  capabilities: [],
});

const emptyResult: SplitResult = {
  teams: [],
  gap: 0,
  flags: [],
  unassigned: [],
  solver: { optimal: true, nodesExplored: 0, elapsedMs: 0 },
};

const session = (id: string, communityId: string): Session => ({
  id,
  communityId,
  disciplineId: "futsal",
  createdAt: 1,
  poolPlayerIds: [],
  settings: { teamCount: 2 },
  result: emptyResult,
});

const tournament = (id: string, communityId: string): Tournament => ({
  id,
  communityId,
  disciplineId: "futsal",
  name: id,
  format: "series",
  seriesLength: 1,
  teamCount: 2,
  thirdPlace: false,
  createdAt: 1,
  status: "draft",
  teams: [],
  matches: [],
});

const squad = (id: string, communityId: string): SavedSquad => ({
  id,
  communityId,
  name: id,
  disciplineId: "futsal",
  createdAt: 1,
  poolPlayerIds: [],
  settings: { teamCount: 2 },
  result: emptyResult,
});

/** Two communities, one record of every kind in each, so a leak is visible. */
const input = (activeCommunityId: string | null) => ({
  communities: [A, B],
  activeCommunityId,
  players: [player("p-a", "c-a"), player("p-b", "c-b")],
  sessions: [session("s-a", "c-a"), session("s-b", "c-b")],
  tournaments: [tournament("t-a", "c-a"), tournament("t-b", "c-b")],
  squads: [squad("q-a", "c-a"), squad("q-b", "c-b")],
});

describe("scopeCommunities", () => {
  // Mutation it defends: `squads: input.squads` — passing the fourth list
  // through unfiltered while the other three are scoped.
  it("returns exactly the active community's records in every list", () => {
    const source = input("c-a");
    const scope = scopeCommunities(source);
    expect(scope.activeCommunity).toEqual(A);
    expect(ids(scope.players)).toEqual(["p-a"]);
    expect(ids(scope.sessions)).toEqual(["s-a"]);
    expect(ids(scope.tournaments)).toEqual(["t-a"]);
    expect(ids(scope.squads)).toEqual(["q-a"]);
    // The other community's records are absent, not merely ordered last.
    expect(holdsRecordOf(scope.players, "c-b")).toBe(false);
    expect(holdsRecordOf(scope.sessions, "c-b")).toBe(false);
    expect(holdsRecordOf(scope.tournaments, "c-b")).toBe(false);
    expect(holdsRecordOf(scope.squads, "c-b")).toBe(false);
    // Scoping reads the source; it must not consume it.
    expect(ids(source.players)).toEqual(["p-a", "p-b"]);
  });

  // Mutation it defends: inverting the predicate, `r.communityId !== id`.
  // `every(r => r.communityId === "c-b")` alone cannot catch that — nor can it
  // catch an implementation that returns nothing at all, which is why the
  // exact ids are asserted first and the leak check runs over a known
  // non-empty list.
  it("leaks nothing from the other community when the active one flips", () => {
    const scope = scopeCommunities(input("c-b"));
    expect(scope.activeCommunity).toEqual(B);
    expect(ids(scope.players)).toEqual(["p-b"]);
    expect(ids(scope.sessions)).toEqual(["s-b"]);
    expect(ids(scope.tournaments)).toEqual(["t-b"]);
    expect(ids(scope.squads)).toEqual(["q-b"]);
    for (const list of [scope.players, scope.sessions, scope.tournaments, scope.squads]) {
      expect(list.every((r) => r.communityId === "c-b")).toBe(true);
      expect(holdsRecordOf(list, "c-a")).toBe(false);
    }
  });

  // Mutation it defends: `communities.find(...) ?? communities[0]` — a
  // first-community fallback that hands back a populated scope with no
  // community selected.
  it("returns a null community and four empty lists when nothing is active", () => {
    const scope = scopeCommunities(input(null));
    expect(scope.activeCommunity).toBeNull();
    expect(scope.players).toEqual([]);
    expect(scope.sessions).toEqual([]);
    expect(scope.tournaments).toEqual([]);
    expect(scope.squads).toEqual([]);
  });

  // Mutation it defends: `const id = activeCommunityId` — trusting the raw id
  // instead of the id of the community it actually resolves to. A stale
  // activeId survives a community delete, and the fixture below gives that
  // id a record, so the leak is observable.
  it("returns an empty list when the active id names no community", () => {
    const scope = scopeCommunities({
      ...input("c-missing"),
      players: [player("p-stale", "c-missing")],
    });
    expect(scope.activeCommunity).toBeNull();
    expect(scope.players).toEqual([]);
  });

  // Mutation it defends: keying the map by name — `d.name` — so
  // `get("futsal")` misses while `get("Futsal")` hits.
  it("builds disciplinesById from the optional input", () => {
    const scope = scopeCommunities({
      ...input("c-a"),
      disciplines: [FUTSAL_DISCIPLINE, MLBB_DISCIPLINE],
    });
    expect(scope.disciplinesById.get("futsal")).toEqual(FUTSAL_DISCIPLINE);
    expect(scope.disciplinesById.size).toBe(2);
    expect(scope.disciplinesById.get("mlbb")).toEqual(MLBB_DISCIPLINE);
    expect(scope.disciplinesById.get("badminton")).toBeUndefined();
  });

  // Mutation it defends: dropping the `= []` default in the destructuring, so
  // `disciplines.map` throws a TypeError on every caller that omits it.
  it("does not throw when disciplines is omitted", () => {
    const scope = scopeCommunities(input("c-a"));
    expect(scope.disciplinesById.size).toBe(0);
    expect(scope.disciplinesById.get("futsal")).toBeUndefined();
  });

  // Mutation it defends: `r.communityId === id || !r.communityId` — adopting
  // legacy orphans into whatever community is active. App.tsx really does
  // write `communityId: activeCommunity?.id ?? ""` when saving a split, so a
  // blank communityId is a value this store holds, not a hypothetical.
  it("keeps a blank-communityId record out of the active community's scope", () => {
    const base = input("c-a");
    const scope = scopeCommunities({ ...base, players: [...base.players, player("p-orphan", "")] });
    expect(ids(scope.players)).toEqual(["p-a"]);
    expect(holdsRecordOf(scope.players, "")).toBe(false);
  });
});
