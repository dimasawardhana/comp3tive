import type { Id } from "./types";
import type {
  CommunityStore,
  RosterStore,
  SavedSquadStore,
  SessionStore,
  TournamentStore,
} from "../storage/types";

/** What a community deletion actually removed, so the caller can report it. */
export interface CommunityRemovalCounts {
  players: number;
  sessions: number;
  squads: number;
  tournaments: number;
}

export interface CommunityRemovalStores {
  communityStore: CommunityStore;
  rosterStore: RosterStore;
  sessionStore: SessionStore;
  savedSquadStore: SavedSquadStore;
  tournamentStore: TournamentStore;
}

/**
 * Delete a community and everything scoped to it.
 *
 * A community owns its players, sessions, saved squads, and tournaments; none
 * of them are shareable. Deleting the community alone would leave records that
 * no screen can reach, so this deletes the whole set and reports what it took.
 *
 * Records belonging to other communities are never touched.
 */
export async function removeCommunityCascade(
  stores: CommunityRemovalStores,
  id: Id,
): Promise<CommunityRemovalCounts> {
  const { communityStore, rosterStore, sessionStore, savedSquadStore, tournamentStore } = stores;

  const [players, sessions, squads, tournaments] = await Promise.all([
    rosterStore.listPlayers(),
    sessionStore.listSessions(),
    savedSquadStore.listSavedSquads(),
    tournamentStore.listTournaments(),
  ]);

  const counts: CommunityRemovalCounts = { players: 0, sessions: 0, squads: 0, tournaments: 0 };

  await Promise.all([
    ...players
      .filter((p) => p.communityId === id)
      .map((p) => {
        counts.players++;
        return rosterStore.deletePlayer(p.id);
      }),
    ...sessions
      .filter((s) => s.communityId === id)
      .map((s) => {
        counts.sessions++;
        return sessionStore.deleteSession(s.id);
      }),
    ...squads
      .filter((q) => q.communityId === id)
      .map((q) => {
        counts.squads++;
        return savedSquadStore.deleteSavedSquad(q.id);
      }),
    ...tournaments
      .filter((t) => t.communityId === id)
      .map((t) => {
        counts.tournaments++;
        return tournamentStore.deleteTournament(t.id);
      }),
  ]);

  await communityStore.deleteCommunity(id);
  return counts;
}
