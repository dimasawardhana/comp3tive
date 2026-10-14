import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { createIndexedDbDisciplineStore, createIndexedDbRosterStore, createIndexedDbSavedSquadStore, createIndexedDbSessionStore } from "./indexed-db";
import { DB_VERSION } from "./indexed-db";
import { MLBB_RETIRED_ROLES, MLBB_DISCIPLINE } from "../domain/seed";
import type { Capability, Player, SavedSquad, Session, SplitResult } from "../domain/types";

/**
 * The v7 → v8 rewrite: MLBB's roles became lanes, and every stored id from the
 * old vocabulary is rewritten through `MLBB_RETIRED_ROLES`.
 *
 * The failure this test exists to prevent is silent and total. `validateCapability`
 * refuses a capability whose role the discipline does not declare, so an
 * unmigrated roster cannot be saved again, and `parseBackup` refuses a whole
 * file on its first bad player — so an unmigrated backup cannot be imported
 * either. Both would look like the app rejecting the user's own data.
 *
 * **The test opens at version 7 with the OLD catalog and the OLD role ids, then
 * lets the app's own open path carry it to `DB_VERSION`.** That is the whole
 * point: asserting against a hand-built v7 database would prove the rewrite
 * function works, not that the upgrade reaches it. This drives the real
 * `indexedDB.open(name, DB_VERSION)` → `onupgradeneeded` path.
 */

/** A v7 database, written by hand with the vocabulary v7 actually used. */
function writeV7Database(dbName: string, records: {
  player: Player;
  session: Session;
  squad: SavedSquad;
  customDisciplineId: string;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(dbName, 7);
    open.onupgradeneeded = () => {
      const db = open.result;
      for (const store of ["communities", "players", "sessions", "tournaments", "saved-squads", "disciplines"]) {
        db.createObjectStore(store, { keyPath: "id" });
      }
      const tx = open.transaction!;
      // The catalog as v7 shipped it: MLBB still declaring hero classes, plus a
      // custom discipline that deliberately owns a role *called* `tank` — the
      // case a blanket rewrite would corrupt.
      tx.objectStore("disciplines").put({
        ...MLBB_DISCIPLINE,
        roles: [
          { id: "tank", name: "Tank" },
          { id: "assassin", name: "Assassin" },
          { id: "mage", name: "Mage" },
          { id: "marksman", name: "Marksman" },
          { id: "fighter", name: "Fighter" },
        ],
      });
      tx.objectStore("disciplines").put({
        id: records.customDisciplineId,
        name: "Petanque",
        shortName: "PTQ",
        roles: [{ id: "tank", name: "Tank" }],
        attributes: [{ id: "aim", name: "Aim" }],
        strengthModel: { kind: "mean" },
        team: { minTeamSize: 1, maxTeamSize: 1, rolesRequired: true },
      });
      tx.objectStore("players").put(records.player);
      tx.objectStore("sessions").put(records.session);
      tx.objectStore("saved-squads").put(records.squad);
    };
    open.onsuccess = () => {
      open.result.close();
      resolve();
    };
    open.onerror = () => reject(open.error);
  });
}

const mlbbCapability = (eligibleRoles: string[], preferredRole: string | null): Capability => ({
  disciplineId: "mlbb",
  attributeRatings: { mechanics: 4, "game-sense": 4, "hero-pool": 3, teamwork: 5 },
  eligibleRoles,
  preferredRole,
});

const splitWithRole = (roleId: string): SplitResult => ({
  teams: [{ index: 0, slots: [{ playerId: "p1", roleId }], totalStrength: 16, avgStrength: 4 }],
  gap: 0,
  flags: [],
  unassigned: [],
  solver: { optimal: true, nodesExplored: 0, elapsedMs: 0 },
});

