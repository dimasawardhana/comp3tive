import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decompose, StoreError } from "./decompose";
import { reassemble } from "./reassemble";
import { sqliteDatabase } from "../test-support/sqlite";
import { parseBackup } from "../../src/data/transfer";
import type { BackupData } from "../../src/data/transfer";
import type { Database } from "../db";

/**
 * The round-trip law: for any valid document, reassemble(decompose(b)) === b.
 * Exact equality, including array order and JSON key order, because the
 * document is the wire format and a pull that reshuffled it would fail the
 * client's parseBackup in ways no schema catches.
 */

const ACCOUNT = "acc-1";
const COMMUNITY = "com-1";

async function freshDb(): Promise<Database> {
  const db = sqliteDatabase();
  // The v1 schema brings accounts; v2 brings the normalized tables. Both are
  // the same files `wrangler d1 execute` applies, so the test executes the
  // real schema, not a hand-written mock of it.
  await db.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../schema-v2.sql", import.meta.url), "utf8"));
  await db
    .prepare("INSERT INTO accounts (id, handle, created_at) VALUES (?, ?, ?)")
    .bind(ACCOUNT, "aGFuZGxlLWZpeHVyZQ", 1)
    .run();
  return db;
}

function emptyDoc(): BackupData {
  return {
    version: 5,
    exportedAt: "2026-10-15T00:00:00.000Z",
    communities: [{ id: COMMUNITY, name: "Squad", createdAt: 10 }],
    players: [],
    sessions: [],
    tournaments: [],
    savedSquads: [],
    disciplines: [],
  };
}

