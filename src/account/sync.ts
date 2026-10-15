/**
 * The Account's data lifecycle: adopt, pull, clear.
 *
 * Three moments, and each is one deliberate act:
 *
 * - **Adopt** pushes this device's local data up as the Account's first
 *   document for a community. Insert-only on the server (a 409 if the Account
 *   already has data there), because adoption is "this device founds the
 *   Account" and an overwrite through it would be silent data loss.
 * - **Pull** replaces this device's local stores with the Account's documents.
 *   The read path stays IndexedDB (ADR-0007): pull writes into the stores and
 *   the caller refreshes the hooks; no screen awaits a fetch to render.
 * - **Clear** empties the domain stores on sign-out. Deliberately *not*
 *   `localStorage.clear()`: `tb-theme`, `tb-layout` and `tb-rail` belong to the
 *   device, not the Account, and `tb-export-*` is durability bookkeeping. Only
 *   `tb-community` goes, so a signed-out device starts at the default
 *   community, which self-heals on first run anyway.
 *
 * **The guard is the session's, not this module's.** Every request here goes
 * through `apiFetch`, which is closed when signed out or expired, so a stale
 * token can neither push nor pull - and therefore can never destroy anything.
 * Sign-out clears; a dead token merely does nothing.
 */
import type { Community, Discipline, Player, SavedSquad, Session as GameSession, Tournament } from "../domain/types";
import { parseBackup, serializeBackup } from "../data/transfer";
import { apiFetch, getSession } from "./session";


/**
 * The last version this device saw the server hold, per Account and community.
 * The push path's compare-and-swap basis. Stored under `tb-` keys following the
 * existing try/catch convention (`usePreferences`): a blocked localStorage
 * degrades to re-checking with the server rather than throwing.
 */
export function syncVersionKey(accountId: string, communityId: string): string {
  return `tb-sync-version-${accountId}-${communityId}`;
}

export function readSyncVersion(accountId: string, communityId: string): number | null {
  try {
    const raw = localStorage.getItem(syncVersionKey(accountId, communityId));
    return raw === null ? null : Number(raw);
  } catch {
    return null;
  }
}

export function writeSyncVersion(accountId: string, communityId: string, version: number): void {
  try {
    localStorage.setItem(syncVersionKey(accountId, communityId), String(version));
  } catch {
    /* degrade to re-checking on the next push */
  }
}

/** The stores a document round-trip touches. The storage seam, unchanged. */
export interface SyncStores {
  communities: {
    listCommunities(): Promise<Community[]>;
    replaceAllCommunities(items: Community[]): Promise<void>;
  };
  roster: {
    listPlayers(): Promise<Player[]>;
    replaceAllPlayers(items: Player[]): Promise<void>;
  };
  sessions: {
    listSessions(): Promise<GameSession[]>;
    replaceAllSessions(items: GameSession[]): Promise<void>;
  };
  tournaments: {
    listTournaments(): Promise<Tournament[]>;
    replaceAllTournaments(items: Tournament[]): Promise<void>;
  };
  squads: {
    listSavedSquads(): Promise<SavedSquad[]>;
    replaceAllSavedSquads(items: SavedSquad[]): Promise<void>;
  };
  disciplines: {
    listDisciplines(): Promise<Discipline[]>;
    saveDiscipline(d: Discipline): Promise<void>;
    deleteDiscipline(id: string): Promise<void>;
  };
}

/** The Account's stored communities as bare ids, or null when unreachable. */
export async function listAccountCommunities(): Promise<string[] | null> {
  const response = await apiFetch("/api/documents");
  if (!response || !response.ok) return null;
  const body = (await response.json()) as { documents?: Array<{ communityId: string }> };
  return (body.documents ?? []).map((d) => d.communityId);
}

export interface CommunityDocument {
  communityId: string;
  version: number;
  payload: string;
}

/**
 * Whether local data exists that adoption would move.
 *
 * The roster and sessions are the census that matters: an Organizer with
 * players or splits has something to lose, a fresh device does not. Communities
 * are not consulted - the default community self-heals and is not "data" - and
 * the catalog reseeds itself from built-ins.
 */
export async function hasLocalData(stores: SyncStores): Promise<boolean> {
  const [players, sessions] = await Promise.all([stores.roster.listPlayers(), stores.sessions.listSessions()]);
  return players.length > 0 || sessions.length > 0;
}

/** The census the confirm names, so the Organizer knows exactly what is replaced. */
export async function localCensus(stores: SyncStores): Promise<{ players: number; sessions: number }> {
  const [players, sessions] = await Promise.all([stores.roster.listPlayers(), stores.sessions.listSessions()]);
  return { players: players.length, sessions: sessions.length };
}

/**
 * Push this device's data up as the Account's first document per community.
 *
 * One document per community, exactly as the export flow serializes it - the
 * wire format is the backup format (ADR-0007), so what `downloadBackup` writes
 * and what adoption sends are the same bytes modulo the timestamp.
 *
 * Returns the communities adopted. A 409 for a community is a skipped
 * adoption, not an error: the Account already has data there and this device
 * defers to it.
 */
