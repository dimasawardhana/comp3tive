import type { Discipline, Id, Player, SolverFlag, SplitResult, TeamAssignment, TeamSlot } from "../domain/types";
import { computeStrength } from "../domain/strength";

/** A player ready for splitting: capability reduced to Strength + roles. */
export interface PoolPlayer {
  playerId: Id;
  name: string;
  strength: number;
  eligibleRoles: Id[];
  preferredRole: Id | null;
}

export interface SolverSettings {
  teamCount: number;
  minTeamSize: number;
  maxTeamSize: number | null;
  rolesRequired: boolean;
}

/** Node budget: beyond this the exact search stops and returns the best found. */
export const NODE_BUDGET = 4_000_000;

/** Re-roll tolerance: a split this far from the optimum still counts as fair. */
export const VARIETY_TOLERANCE = 0.1;

export function buildSettings(discipline: Discipline, teamCount: number): SolverSettings {
  return {
    teamCount,
    minTeamSize: discipline.team.minTeamSize,
    maxTeamSize: discipline.team.maxTeamSize,
    rolesRequired: discipline.team.rolesRequired,
  };
}

/** Suggested default team count: floor(pool / min team size). */
export function suggestTeamCount(poolSize: number, discipline: Discipline): number {
  return Math.max(1, Math.floor(poolSize / discipline.team.minTeamSize));
}

/** Extract pool players: those with a capability in the discipline, Strength computed. */
export function poolFromPlayers(players: Player[], discipline: Discipline): PoolPlayer[] {
  const out: PoolPlayer[] = [];
  for (const p of players) {
    const cap = p.capabilities.find((c) => c.disciplineId === discipline.id);
    if (!cap) continue;
    out.push({
      playerId: p.id,
      name: p.name,
      strength: computeStrength(discipline, cap),
      eligibleRoles: cap.eligibleRoles,
      preferredRole: cap.preferredRole,
    });
  }
  return out;
}