/** Open through the app's own path, which is what triggers the upgrade. */
async function openMigrated(dbName: string) {
  // Constructing a store opens the database at DB_VERSION, running the upgrade.
  const roster = createIndexedDbRosterStore(dbName);
  const sessions = createIndexedDbSessionStore(dbName);
  const squads = createIndexedDbSavedSquadStore(dbName);
  const disciplines = createIndexedDbDisciplineStore(dbName);
  return {
    players: await roster.listPlayers(),
    sessions: await sessions.listSessions(),
    squads: await squads.listSavedSquads(),
    disciplines: await disciplines.listDisciplines(),
  };
}

describe("v7 to v8: the role vocabulary is rewritten", () => {
  it("moves a stored MLBB capability from hero classes to lanes", async () => {
    const dbName = "comp3tive-test-rolemig-a";
    await writeV7Database(dbName, {
      player: { id: "p1", communityId: "c1", name: "Budi", capabilities: [mlbbCapability(["tank", "fighter"], "tank")], createdAt: 1 },
      session: { id: "s1", communityId: "c1", disciplineId: "mlbb", createdAt: 1, poolPlayerIds: ["p1"], settings: { teamCount: 1 }, result: splitWithRole("assassin") },
      squad: { id: "q1", communityId: "c1", name: "Squad", disciplineId: "mlbb", createdAt: 1, poolPlayerIds: ["p1"], settings: { teamCount: 1 }, result: splitWithRole("marksman") },
      customDisciplineId: "petanque-a",
    });

    const got = await openMigrated(dbName);

    // Tank → roam, Fighter → exp. Both were drafted into their default lane.
    expect(got.players[0].capabilities[0].eligibleRoles).toEqual(["roam", "exp-lane"]);
    expect(got.players[0].capabilities[0].preferredRole).toBe("roam");
    // Slot ids are display-only but would render as a missing role name.
    expect(got.sessions[0].result.teams[0].slots[0].roleId).toBe("jungle");
    expect(got.squads[0].result.teams[0].slots[0].roleId).toBe("gold-lane");
  });

  it("refreshes the built-in MLBB catalog from the code", async () => {
    const dbName = "comp3tive-test-rolemig-b";
    await writeV7Database(dbName, {
      player: { id: "p1", communityId: "c1", name: "Budi", capabilities: [mlbbCapability(["tank"], "tank")], createdAt: 1 },
      session: { id: "s1", communityId: "c1", disciplineId: "mlbb", createdAt: 1, poolPlayerIds: [], settings: { teamCount: 1 }, result: splitWithRole("tank") },
      squad: { id: "q1", communityId: "c1", name: "Squad", disciplineId: "mlbb", createdAt: 1, poolPlayerIds: [], settings: { teamCount: 1 }, result: splitWithRole("tank") },
      customDisciplineId: "petanque-b",
    });

    const got = await openMigrated(dbName);
    const mlbb = got.disciplines.find((d) => d.id === "mlbb");
    // A built-in is code-authoritative: the stored row's hero classes are
    // replaced by the seed's lanes, not rewritten through the map.
    expect(mlbb?.roles.map((r) => r.id)).toEqual(["gold-lane", "exp-lane", "mid-lane", "jungle", "roam"]);
  });

  it("leaves a custom discipline's own role called `tank` alone", async () => {
    const dbName = "comp3tive-test-rolemig-c";
    const custom: Player = {
      id: "p1", communityId: "c1", name: "Budi",
      capabilities: [
        mlbbCapability(["tank"], "tank"),
        { disciplineId: "petanque-c", attributeRatings: { aim: 3 }, eligibleRoles: ["tank"], preferredRole: "tank" },
      ],
      createdAt: 1,
    };
    await writeV7Database(dbName, {
      player: custom,
      session: { id: "s1", communityId: "c1", disciplineId: "mlbb", createdAt: 1, poolPlayerIds: [], settings: { teamCount: 1 }, result: splitWithRole("tank") },
      squad: { id: "q1", communityId: "c1", name: "Squad", disciplineId: "mlbb", createdAt: 1, poolPlayerIds: [], settings: { teamCount: 1 }, result: splitWithRole("tank") },
      customDisciplineId: "petanque-c",
    });

    const got = await openMigrated(dbName);
    const [mlbb, petanque] = got.players[0].capabilities;
    // The retired id is an ordinary word. Scoping the rewrite by discipline is
    // what keeps this discipline's eligibility list intact — a blanket rewrite
    // of every `tank` in storage would have silently renamed it.
    expect(mlbb.eligibleRoles).toEqual(["roam"]);
    expect(petanque.eligibleRoles).toEqual(["tank"]);
    expect(petanque.preferredRole).toBe("tank");
    expect(got.disciplines.find((d) => d.id === "petanque-c")?.roles.map((r) => r.id)).toEqual(["tank"]);
  });

  it("is idempotent, and never rewrites an id that is already a lane", async () => {
    const dbName = "comp3tive-test-rolemig-d";
    await writeV7Database(dbName, {
      player: { id: "p1", communityId: "c1", name: "Budi", capabilities: [mlbbCapability(["tank"], "tank")], createdAt: 1 },
      session: { id: "s1", communityId: "c1", disciplineId: "mlbb", createdAt: 1, poolPlayerIds: [], settings: { teamCount: 1 }, result: splitWithRole("tank") },
      squad: { id: "q1", communityId: "c1", name: "Squad", disciplineId: "mlbb", createdAt: 1, poolPlayerIds: [], settings: { teamCount: 1 }, result: splitWithRole("tank") },
      customDisciplineId: "petanque-d",
    });

    const first = await openMigrated(dbName);
    // Reopening at the same version runs no upgrade; the values must be stable.
    const second = await openMigrated(dbName);
    expect(second.players[0].capabilities).toEqual(first.players[0].capabilities);
    expect(second.players[0].capabilities[0].eligibleRoles).toEqual(["roam"]);

    // And the map itself is a fixed point on the new vocabulary.
    for (const lane of MLBB_DISCIPLINE.roles.map((r) => r.id)) {
      expect(MLBB_RETIRED_ROLES[lane]).toBeUndefined();
    }
  });

  it("names every retired class, so the map cannot silently shrink", () => {
    // The five hero classes MLBB declared before v8. If one is dropped from the
    // map, a stored capability holding it would keep an id the discipline does
    // not declare — the exact defect this migration exists to prevent.
    expect(Object.keys(MLBB_RETIRED_ROLES).sort()).toEqual(
      ["assassin", "fighter", "mage", "marksman", "tank"],
    );
    // Every lane a class maps to is a role MLBB actually declares now.
    const lanes = new Set(MLBB_DISCIPLINE.roles.map((r) => r.id));
    for (const lane of Object.values(MLBB_RETIRED_ROLES)) {
      expect(lanes.has(lane)).toBe(true);
    }
  });

  it("the upgraded database is at the current version", async () => {
    const dbName = "comp3tive-test-rolemig-e";
    await writeV7Database(dbName, {
      player: { id: "p1", communityId: "c1", name: "Budi", capabilities: [], createdAt: 1 },
      session: { id: "s1", communityId: "c1", disciplineId: "mlbb", createdAt: 1, poolPlayerIds: [], settings: { teamCount: 1 }, result: splitWithRole("tank") },
      squad: { id: "q1", communityId: "c1", name: "Squad", disciplineId: "mlbb", createdAt: 1, poolPlayerIds: [], settings: { teamCount: 1 }, result: splitWithRole("tank") },
      customDisciplineId: "petanque-e",
    });
    await openMigrated(dbName);

    const version = await new Promise<number>((resolve, reject) => {
      const open = indexedDB.open(dbName);
      open.onsuccess = () => {
        const v = open.result.version;
        open.result.close();
        resolve(v);
      };
      open.onerror = () => reject(open.error);
    });
    expect(version).toBe(DB_VERSION);
  });
});
