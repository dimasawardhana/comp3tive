import { describe, expect, it } from "vitest";
import futsalRoster from "../../sample-data/futsal-roster.json";
import mlbbRoster from "../../sample-data/mpl-id-roster.json";
import badmintonRoster from "../../sample-data/badminton-roster.json";
import { BADMINTON_DISCIPLINE, FUTSAL_DISCIPLINE, MLBB_DISCIPLINE } from "../domain/seed";
import { validatePlayer } from "../domain/validation";
import { buildSettings, fairSplit, poolFromPlayers, suggestTeamCount } from "../solver/solver";
import type { Discipline, Player } from "../domain/types";

/**
 * Badminton is validated against the shipped discipline, imported from
 * `src/domain/seed.ts`. It used to be a literal copied into this file, because
 * the discipline did not exist yet; a copy is only as good as the copy, and
 * redefining badminton in the app would have left every badminton assertion
 * here checking a shape the app no longer has, with nothing failing. The
 * shipped roster is additionally held to the real catalog end to end in
 * `sample-roundtrip.test.ts`, where it runs through `parseBackup`.
 */
const CATALOG: Discipline[] = [FUTSAL_DISCIPLINE, MLBB_DISCIPLINE, BADMINTON_DISCIPLINE];

/** The v1 backup shape `parseBackup` accepts (src/data/transfer.ts). */
interface Backup {
  version: number;
  exportedAt: string;
  players: Player[];
  sessions: unknown[];
}

/**
 * A player record exactly as the file stores it. `Player` cannot describe it:
 * v1 backups predate communities, so there is no `communityId` on disk and
 * `parseBackup` assigns the default one on import. The cast to this shape is
 * what makes the structural assertions below meaningful, and those assertions
 * are what make the cast safe — they compare `Object.keys` against this shape,
 * so a file that stopped matching it fails rather than being read through it.
 */
interface RawCapability {
  disciplineId: string;
  attributeRatings: Record<string, number>;
  eligibleRoles: string[];
  preferredRole: string;
}

interface RawPlayer {
  id: string;
  name: string;
  notes?: string;
  capabilities: RawCapability[];
}

interface RawBackup {
  version: number;
  exportedAt: string;
  players: RawPlayer[];
  sessions: unknown[];
}

interface SampleFile {
  fileName: string;
  /** The app's own "Sample -> Import players" path serves exactly these bytes. */
  data: Backup;
  /** The same bytes, read as stored rather than as the importer returns them. */
  raw: RawBackup;
  discipline: Discipline;
  playerCount: number;
}

const files: SampleFile[] = [
  {
    fileName: "futsal-roster.json",
    data: futsalRoster as unknown as Backup,
    raw: futsalRoster as unknown as RawBackup,
    discipline: FUTSAL_DISCIPLINE,
    playerCount: 25,
  },
  {
    fileName: "mpl-id-roster.json",
    data: mlbbRoster as unknown as Backup,
    raw: mlbbRoster as unknown as RawBackup,
    discipline: MLBB_DISCIPLINE,
    playerCount: 25,
  },
  {
    fileName: "badminton-roster.json",
    data: badmintonRoster as unknown as Backup,
    raw: badmintonRoster as unknown as RawBackup,
    discipline: BADMINTON_DISCIPLINE,
    playerCount: 10,
  },
];

