import type { Capability, Community, Discipline, Player, SavedSquad, Session, Tournament } from "../domain/types";
import { validatePlayer } from "../domain/validation";

/**
 * The exported backup shape. Bump `version` when the format changes.
 * v2 added `communities`; v3 added `tournaments`; v4 added `savedSquads`.
 * Older versions import migrated: v1 -> Default community, no tournaments/squads.
 */
export interface BackupData {
  version: 4;
  exportedAt: string;
  communities: Community[];
  players: Player[];
  sessions: Session[];
  tournaments: Tournament[];
  savedSquads: SavedSquad[];
}

const DEFAULT_COMMUNITY_ID = "community-default";

/** Serialize everything portable into the backup format (ADR-0001). */
export function serializeBackup(
  players: Player[],
  sessions: Session[],
  communities: Community[],
  tournaments: Tournament[],
  savedSquads: SavedSquad[],
): string {
  const data: BackupData = {
    version: 4,
    exportedAt: new Date().toISOString(),
    communities,
    players,
    sessions,
    tournaments,
    savedSquads,
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
  if (data.version !== 1 && data.version !== 2 && data.version !== 3 && data.version !== 4) {
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

  return {
    version: 4,
    exportedAt: typeof data.exportedAt === "string" ? data.exportedAt : "",
    communities,
    players: players.map((p) => ({ ...p, communityId: adopted(p.communityId) })),
    sessions: sessions.map((s) => ({ ...s, communityId: adopted(s.communityId) })),
    tournaments: (rawTournaments as Tournament[]).map((t) => ({
      ...t,
      communityId: adopted(t.communityId),
    })),
    savedSquads: (rawSavedSquads as SavedSquad[]).map((q) => ({
      ...q,
      communityId: adopted(q.communityId),
    })),
  };
}
