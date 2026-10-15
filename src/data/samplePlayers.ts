import type { Player } from "../domain/types";

/**
 * Sample roster: well-known Mobile Legends Bang Bang Professional League
 * Indonesia (MPL ID) players, seeded so the app is immediately demoable.
 *
 * Note: rosters change between seasons; this is approximate reference data
 * meant to be edited, not a live roster. Each player carries an MLBB
 * capability (their main role + one flex role) with plausible ratings.
 */

interface SampleSpec {
  id: string;
  name: string;
  team: string;
  roleId: string;
  roleName: string;
  flex: string;
  ratings: [number, number, number, number]; // mechanics, game-sense, hero-pool, teamwork
}

const S: SampleSpec[] = [
  // ONIC Esports
  { id: "kairi", name: "Kairi", team: "ONIC", roleId: "jungle", roleName: "Jungle", flex: "exp-lane", ratings: [5, 5, 5, 4] },
  { id: "cw", name: "CW", team: "ONIC", roleId: "mid-lane", roleName: "Mid", flex: "roam", ratings: [5, 4, 4, 5] },
  { id: "butsss", name: "Butsss", team: "ONIC", roleId: "exp-lane", roleName: "EXP", flex: "roam", ratings: [4, 5, 4, 4] },
  { id: "kiboy", name: "Kiboy", team: "ONIC", roleId: "roam", roleName: "Roam", flex: "exp-lane", ratings: [4, 5, 4, 5] },
  { id: "drian", name: "Drian", team: "ONIC", roleId: "gold-lane", roleName: "Gold", flex: "jungle", ratings: [5, 4, 5, 4] },
  // RRQ Hoshi
  { id: "cr1te", name: "Cr1te", team: "RRQ", roleId: "jungle", roleName: "Jungle", flex: "exp-lane", ratings: [5, 4, 5, 4] },
  { id: "lemon", name: "Lemon", team: "RRQ", roleId: "mid-lane", roleName: "Mid", flex: "roam", ratings: [5, 5, 4, 4] },
  { id: "albert", name: "Albert", team: "RRQ", roleId: "exp-lane", roleName: "EXP", flex: "roam", ratings: [4, 4, 5, 4] },
  { id: "vyn", name: "Vyn", team: "RRQ", roleId: "roam", roleName: "Roam", flex: "exp-lane", ratings: [4, 5, 5, 5] },
  { id: "r7", name: "R7", team: "RRQ", roleId: "gold-lane", roleName: "Gold", flex: "jungle", ratings: [5, 4, 4, 4] },
  // EVOS Legends
  { id: "wannn", name: "Wannn", team: "EVOS", roleId: "jungle", roleName: "Jungle", flex: "exp-lane", ratings: [5, 5, 5, 4] },
  { id: "ferxiic", name: "Ferxiic", team: "EVOS", roleId: "mid-lane", roleName: "Mid", flex: "roam", ratings: [5, 4, 4, 4] },
  { id: "oura", name: "Oura", team: "EVOS", roleId: "exp-lane", roleName: "EXP", flex: "roam", ratings: [4, 5, 5, 4] },
  { id: "clover", name: "Clover", team: "EVOS", roleId: "roam", roleName: "Roam", flex: "exp-lane", ratings: [4, 5, 4, 5] },
  { id: "luminaire", name: "Luminaire", team: "EVOS", roleId: "gold-lane", roleName: "Gold", flex: "jungle", ratings: [5, 4, 5, 4] },
  // Alter Ego
  { id: "udil", name: "Udil", team: "Alter Ego", roleId: "jungle", roleName: "Jungle", flex: "exp-lane", ratings: [5, 4, 4, 4] },
  { id: "celiboy", name: "Celiboy", team: "Alter Ego", roleId: "mid-lane", roleName: "Mid", flex: "roam", ratings: [5, 5, 4, 4] },
  { id: "nino", name: "Nino", team: "Alter Ego", roleId: "roam", roleName: "Roam", flex: "exp-lane", ratings: [4, 4, 5, 4] },
  { id: "ahmad", name: "Ahmad", team: "Alter Ego", roleId: "gold-lane", roleName: "Gold", flex: "jungle", ratings: [4, 4, 4, 5] },
  { id: "pai", name: "PAI", team: "Alter Ego", roleId: "exp-lane", roleName: "EXP", flex: "roam", ratings: [4, 4, 5, 4] },
  // Aura Fire
  { id: "high", name: "High", team: "Aura Fire", roleId: "jungle", roleName: "Jungle", flex: "exp-lane", ratings: [5, 4, 5, 4] },
  { id: "blustine", name: "Blustine", team: "Aura Fire", roleId: "mid-lane", roleName: "Mid", flex: "roam", ratings: [4, 5, 4, 4] },
  { id: "kabuki", name: "Kabuki", team: "Aura Fire", roleId: "roam", roleName: "Roam", flex: "exp-lane", ratings: [4, 5, 5, 5] },
  { id: "facehugger", name: "FaceHugger", team: "Aura Fire", roleId: "gold-lane", roleName: "Gold", flex: "jungle", ratings: [5, 4, 4, 4] },
  { id: "varius", name: "Varius", team: "Aura Fire", roleId: "exp-lane", roleName: "EXP", flex: "roam", ratings: [4, 4, 4, 5] },
];

// Deterministic, monotonic timestamps: the Dashboard's "recently added" ranks
// by `createdAt`, and a sample roster that shared one instant would order
// itself by id instead of by the roster's own sequence. A fixed base keeps the
// fixture reproducible rather than reading the clock.
const SAMPLE_EPOCH = 1_700_000_000_000;

export const SAMPLE_PLAYERS: Player[] = S.map((s, i) => ({
  id: s.id,
  createdAt: SAMPLE_EPOCH + i,
  communityId: "community-default",
  name: s.name,
  notes: `${s.team} · ${s.roleName}`,
  capabilities: [
    {
      disciplineId: "mlbb",
      attributeRatings: {
        mechanics: s.ratings[0],
        "game-sense": s.ratings[1],
        "hero-pool": s.ratings[2],
        teamwork: s.ratings[3],
      },
      eligibleRoles: [s.roleId, s.flex],
      preferredRole: s.roleId,
    },
  ],
}));