export async function adoptLocalToAccount(stores: SyncStores): Promise<string[]> {
  const [players, sessions, communities, tournaments, squads, disciplines] = await Promise.all([
    stores.roster.listPlayers(),
    stores.sessions.listSessions(),
    stores.communities.listCommunities(),
    stores.tournaments.listTournaments(),
    stores.squads.listSavedSquads(),
    stores.disciplines.listDisciplines(),
  ]);
  // The catalog must travel: the ticket's payload carries every discipline,
  // including deleted built-ins' absence being ordinary, so the document is
  // serialized with the catalog as it is on this device right now.
  const payloadCommunities = communities.length > 0 ? communities : [];
  const adopted: string[] = [];
  for (const community of payloadCommunities) {
    const payload = serializeBackup(
      players.filter((p) => p.communityId === community.id),
      sessions.filter((s) => s.communityId === community.id),
      [community],
      tournaments.filter((t) => t.communityId === community.id),
      squads.filter((s) => s.communityId === community.id),
      disciplines,
    );
    const response = await apiFetch("/api/documents/adopt", {
      method: "POST",
      body: JSON.stringify({ communityId: community.id, payload }),
    });
    if (!response) continue; // Signed out or offline mid-loop: stop adopting.
    if (response.ok) {
      const body = (await response.json().catch(() => ({}))) as { version?: number };
      const session = getSession();
      if (session && typeof body.version === "number") {
        writeSyncVersion(session.accountId, community.id, body.version);
      }
      adopted.push(community.id);
    }
    // A 409 leaves that community to the Account's existing document.
  }
  return adopted;
}

/**
 * Replace this device's stores with the Account's documents.
 *
 * Returns the community the Account's data was pulled for, so the caller can
 * make it active - an Account's data arriving for a community the device has
 * never heard of must land somewhere visible.
 */
export async function pullAccount(stores: SyncStores): Promise<string | null> {
  const session = getSession();
  if (!session) return null;
  const listResponse = await apiFetch("/api/documents");
  if (!listResponse || !listResponse.ok) return null;
  const list = (await listResponse.json()) as { documents?: Array<{ communityId: string }> };
  const communityIds = (list.documents ?? []).map((d) => d.communityId);
  if (communityIds.length === 0) return null;

  const pullResponse = await apiFetch("/api/documents/pull", {
    method: "POST",
    body: JSON.stringify({ communityIds }),
  });
  if (!pullResponse || !pullResponse.ok) return null;
  const pulled = (await pullResponse.json()) as { documents?: CommunityDocument[] };
  const documents = pulled.documents ?? [];
  if (documents.length === 0) return null;

  // Parse first, write second: a malformed document aborts before any store is
  // touched, so a failed pull leaves the device exactly as it was.
  const parsed = documents.map((d) => ({ communityId: d.communityId, data: parseBackup(d.payload) }));
  const first = parsed[0];
  await stores.communities.replaceAllCommunities(
    parsed.flatMap((p) => p.data.communities.length > 0 ? p.data.communities : []),
  );
  await stores.roster.replaceAllPlayers(parsed.flatMap((p) => p.data.players));
  await stores.sessions.replaceAllSessions(parsed.flatMap((p) => p.data.sessions));
  await stores.tournaments.replaceAllTournaments(parsed.flatMap((p) => p.data.tournaments));
  await stores.squads.replaceAllSavedSquads(parsed.flatMap((p) => p.data.savedSquads));
  await replaceDisciplines(stores.disciplines, first.data.disciplines ?? []);
  if (session) {
    for (const d of documents) {
      writeSyncVersion(session.accountId, d.communityId, d.version);
    }
  }
  return first.communityId;
}

/**
 * Replace the catalog by clearing then saving - deliberately not a
 * `replaceAllDisciplines`, which does not exist on the seam (ADR-0007: the
 * discipline store is the one interface without an atomic overwrite, because a
 * catalog clear-and-refill is a delete loop by design).
 */
async function replaceDisciplines(
  store: SyncStores["disciplines"],
  disciplines: Discipline[],
): Promise<void> {
  const existing = await store.listDisciplines();
  for (const d of existing) {
    await store.deleteDiscipline(d.id);
  }
  for (const d of disciplines) {
    await store.saveDiscipline(d);
  }
}

/**
 * Empty every domain store, for explicit sign-out.
 *
 * The discipline catalog is emptied through the same delete loop as a pull, and
 * `tb-community` is dropped so the next run bootstraps the default community
 * fresh. Theme, layout and rail are the device's and stay.
 */
export async function clearLocalData(stores: SyncStores): Promise<void> {
  await stores.roster.replaceAllPlayers([]);
  await stores.sessions.replaceAllSessions([]);
  await stores.tournaments.replaceAllTournaments([]);
  await stores.squads.replaceAllSavedSquads([]);
  await stores.communities.replaceAllCommunities([]);
  await replaceDisciplines(stores.disciplines, []);
  try {
    localStorage.removeItem("tb-community");
  } catch {
    /* nothing to clear */
  }
}
