import { describe, expect, it } from "vitest";
import {
  fairSplit,
  buildSettings,
  suggestTeamCount,
  poolFromPlayers,
  type PoolPlayer,
  type SolverSettings,
} from "./solver";
import { FUTSAL_DISCIPLINE, MLBB_DISCIPLINE } from "../domain/seed";
import type { Player, SplitResult } from "../domain/types";

const ALL_MLBB = ["tank", "assassin", "mage", "marksman", "fighter"];

const p = (id: string, strength: number, eligible: string[] = [], preferred: string | null = null): PoolPlayer => ({
  playerId: id,
  name: `P${id}`,
  strength,
  eligibleRoles: eligible,
  preferredRole: preferred,
});

const futsal = (teamCount: number): SolverSettings => buildSettings(FUTSAL_DISCIPLINE, teamCount);
const mlbb = (teamCount: number): SolverSettings => buildSettings(MLBB_DISCIPLINE, teamCount);

/** Brute-force minimum gap for 2 teams (sized mode): min over subsets of size s of |avgA - avgB|. */
function bruteGap2(pool: PoolPlayer[], s: number): number {
  const total = pool.reduce((acc, q) => acc + q.strength, 0);
  let best = Infinity;
  const idx = pool.map((_, i) => i);
  const pick = (start: number, k: number, chosen: number[], sum: number): void => {
    if (k === 0) {
      const gap = Math.abs(sum / s - (total - sum) / (pool.length - s));
      if (gap < best) best = gap;
      return;
    }
    for (let i = start; i <= idx.length - k; i++) {
      chosen.push(i);
      pick(i + 1, k - 1, chosen, sum + pool[i].strength);
      chosen.pop();
    }
  };
  pick(0, s, [], 0);
  return best;
}

describe("fairSplit: specialist pools (regression: greedy must respect roles)", () => {
  it("25 role-specialists (5 per role) split into 5 fully-covered teams, never empty", () => {
    const pool: PoolPlayer[] = [];
    // 5 specialists per role, each eligible only for their role + one flex
    for (const role of ALL_MLBB) {
      for (let i = 0; i < 5; i++) {
        const flex = ALL_MLBB[(ALL_MLBB.indexOf(role) + 1) % 5];
        pool.push(p(`spec-${role}-${i}`, 4 + (i % 3) / 2, [role, flex], role));
      }
    }
    const res = fairSplit(pool, MLBB_DISCIPLINE, mlbb(5));
    expect(res.teams.length).toBe(5);
    for (const t of res.teams) {
      expect(t.slots).toHaveLength(5);
      expect(t.slots.map((s) => s.roleId).sort()).toEqual([...ALL_MLBB].sort());
    }
  });
});

describe("fairSplit: variety (re-roll)", () => {
  const sig = (res: SplitResult) =>
    res.teams
      .map((t) => t.slots.map((s) => s.playerId).sort().join(","))
      .sort()
      .join("|");

  it("returns different near-optimal splits across variety counters", () => {
    // Equal strengths: every balanced partition is optimal, so variety can vary.
    const pool = Array.from({ length: 10 }, (_, i) => p(`pl${i}`, 4, ALL_MLBB));
    const base = fairSplit(pool, MLBB_DISCIPLINE, mlbb(2));
    const a = fairSplit(pool, MLBB_DISCIPLINE, mlbb(2), { variety: 0 });
    const b = fairSplit(pool, MLBB_DISCIPLINE, mlbb(2), { variety: 1 });
    const c = fairSplit(pool, MLBB_DISCIPLINE, mlbb(2), { variety: 2 });
    const signatures = new Set([sig(a), sig(b), sig(c)]);
    expect(signatures.size).toBeGreaterThan(1); // variety actually varies
    for (const res of [a, b, c]) {
      expect(res.teams).toHaveLength(2);
      for (const t of res.teams) {
        expect(t.slots).toHaveLength(5);
        expect(t.slots.map((s) => s.roleId).sort()).toEqual([...ALL_MLBB].sort());
        // fair: within tolerance of the strict optimum
        expect(res.gap).toBeLessThanOrEqual(base.gap + 0.1 + 1e-9);
      }
    }
  });
});