/** Deterministic string hash mixed with a seed (for tie-break variety). */
function hashSeed(s: string, seed: number): number {
  let h = seed + 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function byNameThenId(a: PoolPlayer, b: PoolPlayer): number {
  return a.name.localeCompare(b.name) || a.playerId.localeCompare(b.playerId);
}

const avg = (team: PoolPlayer[]): number =>
  team.reduce((s, p) => s + p.strength, 0) / Math.max(1, team.length);

const softRole = (p: PoolPlayer): Id | null =>
  p.preferredRole !== null && p.eligibleRoles.includes(p.preferredRole)
    ? p.preferredRole
    : (p.eligibleRoles[0] ?? null);

/** Every role must be coverable by the team (exact check happens in assignRoles). */
function roleCoverPossible(team: PoolPlayer[], roleIds: Id[]): boolean {
  if (team.length < roleIds.length) return false;
  for (const r of roleIds) {
    if (!team.some((p) => p.eligibleRoles.includes(r))) return false;
  }
  return true;
}

/**
 * Assign the team's roles (one per player, each role exactly once), maximizing
 * how many players get their preferred role; ties break by role order. Returns
 * null when no full coverage exists. Deterministic.
 */
function assignRoles(players: PoolPlayer[], roleIds: Id[]): (Id | null)[] | null {
  if (players.length !== roleIds.length) return null;
  const n = players.length;
  // Most-constrained players first.
  const order = players
    .map((_, i) => i)
    .sort((a, b) => players[a].eligibleRoles.length - players[b].eligibleRoles.length);

  const assign: (Id | null)[] = new Array(n).fill(null);
  const used = new Set<Id>();
  let best: (Id | null)[] | null = null;
  let bestPreferred = -1;

  const rec = (k: number, preferred: number): void => {
    if (best !== null && preferred + (n - k) <= bestPreferred) return; // cannot beat
    if (k === n) {
      if (preferred > bestPreferred) {
        bestPreferred = preferred;
        best = [...assign];
      }
      return;
    }
    const pi = order[k];
    const player = players[pi];
    const candidates =
      player.preferredRole !== null && player.eligibleRoles.includes(player.preferredRole)
        ? [player.preferredRole, ...player.eligibleRoles.filter((r) => r !== player.preferredRole)]
        : player.eligibleRoles;
    for (const r of candidates) {
      if (used.has(r)) continue;
      used.add(r);
      assign[pi] = r;
      rec(k + 1, preferred + (r === player.preferredRole ? 1 : 0));
      used.delete(r);
    }
    assign[pi] = null;
  };
  rec(0, 0);
  return best;
}

/**
 * Assign roles to a fixed team after an edit. Required (MLBB): each role
 * exactly once, maximizing preferred matches; null roles when infeasible.
 * Soft (futsal): preferred role if eligible, else the first eligible role.
 */
export function assignTeamRoles(players: PoolPlayer[], roleIds: Id[], required: boolean): (Id | null)[] {
  if (!required) return players.map(softRole);
  const assigned = assignRoles(players, roleIds);
  return assigned ?? players.map(() => null);
}

/**
 * Greedy incumbent for an upper bound. Role mode deals one primary specialist
 * per role per team (round-robin), so every team is coverable by construction
 * when the pool has enough specialists; then balance-fills the rest. Sized
 * mode: strongest players drafted to the weakest team, round-robin.
 */
function greedySplit(
  players: PoolPlayer[],
  teamCount: number,
  sizeHigh: number,
  roleIds: Id[],
  rolesRequired: boolean,
): { teams: PoolPlayer[][]; leftover: PoolPlayer[] } | null {
  if (players.length === 0) return null;
  const pool = [...players].sort((a, b) => b.strength - a.strength); // stable: keeps seed-shuffled ties
  const teams: PoolPlayer[][] = Array.from({ length: teamCount }, () => []);
  const totals = new Array(teamCount).fill(0);
  const leftover: PoolPlayer[] = [];

  if (rolesRequired) {
    const primaries = new Map<Id, PoolPlayer[]>(roleIds.map((r) => [r, []]));
    const others: PoolPlayer[] = [];
    for (const p of pool) {
      if (p.preferredRole !== null && roleIds.includes(p.preferredRole)) {
        primaries.get(p.preferredRole)!.push(p);
      } else {
        others.push(p);
      }
    }

    // Deal one primary specialist per role per team (round-robin).
    for (const role of roleIds) {
      let cursor = 0;
      for (const p of primaries.get(role)!) {
        let placed = false;
        for (let k = 0; k < teamCount && !placed; k++) {
          const t = (cursor + k) % teamCount;
          if (teams[t].length >= sizeHigh) continue;
          if (teams[t].some((q) => q.preferredRole === role)) continue;
          teams[t].push(p);
          totals[t] += p.strength;
          cursor = t + 1;
          placed = true;
        }
        if (!placed) others.push(p);
      }
    }
  }

  // Balance-fill: the strongest remaining players to the weakest team.
  const rest = rolesRequired
    ? pool.filter((p) => !teams.some((t) => t.includes(p)))
    : pool;
  for (const p of rest) {
    let pick = -1;
    let pickTotal = Infinity;
    for (let t = 0; t < teamCount; t++) {
      if (teams[t].length >= sizeHigh) continue;
      if (totals[t] < pickTotal) {
        pickTotal = totals[t];
        pick = t;
      }
    }
    if (pick === -1) {
      leftover.push(p);
      continue;
    }
    teams[pick].push(p);
    totals[pick] += p.strength;
  }

  return { teams: teams.filter((t) => t.length > 0), leftover };
}

export interface FairSplitOptions {
  /**
   * Pick a different near-optimal split (variety counter). Re-roll uses this;
   * a deterministic exact solver would otherwise always return the same teams.
   */
  variety?: number;
  /**
   * Tie-break seed for the initial player ordering: re-rolls explore a
   * different region of the partition space, finding different near-optimal
   * splits that the variety pool can return.
   */
  seed?: number;
}

interface Candidate {
  teams: PoolPlayer[][];
  roles: (Id | null)[][];
  gap: number;
  leftover: PoolPlayer[];
  minViolations: number;
}

/** Build the public SplitResult from concrete teams (roles, totals, gap, flags). */
function toSplitResult(
  teamsIn: PoolPlayer[][],
  leftover: PoolPlayer[],
  discipline: Discipline,
  settings: SolverSettings,
  solverMeta: SplitResult["solver"],
): SplitResult {
  const roleIds = discipline.roles.map((r) => r.id);
  const rolesRequired = settings.rolesRequired;
  const minSize = settings.minTeamSize;
  const teamsOut: TeamAssignment[] = [];
  for (let index = 0; index < teamsIn.length; index++) {
    const team = teamsIn[index];
    const roles = rolesRequired ? (assignRoles(team, roleIds) ?? team.map(() => null)) : team.map(softRole);
    const slots: TeamSlot[] = team.map((player, i) => ({
      playerId: player.playerId,
      roleId: roles[i] ?? null,
    }));
    const totalStrength = team.reduce((s, q) => s + q.strength, 0);
    teamsOut.push({ index, slots, totalStrength, avgStrength: totalStrength / team.length });
  }

  const flags: SolverFlag[] = [];
  for (const t of teamsOut) {
    if (t.slots.length < minSize) {
      flags.push({ kind: "team-below-min", teamIndex: t.index, size: t.slots.length, minTeamSize: minSize });
    }
    if (!rolesRequired) {
      const covered = new Set(t.slots.map((s) => s.roleId).filter((r): r is Id => r !== null));
      for (const role of discipline.roles) {
        if (!covered.has(role.id)) {
          flags.push({ kind: "role-uncovered", teamIndex: t.index, roleId: role.id, coveringPlayerId: null });
        }
      }
    }
  }
  const unassigned = leftover.map((p) => p.playerId);
  for (const id of unassigned) flags.push({ kind: "leftover", playerId: id });

  const gap =
    teamsOut.length >= 2
      ? Math.max(...teamsOut.map((t) => t.avgStrength)) - Math.min(...teamsOut.map((t) => t.avgStrength))
      : 0;
  return { teams: teamsOut, gap, flags, unassigned, solver: solverMeta };
}

/** Deterministic seeded shuffle (re-roll variety on large pools). */
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed >>> 0 || 1;
  const rnd = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const teamAvg = (t: PoolPlayer[]): number => t.reduce((s, p) => s + p.strength, 0) / Math.max(1, t.length);

function teamGap(teams: PoolPlayer[][]): number {
  if (teams.length < 2) return 0;
  const avgs = teams.map(teamAvg);
  return Math.max(...avgs) - Math.min(...avgs);
}

function rolesValid(teams: PoolPlayer[][], roleIds: Id[], required: boolean): boolean {
  if (!required) return true;
  return teams.every((t) => roleCoverPossible(t, roleIds) && assignRoles(t, roleIds) !== null);
}

/** Local improvement: swap strongest/weakest team players to close the gap. */
function improveBySwaps(teams: PoolPlayer[][], roleIds: Id[], required: boolean, maxIter = 12): void {
  for (let iter = 0; iter < maxIter; iter++) {
    const avgs = teams.map(teamAvg);
    const hi = avgs.indexOf(Math.max(...avgs));
    const lo = avgs.indexOf(Math.min(...avgs));
    if (hi === lo) break;
    const gapBefore = teamGap(teams);
    let bestNewGap = gapBefore;
    let bestPair: [number, number] | null = null;
    for (let i = 0; i < teams[hi].length; i++) {
      for (let j = 0; j < teams[lo].length; j++) {
        const newAvgs = [...avgs];
        newAvgs[hi] =
          (avgs[hi] * teams[hi].length - teams[hi][i].strength + teams[lo][j].strength) / teams[hi].length;
        newAvgs[lo] =
          (avgs[lo] * teams[lo].length - teams[lo][j].strength + teams[hi][i].strength) / teams[lo].length;
        const newGap = Math.max(...newAvgs) - Math.min(...newAvgs);
        if (newGap < bestNewGap) {
          bestNewGap = newGap;
          bestPair = [i, j];
        }
      }
    }
    if (!bestPair || bestNewGap >= gapBefore) break;
    const [i, j] = bestPair;
    const a = teams[hi][i];
    const b = teams[lo][j];
    teams[hi][i] = b;
    teams[lo][j] = a;
    if (!rolesValid(teams, roleIds, required)) {
      teams[hi][i] = a;
      teams[lo][j] = b;
      break;
    }
  }
}

/**
 * Re-roll path: a different, fair split without exhaustive search (large
 * pools would never finish). Seeded randomized greedy + local swaps, then a
 * variety-indexed near-optimal candidate.
 */
export function varietySplit(
  pool: PoolPlayer[],
  discipline: Discipline,
  settings: SolverSettings,
  seed: number,
): SplitResult {
  const started = performance.now();
  const roleIds = discipline.roles.map((r) => r.id);
  const required = settings.rolesRequired;
  const teamCount = Math.max(1, settings.teamCount);
  const capMax = settings.maxTeamSize === null ? Infinity : settings.maxTeamSize;
  const base = Math.floor(pool.length / teamCount);
  const rem = pool.length % teamCount;
  let sizeLow: number;
  let sizeHigh: number;
  if (settings.maxTeamSize !== null) {
    if (pool.length >= teamCount * settings.maxTeamSize) {
      sizeLow = settings.maxTeamSize;
      sizeHigh = settings.maxTeamSize;
    } else {
      sizeLow = base;
      sizeHigh = base + (rem > 0 ? 1 : 0);
    }
  } else {
    sizeLow = base;
    sizeHigh = base + (rem > 0 ? 1 : 0);
  }
  sizeLow = Math.max(1, Math.min(sizeLow, capMax));
  sizeHigh = Math.max(sizeLow, Math.min(sizeHigh, capMax));

  const candidates: PoolPlayer[][][] = [];
  const leftovers: PoolPlayer[][] = [];
  const seen = new Set<string>();
  for (let s = 0; s < 10; s++) {
    const shuffled = seededShuffle(pool, seed + s * 101);
    const g = greedySplit(shuffled, teamCount, sizeHigh, roleIds, required);
    if (!g || g.teams.length === 0) continue;
    const teams = g.teams.map((t) => [...t]);
    if (!rolesValid(teams, roleIds, required)) continue;
    improveBySwaps(teams, roleIds, required);
    if (!rolesValid(teams, roleIds, required)) continue;
    const sig = teams.map((t) => t.map((p) => p.playerId).sort().join(",")).sort().join("|");
    if (seen.has(sig)) continue;
    seen.add(sig);
    candidates.push(teams);
    leftovers.push(g.leftover);
    if (candidates.length >= 6) break;
  }

  if (candidates.length === 0) {
    return fairSplit(pool, discipline, settings);
  }

  const picks = candidates.map((c, i) => ({ teams: c, leftover: leftovers[i], gap: teamGap(c) }));
  const minGap = Math.min(...picks.map((p) => p.gap));
  const near = picks.filter((p) => p.gap <= minGap + VARIETY_TOLERANCE);
  const list = near.length > 0 ? near : picks;
  const chosen = list[seed % list.length];

  return toSplitResult(chosen.teams, chosen.leftover, discipline, settings, {
    optimal: false,
    nodesExplored: 0,
    elapsedMs: Math.round(performance.now() - started),
  });
}

/**
 * The Fair split solver (the single test seam per the spec).
 *
 * Exact search over canonical set partitions (each split considered exactly
 * once) minimizing the strength gap between teams: max(avg) - min(avg).
 * Team sizes stay even (differ by at most 1) via sizeLow/sizeHigh. Role
 * coverage is hard (MLBB) or soft (futsal, with best-fit + flags). Leftover
 * players (pool beyond capacity) sit out and are flagged.
 *
 * Pruning: players are processed strongest-first; prefix sums give a valid
 * branch-and-bound on the achievable gap, so branches that cannot beat the
 * incumbent are cut. A node budget guards pathological pools. Deterministic.
 */
export function fairSplit(
  pool: PoolPlayer[],
  discipline: Discipline,
  settings: SolverSettings,
  options?: FairSplitOptions,
): SplitResult {
  const started = performance.now();
  const tieBreak = (a: PoolPlayer, b: PoolPlayer): number => {
    if (options?.seed !== undefined) {
      const ha = hashSeed(a.playerId, options.seed);
      const hb = hashSeed(b.playerId, options.seed);
      if (ha !== hb) return ha - hb;
    }
    return byNameThenId(a, b);
  };
  const players = [...pool].sort((a, b) => b.strength - a.strength || tieBreak(a, b));

  if (players.length === 0) {
    return { teams: [], gap: 0, flags: [], unassigned: [], solver: { optimal: true, nodesExplored: 0, elapsedMs: 0 } };
  }

  const roleIds = discipline.roles.map((r) => r.id);
  const teamCount = Math.max(1, settings.teamCount);
  const minSize = settings.minTeamSize;
  const capMax = settings.maxTeamSize === null ? Infinity : settings.maxTeamSize;

  const base = Math.floor(players.length / teamCount);
  const rem = players.length % teamCount;
  let sizeLow: number;
  let sizeHigh: number;
  if (settings.maxTeamSize !== null) {
    // Role mode: exactly maxTeamSize per team when the pool allows, else even best-effort.
    if (players.length >= teamCount * settings.maxTeamSize) {
      sizeLow = settings.maxTeamSize;
      sizeHigh = settings.maxTeamSize;
    } else {
      sizeLow = base;
      sizeHigh = base + (rem > 0 ? 1 : 0);
    }
  } else {
    // Sized mode: even sizes (subs), differ by at most 1.
    sizeLow = base;
    sizeHigh = base + (rem > 0 ? 1 : 0);
  }
  sizeLow = Math.max(1, Math.min(sizeLow, capMax));
  sizeHigh = Math.max(sizeLow, Math.min(sizeHigh, capMax));

  // Prefix sums over strength-sorted players: topK/bottomK feed the B&B bound.
  const n = players.length;
  const cum: number[] = new Array(n);
  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc += players[i].strength;
    cum[i] = acc;
  }
  const totalStrength = acc;
  const bottomK = (k: number): number => {
    if (k <= 0) return 0;
    if (k >= n) return totalStrength;
    return totalStrength - cum[n - k - 1];
  };

  let best: Candidate | null = null;
  const nearBest: Candidate[] = [];
  const nearSeen = new Set<string>();
  let nodes = 0;
  let aborted = false;

  const signatureOf = (c: Candidate): string =>
    c.teams
      .map((t) => t.map((p) => p.playerId).sort().join(","))
      .sort()
      .join("|");

  const consider = (teams: PoolPlayer[][], leftover: PoolPlayer[]): void => {
    if (teams.length === 0) return;
    if (teams.some((t) => t.length < 1 || t.length > sizeHigh)) return;
    if (settings.rolesRequired && !teams.every((t) => roleCoverPossible(t, roleIds))) return;

    const rolesRaw = teams.map((t) => (settings.rolesRequired ? assignRoles(t, roleIds) : t.map(softRole)));
    if (settings.rolesRequired && rolesRaw.some((r) => r === null)) return;
    const roles = rolesRaw.map((r) => r as (Id | null)[]);

    let minViolations = 0;
    for (const t of teams) if (t.length < minSize) minViolations++;

    const gap = Math.max(...teams.map(avg)) - Math.min(...teams.map(avg));
    const better =
      best === null ||
      minViolations < best.minViolations ||
      (minViolations === best.minViolations && gap < best.gap) ||
      (minViolations === best.minViolations && gap === best.gap && teams.length > best.teams.length);
    if (better) {
      // Snapshot: `teams`/`leftover` are live buffers that unwind after the search.
      best = {
        teams: teams.map((t) => [...t]),
        roles,
        gap,
        leftover: [...leftover],
        minViolations,
      };
    }

    // Variety pool: remember distinct candidates with the same coverage quality.
    if (best !== null && minViolations === best.minViolations) {
      const snapshot: Candidate = {
        teams: teams.map((t) => [...t]),
        roles,
        gap,
        leftover: [...leftover],
        minViolations,
      };
      const sig = signatureOf(snapshot);
      if (!nearSeen.has(sig)) {
        nearSeen.add(sig);
        nearBest.push(snapshot);
        if (nearBest.length > 12) {
          let worst = 0;
          for (let i = 1; i < nearBest.length; i++) {
            if (nearBest[i].gap > nearBest[worst].gap) worst = i;
          }
          nearBest.splice(worst, 1);
        }
      }
    }
  };

  const greedy = greedySplit(players, teamCount, sizeHigh, roleIds, settings.rolesRequired);
  if (greedy) consider(greedy.teams, greedy.leftover);

  // Canonical set-partition search with branch-and-bound. Teams are ordered by
  // their first (smallest) member, so each split is generated exactly once.
  const teams: PoolPlayer[][] = [];
  const teamSums: number[] = [];
  const leftover: PoolPlayer[] = [];

  const search = (from: number): void => {
    if (aborted) return;
    nodes++;
    if (nodes > NODE_BUDGET) {
      aborted = true;
      return;
    }

    // Branch-and-bound: any completion has gap >= max(team minAvg) - min(team maxAvg).
    // Bounds use only the unplaced suffix (players[from..]) - the strongest-first
    // order makes those the weakest players, and prefix sums give both in O(1).
    if (best !== null) {
      // Variety mode relaxes the bound so near-optimal alternatives are explored.
      const bound = options?.variety !== undefined ? best.gap + VARIETY_TOLERANCE : best.gap;
      const available = n - from;
      let maxMin = -Infinity;
      let minMax = Infinity;
      for (let i = 0; i < teams.length; i++) {
        const c = teams[i].length;
        const s = teamSums[i];
        const k = Math.min(sizeHigh - c, available);
        const minAvg = (s + bottomK(k)) / (c + k);
        const maxAvg = (s + (k <= 0 ? 0 : cum[from + k - 1] - (from > 0 ? cum[from - 1] : 0))) / (c + k);
        if (minAvg > maxMin) maxMin = minAvg;
        if (maxAvg < minMax) minMax = maxAvg;
      }
      if (maxMin - minMax >= bound) return;
    }

    if (from >= n) {
      if (teams.length > 0) consider(teams, [...leftover]);
      return;
    }

    const p = players[from];

    // Option 1: p joins an existing team (any team below the size cap).
    for (let i = 0; i < teams.length; i++) {
      if (teams[i].length < sizeHigh) {
        teams[i].push(p);
        teamSums[i] += p.strength;
        search(from + 1);
        teams[i].pop();
        teamSums[i] -= p.strength;
      }
    }

    // Option 2: p opens a new team.
    if (teams.length < teamCount) {
      teams.push([p]);
      teamSums.push(p.strength);
      search(from + 1);
      teams.pop();
      teamSums.pop();
    }

    // Option 3: role-mode capacity overflow - all teams full, p sits out.
    if (settings.maxTeamSize !== null && teams.length === teamCount && teams.every((t) => t.length === sizeHigh)) {
      leftover.push(p);
      search(from + 1);
      leftover.pop();
    }
  };

  search(0);

  // TS narrows `best` to null across the closure calls above; assert the real type.
  const finalBest = best as Candidate | null;
  let chosen = finalBest;
  if (finalBest && options?.variety !== undefined && options.variety >= 0) {
    const pool = nearBest.filter(
      (c) => c.minViolations === finalBest.minViolations && c.gap <= finalBest.gap + VARIETY_TOLERANCE,
    );
    if (pool.length > 1) chosen = pool[options.variety % pool.length];
  }
  const teamsOut: TeamAssignment[] = [];
  if (chosen) {
    for (let index = 0; index < chosen.teams.length; index++) {
      const team = chosen.teams[index];
      const rolesRow = chosen.roles[index];
      const slots: TeamSlot[] = team.map((player, i) => ({
        playerId: player.playerId,
        roleId: rolesRow ? rolesRow[i] : null,
      }));
      const totalStrength = team.reduce((s, q) => s + q.strength, 0);
      teamsOut.push({ index, slots, totalStrength, avgStrength: totalStrength / team.length });
    }
  }

  const flags: SolverFlag[] = [];
  for (const t of teamsOut) {
    if (t.slots.length < minSize) {
      flags.push({ kind: "team-below-min", teamIndex: t.index, size: t.slots.length, minTeamSize: minSize });
    }
    if (!settings.rolesRequired) {
      const covered = new Set(t.slots.map((s) => s.roleId).filter((r): r is Id => r !== null));
      for (const role of discipline.roles) {
        if (!covered.has(role.id)) {
          flags.push({ kind: "role-uncovered", teamIndex: t.index, roleId: role.id, coveringPlayerId: null });
        }
      }
    }
  }
  const unassigned: Id[] = chosen ? chosen.leftover.map((pl) => pl.playerId) : [];
  for (const id of unassigned) flags.push({ kind: "leftover", playerId: id });

  return {
    teams: teamsOut,
    gap: chosen ? chosen.gap : 0,
    flags,
    unassigned,
    solver: { optimal: !aborted, nodesExplored: nodes, elapsedMs: Math.round(performance.now() - started) },
  };
}
