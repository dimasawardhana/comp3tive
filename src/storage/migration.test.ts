import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  createIndexedDbCommunityStore,
  createIndexedDbDisciplineStore,
  createIndexedDbRosterStore,
  createIndexedDbSavedSquadStore,
  createIndexedDbSessionStore,
  createIndexedDbTournamentStore,
  migrateDatabase,
} from "./indexed-db";
import type { Community, Discipline, Player, SavedSquad, Session, Tournament } from "../domain/types";

/** Store factories for a database, used to read targets back. */
const storesFor = (dbName: string) => ({
  communityStore: createIndexedDbCommunityStore(dbName),
  rosterStore: createIndexedDbRosterStore(dbName),
  sessionStore: createIndexedDbSessionStore(dbName),
  tournamentStore: createIndexedDbTournamentStore(dbName),
  savedSquadStore: createIndexedDbSavedSquadStore(dbName),
  disciplineStore: createIndexedDbDisciplineStore(dbName),
});

/**
 * Create a source database and write records through a connection that is then
 * closed. Store factories would keep a cached connection open, which correctly
 * blocks deleting the source, so the legacy database is seeded directly here.
 */
function seedDatabase(dbName: string, records: Record<string, unknown[]>): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const storeName of Object.keys(records)) {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: "id" });
        }
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      const names = [...db.objectStoreNames];
      const tx = db.transaction(names, "readwrite");
      for (const name of names) {
        const store = tx.objectStore(name);
        for (const record of records[name] ?? []) store.put(record);
      }
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    };
    request.onerror = () => reject(request.error);
  });
}

const community = (id: string, name: string): Community => ({ id, name, createdAt: 1 });
const player = (id: string, communityId: string): Player => ({ id, communityId, name: id, capabilities: [] });
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
const customDiscipline = (id: string): Discipline => ({
  id,
  name: id,
  shortName: id.slice(0, 3).toUpperCase(),
  roles: [],
  attributes: [],
  strengthModel: { kind: "mean" },
  team: { minTeamSize: 2, maxTeamSize: null, rolesRequired: false },
});

describe("migrateDatabase", () => {
  it("copies every store into the target and removes the source", async () => {
    await seedDatabase("mig-src-1", {
      communities: [community("c1", "Sunday")],
      players: [player("p1", "c1"), player("p2", "c1")],
      sessions: [session("s1", "c1")],
      tournaments: [tournament("t1", "c1")],
      "saved-squads": [squad("q1", "c1")],
    });

    const result = await migrateDatabase("mig-src-1", "mig-dst-1");

    expect(result.skipped).toBeNull();
    expect(result.migrated).toBe(true);
    expect(result.sourceRemoved).toBe(true);
    expect(result.copied).toMatchObject({
      communities: 1,
      players: 2,
      sessions: 1,
      tournaments: 1,
      "saved-squads": 1,
    });

    const target = storesFor("mig-dst-1");
    expect((await target.rosterStore.listPlayers()).map((p) => p.id).sort()).toEqual(["p1", "p2"]);
    expect((await target.communityStore.listCommunities()).map((c) => c.id)).toEqual(["c1"]);
    expect((await target.sessionStore.listSessions()).map((s) => s.id)).toEqual(["s1"]);
    expect((await target.tournamentStore.listTournaments()).map((t) => t.id)).toEqual(["t1"]);
    expect((await target.savedSquadStore.listSavedSquads()).map((q) => q.id)).toEqual(["q1"]);
  });

  it("removes the source once the copy is verified", async () => {
    await seedDatabase("mig-src-verify", { players: [player("p1", "c1")] });

    const result = await migrateDatabase("mig-src-verify", "mig-dst-verify");

    expect(result.sourceRemoved).toBe(true);
    // A second run finds nothing left to migrate.
    const again = await migrateDatabase("mig-src-verify", "mig-dst-verify");
    expect(again.skipped).toBe("no-legacy");
  });

  it("never overwrites a target that already holds data", async () => {
    await seedDatabase("mig-src-2", { players: [player("legacy-player", "c1")] });
    const target = storesFor("mig-dst-2");
    await target.rosterStore.savePlayer(player("current-player", "c1"));

    const result = await migrateDatabase("mig-src-2", "mig-dst-2");

    expect(result.skipped).toBe("target-has-data");
    expect(result.migrated).toBe(false);
    expect(result.sourceRemoved).toBe(false);
    expect((await storesFor("mig-dst-2").rosterStore.listPlayers()).map((p) => p.id)).toEqual(["current-player"]);
  });

  it("is a no-op when there is no source database", async () => {
    const result = await migrateDatabase("mig-src-absent", "mig-dst-3");

    expect(result.skipped).toBe("no-legacy");
    expect(result.migrated).toBe(false);
    expect(result.sourceRemoved).toBe(false);
  });

  it("carries custom disciplines over while keeping the seeded catalog", async () => {
    await seedDatabase("mig-src-4", { disciplines: [customDiscipline("badminton")] });

    const result = await migrateDatabase("mig-src-4", "mig-dst-4");

    expect(result.migrated).toBe(true);
    const ids = (await storesFor("mig-dst-4").disciplineStore.listDisciplines()).map((d) => d.id);
    expect(ids).toContain("badminton");
    // Seeded defaults survive alongside the custom entry.
    expect(ids).toContain("futsal");
    expect(ids).toContain("mlbb");
  });

  it("does not resurrect data after the source has been removed", async () => {
    await seedDatabase("mig-src-5", { players: [player("p1", "c1")] });
    await migrateDatabase("mig-src-5", "mig-dst-5");

    // Simulate the user clearing everything in the new database.
    const target = storesFor("mig-dst-5");
    await target.rosterStore.deletePlayer("p1");
    expect(await target.rosterStore.listPlayers()).toEqual([]);

    const second = await migrateDatabase("mig-src-5", "mig-dst-5");

    expect(second.skipped).toBe("no-legacy");
    expect(await storesFor("mig-dst-5").rosterStore.listPlayers()).toEqual([]);
  });
});
