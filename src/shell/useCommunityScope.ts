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
  const {
    communities,
    activeCommunityId,
    players,
    sessions,
    tournaments,
    squads,
    disciplines = [],
  } = input;
  const activeCommunity = communities.find((c) => c.id === activeCommunityId) ?? null;
  const id = activeCommunity?.id;
  const scoped = <T extends { communityId: Id }>(records: T[]): T[] =>
    id ? records.filter((r) => r.communityId === id) : [];
  return {
    activeCommunity,
    players: scoped(players),
    sessions: scoped(sessions),
    tournaments: scoped(tournaments),
    squads: scoped(squads),
    disciplinesById: new Map(disciplines.map((d) => [d.id, d])),
  };
}

/**
 * The seven destructured names below are the memo's whole read set, and the
 * dependency array repeats them verbatim. Nothing enforces that: there is no
 * linter in this repo, and `tsc -b` cannot see a missing runtime dependency. A
 * field read here and forgotten in the deps would make the memo silently
 * ignore it — and every consumer is a scoped list, so the failure is a
 * cross-community leak, the thing ADR-0005 records having already happened
 * once. Keep the two lists the same seven identifiers; a new field in
 * CommunityScopeInput must be added to both.
 */
export function useCommunityScope(input: CommunityScopeInput): CommunityScopeResult {
  const {
    communities,
    activeCommunityId,
    players,
    sessions,
    tournaments,
    squads,
    disciplines,
  } = input;
  return useMemo(
    () => scopeCommunities({ communities, activeCommunityId, players, sessions, tournaments, squads, disciplines }),
    [communities, activeCommunityId, players, sessions, tournaments, squads, disciplines],
  );
}
