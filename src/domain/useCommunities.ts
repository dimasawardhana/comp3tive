import { useCallback, useEffect, useState } from "react";
import type { Community, Id } from "../domain/types";
import type { CommunityStore, RosterStore, SavedSquadStore, SessionStore, TournamentStore } from "../storage/types";

const ACTIVE_KEY = "tb-community";
const DEFAULT_NAME = "Default";
/** Fixed id so concurrent first-run refreshes upsert to one row (StrictMode double-effect). */
const DEFAULT_ID = "community-default";

function readActive(): string {
  try {
    return localStorage.getItem(ACTIVE_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeActive(id: string): void {
  try {
    localStorage.setItem(ACTIVE_KEY, id);
  } catch {
    /* ignore */
  }
}

/**
 * Communities (profiles): their own squads and history. The active community
 * drives every roster/session filter in the app. Deleting one cascades to its
 * players, sessions, and saved squads (a community owns them; they cannot be
 * shared).
 */
/** What a community deletion actually removed, so the caller can report it. */
export interface CommunityRemovalCounts {
  players: number;
  sessions: number;
  squads: number;
  tournaments: number;
}

export function useCommunities(
  store: CommunityStore,
  rosterStore: RosterStore,
  sessionStore: SessionStore,
  savedSquadStore: SavedSquadStore,
  tournamentStore: TournamentStore,
) {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [activeId, setActiveIdState] = useState<string>(readActive);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      let list = await store.listCommunities();
      // First run: create the default community so there is always one profile.
      // Fixed id makes concurrent refreshes (StrictMode double-effect) upsert to one row.
      if (list.length === 0) {
        const community: Community = { id: DEFAULT_ID, name: DEFAULT_NAME, createdAt: Date.now() };
        await store.saveCommunity(community);
        list = [community];
      }
      setCommunities(list);
      setError(null);
      setActiveIdState((prev) => {
        const next = list.some((c) => c.id === prev) ? prev : list[0].id;
        writeActive(next);
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [store]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setActiveId = useCallback(
    (id: Id) => {
      writeActive(id);
      setActiveIdState(id);
    },
    [],
  );

  const create = useCallback(
    async (name: string): Promise<Community> => {
      const community: Community = { id: crypto.randomUUID(), name: name.trim(), createdAt: Date.now() };
      await store.saveCommunity(community);
      setCommunities((prev) => [...prev, community]);
      setActiveId(community.id);
      return community;
    },
    [store, setActiveId],
  );

  const remove = useCallback(
    async (id: Id): Promise<CommunityRemovalCounts> => {
      const current = await rosterStore.listPlayers();
      const sessions = await sessionStore.listSessions();
      const squads = await savedSquadStore.listSavedSquads();
      const tournaments = await tournamentStore.listTournaments();
      // A community owns everything scoped to it. Deleting the community
      // without these would leave records that no screen can ever reach.
      const counts: CommunityRemovalCounts = { players: 0, sessions: 0, squads: 0, tournaments: 0 };
      for (const p of current) {
        if (p.communityId === id) {
          await rosterStore.deletePlayer(p.id);
          counts.players++;
        }
      }
      for (const s of sessions) {
        if (s.communityId === id) {
          await sessionStore.deleteSession(s.id);
          counts.sessions++;
        }
      }
      for (const q of squads) {
        if (q.communityId === id) {
          await savedSquadStore.deleteSavedSquad(q.id);
          counts.squads++;
        }
      }
      for (const t of tournaments) {
        if (t.communityId === id) {
          await tournamentStore.deleteTournament(t.id);
          counts.tournaments++;
        }
      }
      await store.deleteCommunity(id);
      setCommunities((prev) => {
        const next = prev.filter((c) => c.id !== id);
        if (next.length === 0) return prev; // never delete the last community
        if (activeId === id) {
          writeActive(next[0].id);
          setActiveIdState(next[0].id);
        }
        return next;
      });
      return counts;
    },
    [store, rosterStore, sessionStore, savedSquadStore, tournamentStore, activeId],
  );

  return { communities, activeId, loading, error, refresh, setActiveId, create, remove };
}
