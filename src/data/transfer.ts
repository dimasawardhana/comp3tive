import type { Capability, Community, Discipline, Player, SavedSquad, Session, Tournament } from "../domain/types";
import { orderDisciplines, SEED_DISCIPLINES } from "../domain/seed";
import { validatePlayer } from "../domain/validation";

/**
 * The exported backup shape. Bump `version` when the format changes.
 * v2 added `communities`; v3 added `tournaments`; v4 added `savedSquads`;
 * v5 added `disciplines`.
 * Older versions import migrated: v1 -> Default community, no tournaments or
 * squads. A file predating `disciplines` imports against the code's built-in
 * catalog, which is where a v1-v4 device's disciplines came from anyway.
 */
export interface BackupData {
  version: 5;
  exportedAt: string;
  communities: Community[];
  players: Player[];
  sessions: Session[];
  tournaments: Tournament[];
  savedSquads: SavedSquad[];
  disciplines: Discipline[];
}

const DEFAULT_COMMUNITY_ID = "community-default";

/**
 * Serialize everything portable into the backup format (ADR-0001).
 *
 * `disciplines` is last although the shape puts it last-but-one-in-spirit: the
 * parameter order predates the shape's and has differed from it since v3, so a
 * new argument is appended rather than threaded into the middle. Every
 * parameter is a whole collection, so a caller cannot pass them in the wrong
 * order without a type error.
 */
