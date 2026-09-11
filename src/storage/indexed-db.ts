import type { Community, Discipline, Id, Player, SavedSquad, Session, Tournament } from "../domain/types";
import { SEED_DISCIPLINES } from "../domain/seed";
import type {
  CommunityStore,
  DisciplineStore,
  RosterStore,
  SavedSquadStore,
  SessionStore,
  TournamentStore,
} from "./types";

const DEFAULT_DB = "comp3tive";
/**
 * The database name used before the app was renamed. Existing installs keep
 * their data here, so it is migrated on first open and then removed.
 */
const LEGACY_DB = "team-builder";
const DB_VERSION = 6;
const COMMUNITY_STORE = "communities";
const PLAYER_STORE = "players";
const SESSION_STORE = "sessions";
const DISCIPLINE_STORE = "disciplines";
const TOURNAMENT_STORE = "tournaments";
const SAVED_SQUAD_STORE = "saved-squads";

/** Stores holding user data. Seeded config stores are deliberately excluded. */
const DATA_STORES = [COMMUNITY_STORE, PLAYER_STORE, SESSION_STORE, TOURNAMENT_STORE, SAVED_SQUAD_STORE];
const ALL_STORES = [...DATA_STORES, DISCIPLINE_STORE];

/** Open (creating if absent) the app database and ensure every store exists. */
function openAppDb(dbName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(COMMUNITY_STORE)) {
        db.createObjectStore(COMMUNITY_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(PLAYER_STORE)) {
        db.createObjectStore(PLAYER_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(SESSION_STORE)) {
        db.createObjectStore(SESSION_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(TOURNAMENT_STORE)) {
        db.createObjectStore(TOURNAMENT_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(SAVED_SQUAD_STORE)) {
        db.createObjectStore(SAVED_SQUAD_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(DISCIPLINE_STORE)) {
        const store = db.createObjectStore(DISCIPLINE_STORE, { keyPath: "id" });
        // Seed the catalog on first open (config data, editable later).
        for (const discipline of SEED_DISCIPLINES) store.put(discipline);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open IndexedDB"));
  });
}

/** Open a database exactly as it exists, without creating stores or seeding. */
function openExistingDb(dbName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open IndexedDB"));
  });
}

/** Resolve once an IndexedDB request settles. */
function reqToPromise<T>(request: IDBRequest<T>): Promise<T> {
  const { promise, resolve, reject } = Promise.withResolvers<T>();
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  return promise;
}

function countIn(db: IDBDatabase, storeName: string): Promise<number> {
  return reqToPromise(db.transaction(storeName, "readonly").objectStore(storeName).count());
}

function readAllFrom(db: IDBDatabase, storeName: string): Promise<unknown[]> {
  const store = db.transaction(storeName, "readonly").objectStore(storeName);
  return reqToPromise(store.getAll() as IDBRequest<unknown[]>);
}

function writeAllInto(db: IDBDatabase, storeName: string, records: unknown[]): Promise<void> {
  const { promise, resolve, reject } = Promise.withResolvers<void>();
  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);
  for (const record of records) store.put(record);
  tx.oncomplete = () => resolve();
  tx.onerror = () => reject(tx.error ?? new Error("Could not write migrated records"));
  tx.onabort = () => reject(tx.error ?? new Error("Could not write migrated records"));
  return promise;
}

function deleteDatabase(dbName: string): Promise<boolean> {
  const { promise, resolve } = Promise.withResolvers<boolean>();
  const request = indexedDB.deleteDatabase(dbName);
  request.onsuccess = () => resolve(true);
  request.onerror = () => resolve(false);
  // Another tab is holding a connection; leave it for a later launch.
  request.onblocked = () => resolve(false);
  return promise;
}

async function databaseExists(dbName: string): Promise<boolean> {
  if (typeof indexedDB.databases === "function") {
    try {
      const databases = await indexedDB.databases();
      return databases.some((entry) => entry.name === dbName);
    } catch {
      // Fall through to the probing implementation below.
    }
  }
  // Engines without `databases()` create a missing database on open, so an
  // empty result means it never existed and the empty shell is discarded.
  const db = await openExistingDb(dbName);
  const exists = db.objectStoreNames.length > 0;
  db.close();
  if (!exists) await deleteDatabase(dbName);
  return exists;
}

export interface DatabaseMigration {
  /** True once records were copied across. */
  migrated: boolean;
  /** How many records were copied, per store. */
  copied: Record<string, number>;
  /** Why nothing was copied, when nothing was. */
  skipped: "no-legacy" | "target-has-data" | null;
  /** True once the source database has been removed. */
  sourceRemoved: boolean;
}

/**
 * Copy every record from `fromName` into `toName`, then remove `fromName`.
 *
 * Written for the database rename but general in shape. Two safety rules: an
 * existing, non-empty target is never overwritten (the copy is skipped rather
 * than merged), and the copy is verified store by store before the source is
 * deleted, so a failure leaves the original intact and the next launch retries.
 */
