import type { Community, Discipline, Id, Player, Session, Tournament } from "../domain/types";
import { SEED_DISCIPLINES } from "../domain/seed";
import type { CommunityStore, DisciplineStore, RosterStore, SessionStore, TournamentStore } from "./types";

const DEFAULT_DB = "team-builder";
const DB_VERSION = 6;
const COMMUNITY_STORE = "communities";
const PLAYER_STORE = "players";
const SESSION_STORE = "sessions";
const DISCIPLINE_STORE = "disciplines";
const TOURNAMENT_STORE = "tournaments";
function openDb(dbName: string): Promise<IDBDatabase> {
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

function reqToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

/** Single-transaction atomic replace of an object store. */
function replaceAll<T extends { id: string }>(dbName: string, storeName: string, items: T[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, DB_VERSION);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      store.clear();
      for (const item of items) store.put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Replace failed"));
    };
    request.onerror = () => reject(request.error ?? new Error("Could not open IndexedDB"));
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
  let dbPromise: Promise<IDBDatabase> | null = null;
  const db = (): Promise<IDBDatabase> => (dbPromise ??= openDb(dbName));
  return {
    async list() {
      const database = await db();
      const store = database.transaction(storeName, "readonly").objectStore(storeName);
      return reqToPromise(store.getAll() as IDBRequest<T[]>);
    },
    async save(item: T) {
      const database = await db();
      const store = database.transaction(storeName, "readwrite").objectStore(storeName);
      await reqToPromise(store.put(item));
    },
    async remove(id: Id) {
      const database = await db();
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

export function createIndexedDbDisciplineStore(dbName = DEFAULT_DB): DisciplineStore {
  const crud = createCrud<Discipline>(dbName, DISCIPLINE_STORE);
  return {
    listDisciplines: crud.list,
    saveDiscipline: crud.save,
    deleteDiscipline: crud.remove,
  };
}
