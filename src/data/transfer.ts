import type { Community, Player, Session, Tournament } from "../domain/types";

/**
 * The exported backup shape. Bump `version` when the format changes.
 * v2 added `communities`; v3 added `tournaments`.
 * Older versions import migrated: v1 -> Default community, no tournaments.
 */
export interface BackupData {
  version: 3;
  exportedAt: string;
  communities: Community[];
  players: Player[];
  sessions: Session[];
  tournaments: Tournament[];
}

const DEFAULT_COMMUNITY_ID = "community-default";

/** Serialize everything portable into the backup format (ADR-0001). */
export function serializeBackup(
  players: Player[],
  sessions: Session[],
  communities: Community[],
  tournaments: Tournament[],
): string {
  const data: BackupData = {
    version: 3,
    exportedAt: new Date().toISOString(),
    communities,
    players,
    sessions,
    tournaments,
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
export function parseBackup(text: string): BackupData {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("That file is not valid JSON.");
  }
  if (!isRecord(data)) throw new Error("That file is not a Team Builder backup.");
  if (data.version === undefined) throw new Error("That file is not a Team Builder backup.");
  if (data.version !== 1 && data.version !== 2 && data.version !== 3) {
    throw new Error(`Unsupported backup version: ${String(data.version)}.`);
  }
  if (!Array.isArray(data.players)) throw new Error("Backup has no players list.");
  if (!Array.isArray(data.sessions)) throw new Error("Backup has no sessions list.");

  for (const p of data.players) {
    if (!isPlayer(p)) throw new Error("Backup contains a malformed player.");
  }
  for (const s of data.sessions) {
    if (!isSession(s)) throw new Error("Backup contains a malformed session.");
  }
  const rawTournaments = Array.isArray(data.tournaments) ? (data.tournaments as unknown[]) : [];
  for (const t of rawTournaments) {
    if (!isTournament(t)) throw new Error("Backup contains a malformed tournament.");
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
    version: 3,
    exportedAt: typeof data.exportedAt === "string" ? data.exportedAt : "",
    communities,
    players: players.map((p) => ({ ...p, communityId: adopted(p.communityId) })),
    sessions: sessions.map((s) => ({ ...s, communityId: adopted(s.communityId) })),
    tournaments: (rawTournaments as Tournament[]).map((t) => ({
      ...t,
      communityId: adopted(t.communityId),
    })),
  };
}
