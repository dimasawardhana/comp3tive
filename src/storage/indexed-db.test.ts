import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  DB_VERSION,
  createIndexedDbRosterStore,
  createIndexedDbSessionStore,
  createIndexedDbDisciplineStore,
  createIndexedDbTournamentStore,
} from "./indexed-db";
import type { Discipline, Player, Session, Tournament } from "../domain/types";
import { FUTSAL_DISCIPLINE, MLBB_DISCIPLINE } from "../domain/seed";

const player = (id: string, name: string): Player => ({ id, communityId: "c1", name, capabilities: [] });

/**
 * The schema version that shipped without badminton. A profile written at this
 * version already has a discipline store, so the first-open seed never runs for
 * it again and only the upgrade path can add a discipline shipped later.
 */
const PRE_BADMINTON_VERSION = 6;

describe("indexed-db roster store (smoke)", () => {
  it("persists players across adapter instances (simulated reload)", async () => {
    const a = createIndexedDbRosterStore("comp3tive-test-1");
    await a.savePlayer(player("1", "Budi"));
    await a.savePlayer(player("2", "Andi"));

    // A fresh adapter = a fresh page load; the data must still be there.
    const b = createIndexedDbRosterStore("comp3tive-test-1");
    const all = await b.listPlayers();
    expect(all.map((p) => p.name).sort()).toEqual(["Andi", "Budi"]);
  });

  it("upserts by id and deletes", async () => {
    const store = createIndexedDbRosterStore("comp3tive-test-2");
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
    const a = createIndexedDbSessionStore("comp3tive-test-3");
    await a.saveSession(session("s1"));
    await a.saveSession(session("s2"));

    const b = createIndexedDbSessionStore("comp3tive-test-3");
    const all = await b.listSessions();
    expect(all.map((s) => s.id).sort()).toEqual(["s1", "s2"]);
  });

  it("upserts by id and deletes", async () => {
    const store = createIndexedDbSessionStore("comp3tive-test-4");
    await store.saveSession(session("s1"));
    await store.saveSession({ ...session("s1"), settings: { teamCount: 3 } });
    expect((await store.listSessions())[0].settings.teamCount).toBe(3);

    await store.deleteSession("s1");
    expect(await store.listSessions()).toEqual([]);
  });
});