describe("shipped sample data", () => {
  it("keeps the v1 backup shape parseBackup accepts", () => {
    for (const { fileName, data, playerCount } of files) {
      expect(data.version, fileName).toBe(1);
      expect(typeof data.exportedAt, fileName).toBe("string");
      expect(Number.isNaN(Date.parse(data.exportedAt)), fileName).toBe(false);
      expect(Array.isArray(data.players), fileName).toBe(true);
      expect(data.players.length, `${fileName} player count`).toBe(playerCount);
      expect(data.sessions, fileName).toEqual([]);
    }
  });

  it("passes validatePlayer for every player in every file", () => {
    for (const { fileName, data } of files) {
      const issues = data.players.flatMap((p) =>
        validatePlayer(p, CATALOG).map((issue) => `${fileName} · ${p.name}: ${issue.message}`),
      );
      expect(issues, `${fileName} has players the app's own validator rejects`).toEqual([]);
    }
  });

  /**
   * Spelled out per player rather than left to `validatePlayer`: a preferred role
   * outside the eligibility list is what made the shipped futsal sample fail its
   * own "Sample" button, and the first thing to regress is a hand-edited roster.
   */
  it("keeps every preferred role inside that player's own eligibleRoles", () => {
    for (const { fileName, data } of files) {
      for (const player of data.players) {
        for (const cap of player.capabilities) {
          if (cap.preferredRole === null) continue;
          expect(
            cap.eligibleRoles.includes(cap.preferredRole),
            `${fileName} · ${player.name}: preferred "${cap.preferredRole}" is outside [${cap.eligibleRoles.join(", ")}]`,
          ).toBe(true);
        }
      }
    }
  });

  it("gives every player a capability in the file's own discipline, under a unique id", () => {
    for (const { fileName, data, discipline } of files) {
      const ids = new Set<string>();
      for (const player of data.players) {
        const caps = player.capabilities.filter((c) => c.disciplineId === discipline.id);
        expect(caps, `${fileName} · ${player.name} has no ${discipline.id} capability`).toHaveLength(1);
        expect(ids.has(player.id), `${fileName} duplicates player id ${player.id}`).toBe(false);
        ids.add(player.id);
      }
    }
  });

  /**
   * The stored bytes, not the laundered `Backup` view: exactly the keys a v1
   * backup player has (no `communityId`, no org tag smuggled in beside `notes`),
   * ids keyed to their discipline, every attribute rated on the discipline's own
   * scale, and every eligible role a role the discipline actually has. These
   * are the invariants a hand-edited roster breaks first, and they hold for
   * badminton against the inline discipline for the reason its doc comment
   * gives: the shape is test-owned until Task 5 owns it.
   */
  it("stores every player as a v1 record with ids, ratings and roles it can use", () => {
    const playerKeys = ["capabilities", "id", "name", "notes"];
    const capabilityKeys = ["attributeRatings", "disciplineId", "eligibleRoles", "preferredRole"];
    for (const { fileName, raw, discipline } of files) {
      const roleIds = new Set(discipline.roles.map((r) => r.id));
      const attributeIds = discipline.attributes.map((a) => a.id);
      expect(Object.keys(raw).sort(), fileName).toEqual(["exportedAt", "players", "sessions", "version"]);
      for (const player of raw.players) {
        const at = `${fileName} · ${player.name}`;
        expect(Object.keys(player).sort(), at).toEqual(playerKeys);
        expect(player.id, `${at} id`).toMatch(new RegExp(`^${discipline.id}-\\d{2}$`));
        expect(player.capabilities, `${at} capability count`).toHaveLength(1);
        for (const cap of player.capabilities) {
          expect(Object.keys(cap).sort(), at).toEqual(capabilityKeys);
          expect(cap.disciplineId, at).toBe(discipline.id);
          expect(Object.keys(cap.attributeRatings).sort(), `${at} ratings`).toEqual([...attributeIds].sort());
          for (const attribute of discipline.attributes) {
            const value = cap.attributeRatings[attribute.id];
            const min = attribute.min ?? 1;
            const max = attribute.max ?? 5;
            expect(
              Number.isInteger(value) && value >= min && value <= max,
              `${at} rates ${attribute.id} at ${String(value)}, outside ${min}-${max}`,
            ).toBe(true);
          }
          expect(cap.eligibleRoles.length, `${at} has no eligible role`).toBeGreaterThan(0);
          for (const roleId of cap.eligibleRoles) {
            expect(roleIds.has(roleId), `${at} is eligible for "${roleId}", not a ${discipline.name} role`).toBe(true);
          }
        }
      }
    }
  });

  it("splits to its suggested team count with gap 0, proven, and zero flags", () => {
    for (const { fileName, data, discipline } of files) {
      const teamCount = suggestTeamCount(data.players.length, discipline);
      const result = fairSplit(
        poolFromPlayers(data.players, discipline),
        discipline,
        buildSettings(discipline, teamCount),
      );
      expect(result.teams.length, fileName).toBe(teamCount);
      expect(result.gap, `${fileName} should split evenly`).toBe(0);
      expect(result.solver.optimal, `${fileName} should be provable`).toBe(true);
      expect(result.flags, `${fileName} should need no flags`).toEqual([]);
    }
  });

  it("covers every role on every team for the hard-coverage disciplines", () => {
    for (const { fileName, data, discipline } of files) {
      if (!discipline.team.rolesRequired) continue;
      const result = fairSplit(
        poolFromPlayers(data.players, discipline),
        discipline,
        buildSettings(discipline, suggestTeamCount(data.players.length, discipline)),
      );
      const roleIds = discipline.roles.map((r) => r.id);
      for (const team of result.teams) {
        const filled = new Set(team.slots.map((s) => s.roleId));
        for (const roleId of roleIds) {
          expect(
            filled.has(roleId),
            `${fileName} · ${discipline.id} team ${team.index} is missing ${roleId}`,
          ).toBe(true);
        }
      }
    }
  });

  it("carries no real-league org tags and shares no names between files", () => {
    const raw = JSON.stringify([futsalRoster, mlbbRoster, badmintonRoster]);
    for (const tag of ["ONIC", "RRQ", "EVOS", "Aura Fire", "Alter Ego"]) {
      expect(raw, tag).not.toContain(tag);
    }
    const names = files.map(
      ({ fileName, data }) => [fileName, new Set(data.players.map((p) => p.name))] as const,
    );
    for (let a = 0; a < names.length; a++) {
      for (let b = a + 1; b < names.length; b++) {
        const shared = [...names[a][1]].filter((n) => names[b][1].has(n));
        expect(shared, `${names[a][0]} and ${names[b][0]} share names`).toEqual([]);
      }
    }
    // The landing hero's own roster (ROSTER in src/landing.tsx; not exported).
    const hero = new Set(["Budi", "Andi", "Citra", "Dewi", "Eka", "Fajar", "Gita", "Hana", "Irfan", "Joko"]);
    for (const [fileName, set] of names) {
      expect([...set].filter((n) => hero.has(n)), `${fileName} collides with the landing hero`).toEqual([]);
    }
  });
});