export async function migrateDatabase(fromName: string, toName: string): Promise<DatabaseMigration> {
  const result: DatabaseMigration = { migrated: false, copied: {}, skipped: null, sourceRemoved: false };
  if (typeof indexedDB === "undefined") return result;

  if (!(await databaseExists(fromName))) {
    result.skipped = "no-legacy";
    return result;
  }

  const source = await openExistingDb(fromName);
  let target: IDBDatabase | null = null;
  try {
    target = await openAppDb(toName);

    // Only user data counts here: the seeded discipline catalog would make a
    // freshly created target look occupied and block every migration.
    const occupied = await Promise.all(DATA_STORES.map((storeName) => countIn(target as IDBDatabase, storeName)));
    if (occupied.some((count) => count > 0)) {
      result.skipped = "target-has-data";
      return result;
    }

    const expected: Array<[string, number]> = [];
    for (const storeName of ALL_STORES) {
      if (!source.objectStoreNames.contains(storeName)) continue;
      if (!target.objectStoreNames.contains(storeName)) continue;
      const records = await readAllFrom(source, storeName);
      expected.push([storeName, records.length]);
      if (records.length === 0) continue;
      await writeAllInto(target, storeName, records);
      result.copied[storeName] = records.length;
    }

    // Release the source before removing it, then confirm the copy landed.
    source.close();
    let verified = true;
    for (const [storeName, count] of expected) {
      if ((await countIn(target, storeName)) < count) {
        verified = false;
        break;
      }
    }

    result.migrated = verified;
    if (verified) result.sourceRemoved = await deleteDatabase(fromName);
    return result;
  } finally {
    source.close();
    target?.close();
  }
}

const connections = new Map<string, Promise<IDBDatabase>>();
let legacyMigration: Promise<DatabaseMigration> | null = null;

/** Migrate the pre-rename database once per page load. */
function ensureLegacyMigration(): Promise<DatabaseMigration> {
  return (legacyMigration ??= migrateDatabase(LEGACY_DB, DEFAULT_DB));
}

/**
 * Shared connection per database name. The default database waits for the
 * legacy migration first, so no store can read an empty catalog while the copy
 * is still in flight. A failed open is evicted so the next call can retry.
 */
function openDb(dbName: string): Promise<IDBDatabase> {
  let connection = connections.get(dbName);
  if (!connection) {
    const opened =
      dbName === DEFAULT_DB ? ensureLegacyMigration().then(() => openAppDb(dbName)) : openAppDb(dbName);
    connection = opened.catch((error: unknown) => {
      connections.delete(dbName);
      throw error;
    });
    connections.set(dbName, connection);
  }
  return connection;
}

/** Single-transaction atomic replace of an object store. */
function replaceAll<T extends { id: string }>(dbName: string, storeName: string, items: T[]): Promise<void> {
  return openDb(dbName).then((db) => {
    const { promise, resolve, reject } = Promise.withResolvers<void>();
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    store.clear();
    for (const item of items) store.put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Replace failed"));
    return promise;
  });
}

function createCrud<T extends { id: string }>(
  dbName: string,
  storeName: string,
): {
  list(): Promise<T[]>;
  save(item: T): Promise<void>;
  remove(id: Id): Promise<void>;
} {
  return {
    async list() {
      const database = await openDb(dbName);
      const store = database.transaction(storeName, "readonly").objectStore(storeName);
      return reqToPromise(store.getAll() as IDBRequest<T[]>);
    },
    async save(item: T) {
      const database = await openDb(dbName);
      const store = database.transaction(storeName, "readwrite").objectStore(storeName);
      await reqToPromise(store.put(item));
    },
    async remove(id: Id) {
      const database = await openDb(dbName);
      const store = database.transaction(storeName, "readwrite").objectStore(storeName);
      await reqToPromise(store.delete(id));
    },
  };
}

/**
 * IndexedDB-backed stores. All adapters share one database (one object store
 * per aggregate) so a future backend replaces them behind the same interfaces.
 */
export function createIndexedDbCommunityStore(dbName = DEFAULT_DB): CommunityStore {
  const crud = createCrud<Community>(dbName, COMMUNITY_STORE);
  return {
    listCommunities: crud.list,
    saveCommunity: crud.save,
    deleteCommunity: crud.remove,
    async replaceAllCommunities(communities: Community[]) {
      await replaceAll<Community>(dbName, COMMUNITY_STORE, communities);
    },
  };
}

export function createIndexedDbRosterStore(dbName = DEFAULT_DB): RosterStore {
  const crud = createCrud<Player>(dbName, PLAYER_STORE);
  return {
    listPlayers: crud.list,
    savePlayer: crud.save,
    deletePlayer: crud.remove,
    async replaceAllPlayers(players: Player[]) {
      await replaceAll<Player>(dbName, PLAYER_STORE, players);
    },
  };
}

export function createIndexedDbSessionStore(dbName = DEFAULT_DB): SessionStore {
  const crud = createCrud<Session>(dbName, SESSION_STORE);
  return {
    listSessions: crud.list,
    saveSession: crud.save,
    deleteSession: crud.remove,
    async replaceAllSessions(sessions: Session[]) {
      await replaceAll<Session>(dbName, SESSION_STORE, sessions);
    },
  };
}

export function createIndexedDbTournamentStore(dbName = DEFAULT_DB): TournamentStore {
  const crud = createCrud<Tournament>(dbName, TOURNAMENT_STORE);
  return {
    listTournaments: crud.list,
    saveTournament: crud.save,
    deleteTournament: crud.remove,
    async replaceAllTournaments(tournaments: Tournament[]) {
      await replaceAll<Tournament>(dbName, TOURNAMENT_STORE, tournaments);
    },
  };
}

export function createIndexedDbSavedSquadStore(dbName = DEFAULT_DB): SavedSquadStore {
  const crud = createCrud<SavedSquad>(dbName, SAVED_SQUAD_STORE);
  return {
    listSavedSquads: crud.list,
    saveSavedSquad: crud.save,
    deleteSavedSquad: crud.remove,
    async replaceAllSavedSquads(squads: SavedSquad[]) {
      await replaceAll<SavedSquad>(dbName, SAVED_SQUAD_STORE, squads);
    },
  };
}

export function createIndexedDbDisciplineStore(dbName = DEFAULT_DB): DisciplineStore {
  const crud = createCrud<Discipline>(dbName, DISCIPLINE_STORE);
  return {
    listDisciplines: crud.list,
    saveDiscipline: crud.save,
    deleteDiscipline: crud.remove,
  };
}
