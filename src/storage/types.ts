import type { Community, Discipline, Id, Player, SavedSquad, Session, Tournament } from "../domain/types";

/**
 * Persistence behind ADR-0001: the app talks to these interfaces, so a backend
 * (API + database) can replace the IndexedDB adapters later without touching
 * callers.
 */
export interface CommunityStore {
  listCommunities(): Promise<Community[]>;
  saveCommunity(community: Community): Promise<void>; // upsert by id
  deleteCommunity(id: Id): Promise<void>;
  replaceAllCommunities(communities: Community[]): Promise<void>; // atomic overwrite
}

export interface RosterStore {
  listPlayers(): Promise<Player[]>;
  savePlayer(player: Player): Promise<void>; // upsert by id
  deletePlayer(id: Id): Promise<void>;
  replaceAllPlayers(players: Player[]): Promise<void>; // atomic overwrite
}

export interface SessionStore {
  listSessions(): Promise<Session[]>;
  saveSession(session: Session): Promise<void>; // upsert by id
  deleteSession(id: Id): Promise<void>;
  replaceAllSessions(sessions: Session[]): Promise<void>; // atomic overwrite
}

export interface DisciplineStore {
  listDisciplines(): Promise<Discipline[]>;
  saveDiscipline(discipline: Discipline): Promise<void>; // upsert by id
  deleteDiscipline(id: Id): Promise<void>;
}

export interface TournamentStore {
  listTournaments(): Promise<Tournament[]>;
  saveTournament(tournament: Tournament): Promise<void>; // upsert by id
  deleteTournament(id: Id): Promise<void>;
  replaceAllTournaments(tournaments: Tournament[]): Promise<void>; // atomic overwrite
}

export interface SavedSquadStore {
  listSavedSquads(): Promise<SavedSquad[]>;
  saveSavedSquad(squad: SavedSquad): Promise<void>; // upsert by id
  deleteSavedSquad(id: Id): Promise<void>;
  replaceAllSavedSquads(squads: SavedSquad[]): Promise<void>; // atomic overwrite
}