export function serializeBackup(
  players: Player[],
  sessions: Session[],
  communities: Community[],
  tournaments: Tournament[],
  savedSquads: SavedSquad[],
  disciplines: Discipline[],
): string {
  const data: BackupData = {
    version: 5,
    exportedAt: new Date().toISOString(),
    communities,
    players,
    sessions,
    tournaments,
    savedSquads,
    disciplines,
  };
  return JSON.stringify(data, null, 2);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function isPlayer(v: unknown): v is Player {
  return (
    isRecord(v) &&
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    Array.isArray(v.capabilities)
  );
}

/** The three fields validateCapability dereferences; checked before the call. */
function isCapabilityShape(v: unknown): v is Capability {
  return (
    isRecord(v) &&
    typeof v.disciplineId === "string" &&
    isRecord(v.attributeRatings) &&
    Array.isArray(v.eligibleRoles)
  );
}

function isSession(v: unknown): v is Session {
  return (
    isRecord(v) &&
    typeof v.id === "string" &&
    typeof v.disciplineId === "string" &&
    Array.isArray(v.poolPlayerIds) &&
    isRecord(v.settings) &&
    isRecord(v.result)
  );
}

function isSavedSquad(v: unknown): v is SavedSquad {
  return (
    isRecord(v) &&
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    typeof v.disciplineId === "string" &&
    Array.isArray(v.poolPlayerIds) &&
    isRecord(v.settings) &&
    isRecord(v.result)
  );
}

function isTournament(v: unknown): v is Tournament {
  return (
    isRecord(v) &&
    typeof v.id === "string" &&
    typeof v.communityId === "string" &&
    typeof v.name === "string" &&
    typeof v.format === "string" &&
    typeof v.seriesLength === "number" &&
    typeof v.teamCount === "number" &&
    Array.isArray(v.teams) &&
    Array.isArray(v.matches)
  );
}

/**
 * The fields a merged discipline is actually read through: `orderDisciplines`
 * matches on `id`, and `DisciplineEditModal`, `computeStrength` and the solver
 * dereference the rest. Checked before the merge so a malformed element fails
 * with this module's own message rather than as a half-written catalog.
 */
function isDiscipline(v: unknown): v is Discipline {
  return (
    isRecord(v) &&
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    typeof v.shortName === "string" &&
    Array.isArray(v.roles) &&
    Array.isArray(v.attributes) &&
    isRecord(v.strengthModel) &&
    isRecord(v.team)
  );
}

/**
 * The catalog a parsed file yields: the file's own entries, plus any built-in
 * the file omitted, merged by id.
 *
 * **The file wins for a built-in's id, and this is the whole rule.** The
 * catalog on a device belongs to the Organizer: built-in disciplines are
 * editable there (only the delete is refused, `DisciplineEditModal`), and the
 * sync path and the app's own import both treat the device's catalog as the
 * source of truth. A file authored by another device carries that device's
 * edited catalog, so honoring it — not reverting it to the code's seeds — is
 * what makes a round trip lossless. Shape is still enforced (`isDiscipline`),
 * so a hand-edited file cannot smuggle in a malformed definition.
 *
 * **A built-in cannot be deleted by omission.** A v4 file carries no catalog
 * at all, and a file that predates an edit would otherwise delete the
 * built-in outright. So the seeds are unioned in first and every file entry
 * overrides by id; what survives is the file's version when it has one and
 * the code's when it does not.
 *
 * **A discipline the code does not know is taken as written.** That is the
 * entire point of the field: a custom catalog entry is not something the build
 * can reconstruct, so its definition comes from the file, every field of it.
 *
 * Ordering follows `orderDisciplines`, the same function both stores apply, so
 * a parsed catalog is in the order the app displays and `disciplines[0]` — the
 * new-tournament default — is the same before and after a restore.
 */
function mergeDisciplines(fromFile: Discipline[]): Discipline[] {
  // Seeds first as the floor: a built-in is present even when the file (say a
  // v4 import, or one authored before an attribute edit) omits or predates it.
  const merged = new Map<string, Discipline>();
  for (const seed of SEED_DISCIPLINES) merged.set(seed.id, seed);
  for (const d of fromFile) {
    // Overwrite by id: the file's definition is the newer one — it is what the
    // exporting device was running, edited catalog included.
    merged.set(d.id, d);
  }
  return orderDisciplines([...merged.values()]);
}

/**
 * Parse and validate a backup file. Throws a specific, user-readable error on
 * any problem (invalid JSON, unsupported version, malformed records).
 * Records missing a communityId are adopted into the first community.
 */
export function parseBackup(text: string, disciplines?: Discipline[]): BackupData {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("That file is not valid JSON.");
  }
  if (!isRecord(data)) throw new Error("That file is not a comp3tive backup.");
  if (data.version === undefined) throw new Error("That file is not a comp3tive backup.");
  if (data.version !== 1 && data.version !== 2 && data.version !== 3 && data.version !== 4 && data.version !== 5) {
    throw new Error(`Unsupported backup version: ${String(data.version)}.`);
  }
  if (!Array.isArray(data.players)) throw new Error("Backup has no players list.");
  if (!Array.isArray(data.sessions)) throw new Error("Backup has no sessions list.");

  for (const p of data.players) {
    if (!isPlayer(p)) throw new Error("Backup contains a malformed player.");
  }
  // When the caller supplies the catalog, the model invariants are checked here
  // too: shape alone lets a capability through that computeStrength throws on.
  if (disciplines) {
    for (const p of data.players as Player[]) {
      // validateCapability dereferences these, so a non-record capability or one
      // missing them must fail with this module's own message, not a TypeError.
      if (!p.capabilities.every(isCapabilityShape)) {
        throw new Error("Backup contains a malformed player.");
      }
      // A backup carries no catalog of its own, so a capability for a discipline
      // this device has not created yet is a legitimate record: the
      // discipline-delete copy promises those ratings survive. Such a capability
      // can never reach computeStrength, which resolves capabilities through the
      // local catalog, so narrowing this one rule out costs no protection. Every
      // other invariant (duplicates included) still throws.
      const problems = validatePlayer(p, disciplines).filter(
        (issue) => !issue.message.startsWith("Unknown discipline "),
      );
      if (problems.length > 0) {
        throw new Error(`Backup player "${p.name}" is invalid: ${problems[0].message}`);
      }
    }
  }
  for (const s of data.sessions) {
    if (!isSession(s)) throw new Error("Backup contains a malformed session.");
  }
  const rawTournaments = Array.isArray(data.tournaments) ? (data.tournaments as unknown[]) : [];
  for (const t of rawTournaments) {
    if (!isTournament(t)) throw new Error("Backup contains a malformed tournament.");
  }
  const rawSavedSquads = Array.isArray(data.savedSquads) ? (data.savedSquads as unknown[]) : [];
  for (const q of rawSavedSquads) {
    if (!isSavedSquad(q)) throw new Error("Backup contains a malformed saved squad.");
  }

  const rawDisciplines = Array.isArray(data.disciplines) ? (data.disciplines as unknown[]) : [];
  for (const d of rawDisciplines) {
    if (!isDiscipline(d)) throw new Error("Backup contains a malformed discipline.");
  }

  const players = data.players as Player[];
  const sessions = data.sessions as Session[];

  // v1 backups predate communities: everything belongs to one Default community.
  let communities: Community[];
  if (data.version === 1 || !Array.isArray(data.communities) || data.communities.length === 0) {
    communities = [{ id: DEFAULT_COMMUNITY_ID, name: "Default", createdAt: Date.now() }];
  } else {
    communities = data.communities as Community[];
  }

  const fallbackId = communities[0].id;
  const known = new Set(communities.map((c) => c.id));
  const adopted = (communityId: unknown): string =>
    typeof communityId === "string" && known.has(communityId) ? communityId : fallbackId;

  // Same shape as the communityId adoption above: a field the file may not
  // carry is filled in rather than left undefined. A v1-v4 file predates
  // `Player.createdAt`, and the Dashboard ranks "recently added" by it, so an
  // imported player with no timestamp would sort as `NaN`. The file's own value
  // is kept when it is a usable number; otherwise the parse order stands in for
  // an order nothing recorded, which is what a pre-v5 file can offer.
  const importedAt = Date.now();
  const withCreatedAt = (p: Player, i: number): Player => ({
    ...p,
    communityId: adopted(p.communityId),
    createdAt: Number.isFinite(p.createdAt) ? p.createdAt : importedAt + i,
  });

  return {
    version: 5,
    exportedAt: typeof data.exportedAt === "string" ? data.exportedAt : "",
    communities,
    players: players.map(withCreatedAt),
    sessions: sessions.map((s) => ({ ...s, communityId: adopted(s.communityId) })),
    tournaments: (rawTournaments as Tournament[]).map((t) => ({
      ...t,
      communityId: adopted(t.communityId),
    })),
    savedSquads: (rawSavedSquads as SavedSquad[]).map((q) => ({
      ...q,
      communityId: adopted(q.communityId),
    })),
    disciplines: mergeDisciplines(rawDisciplines as Discipline[]),
  };
}
