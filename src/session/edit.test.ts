import { describe, expect, it } from "vitest";
import { swapPlayers, freshSplit } from "./edit";
import { buildSettings, fairSplit, poolFromPlayers, VARIETY_TOLERANCE } from "../solver/solver";
import { FUTSAL_DISCIPLINE, MLBB_DISCIPLINE } from "../domain/seed";
import type { Player, SplitResult } from "../domain/types";

const ALL_FUTSAL = ["goalkeeper", "defender", "winger", "pivot"];
const ALL_MLBB = ["tank", "assassin", "mage", "marksman", "fighter"];

const player = (id: string, name: string, fut: number[], ml: number[]): Player => ({ communityId: "c1",
  id,
  name,
  capabilities: [
    {
      disciplineId: "futsal",
      attributeRatings: { technical: fut[0], fitness: fut[1], "game-iq": fut[2] },
      eligibleRoles: ALL_FUTSAL,
      preferredRole: null,
    },
    {
      disciplineId: "mlbb",
      attributeRatings: { mechanics: ml[0], "game-sense": ml[1], "hero-pool": ml[2], teamwork: ml[3] },
      eligibleRoles: ALL_MLBB,
      preferredRole: null,
    },
  ],
});

const tenPlayers = (): Player[] =>
  ["Budi", "Andi", "Cici", "Dedi", "Eka", "Fitri", "Gita", "Hadi", "Intan", "Joko"].map((n, i) =>
    player(`p${i}`, n, [5 - (i % 4), 4 - (i % 3), 3 + (i % 3)], [4, 4, 4, 4]),
  );

const splitFutsal = (players: Player[]) =>
  fairSplit(poolFromPlayers(players, FUTSAL_DISCIPLINE), FUTSAL_DISCIPLINE, buildSettings(FUTSAL_DISCIPLINE, 2));

describe("swapPlayers", () => {
  it("exchanges the two players between teams without changing sizes", () => {
    const players = tenPlayers();
    const result = splitFutsal(players);
    const a = result.teams[0];
    const b = result.teams[1];
    const swapped = swapPlayers(result, players, FUTSAL_DISCIPLINE, {
      teamIndex: a.index,
      playerId: a.slots[0].playerId,
    }, { teamIndex: b.index, playerId: b.slots[0].playerId });

    expect(swapped.teams.map((t) => t.slots.length).sort()).toEqual([5, 5]);
    const aIds = swapped.teams.find((t) => t.index === a.index)!.slots.map((s) => s.playerId);
    const bIds = swapped.teams.find((t) => t.index === b.index)!.slots.map((s) => s.playerId);
    expect(aIds).toContain(b.slots[0].playerId);
    expect(bIds).toContain(a.slots[0].playerId);
    expect(swapped.gap).toBeGreaterThanOrEqual(0);
  });

  it("keeps MLBB role coverage valid after a swap (roles re-derived)", () => {
    const players = tenPlayers();
    const result = fairSplit(poolFromPlayers(players, MLBB_DISCIPLINE), MLBB_DISCIPLINE, buildSettings(MLBB_DISCIPLINE, 2));
    const a = result.teams[0];
    const b = result.teams[1];
    const swapped = swapPlayers(result, players, MLBB_DISCIPLINE, {
      teamIndex: a.index,
      playerId: a.slots[0].playerId,
    }, { teamIndex: b.index, playerId: b.slots[0].playerId });

    for (const t of swapped.teams) {
      expect(t.slots.map((s) => s.roleId).sort()).toEqual([...ALL_MLBB].sort());
    }
  });

  it("rejects swaps within the same team (no-op)", () => {
    const players = tenPlayers();
    const result = splitFutsal(players);
    const a = result.teams[0];
    const swapped = swapPlayers(result, players, FUTSAL_DISCIPLINE, {
      teamIndex: a.index,
      playerId: a.slots[0].playerId,
    }, { teamIndex: a.index, playerId: a.slots[1].playerId });
    expect(swapped).toBe(result); // unchanged reference
  });
});

describe("freshSplit", () => {
  it("re-rolls a split from the session's own pool and settings", () => {
    const players = tenPlayers();
    const pool = poolFromPlayers(players, FUTSAL_DISCIPLINE);
    const first = fairSplit(pool, FUTSAL_DISCIPLINE, buildSettings(FUTSAL_DISCIPLINE, 2));
    const rerolled = freshSplit(pool.map((p) => p.playerId), players, FUTSAL_DISCIPLINE, { teamCount: 2 });

    expect(rerolled.teams.reduce((n, t) => n + t.slots.length, 0)).toBe(10);
    const placed = new Set(rerolled.teams.flatMap((t) => t.slots.map((s) => s.playerId)));
    expect(placed.size).toBe(10); // same pool, all placed
    expect(rerolled.gap).toBeLessThanOrEqual(first.gap + 1e-9); // re-roll never worse than the proven optimum
  });
});

describe("freshSplit: variety (re-roll)", () => {
  const signature = (result: SplitResult) =>
    result.teams
      .map((t) => t.slots.map((s) => s.playerId).sort().join(","))
      .sort()
      .join("|");

  it("returns a different, still-fair split for a different variety counter", () => {
    const players = tenPlayers();
    const pool = players.map((p) => p.id);
    const settings = { teamCount: 2 };
    const optimum = fairSplit(
      poolFromPlayers(players, FUTSAL_DISCIPLINE),
      FUTSAL_DISCIPLINE,
      buildSettings(FUTSAL_DISCIPLINE, 2),
    );

    const a = freshSplit(pool, players, FUTSAL_DISCIPLINE, settings, { variety: 0 });
    const b = freshSplit(pool, players, FUTSAL_DISCIPLINE, settings, { variety: 1 });

    expect(signature(a)).not.toBe(signature(b));
    for (const result of [a, b]) {
      const placed = new Set(result.teams.flatMap((t) => t.slots.map((s) => s.playerId)));
      expect(placed.size).toBe(10); // same pool, every player placed
      // Fair: within VARIETY_TOLERANCE of the proven optimum. Never asserted optimal.
      expect(result.gap).toBeLessThanOrEqual(optimum.gap + VARIETY_TOLERANCE + 1e-9);
    }
  });

  it("draws from the whole pool, so a player who sat out can return", () => {
    // Seven MLBB players, one team of exactly five: two must sit out.
    const players = Array.from({ length: 7 }, (_, i) => player(`q${i}`, `Q${i}`, [3, 3, 3], [4, 4, 4, 4]));
    const pool = players.map((p) => p.id);
    const eligible = new Set<string>();
    for (let variety = 0; variety < 12; variety++) {
      const result = freshSplit(pool, players, MLBB_DISCIPLINE, { teamCount: 1 }, { variety });
      for (const team of result.teams) for (const slot of team.slots) eligible.add(slot.playerId);
    }
    expect(eligible.size).toBe(7);
  });
});
