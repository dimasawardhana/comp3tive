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
  { id: "kairi", name: "Kairi", team: "ONIC", roleId: "assassin", roleName: "Jungle", flex: "fighter", ratings: [5, 5, 5, 4] },
  { id: "cw", name: "CW", team: "ONIC", roleId: "mage", roleName: "Mid", flex: "tank", ratings: [5, 4, 4, 5] },
  { id: "butsss", name: "Butsss", team: "ONIC", roleId: "fighter", roleName: "EXP", flex: "tank", ratings: [4, 5, 4, 4] },
  { id: "kiboy", name: "Kiboy", team: "ONIC", roleId: "tank", roleName: "Roam", flex: "fighter", ratings: [4, 5, 4, 5] },
  { id: "drian", name: "Drian", team: "ONIC", roleId: "marksman", roleName: "Gold", flex: "assassin", ratings: [5, 4, 5, 4] },
  // RRQ Hoshi
  { id: "cr1te", name: "Cr1te", team: "RRQ", roleId: "assassin", roleName: "Jungle", flex: "fighter", ratings: [5, 4, 5, 4] },
  { id: "lemon", name: "Lemon", team: "RRQ", roleId: "mage", roleName: "Mid", flex: "tank", ratings: [5, 5, 4, 4] },
  { id: "albert", name: "Albert", team: "RRQ", roleId: "fighter", roleName: "EXP", flex: "tank", ratings: [4, 4, 5, 4] },
  { id: "vyn", name: "Vyn", team: "RRQ", roleId: "tank", roleName: "Roam", flex: "fighter", ratings: [4, 5, 5, 5] },
  { id: "r7", name: "R7", team: "RRQ", roleId: "marksman", roleName: "Gold", flex: "assassin", ratings: [5, 4, 4, 4] },
  // EVOS Legends
  { id: "wannn", name: "Wannn", team: "EVOS", roleId: "assassin", roleName: "Jungle", flex: "fighter", ratings: [5, 5, 5, 4] },
  { id: "ferxiic", name: "Ferxiic", team: "EVOS", roleId: "mage", roleName: "Mid", flex: "tank", ratings: [5, 4, 4, 4] },
  { id: "oura", name: "Oura", team: "EVOS", roleId: "fighter", roleName: "EXP", flex: "tank", ratings: [4, 5, 5, 4] },
  { id: "clover", name: "Clover", team: "EVOS", roleId: "tank", roleName: "Roam", flex: "fighter", ratings: [4, 5, 4, 5] },
  { id: "luminaire", name: "Luminaire", team: "EVOS", roleId: "marksman", roleName: "Gold", flex: "assassin", ratings: [5, 4, 5, 4] },
  // Alter Ego
  { id: "udil", name: "Udil", team: "Alter Ego", roleId: "assassin", roleName: "Jungle", flex: "fighter", ratings: [5, 4, 4, 4] },
  { id: "celiboy", name: "Celiboy", team: "Alter Ego", roleId: "mage", roleName: "Mid", flex: "tank", ratings: [5, 5, 4, 4] },
  { id: "nino", name: "Nino", team: "Alter Ego", roleId: "tank", roleName: "Roam", flex: "fighter", ratings: [4, 4, 5, 4] },
  { id: "ahmad", name: "Ahmad", team: "Alter Ego", roleId: "marksman", roleName: "Gold", flex: "assassin", ratings: [4, 4, 4, 5] },
  { id: "pai", name: "PAI", team: "Alter Ego", roleId: "fighter", roleName: "EXP", flex: "tank", ratings: [4, 4, 5, 4] },
  // Aura Fire
  { id: "high", name: "High", team: "Aura Fire", roleId: "assassin", roleName: "Jungle", flex: "fighter", ratings: [5, 4, 5, 4] },
  { id: "blustine", name: "Blustine", team: "Aura Fire", roleId: "mage", roleName: "Mid", flex: "tank", ratings: [4, 5, 4, 4] },
  { id: "kabuki", name: "Kabuki", team: "Aura Fire", roleId: "tank", roleName: "Roam", flex: "fighter", ratings: [4, 5, 5, 5] },
  { id: "facehugger", name: "FaceHugger", team: "Aura Fire", roleId: "marksman", roleName: "Gold", flex: "assassin", ratings: [5, 4, 4, 4] },
  { id: "varius", name: "Varius", team: "Aura Fire", roleId: "fighter", roleName: "EXP", flex: "tank", ratings: [4, 4, 4, 5] },
];

export const SAMPLE_PLAYERS: Player[] = S.map((s) => ({
  id: s.id,
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