describe("indexed-db discipline store (smoke)", () => {
  const custom: Discipline = {
    id: "padel-x",
    name: "Padel",
    shortName: "Padel",
    roles: [{ id: "right", name: "Right" }],
    attributes: [{ id: "skill", name: "Skill" }],
    strengthModel: { kind: "mean" },
    team: { minTeamSize: 2, maxTeamSize: null, rolesRequired: false },
  };

  /**
   * A database holding exactly these disciplines, written at `version`.
   * Opened directly rather than through a store, because a store opens at the
   * current version and would perform the upgrade itself - which is the thing
   * under test.
   */
  const seedDisciplinesAt = (dbName: string, version: number, disciplines: Discipline[]): Promise<void> => {
    const { promise, resolve, reject } = Promise.withResolvers<void>();
    const request = indexedDB.open(dbName, version);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore("disciplines", { keyPath: "id" });
      for (const d of disciplines) store.put(d);
    };
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
    request.onerror = () => reject(request.error ?? new Error(`Could not seed ${dbName} at version ${version}`));
    return promise;
  };

  /** A profile as it was before badminton shipped: two seeds and one custom row. */
  const seedPreBadmintonProfile = (dbName: string): Promise<void> =>
    seedDisciplinesAt(dbName, PRE_BADMINTON_VERSION, [FUTSAL_DISCIPLINE, MLBB_DISCIPLINE, custom]);

  /** The stored discipline ids, read the way a page load reads them. */
  const readStoredIds = (dbName: string): Promise<string[]> => {
    const { promise, resolve, reject } = Promise.withResolvers<string[]>();
    const request = indexedDB.open(dbName, DB_VERSION);
    request.onsuccess = () => {
      const db = request.result;
      const all = db.transaction("disciplines", "readonly").objectStore("disciplines").getAll();
      all.onsuccess = () => {
        db.close();
        // Key order, deliberately: this asserts the rows on disk, not display order.
        resolve(all.result.map((d: Discipline) => d.id));
      };
      all.onerror = () => reject(all.error ?? new Error(`Could not read the disciplines in ${dbName}`));
    };
    request.onerror = () => reject(request.error ?? new Error(`Could not open ${dbName}`));
    return promise;
  };

  it("seeds the built-in disciplines on first open", async () => {
    const store = createIndexedDbDisciplineStore("comp3tive-test-disc-1");
    const list = await store.listDisciplines();
    // Order, not just membership: the store's key order is alphabetical, which
    // would make badminton the app's default discipline.
    expect(list.map((d) => d.id)).toEqual(["futsal", "mlbb", "badminton"]);
    expect(list.every((d) => d.builtIn)).toBe(true);
  });

  it("saves and deletes custom disciplines, keeping the seeds", async () => {
    const store = createIndexedDbDisciplineStore("comp3tive-test-disc-2");
    await store.saveDiscipline(custom);
    expect((await store.listDisciplines()).some((d) => d.id === custom.id)).toBe(true);

    await store.deleteDiscipline(custom.id);
    const after = await store.listDisciplines();
    expect(after.some((d) => d.id === custom.id)).toBe(false);
    expect(after.map((d) => d.id)).toEqual(["futsal", "mlbb", "badminton"]);
  });

  it("upgrades a profile that predates badminton: it gains the seed, keeps its own rows", async () => {
    // Without the versioned backfill this profile is stuck on two disciplines
    // forever, no matter how many times it is reopened.
    await seedPreBadmintonProfile("comp3tive-test-disc-3");
    const store = createIndexedDbDisciplineStore("comp3tive-test-disc-3");

    const ids = (await store.listDisciplines()).map((d) => d.id);
    expect(ids).toEqual(["futsal", "mlbb", "badminton", "padel-x"]);
  });

  it("a current-version profile that lacks a seed is not given it back on the next launch", async () => {
    // A v7 profile that deleted badminton. Nothing may put it back: the catalog
    // is the user's to edit, and "ensure every seed exists" - the naive form of
    // the backfill - would undo their deletion on every launch, forever.
    await seedDisciplinesAt("comp3tive-test-disc-4", DB_VERSION, [FUTSAL_DISCIPLINE, MLBB_DISCIPLINE, custom]);

    // The rows on disk, read the way a page load reads them: no upgrade fires.
    expect(await readStoredIds("comp3tive-test-disc-4")).toEqual(["futsal", "mlbb", "padel-x"]);
    // And through the app's own path, which is where a naive ensure-seeds would
    // live if someone put it there instead of in the upgrade.
    const store = createIndexedDbDisciplineStore("comp3tive-test-disc-4");
    expect((await store.listDisciplines()).map((d) => d.id)).toEqual(["futsal", "mlbb", "padel-x"]);
  });

  it("upgrading adds the new seed without restoring one the user deleted", async () => {
    // The same pre-badminton profile, except this one deleted futsal. The
    // backfill is for seeds this version introduced, not for every seed the code
    // knows: re-seeding everything here would resurrect futsal.
    await seedDisciplinesAt("comp3tive-test-disc-5", PRE_BADMINTON_VERSION, [MLBB_DISCIPLINE, custom]);
    const store = createIndexedDbDisciplineStore("comp3tive-test-disc-5");

    const ids = (await store.listDisciplines()).map((d) => d.id);
    expect(ids).toEqual(["mlbb", "badminton", "padel-x"]);
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
    const a = createIndexedDbTournamentStore("comp3tive-test-t1");
    await a.saveTournament(tournament("tr1"));
    const b = createIndexedDbTournamentStore("comp3tive-test-t1");
    const all = await b.listTournaments();
    expect(all.map((t) => t.id)).toEqual(["tr1"]);
    await b.deleteTournament("tr1");
    expect(await createIndexedDbTournamentStore("comp3tive-test-t1").listTournaments()).toEqual([]);
  });

  it("replaces all tournaments atomically", async () => {
    const store = createIndexedDbTournamentStore("comp3tive-test-t2");
    await store.saveTournament(tournament("old"));
    await store.replaceAllTournaments([tournament("new")]);
    expect((await store.listTournaments()).map((t) => t.id)).toEqual(["new"]);
  });
});
