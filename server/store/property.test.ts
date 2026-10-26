import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { Database } from "../db";
import { decompose } from "./decompose";
import { reassemble } from "./reassemble";
import { sqliteDatabase } from "../test-support/sqlite";
import { SEED_DISCIPLINES } from "../../src/domain/seed";
import type { BackupData } from "../../src/data/transfer";
import type { Discipline, Player, Session, SavedSquad, Tournament } from "../../src/domain/types";

const ACCOUNT = "acc-1";

async function freshDb(): Promise<Database> {
  const db = sqliteDatabase();
  await db.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../schema-v2.sql", import.meta.url), "utf8"));
  await db.prepare("INSERT INTO accounts (id, handle, created_at) VALUES (?, ?, ?)").bind(ACCOUNT, "aGFuZGxlLWZpeHVyZQ", 1).run();
  return db;
}
/**
 * A randomized document must survive decompose/reassemble exactly. Unlike the
 * fixed fixture in roundtrip.test.ts, this sweeps shape combinations the hand
 * fixture never hits: empty arrays everywhere, optional fields present or
 * absent, ratings sparse or dense, matches with or without games, third-place
 * matches, null bracket slots. 200 seeds; each seed's document is generated
 * from a deterministic PRNG, so a failure names its seed and replays exactly.
 */

// mulberry32: deterministic, tiny, good enough for shape fuzzing.
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(r: () => number, arr: readonly T[]): T => arr[Math.floor(r() * arr.length)]!;
const randInt = (r: () => number, lo: number, hi: number): number => lo + Math.floor(r() * (hi - lo + 1));
const chance = (r: () => number, p: number): boolean => r() < p;

