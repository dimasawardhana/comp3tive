import type { Discipline } from "./types";

/**
 * Seed Disciplines (spec: config data, not code - editable without a release,
 * and extensible via Discipline management).
 *
 * Futsal: 4 roles, 3 attributes, soft role coverage, min 5 with Subs.
 * MLBB: 5 roles, 4 attributes, hard role coverage, exactly 5.
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

export const SEED_DISCIPLINES: Discipline[] = [FUTSAL_DISCIPLINE, MLBB_DISCIPLINE];
