import type { Discipline } from "./types";

/**
 * Seed Disciplines (spec: config data, not code - editable without a release,
 * and extensible via Discipline management).
 *
 * Futsal: 4 roles, 3 attributes, soft role coverage, min 5 with Subs.
 * MLBB: 5 roles, 4 attributes, hard role coverage, exactly 5.
 * Badminton: 2 court roles, 3 attributes, hard role coverage, exactly 2.
 */
export const FUTSAL_DISCIPLINE: Discipline = {
  id: "futsal",
  name: "Futsal",
  shortName: "Futsal",
  builtIn: true,
  roles: [
    { id: "goalkeeper", name: "Goalkeeper" },
    { id: "defender", name: "Defender" },
    { id: "winger", name: "Winger" },
    { id: "pivot", name: "Pivot" },
  ],
  attributes: [
    { id: "technical", name: "Technical" },
    { id: "fitness", name: "Fitness" },
    { id: "game-iq", name: "Game IQ" },
  ],
  strengthModel: { kind: "mean" },
  team: { minTeamSize: 5, maxTeamSize: null, rolesRequired: false },
};

export const MLBB_DISCIPLINE: Discipline = {
  id: "mlbb",
  name: "Mobile Legends",
  shortName: "MLBB",
  builtIn: true,
  roles: [
    { id: "tank", name: "Tank" },
    { id: "assassin", name: "Assassin" },
    { id: "mage", name: "Mage" },
    { id: "marksman", name: "Marksman" },
    { id: "fighter", name: "Fighter" },
  ],
  attributes: [
    { id: "mechanics", name: "Mechanics" },
    { id: "game-sense", name: "Game Sense" },
    { id: "hero-pool", name: "Hero Pool" },
    { id: "teamwork", name: "Teamwork" },
  ],
  strengthModel: { kind: "mean" },
  team: { minTeamSize: 5, maxTeamSize: 5, rolesRequired: true },
};

export const BADMINTON_DISCIPLINE: Discipline = {
  id: "badminton",
  name: "Badminton",
  shortName: "Badminton",
  builtIn: true,
  roles: [
    { id: "front-court", name: "Front court" },
    { id: "rear-court", name: "Rear court" },
  ],
  attributes: [
    { id: "technical", name: "Technical" },
    { id: "fitness", name: "Fitness" },
    { id: "game-iq", name: "Game IQ" },
  ],
  strengthModel: { kind: "mean" },
  // Hard coverage with two roles is exactly pairs: `roleCoverPossible` needs
  // `team.length >= roleIds.length` and `assignRoles` needs
  // `players.length === roleIds.length`. A degenerate pool therefore returns
  // zero teams — the same tradeoff MLBB already makes, and the split screen
  // already has the actionable empty state for it.
  team: { minTeamSize: 2, maxTeamSize: 2, rolesRequired: true },
};

export const SEED_DISCIPLINES: Discipline[] = [FUTSAL_DISCIPLINE, MLBB_DISCIPLINE, BADMINTON_DISCIPLINE];

/**
 * The catalog in the order the app shows it: seeds in the order declared above,
 * then any custom discipline in the order it arrived.
 *
 * A store reads its rows in ascending key order, which is alphabetical — so
 * without this, badminton would lead, and the app takes `disciplines[0]` as both
 * the new-tournament default and the fallback when no player pool is decisive
 * (`GamesScreen.tsx`, `App.tsx`). Seed order is the app's deliberate order, so
 * it is applied here rather than relied upon from a storage engine's sort.
 * Custom disciplines have no declared position, so they keep theirs.
 */
export function orderDisciplines(disciplines: Discipline[]): Discipline[] {
  const rank = (d: Discipline): number => {
    const i = SEED_DISCIPLINES.findIndex((seed) => seed.id === d.id);
    return i === -1 ? SEED_DISCIPLINES.length : i;
  };
  return [...disciplines].sort((a, b) => rank(a) - rank(b));
}