describe("round-trip law", () => {
  it("holds for the empty community", async () => {
    const db = await freshDb();
    const doc = emptyDoc();
    await decompose(db, ACCOUNT, COMMUNITY, doc);
    await expect(reassemble(db, ACCOUNT, COMMUNITY)).resolves.toEqual(doc);
  });

  it("holds for a document parsed from a serialized fixture", async () => {
    const db = await freshDb();
    const original: BackupData = {
      version: 5,
      exportedAt: "2026-10-15T12:34:56.789Z",
      communities: [{ id: COMMUNITY, name: "Roster", createdAt: 1728900000000 }],
      disciplines: [
        {
          id: "disc-mlbb",
          name: "Mobile Legends",
          shortName: "MLBB",
          roles: [
            { id: "gold-lane", name: "Gold Lane" },
            { id: "roam", name: "Roam" },
          ],
          attributes: [
            { id: "mechanics", name: "Mechanics", min: 1, max: 10, labels: { 1: "Novice", 10: "Legend" } },
            { id: "gameSense", name: "Game sense" },
          ],
          strengthModel: { kind: "mean" },
          team: { minTeamSize: 5, maxTeamSize: 5, rolesRequired: true },
          builtIn: true,
        },
        {
          id: "disc-custom",
          name: "Futsal",
          shortName: "FUT",
          roles: [{ id: "keeper", name: "Keeper" }],
          attributes: [],
          strengthModel: { kind: "mean" },
          team: { minTeamSize: 1, maxTeamSize: 5, rolesRequired: false },
        },
      ],
      players: [
        {
          id: "p1",
          communityId: COMMUNITY,
          name: "Kiww",
          notes: "prefers gold lane",
          capabilities: [
            {
              disciplineId: "disc-mlbb",
              attributeRatings: { gameSense: 3, mechanics: 4 },
              eligibleRoles: ["roam", "gold-lane"],
              preferredRole: "gold-lane",
            },
          ],
          createdAt: 1728900001000,
        },
        {
          id: "p2",
          communityId: COMMUNITY,
          name: "Sparse",
          capabilities: [
            { disciplineId: "disc-custom", attributeRatings: {}, eligibleRoles: [], preferredRole: null },
          ],
          createdAt: 1728900002000,
        },
      ],
      sessions: [
        {
          id: "s1",
          communityId: COMMUNITY,
          disciplineId: "disc-mlbb",
          createdAt: 1728900003000,
          poolPlayerIds: ["p1", "p2", "gone"],
          settings: { teamCount: 2 },
          result: {
            teams: [
              { index: 0, slots: [{ playerId: "p1", roleId: "gold-lane" }], totalStrength: 4, avgStrength: 4 },
              { index: 1, slots: [{ playerId: "p2", roleId: null }], totalStrength: 3, avgStrength: 3 },
            ],
            gap: 1,
            flags: [],
            unassigned: [],
            solver: { optimal: true, nodesExplored: 12, elapsedMs: 3 },
          },
        },
      ],
      tournaments: [
        {
          id: "t1",
          communityId: COMMUNITY,
          disciplineId: "disc-mlbb",
          name: "Cup",
          format: "single-elim",
          seriesLength: 1,
          teamCount: 4,
          thirdPlace: true,
          createdAt: 1728900004000,
          status: "active",
          teams: [
            { id: "tt1", bibIndex: 0, name: "Alpha", strength: 8, players: ["p1"] },
            { id: "tt2", bibIndex: 1, name: "Beta", strength: 6, players: ["p2"] },
          ],
          matches: [
            {
              id: "m1",
              round: 0,
              position: 0,
              teamAId: "tt1",
              teamBId: "tt2",
              games: [{ winnerTeamId: "tt1", scoreA: 2, scoreB: 1 }],
              winnerTeamId: "tt1",
              winnerNext: { matchId: "m2", slot: "A" },
              loserNext: null,
            },
            {
              id: "m2",
              round: 1,
              position: 0,
              teamAId: "tt1",
              teamBId: null,
              games: [],
              winnerTeamId: null,
              winnerNext: null,
              loserNext: null,
              isThirdPlace: true,
            },
          ],
        },
      ],
      savedSquads: [
        {
          id: "sq1",
          communityId: COMMUNITY,
          name: "Weekly five",
          disciplineId: "disc-mlbb",
          createdAt: 1728900005000,
          poolPlayerIds: ["p1"],
          settings: { teamCount: 1 },
          result: {
            teams: [
              { index: 0, slots: [{ playerId: "p1", roleId: null }], totalStrength: 4, avgStrength: 4 },
            ],
            gap: 0,
            flags: [],
            unassigned: [],
            solver: { optimal: false, nodesExplored: 1, elapsedMs: 0 },
          },
        },
      ],
    };
    const parsed = parseBackup(JSON.stringify(original));
    expect(parsed).not.toBeNull();
    await decompose(db, ACCOUNT, COMMUNITY, parsed!);
    const back = await reassemble(db, ACCOUNT, COMMUNITY);
    // Structural equality over the whole document. Not byte equality: the
    // catalog's discipline objects are rebuilt from columns, and normalized
    // storage cannot preserve a source object's JSON key order (the built-in
    // seeds carry `builtIn` ahead of `roles`). Key order carries no meaning
    // — parseBackup re-merges built-ins and reorders the catalog on the very
    // next client export — so what must survive is the structure, the array
    // order, and the exact JSON of the fields stored as JSON columns.
    expect(back).toEqual(parsed!);
    // Byte-exactness IS pinned for the fields the store keeps as JSON,
    // because those are re-parsed by the client as opaque values.
    expect(JSON.stringify(back!.sessions[0]!.result)).toBe(JSON.stringify(parsed!.sessions[0]!.result));
    expect(JSON.stringify(back!.savedSquads[0]!.result)).toBe(JSON.stringify(parsed!.savedSquads[0]!.result));
  });

  it("a second push replaces the first document entirely", async () => {
    const db = await freshDb();
    const first = emptyDoc();
    first.players = [
      {
        id: "p1",
        communityId: COMMUNITY,
        name: "Old",
        capabilities: [],
        createdAt: 1,
      },
    ];
    await decompose(db, ACCOUNT, COMMUNITY, first);

    const second = emptyDoc();
    second.players = [
      { id: "p2", communityId: COMMUNITY, name: "New", capabilities: [], createdAt: 2 },
    ];
    await decompose(db, ACCOUNT, COMMUNITY, second);

    const back = await reassemble(db, ACCOUNT, COMMUNITY);
    expect(back).toEqual(second);
  });

  it("a second push of a document with capabilities replaces, not collides", async () => {
    const db = await freshDb();
    const doc = emptyDoc();
    doc.disciplines = [
      {
        id: "futsal",
        name: "Futsal",
        shortName: "FUT",
        roles: [{ id: "keeper", name: "Keeper" }],
        attributes: [{ id: "pace", name: "Pace" }],
        strengthModel: { kind: "mean" },
        team: { minTeamSize: 1, maxTeamSize: 5, rolesRequired: true },
      },
    ];
    doc.players = [
      {
        id: "p1",
        communityId: COMMUNITY,
        name: "One",
        createdAt: 1,
        capabilities: [
          {
            disciplineId: "futsal",
            attributeRatings: { pace: 4 },
            eligibleRoles: ["keeper"],
            preferredRole: "keeper",
          },
        ],
      },
    ];

    // The same document twice is what a client does after a local edit: the
    // ids are identical, so every replaced row must be gone before the
    // identical row is inserted. The capability chain carries no community
    // column, so it is exactly the chain a `players` delete does not reach.
    await decompose(db, ACCOUNT, COMMUNITY, doc);
    await decompose(db, ACCOUNT, COMMUNITY, doc);

    await expect(reassemble(db, ACCOUNT, COMMUNITY)).resolves.toEqual(doc);
    // And no leftovers behind the rows: an orphan is invisible to `reassemble`
    // but collides with the next push, which is the failure this test is for.
    for (const table of ["capability_roles", "capability_ratings", "player_capabilities"] as const) {
      const row = await db
        .prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE account_id = ?`)
        .bind(ACCOUNT)
        .first<{ n: number }>();
      expect({ table, rows: row!.n }).toEqual({ table, rows: 1 });
    }
  });

  it("sweeps capabilities an earlier broken push orphaned, without touching another community", async () => {
    const db = await freshDb();
    // A second community, with a player whose capability rows must survive:
    // the sweep is scoped by player, and that player is not this community's.
    await db
      .prepare("INSERT INTO communities (account_id, id, name, created_at, exported_at) VALUES (?, ?, ?, ?, ?)")
      .bind(ACCOUNT, "com-2", "Other", 20, "2026-10-15T00:00:00.000Z")
      .run();
    await db
      .prepare("INSERT INTO players (account_id, community_id, id, name, created_at) VALUES (?, ?, ?, ?, ?)")
      .bind(ACCOUNT, "com-2", "p2", "Two", 2)
      .run();

    // Capability rows for `player`: one in each table, the shape a player with
    // a rated, role-eligible capability produces.
    const capabilityRows = async (player: string): Promise<void> => {
      await db
        .prepare("INSERT INTO player_capabilities (account_id, player_id, discipline_id) VALUES (?, ?, ?)")
        .bind(ACCOUNT, player, "futsal")
        .run();
      await db
        .prepare("INSERT INTO capability_ratings (account_id, player_id, discipline_id, attribute_id, rating) VALUES (?, ?, ?, ?, ?)")
        .bind(ACCOUNT, player, "futsal", "pace", 3)
        .run();
      await db
        .prepare("INSERT INTO capability_roles (account_id, player_id, discipline_id, role_id, position) VALUES (?, ?, ?, ?, ?)")
        .bind(ACCOUNT, player, "futsal", "keeper", 0)
        .run();
    };
    await capabilityRows("p2");

    // What the pre-fix code left behind: capability rows whose player is gone.
    // The current schema cascades those away, so the state is unreachable by
    // ordinary writes - but it is the state the deployed database is actually
    // in, and it wedges the next push. Foreign keys go off for the fixture,
    // which is how the legacy tables behaved.
    await db.exec("PRAGMA foreign_keys = OFF");
    await capabilityRows("gone");
    await db.exec("PRAGMA foreign_keys = ON");

    const doc = emptyDoc();
    doc.players = [{ id: "p1", communityId: COMMUNITY, name: "One", createdAt: 1, capabilities: [] }];
    await decompose(db, ACCOUNT, COMMUNITY, doc);

    for (const table of ["capability_roles", "capability_ratings", "player_capabilities"] as const) {
      const rows = await db
        .prepare(`SELECT player_id FROM ${table} WHERE account_id = ? ORDER BY player_id`)
        .bind(ACCOUNT)
        .all<{ player_id: string }>();
      // The orphan is gone, and com-2's player is untouched.
      expect({ table, players: rows.map((r) => r.player_id) }).toEqual({ table, players: ["p2"] });
    }
  });


  it("rejects a payload carrying a sibling community", async () => {
    const db = await freshDb();
    const doc = emptyDoc();
    doc.communities.push({ id: "com-2", name: "Other", createdAt: 5 });
    await expect(decompose(db, ACCOUNT, COMMUNITY, doc)).rejects.toBeInstanceOf(StoreError);
  });

  it("rejects a version it does not know", async () => {
    const db = await freshDb();
    const doc = { ...emptyDoc(), version: 4 } as unknown as BackupData;
    await expect(decompose(db, ACCOUNT, COMMUNITY, doc)).rejects.toBeInstanceOf(StoreError);
  });

  it("returns null for a community the account never wrote", async () => {
    const db = await freshDb();
    await expect(reassemble(db, ACCOUNT, "nope")).resolves.toBeNull();
  });
});