function genDoc(r: () => number, i: number): BackupData {
  const comm = { id: "com-1", name: `Community ${i}`, createdAt: 1728900000000 + i };

  const disciplines: Discipline[] = [];
  if (chance(r, 0.7)) {
    for (const seed of SEED_DISCIPLINES) if (chance(r, 0.6)) disciplines.push(structuredClone(seed));
  }
  for (let k = 0; k < randInt(r, 0, 2); k++) {
    disciplines.push({
      id: `disc-c${i}_${k}`,
      name: `Custom ${k}`,
      shortName: `C${k}`,
      roles: Array.from({ length: randInt(r, 1, 3) }, (_, j) => ({ id: `role-${k}${j}`, name: `Role ${j}` })),
      attributes: Array.from({ length: randInt(r, 0, 3) }, (_, j) => {
        const attr: Discipline["attributes"][number] = { id: `attr-${k}${j}`, name: `Attr ${j}` };
        if (chance(r, 0.5)) attr.min = 1;
        if (chance(r, 0.5)) attr.max = 5;
        // A sparse, partial naming of the scale, the shape the editor writes.
        if (chance(r, 0.4)) attr.labels = { [randInt(r, 1, 5)]: `Word ${j}` };
        return attr;
      }),
      strengthModel: { kind: "mean" },
      team: {
        minTeamSize: randInt(r, 1, 5),
        maxTeamSize: chance(r, 0.5) ? null : randInt(r, 1, 8),
        rolesRequired: chance(r, 0.5),
      },
    });
  }
  // Sessions/squads/tournaments reference a discipline; an empty catalog gets
  // one seed so the generator always emits valid references.
  const catalog = disciplines.length ? disciplines : [structuredClone(SEED_DISCIPLINES[0]!)];
  if (!disciplines.length) disciplines.push(catalog[0]!);

  const players: Player[] = [];
  for (let k = 0; k < randInt(r, 0, 6); k++) {
    const p: Player = {
      id: `p${i}_${k}`,
      communityId: comm.id,
      name: `Player ${k}`,
      capabilities: [],
      createdAt: 1728900001000 + k,
    };
    if (chance(r, 0.5)) p.notes = `note ${k}`;
    for (const d of catalog) {
      if (!chance(r, 0.6)) continue;
      const ratings: Record<string, number> = {};
      for (const a of d.attributes) if (chance(r, 0.8)) ratings[a.id] = randInt(r, 1, 5);
      p.capabilities.push({
        disciplineId: d.id,
        attributeRatings: ratings,
        eligibleRoles: d.roles.filter(() => chance(r, 0.5)).map((role) => role.id),
        preferredRole: chance(r, 0.5) ? pick(r, d.roles).id : null,
      });
    }
    players.push(p);
  }

  const mkResult = (ids: string[]) => ({
    teams: ids.length
      ? [{ index: 0, slots: ids.map((id) => ({ playerId: id, roleId: null })), totalStrength: ids.length * 3, avgStrength: 3 }]
      : [],
    gap: randInt(r, 0, 2),
    flags: [],
    unassigned: [],
    solver: { optimal: chance(r, 0.5), nodesExplored: randInt(r, 1, 500), elapsedMs: randInt(r, 0, 50) },
  });

  const sessions: Session[] = [];
  for (let k = 0; k < randInt(r, 0, 3); k++) {
    const pool = players.filter(() => chance(r, 0.6)).map((p) => p.id);
    sessions.push({
      id: `s${i}_${k}`,
      communityId: comm.id,
      disciplineId: pick(r, catalog).id,
      createdAt: 1728900002000 + k,
      poolPlayerIds: pool,
      settings: { teamCount: randInt(r, 2, 4) },
      result: mkResult(pool),
    });
  }

  const squads: SavedSquad[] = [];
  for (let k = 0; k < randInt(r, 0, 2); k++) {
    const pool = players.filter(() => chance(r, 0.5)).map((p) => p.id);
    squads.push({
      id: `sq${i}_${k}`,
      communityId: comm.id,
      name: `Squad ${k}`,
      disciplineId: pick(r, catalog).id,
      createdAt: 1728900003000 + k,
      poolPlayerIds: pool,
      settings: { teamCount: randInt(r, 1, 3) },
      result: mkResult(pool),
    });
  }

  const tournaments: Tournament[] = [];
  for (let k = 0; k < randInt(r, 0, 2); k++) {
    const teams = players.map((p, j) => ({
      id: `tt${j}`,
      bibIndex: j,
      name: `T${j}`,
      strength: randInt(r, 1, 10),
      players: [p.id],
    }));
    const matches = [];
    for (let m = 0; m < randInt(r, 1, 4); m++) {
      // GameResult.winnerTeamId is typed non-null (a game always has a
      // winner), so games exist only when teams do.
      const games = Array.from({ length: teams.length ? randInt(r, 0, 3) : 0 }, () => {
        const game: { winnerTeamId: string; scoreA?: number; scoreB?: number } = {
          winnerTeamId: pick(r, teams).id,
        };
        if (chance(r, 0.5)) game.scoreA = randInt(r, 0, 3);
        if (chance(r, 0.5)) game.scoreB = randInt(r, 0, 3);
        return game;
      });
      const match: Tournament["matches"][number] = {
        id: `m${i}_${k}_${m}`,
        round: randInt(r, 1, 3),
        position: m,
        teamAId: teams.length && chance(r, 0.8) ? pick(r, teams).id : null,
        teamBId: teams.length && chance(r, 0.8) ? pick(r, teams).id : null,
        games,
        winnerTeamId: teams.length && chance(r, 0.7) ? pick(r, teams).id : null,
        winnerNext: chance(r, 0.5) ? { matchId: "m0", slot: chance(r, 0.5) ? "A" : "B" } : null,
        loserNext: chance(r, 0.5) ? { matchId: "m1", slot: "A" } : null,
      };
      if (chance(r, 0.3)) match.isThirdPlace = true;
      matches.push(match);
    }
    tournaments.push({
      id: `t${i}_${k}`,
      communityId: comm.id,
      disciplineId: pick(r, catalog).id,
      name: `Cup ${k}`,
      format: pick(r, ["series", "single-elim", "swiss", "round-robin"] as const),
      seriesLength: pick(r, [1, 3, 5]),
      teamCount: randInt(r, 2, 8),
      thirdPlace: chance(r, 0.5),
      createdAt: 1728900004000 + k,
      status: pick(r, ["draft", "active", "complete"] as const),
      teams,
      matches,
    });
  }

  return {
    version: 5,
    exportedAt: "2026-10-15T00:00:00.000Z",
    communities: [comm],
    players,
    sessions,
    tournaments,
    savedSquads: squads,
    disciplines,
  };
}

/** Structural canonicalization: object key order is not part of the law. */
function canon(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, vv]) => [k, canon(vv)]),
    );
  }
  return v;
}

describe("round-trip property", () => {
  it("survives 200 randomized documents", async () => {
    const failures: number[] = [];
    for (let i = 0; i < 200; i++) {
      const r = rng(0xc0ffee + i * 7919);
      const doc = genDoc(r, i);
      const db = await freshDb();
      try {
        await decompose(db, "acc-1", "com-1", doc);
        const back = await reassemble(db, "acc-1", "com-1");
        expect(canon(back), `seed ${i}`).toEqual(canon(doc));
      } catch (e) {
        failures.push(i);
        if (failures.length <= 3) console.error(`seed ${i}:`, e);
      }
    }
    expect(failures, `seeds failing: ${failures.join(", ")}`).toEqual([]);
  });
});
