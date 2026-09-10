// Domain vocabulary per CONTEXT.md: Player, Capability, Discipline, Role,
// Attribute, Strength, Session, Team, Sub, Fair split, Role-complete.

export type Id = string;

/** A community (profile): its own squad and history. Players belong to exactly one. */
export interface Community {
  id: Id;
  name: string;
  createdAt: number; // epoch ms
}

/** A person on the roster who can be assigned to teams in one or more disciplines. */
export interface Player {
  id: Id;
  /** The community this player belongs to. Never shared across communities. */
  communityId: Id;
  name: string;
  notes?: string;
  capabilities: Capability[];
}

// ---- Tournaments (CONTEXT.md: the competition container) ----

export type TournamentFormat = "series" | "single-elim" | "swiss";
export type TournamentStatus = "draft" | "active" | "complete";
export type SeriesLength = 1 | 3 | 5;

/** A team competing in a tournament: a snapshot of one split team. */
export interface TournamentTeam {
  id: Id;
  /** Index into the split's teams (bib color: A/B/C/…). */
  bibIndex: number;
  name: string;
  strength: number; // avg strength at submission, used for seeding
  players: Id[]; // player ids at submission
}

/** One play between two tournament teams; always produces a winner. */
export interface GameResult {
  winnerTeamId: Id;
  scoreA?: number;
  scoreB?: number;
}

/** A head-to-head slot in the bracket, possibly a best-of-N series. */
export interface TournamentMatch {
  id: Id; // deterministic: `m-<round>-<position>`
  round: number; // 1-based
  position: number; // 0-based within the round
  teamAId: Id | null; // null until the advancing team fills the slot
  teamBId: Id | null;
  games: GameResult[]; // recorded in order; series resolves at majority
  winnerTeamId: Id | null; // set once a majority exists
  winnerNext: { matchId: Id; slot: "A" | "B" } | null; // where the winner goes
  loserNext: { matchId: Id; slot: "A" | "B" } | null; // where the loser goes (3rd-place)
  isThirdPlace?: boolean;
}

/** A competition container (CONTEXT.md: Tournament). One document per tournament. */
export interface Tournament {
  id: Id;
  communityId: Id;
  disciplineId: Id;
  name: string;
  format: TournamentFormat;
  seriesLength: SeriesLength;
  teamCount: number;
  /** Single elimination only: play a 3rd-place match (default true). */
  thirdPlace: boolean;
  createdAt: number; // epoch ms
  status: TournamentStatus;
  teams: TournamentTeam[]; // seed order: strongest first
  matches: TournamentMatch[];
}

/** A position within a discipline that a player can fill (goalkeeper, tank, ...). */
export interface Role {
  id: Id;
  name: string;
}

/** A strength factor defined by a discipline, rated 1-5 per capability. */
export interface Attribute {
  id: Id;
  name: string;
  min?: number; // default 1
  max?: number; // default 5
}

/** Team-building rules owned by a discipline. */
export interface TeamConstraints {
  /** Futsal: 5. MLBB: 5. */
  minTeamSize: number;
  /** null = unbounded (futsal Subs). MLBB: exactly minTeamSize. */
  maxTeamSize: number | null;
  /** MLBB hard role coverage; futsal soft (best-fit + flag). */
  rolesRequired: boolean;
}

/**
 * The pluggable strength model a Discipline owns. New models are new kinds;
 * callers switch on the kind and never change.
 */
export type StrengthModel = { kind: "mean" };

/** A catalog entry teams can be built for (futsal, MLBB, badminton, ...). */
export interface Discipline {
  id: Id;
  name: string;
  /** Short label for badges and tight spaces (e.g. "MLBB"). */
  shortName: string;
  roles: Role[];
  attributes: Attribute[];
  strengthModel: StrengthModel;
  team: TeamConstraints;
  /** Built-in (seeded) disciplines cannot be deleted. */
  builtIn?: boolean;
}

/** A player's proficiency in a discipline. At most one per player per discipline. */
export interface Capability {
  disciplineId: Id;
  attributeRatings: Record<Id, number>; // key = attribute id, value in 1..5
  eligibleRoles: Id[]; // roles this player can fill
  preferredRole: Id | null; // must be inside eligibleRoles when set
}

// ---- Fair split outputs (shared vocabulary; the solver produces these) ----

/** A player placed on a team, with the role they fill (null in soft-role mode). */
export interface TeamSlot {
  playerId: Id;
  roleId: Id | null;
}

export interface TeamAssignment {
  index: number;
  slots: TeamSlot[];
  totalStrength: number;
  avgStrength: number;
}

export type SolverFlag =
  | { kind: "role-uncovered"; teamIndex: number; roleId: Id; coveringPlayerId: Id | null }
  | { kind: "leftover"; playerId: Id }
  | { kind: "team-below-min"; teamIndex: number; size: number; minTeamSize: number };

/** The result of a Fair split: teams, the strength gap, and flags. */
export interface SplitResult {
  teams: TeamAssignment[];
  /** max(team avg) - min(team avg); 0 when balanced. */
  gap: number;
  flags: SolverFlag[];
  /** Pool players not placed on any team (e.g. MLBB leftovers). */
  unassigned: Id[];
  solver: { optimal: boolean; nodesExplored: number; elapsedMs: number };
}

/** Settings for a team-building run. */
export interface SessionSettings {
  teamCount: number;
}

/** A saved team-building run (CONTEXT.md: pool, discipline, settings, teams). */
export interface Session {
  id: Id;
  /** The community this session was built in. */
  communityId: Id;
  disciplineId: Id;
  createdAt: number; // epoch ms, for history ordering
  poolPlayerIds: Id[];
  settings: SessionSettings;
  result: SplitResult;
}

// ---- Saved Squads (CONTEXT.md: the curated, named split) ----

/**
 * A named, self-contained record of one fair split, saved explicitly for
 * reuse (CONTEXT.md: Saved Squad). Holds its own copy of the split data so
 * re-splitting or deleting the source Session never changes it, and a draft
 * Tournament can consume a matching one as its teams (snapshot semantics).
 */
export interface SavedSquad {
  id: Id;
  /** The community this squad was saved in. Never shared across communities. */
  communityId: Id;
  name: string;
  disciplineId: Id;
  createdAt: number; // epoch ms, for ordering
  poolPlayerIds: Id[];
  settings: SessionSettings;
  result: SplitResult;
}
