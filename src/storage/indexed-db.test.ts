import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  createIndexedDbRosterStore,
  createIndexedDbSessionStore,
  createIndexedDbDisciplineStore,
  createIndexedDbTournamentStore,
} from "./indexed-db";
import type { Discipline, Player, Session, Tournament } from "../domain/types";

const player = (id: string, name: string): Player => ({ id, communityId: "c1", name, capabilities: [] });

describe("indexed-db roster store (smoke)", () => {
  it("persists players across adapter instances (simulated reload)", async () => {
    const a = createIndexedDbRosterStore("team-builder-test-1");
    await a.savePlayer(player("1", "Budi"));
    await a.savePlayer(player("2", "Andi"));

    // A fresh adapter = a fresh page load; the data must still be there.
    const b = createIndexedDbRosterStore("team-builder-test-1");
    const all = await b.listPlayers();
    expect(all.map((p) => p.name).sort()).toEqual(["Andi", "Budi"]);
  });

  it("upserts by id and deletes", async () => {
    const store = createIndexedDbRosterStore("team-builder-test-2");
    await store.savePlayer(player("1", "Budi"));
    await store.savePlayer({ ...player("1", "Budi S."), notes: "captain" });

    const all = await store.listPlayers();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe("Budi S.");

    await store.deletePlayer("1");
    expect(await store.listPlayers()).toEqual([]);
  });
});

describe("indexed-db session store (smoke)", () => {
  const session = (id: string): Session => ({
    id,
    communityId: "c1",
    disciplineId: "futsal",
    createdAt: 1000,
    poolPlayerIds: ["1", "2"],
    settings: { teamCount: 2 },
    result: { teams: [], gap: 0, flags: [], unassigned: [], solver: { optimal: true, nodesExplored: 0, elapsedMs: 0 } },
  });

  it("persists sessions across adapter instances (simulated reload)", async () => {
    const a = createIndexedDbSessionStore("team-builder-test-3");
    await a.saveSession(session("s1"));
    await a.saveSession(session("s2"));

    const b = createIndexedDbSessionStore("team-builder-test-3");
    const all = await b.listSessions();
    expect(all.map((s) => s.id).sort()).toEqual(["s1", "s2"]);
  });

  it("upserts by id and deletes", async () => {
    const store = createIndexedDbSessionStore("team-builder-test-4");
    await store.saveSession(session("s1"));
    await store.saveSession({ ...session("s1"), settings: { teamCount: 3 } });
    expect((await store.listSessions())[0].settings.teamCount).toBe(3);

    await store.deleteSession("s1");
    expect(await store.listSessions()).toEqual([]);
  });
});

describe("indexed-db discipline store (smoke)", () => {
  const custom: Discipline = {
    id: "badminton-x",
    name: "Badminton",
    shortName: "Badminton",
    roles: [{ id: "singles", name: "Singles" }],
    attributes: [{ id: "skill", name: "Skill" }],
    strengthModel: { kind: "mean" },
    team: { minTeamSize: 2, maxTeamSize: null, rolesRequired: false },
  };

  it("seeds the built-in disciplines on first open", async () => {
    const store = createIndexedDbDisciplineStore("team-builder-test-disc-1");
    const list = await store.listDisciplines();
    expect(list.map((d) => d.id).sort()).toEqual(["futsal", "mlbb"]);
    expect(list.every((d) => d.builtIn)).toBe(true);
  });

  it("saves and deletes custom disciplines, keeping the seeds", async () => {
    const store = createIndexedDbDisciplineStore("team-builder-test-disc-2");
    await store.saveDiscipline(custom);
    expect((await store.listDisciplines()).some((d) => d.id === custom.id)).toBe(true);

    await store.deleteDiscipline(custom.id);
    const after = await store.listDisciplines();
    expect(after.some((d) => d.id === custom.id)).toBe(false);
    expect(after.map((d) => d.id).sort()).toEqual(["futsal", "mlbb"]);
  });
});

describe("indexed-db tournament store (smoke)", () => {
  const tournament = (id: string): Tournament => ({
    id,
    communityId: "c1",
    disciplineId: "futsal",
    name: "Night cup",
    format: "single-elim",
    seriesLength: 3,
    teamCount: 4,
    thirdPlace: true,
    createdAt: 1000,
    status: "draft",
    teams: [],
    matches: [],
  });

  it("persists tournaments across adapter instances", async () => {
    const a = createIndexedDbTournamentStore("team-builder-test-t1");
    await a.saveTournament(tournament("tr1"));
    const b = createIndexedDbTournamentStore("team-builder-test-t1");
    const all = await b.listTournaments();
    expect(all.map((t) => t.id)).toEqual(["tr1"]);
    await b.deleteTournament("tr1");
    expect(await createIndexedDbTournamentStore("team-builder-test-t1").listTournaments()).toEqual([]);
  });

  it("replaces all tournaments atomically", async () => {
    const store = createIndexedDbTournamentStore("team-builder-test-t2");
    await store.saveTournament(tournament("old"));
    await store.replaceAllTournaments([tournament("new")]);
    expect((await store.listTournaments()).map((t) => t.id)).toEqual(["new"]);
  });
});