describe("fairSplit: determinism", () => {
  it("returns identical output for identical input (sized mode)", () => {
    const pool = [5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1, 0.5].map((s, i) => p(String(i), s));
    const a = fairSplit(pool, FUTSAL_DISCIPLINE, futsal(2));
    const b = fairSplit(pool, FUTSAL_DISCIPLINE, futsal(2));
    // elapsedMs is wall-clock and legitimately varies; everything else must be identical.
    expect({ ...a, solver: { ...a.solver, elapsedMs: 0 } }).toEqual({
      ...b,
      solver: { ...b.solver, elapsedMs: 0 },
    });
  });

  it("returns identical output for identical input (role mode)", () => {
    const pool = [5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1, 0.5].map((s, i) => p(String(i), s, ALL_MLBB));
    const a = fairSplit(pool, MLBB_DISCIPLINE, mlbb(2));
    const b = fairSplit(pool, MLBB_DISCIPLINE, mlbb(2));
    expect({ ...a, solver: { ...a.solver, elapsedMs: 0 } }).toEqual({
      ...b,
      solver: { ...b.solver, elapsedMs: 0 },
    });
  });
});

describe("fairSplit: optimality (sized mode, brute-force ground truth)", () => {
  it("6 players, 2 teams of 3: matches exhaustive minimum gap", () => {
    const pool = [5, 4, 3, 2, 1, 0.5].map((s, i) => p(String(i), s));
    const res = fairSplit(pool, FUTSAL_DISCIPLINE, futsal(2));
    expect(res.solver.optimal).toBe(true);
    expect(res.gap).toBeCloseTo(bruteGap2(pool, 3), 6);
  });

  it("11 players, 2 teams (5 v 6 with a Sub): matches exhaustive minimum gap", () => {
    const pool = [5, 4.5, 4, 3.8, 3.6, 3.2, 3, 2.6, 2.2, 1.8, 1.4].map((s, i) => p(String(i), s));
    const res = fairSplit(pool, FUTSAL_DISCIPLINE, futsal(2));
    expect(res.solver.optimal).toBe(true);
    const sizes = res.teams.map((t) => t.slots.length).sort((a, b) => a - b);
    expect(sizes).toEqual([5, 6]); // even split, one team carries the Sub
    expect(res.gap).toBeCloseTo(bruteGap2(pool, 5), 6);
  });
});

describe("fairSplit: MLBB role coverage (hard)", () => {
  it("10 players, 2 teams: every team covers all five roles", () => {
    const pool = [5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1, 0.5].map((s, i) => p(String(i), s, ALL_MLBB));
    const res = fairSplit(pool, MLBB_DISCIPLINE, mlbb(2));
    expect(res.solver.optimal).toBe(true);
    expect(res.teams).toHaveLength(2);
    for (const t of res.teams) {
      expect(t.slots).toHaveLength(5);
      expect(t.slots.map((s) => s.roleId).sort()).toEqual([...ALL_MLBB].sort());
    }
  });

  it("specialists only ever get their one eligible role; teams stay fully covered", () => {
    // 5 specialists (one per role, strength 4) + 5 flex players (all roles, strength 2).
    const pool: PoolPlayer[] = [];
    for (let i = 0; i < 5; i++) {
      pool.push(p(`s${i}`, 4, [ALL_MLBB[i]]));
    }
    for (let i = 0; i < 5; i++) {
      pool.push(p(`f${i}`, 2, ALL_MLBB));
    }
    const res = fairSplit(pool, MLBB_DISCIPLINE, mlbb(2));
    expect(res.solver.optimal).toBe(true);
    for (const t of res.teams) {
      expect(t.slots.map((s) => s.roleId).sort()).toEqual([...ALL_MLBB].sort());
      for (const slot of t.slots) {
        const player = pool.find((q) => q.playerId === slot.playerId)!;
        expect(player.eligibleRoles).toContain(slot.roleId);
      }
    }
  });

  it("prefers preferred roles when balance allows", () => {
    const pool = ALL_MLBB.map((role, i) => p(`pl${i}`, 3, ALL_MLBB, role));
    const res = fairSplit(pool, MLBB_DISCIPLINE, mlbb(1));
    expect(res.solver.optimal).toBe(true);
    expect(res.teams).toHaveLength(1);
    const assigned = new Map(res.teams[0].slots.map((s) => [s.playerId, s.roleId]));
    for (const player of pool) {
      expect(assigned.get(player.playerId)).toBe(player.preferredRole);
    }
  });
});

