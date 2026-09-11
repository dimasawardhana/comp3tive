import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  createIndexedDbCommunityStore,
  createIndexedDbRosterStore,
  createIndexedDbSavedSquadStore,
  createIndexedDbSessionStore,
  createIndexedDbTournamentStore,
} from "../storage";
import { removeCommunityCascade, type CommunityRemovalStores } from "./community-removal";
import type { Community, Player, SavedSquad, Session, Tournament } from "./types";

let dbSeq = 0;
const stores = (): CommunityRemovalStores => {
  const name = `community-removal-test-${++dbSeq}`;
  return {
    communityStore: createIndexedDbCommunityStore(name),
    rosterStore: createIndexedDbRosterStore(name),
    sessionStore: createIndexedDbSessionStore(name),
    savedSquadStore: createIndexedDbSavedSquadStore(name),
    tournamentStore: createIndexedDbTournamentStore(name),
  };
};

const community = (id: string, name: string): Community => ({ id, name, createdAt: 1 });
const player = (id: string, communityId: string): Player => ({
  id,
  communityId,
  name: id,
  capabilities: [],
});
const session = (id: string, communityId: string): Session => ({
  id,
  communityId,
  disciplineId: "futsal",
  createdAt: 1,
  poolPlayerIds: [],
  settings: { teamCount: 2 },
  result: { teams: [], gap: 0, flags: [], unassigned: [], solver: { optimal: true, nodesExplored: 0, elapsedMs: 0 } },
});
const squad = (id: string, communityId: string): SavedSquad => ({
  id,
  communityId,
  name: id,
  disciplineId: "futsal",
  createdAt: 1,
  poolPlayerIds: [],
  settings: { teamCount: 2 },
  result: { teams: [], gap: 0, flags: [], unassigned: [], solver: { optimal: true, nodesExplored: 0, elapsedMs: 0 } },
});
const tournament = (id: string, communityId: string): Tournament => ({
  id,
  communityId,
  disciplineId: "futsal",
  name: id,
  format: "single-elim",
  seriesLength: 3,
  teamCount: 4,
  thirdPlace: true,
  createdAt: 1,
  status: "draft",
  teams: [],
  matches: [],
});

describe("removeCommunityCascade", () => {
  it("deletes every record owned by the community and reports the counts", async () => {
    const s = stores();
    await s.communityStore.saveCommunity(community("c1", "Sunday"));
    await s.rosterStore.savePlayer(player("p1", "c1"));
    await s.rosterStore.savePlayer(player("p2", "c1"));
    await s.sessionStore.saveSession(session("s1", "c1"));
    await s.savedSquadStore.saveSavedSquad(squad("q1", "c1"));
    await s.tournamentStore.saveTournament(tournament("t1", "c1"));

    const counts = await removeCommunityCascade(s, "c1");

    expect(counts).toEqual({ players: 2, sessions: 1, squads: 1, tournaments: 1 });
    expect(await s.communityStore.listCommunities()).toEqual([]);
    expect(await s.rosterStore.listPlayers()).toEqual([]);
    expect(await s.sessionStore.listSessions()).toEqual([]);
    expect(await s.savedSquadStore.listSavedSquads()).toEqual([]);
    expect(await s.tournamentStore.listTournaments()).toEqual([]);
  });

  it("leaves records belonging to other communities untouched", async () => {
    const s = stores();
    await s.communityStore.saveCommunity(community("c1", "Sunday"));
    await s.communityStore.saveCommunity(community("c2", "Tuesday"));
    await s.rosterStore.savePlayer(player("p1", "c1"));
    await s.rosterStore.savePlayer(player("p2", "c2"));
    await s.sessionStore.saveSession(session("s1", "c1"));
    await s.sessionStore.saveSession(session("s2", "c2"));
    await s.tournamentStore.saveTournament(tournament("t1", "c1"));
    await s.tournamentStore.saveTournament(tournament("t2", "c2"));

    const counts = await removeCommunityCascade(s, "c1");

    expect(counts).toEqual({ players: 1, sessions: 1, squads: 0, tournaments: 1 });
    expect((await s.communityStore.listCommunities()).map((c) => c.id)).toEqual(["c2"]);
    expect((await s.rosterStore.listPlayers()).map((p) => p.id)).toEqual(["p2"]);
    expect((await s.sessionStore.listSessions()).map((x) => x.id)).toEqual(["s2"]);
    expect((await s.tournamentStore.listTournaments()).map((t) => t.id)).toEqual(["t2"]);
  });

  it("reports zero counts for an empty community and still deletes it", async () => {
    const s = stores();
    await s.communityStore.saveCommunity(community("c1", "Sunday"));

    const counts = await removeCommunityCascade(s, "c1");

    expect(counts).toEqual({ players: 0, sessions: 0, squads: 0, tournaments: 0 });
    expect(await s.communityStore.listCommunities()).toEqual([]);
  });
});
