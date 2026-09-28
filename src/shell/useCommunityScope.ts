import { useMemo } from "react";
import type {
  Community,
  Discipline,
  Id,
  Player,
  SavedSquad,
  Session,
  Tournament,
} from "../domain/types";

export interface CommunityScopeInput {
  communities: Community[];
  activeCommunityId: Id | null;
  players: Player[];
  sessions: Session[];
  tournaments: Tournament[];
  squads: SavedSquad[];
  /** Not in the frozen input; required to build the returned map. Defaults to []. */
  disciplines?: Discipline[];
}

export interface CommunityScopeResult {
  activeCommunity: Community | null;
  players: Player[];
  sessions: Session[];
  tournaments: Tournament[];
  squads: SavedSquad[];
  disciplinesById: Map<Id, Discipline>;
}

/**
 * The one place community scoping lives (CONTEXT: every list shows only the
 * active community's records). ADR-0005 records why: History and Games were once
 * handed unfiltered lists and leaked records across communities.
 */
export function scopeCommunities(input: CommunityScopeInput): CommunityScopeResult {
  const { communities, activeCommunityId, disciplines = [] } = input;
  const activeCommunity = communities.find((c) => c.id === activeCommunityId) ?? null;
  const id = activeCommunity?.id;
  const scoped = <T extends { communityId: Id }>(records: T[]): T[] =>
    id ? records.filter((r) => r.communityId === id) : [];
  return {
    activeCommunity,
    players: scoped(input.players),
    sessions: scoped(input.sessions),
    tournaments: scoped(input.tournaments),
    squads: scoped(input.squads),
    disciplinesById: new Map(disciplines.map((d) => [d.id, d])),
  };
}

export function useCommunityScope(input: CommunityScopeInput): CommunityScopeResult {
  return useMemo(
    () => scopeCommunities(input),
    [
      input.communities,
      input.activeCommunityId,
      input.players,
      input.sessions,
      input.tournaments,
      input.squads,
      input.disciplines,
    ],
  );
}