describe("fairSplit: eligibility", () => {
  it("never assigns a role the player cannot fill", () => {
    const pool = ALL_MLBB.map((role, i) => p(`sp${i}`, 3, [role], role));
    const res = fairSplit(pool, MLBB_DISCIPLINE, mlbb(1));
    for (const slot of res.teams[0].slots) {
      const player = pool.find((q) => q.playerId === slot.playerId)!;
      expect(player.eligibleRoles).toContain(slot.roleId);
    }
  });
});

describe("fairSplit: leftovers and minimums", () => {
  it("11 players, 2 MLBB teams: one player sits out and is flagged", () => {
    const pool = [5, 4.5, 4, 3.8, 3.6, 3.2, 3, 2.6, 2.2, 1.8, 1.4].map((s, i) => p(String(i), s, ALL_MLBB));
    const res = fairSplit(pool, MLBB_DISCIPLINE, mlbb(2));
    expect(res.teams).toHaveLength(2);
    for (const t of res.teams) expect(t.slots).toHaveLength(5);
    expect(res.unassigned).toHaveLength(1);
    expect(res.flags.some((f) => f.kind === "leftover")).toBe(true);
  });

  it("8 players, 3 futsal teams: best effort, every team flagged below minimum", () => {
    const pool = [5, 4, 3.5, 3, 2.5, 2, 1.5, 1].map((s, i) => p(String(i), s));
    const res = fairSplit(pool, FUTSAL_DISCIPLINE, futsal(3));
    const belowMin = res.flags.filter((f) => f.kind === "team-below-min");
    expect(belowMin.length).toBeGreaterThan(0);
    expect(res.teams.length).toBeGreaterThan(0);
  });

  it("empty pool yields an empty, optimal result", () => {
    const res = fairSplit([], FUTSAL_DISCIPLINE, futsal(2));
    expect(res.teams).toEqual([]);
    expect(res.gap).toBe(0);
    expect(res.solver.optimal).toBe(true);
  });
});

describe("settings and pool helpers", () => {
  it("suggests floor(pool / min team size), clamped to at least 1", () => {
    expect(suggestTeamCount(11, FUTSAL_DISCIPLINE)).toBe(2);
    expect(suggestTeamCount(25, FUTSAL_DISCIPLINE)).toBe(5);
    expect(suggestTeamCount(3, MLBB_DISCIPLINE)).toBe(1);
  });

  it("poolFromPlayers keeps only players with a capability, computing Strength", () => {
    const cap = (disciplineId: string, ratings: Record<string, number>, roles: string[]): Player["capabilities"][number] => ({
      disciplineId,
      attributeRatings: ratings,
      eligibleRoles: roles,
      preferredRole: roles[0] ?? null,
    });
    const players: Player[] = [
      { id: "1", communityId: "c1", name: "Budi", capabilities: [cap("futsal", { technical: 4, fitness: 3, "game-iq": 5 }, ["goalkeeper"])] },
      { id: "2", communityId: "c1", name: "Andi", capabilities: [cap("mlbb", { mechanics: 4, "game-sense": 3, "hero-pool": 5, teamwork: 4 }, ["tank"])] },
    ];
    const pool = poolFromPlayers(players, FUTSAL_DISCIPLINE);
    expect(pool.map((q) => q.playerId)).toEqual(["1"]);
    expect(pool[0].strength).toBeCloseTo((4 + 3 + 5) / 3, 6);
  });

  it("poolFromPlayers keeps all role info a session needs", () => {
    const players: Player[] = [
      {
        id: "1",
        communityId: "c1",
        name: "Cici",
        capabilities: [
          {
            disciplineId: "futsal",
            attributeRatings: { technical: 4, fitness: 4, "game-iq": 4 },
            eligibleRoles: ["goalkeeper", "defender"],
            preferredRole: "defender",
          },
        ],
      },
    ];
    const pool = poolFromPlayers(players, FUTSAL_DISCIPLINE);
    expect(pool[0].eligibleRoles).toEqual(["goalkeeper", "defender"]);
    expect(pool[0].preferredRole).toBe("defender");
  });
});
