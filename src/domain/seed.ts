import type { Discipline } from "./types";

/**
 * Seed Disciplines (spec: config data, not code - editable without a release,
 * and extensible via Discipline management).
 *
 * Futsal: 4 roles, 3 attributes, soft role coverage, min 5 with Subs.
 * MLBB: the 5 lanes, 4 attributes, hard role coverage, exactly 5.
 * Badminton: 2 court roles, 3 attributes, hard role coverage, exactly 2.
 *
 * **MLBB's roles are lanes, not hero classes, and the distinction is the point.**
 * A hero's class (Tank/Marksman/Assassin/Fighter/Mage/Support) describes what the
 * hero *is*; a team's five slots are the five positions its players *fill* —
 * gold lane, exp lane, mid lane, jungle and roam. `rolesRequired: true` assigns
 * exactly one player to each, so the five roles have to be the five positions or
 * the assignment is meaningless: no team drafts one Tank, one Marksman, one
 * Assassin, one Fighter and one Mage. Hero breadth is already a rating here
 * (`hero-pool`), so class-as-role double-counted what the attributes measure.
 * See `MLBB_RETIRED_ROLES` for the vocabulary this replaced.
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
  // Ordered as a draft reads: the two side lanes, then mid, jungle and roam.
  roles: [
    { id: "gold-lane", name: "Gold Laner" },
    { id: "exp-lane", name: "Exp Laner" },
    { id: "mid-lane", name: "Mid Laner" },
    { id: "jungle", name: "Jungler" },
    { id: "roam", name: "Roamer" },
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

/**
 * The hero classes MLBB used to declare as its roles, each mapped to the lane it
 * is drafted into.
 *
 * **This is a migration table, and it is the only place the old vocabulary is
 * still named.** Every hero class has exactly one default lane, which is why the
 * rewrite is lossless: a player who was eligible for Assassin is a Jungler, and a
 * player eligible for Tank and Fighter is a Roamer who can also cover Exp.
 * Storage rewrites stored role ids through this map on the upgrade to database
 * version 8 (`src/storage/indexed-db.ts`), and it is scoped to `mlbb` — a custom
 * discipline is free to define its own role called `tank`, and must keep it.
 *
 * A class is not a *position*, and the map is a convention rather than a law: a
 * Tank hero can roam or hold exp, a Fighter can do either. What the map records
 * is the lane each class is picked for by default, which is the only thing an
 * eligibility list keyed on classes can honestly be read as.
 */
export const MLBB_RETIRED_ROLES: Record<string, string> = {
  assassin: "jungle",
  mage: "mid-lane",
  fighter: "exp-lane",
  tank: "roam",
  marksman: "gold-lane",
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
