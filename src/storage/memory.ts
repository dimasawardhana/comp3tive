import type { Discipline, Id, Player, SavedSquad, Session } from "../domain/types";
import type { DisciplineStore, RosterStore, SavedSquadStore, SessionStore } from "./types";

/** In-memory stores: for tests and as a fallback when IndexedDB is absent. */
export function createMemoryRosterStore(initial: Player[] = []): RosterStore {
  const players = new Map<Id, Player>(initial.map((p) => [p.id, structuredClone(p)]));
  return {
    async listPlayers() {
      return [...players.values()].map((p) => structuredClone(p));
    },
    async savePlayer(player: Player) {
      players.set(player.id, structuredClone(player));
    },
    async deletePlayer(id: Id) {
      players.delete(id);
    },
    async replaceAllPlayers(items: Player[]) {
      players.clear();
      for (const p of items) players.set(p.id, structuredClone(p));
    },
  };
}

export function createMemorySessionStore(initial: Session[] = []): SessionStore {
  const sessions = new Map<Id, Session>(initial.map((s) => [s.id, structuredClone(s)]));
  return {
    async listSessions() {
      return [...sessions.values()].map((s) => structuredClone(s));
    },
    async saveSession(session: Session) {
      sessions.set(session.id, structuredClone(session));
    },
    async deleteSession(id: Id) {
      sessions.delete(id);
    },
    async replaceAllSessions(items: Session[]) {
      sessions.clear();
      for (const s of items) sessions.set(s.id, structuredClone(s));
    },
  };
}

export function createMemorySavedSquadStore(initial: SavedSquad[] = []): SavedSquadStore {
  const squads = new Map<Id, SavedSquad>(initial.map((s) => [s.id, structuredClone(s)]));
  return {
    async listSavedSquads() {
      return [...squads.values()].map((s) => structuredClone(s));
    },
    async saveSavedSquad(squad: SavedSquad) {
      squads.set(squad.id, structuredClone(squad));
    },
    async deleteSavedSquad(id: Id) {
      squads.delete(id);
    },
    async replaceAllSavedSquads(items: SavedSquad[]) {
      squads.clear();
      for (const s of items) squads.set(s.id, structuredClone(s));
    },
  };
}

export function createMemoryDisciplineStore(initial: Discipline[] = []): DisciplineStore {
  const disciplines = new Map<Id, Discipline>(initial.map((d) => [d.id, structuredClone(d)]));
  return {
    async listDisciplines() {
      return [...disciplines.values()].map((d) => structuredClone(d));
    },
    async saveDiscipline(discipline: Discipline) {
      disciplines.set(discipline.id, structuredClone(discipline));
    },
    async deleteDiscipline(id: Id) {
      disciplines.delete(id);
    },
  };
}
