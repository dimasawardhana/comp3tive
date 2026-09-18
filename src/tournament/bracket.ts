import type { GameResult, Id, Tournament, TournamentMatch, TournamentTeam } from "../domain/types";

/**
 * The tournament state machine (spec: docs/spec/0002-tournaments-v1.md).
 * Pure and deterministic: given the same input it always produces the same
 * bracket, so every behavior is testable without storage or UI.
 *
 * Conventions:
 * - Teams are stored in seed order (strongest first, seed = index + 1).
 * - Match ids are deterministic: `m-<round>-<position>`.
 * - Single elimination seeds by bit-reversal so seeds 1 and 2 meet only in
 *   the final; winners advance via `winnerNext`, semifinal losers route to
 *   the 3rd-place match via `loserNext`.
 * - Swiss generates round 1 only; each subsequent round is created when the
 *   previous one completes, pairing same-record teams without rematches.
 */

const majority = (seriesLength: number): number => Math.floor(seriesLength / 2) + 1;

const matchId = (round: number, position: number): string => `m-${round}-${position}`;

/** Reverse the low `bits` bits of `n` (used for bracket seeding). */
function bitReverse(n: number, bits: number): number {
  let out = 0;
  for (let i = 0; i < bits; i++) {
    out = (out << 1) | (n & 1);
    n >>= 1;
  }
  return out;
}

/** The team that lost a decided match. */
function loserId(match: TournamentMatch): Id | null {
  if (!match.winnerTeamId || !match.teamAId || !match.teamBId) return null;
  return match.teamAId === match.winnerTeamId ? match.teamBId : match.teamAId;
}

function resolvedWinner(games: GameResult[], a: Id | null, b: Id | null, seriesLength: number): Id | null {
  if (!a || !b) return null;
  const need = majority(seriesLength);
  let aWins = 0;
  let bWins = 0;
  for (const g of games) {
    if (g.winnerTeamId === a) aWins++;
    else if (g.winnerTeamId === b) bWins++;
  }
  if (aWins >= need) return a;
  if (bWins >= need) return b;
  return null;
}

/** Round count for a format: single elim = log2(N); swiss = ceil(log2 N). */
const roundsFor = (format: Tournament["format"], n: number): number =>
  format === "single-elim" ? Math.log2(n) : Math.ceil(Math.log2(n));

function emptyMatch(round: number, position: number): TournamentMatch {
  return {
    id: matchId(round, position),
    round,
    position,
    teamAId: null,
    teamBId: null,
    games: [],
    winnerTeamId: null,
    winnerNext: null,
    loserNext: null,
  };
}

/** Fill a slot on a match; null clears it. */
function setSlot(match: TournamentMatch, slot: "A" | "B", teamId: Id | null): void {
  if (slot === "A") match.teamAId = teamId;
  else match.teamBId = teamId;
}

/**
 * Build (or rebuild) the bracket structure for a tournament's teams.
 * Idempotent: calling it again regenerates the same matches.
 */
export function buildBracket(tournament: Tournament): Tournament {
  const t: Tournament = { ...tournament, teams: [...tournament.teams], matches: [] };
  const n = t.teams.length;
  if (n === 0) return { ...t, status: "draft" };

  if (t.format === "series" || (t.format === "single-elim" && n === 2)) {
    t.matches = [{ ...emptyMatch(1, 0), teamAId: t.teams[0].id, teamBId: t.teams[1].id }];
    return { ...t, status: "active" };
  }

  if (t.format === "single-elim") {
    const rounds = roundsFor(t.format, n);
    const positionOf = (seed: number): number => bitReverse(seed - 1, rounds);
    const order = t.teams.map((team, i) => ({ team, pos: positionOf(i + 1) })).sort((a, b) => a.pos - b.pos);
    const seeds = order.map((x) => x.team);

    for (let r = 1; r <= rounds; r++) {
      const matchesInRound = 2 ** (rounds - r);
      for (let p = 0; p < matchesInRound; p++) {
        const m = emptyMatch(r, p);
        if (r === 1) {
          m.teamAId = seeds[p * 2].id;
          m.teamBId = seeds[p * 2 + 1].id;
        }
        if (r < rounds) {
          m.winnerNext = { matchId: matchId(r + 1, Math.floor(p / 2)), slot: p % 2 === 0 ? "A" : "B" };
        }
        // Semifinal losers route to the 3rd-place match (same round as the final).
        if (t.thirdPlace && r === rounds - 1) {
          m.loserNext = { matchId: matchId(rounds, 1), slot: p === 0 ? "A" : "B" };
        }
        t.matches.push(m);
      }
    }
    if (t.thirdPlace && rounds > 1) {
      const third = emptyMatch(rounds, 1);
      third.isThirdPlace = true;
      t.matches.push(third);
    }
    return { ...t, status: "active" };
  }

  // swiss: one match per pair of seeds, adjacent pairing
  t.matches = Array.from({ length: Math.floor(n / 2) }, (_, p) => ({
    ...emptyMatch(1, p),
    teamAId: t.teams[p * 2].id,
    teamBId: t.teams[p * 2 + 1].id,
  }));
  return { ...t, status: "active" };
}

interface TeamRecord {
  team: TournamentTeam;
  wins: number;
  gameWins: number;
}

function records(t: Tournament): Map<Id, TeamRecord> {
  const map = new Map<Id, TeamRecord>();
  for (const team of t.teams) map.set(team.id, { team, wins: 0, gameWins: 0 });
  for (const m of t.matches) {
    for (const g of m.games) {
      const rec = map.get(g.winnerTeamId);
      if (rec) rec.gameWins++;
    }
    if (m.winnerTeamId) {
      const rec = map.get(m.winnerTeamId);
      if (rec) rec.wins++;
    }
  }
  return map;
}

const playedPairs = (t: Tournament): Set<string> => {
  const set = new Set<string>();
  for (const m of t.matches) {
    if (m.teamAId && m.teamBId) set.add([m.teamAId, m.teamBId].sort().join(":"));
  }
  return set;
};

/**
 * Choose a rematch-free, legal (|Δwins| <= 1) pairing of the whole field.
 * Deterministic depth-first search: take the first unpaired team, try opponents
 * in a fixed order (smallest wins difference first, then stronger seed), and
 * backtrack when a choice strands the remainder. Returns `null` only when no
 * rematch-free legal assignment exists.
 */
function selectPairing(
  field: TournamentTeam[],
  recs: Map<Id, TeamRecord>,
  played: Set<string>,
): [TournamentTeam, TournamentTeam][] | null {
  const seedIndex = new Map<Id, number>();
  field.forEach((team, i) => seedIndex.set(team.id, i));
  const byId = new Map(field.map((team) => [team.id, team]));

  const pairUp = (
    remaining: Id[],
    pairs: [TournamentTeam, TournamentTeam][],
  ): [TournamentTeam, TournamentTeam][] | null => {
    if (remaining.length === 0) return pairs;
    const [a, ...rest] = remaining;
    const aWins = recs.get(a)!.wins;
    const candidates = rest
      .filter((b) => Math.abs(aWins - recs.get(b)!.wins) <= 1 && !played.has([a, b].sort().join(":")))
      .sort(
        (x, y) =>
          Math.abs(aWins - recs.get(x)!.wins) - Math.abs(aWins - recs.get(y)!.wins) ||
          seedIndex.get(x)! - seedIndex.get(y)!,
      );
    for (const b of candidates) {
      const next = pairUp(rest.filter((id) => id !== b), [...pairs, [byId.get(a)!, byId.get(b)!]]);
      if (next) return next;
    }
    return null;
  };

  return pairUp(field.map((team) => team.id), []);
}

/** Pair the next Swiss round: same-record groups, no rematches, floats for odd groups. */
function pairRound(t: Tournament, recs: Map<Id, TeamRecord>, played: Set<string>): TournamentMatch[] {
  const field = t.teams
    .slice()
    .sort((a, b) => recs.get(b.id)!.wins - recs.get(a.id)!.wins || a.id.localeCompare(b.id));
  // A rematch-free legal pairing exists in every reachable Swiss position at
  // n <= 8; asking for one is the normal path.
  const legal = selectPairing(field, recs, played);
  const pairs: [TournamentTeam, TournamentTeam][] = [];
  if (legal === null) {
    // Last resort: no rematch-free legal assignment exists, so a repeat is
    // unavoidable. Pair the field in order and let the record rule float.
    const remaining = [...field];
    while (remaining.length > 1) {
      const a = remaining.shift()!;
      const ai = remaining.findIndex((b) => Math.abs(recs.get(a.id)!.wins - recs.get(b.id)!.wins) <= 1);
      pairs.push([a, remaining.splice(ai === -1 ? 0 : ai, 1)[0]]);
    }
  } else {
    pairs.push(...legal);
  }
  const round = t.matches.reduce((max, m) => Math.max(max, m.round), 0) + 1;
  return pairs.map(([a, b], p) => ({
    ...emptyMatch(round, p),
    teamAId: a.id,
    teamBId: b.id,
  }));
}

function requiredMatches(t: Tournament): TournamentMatch[] {
  if (t.format === "series") return t.matches;
  if (t.format === "single-elim") {
    const finalRound = roundsFor(t.format, t.teams.length);
    const finals = t.matches.filter((m) => m.round === finalRound && !m.isThirdPlace);
    const third = t.matches.find((m) => m.isThirdPlace);
    return third ? [...finals, third] : finals;
  }
  const lastRound = t.matches.reduce((max, m) => Math.max(max, m.round), 0);
  return t.matches.filter((m) => m.round === lastRound);
}

function statusOf(t: Tournament): Tournament["status"] {
  if (t.teams.length === 0) return "draft";
  const required = requiredMatches(t);
  if (required.length > 0 && required.every((m) => m.winnerTeamId)) return "complete";
  return "active";
}

/** Re-settle participants and winners downstream of an edit, then refresh status. */
function settle(t: Tournament): Tournament {
  const byRound = [...t.matches].sort((a, b) => a.round - b.round || a.position - b.position);
  for (const m of byRound) {
    const oldA = m.teamAId;
    const oldB = m.teamBId;
    // Re-derive this match's participants from upstream results.
    for (const src of byRound) {
      if (src.winnerNext?.matchId === m.id) setSlot(m, src.winnerNext.slot, src.winnerTeamId);
      if (src.loserNext?.matchId === m.id) setSlot(m, src.loserNext.slot, loserId(src));
    }
    if (m.teamAId !== oldA || m.teamBId !== oldB) {
      m.games = [];
      m.winnerTeamId = null;
    } else if (m.teamAId && m.teamBId) {
      m.winnerTeamId = resolvedWinner(m.games, m.teamAId, m.teamBId, t.seriesLength);
    }
  }
  // Swiss: generate the next round once the current one completes.
  if (t.format === "swiss") {
    const lastRound = t.matches.reduce((max, m) => Math.max(max, m.round), 0);
    const current = t.matches.filter((m) => m.round === lastRound);
    if (current.length > 0 && current.every((m) => m.winnerTeamId)) {
      const totalRounds = roundsFor(t.format, t.teams.length);
      if (lastRound < totalRounds) {
        const next = pairRound(t, records(t), playedPairs(t));
        t.matches.push(...next);
      }
    }
  }
  t.status = statusOf(t);
  return t;
}

/**
 * Record (or re-record) a match's games. Validates the frontier (both
 * participants decided), game legality (participant winner, series not
 * already decided, count within the series), then re-settles the bracket.
 */
export function applyResult(tournament: Tournament, matchId: Id, games: GameResult[]): Tournament {
  const t: Tournament = { ...tournament, matches: tournament.matches.map((m) => ({ ...m, games: [...m.games] })) };
  const match = t.matches.find((m) => m.id === matchId);
  if (!match) throw new Error("No match with that id.");
  if (!match.teamAId || !match.teamBId) {
    throw new Error("That match isn't ready to record: its teams aren't decided yet.");
  }
  if (games.length > t.seriesLength) {
    throw new Error(`A best-of-${t.seriesLength} series has at most ${t.seriesLength} games.`);
  }
  const need = majority(t.seriesLength);
  let aWins = 0;
  let bWins = 0;
  for (const [i, g] of games.entries()) {
    if (g.winnerTeamId !== match.teamAId && g.winnerTeamId !== match.teamBId) {
      throw new Error("A game must be won by one of the two teams.");
    }
    if (g.winnerTeamId === match.teamAId) aWins++;
    else bWins++;
    if ((aWins >= need || bWins >= need) && i < games.length - 1) {
      throw new Error("The series is already decided: no more games can be recorded.");
    }
  }
  match.games = games;
  match.winnerTeamId = resolvedWinner(games, match.teamAId, match.teamBId, t.seriesLength);
  return settle(t);
}
/**
 * Undo the last recorded game. Returns the tournament with the most recent
 * `games` entry removed from the match that recorded it. Throws if no game
 * has been recorded yet. Used by the spec-mandated "Undo" affordance.
 */
export function undoLastGame(tournament: Tournament): Tournament {
  const t: Tournament = { ...tournament, matches: tournament.matches.map((m) => ({ ...m, games: [...m.games] })) };
  let lastMatch: TournamentMatch | null = null;
  for (const m of t.matches) {
    if (m.games.length === 0) continue;
    if (!lastMatch || m.games.length > 0) lastMatch = m;
  }
  if (!lastMatch || lastMatch.games.length === 0) {
    throw new Error("No game to undo.");
  }
  lastMatch.games = lastMatch.games.slice(0, -1);
  lastMatch.winnerTeamId = resolvedWinner(
    lastMatch.games,
    lastMatch.teamAId,
    lastMatch.teamBId,
    t.seriesLength,
  );
  return settle(t);
}


/**
 * Swiss standings, crowned by play: series wins, then the head-to-head winner
 * when exactly two teams share a record (Swiss guarantees at most one meeting
 * per pair, so it is well defined there), then game difference, then game wins.
 * Those three keys read the played record, not the seed: seeding builds the
 * bracket, play decides the table.
 *
 * Ascending `team.id` is the deterministic last resort when all three tie, and
 * it is *not* seed-neutral: ids are handed out in strength order (`team-1` is
 * the strongest, `src/App.tsx`), so in the rare fully-tied case the id key can
 * still reproduce the pre-tournament seed. Once wins, difference and gameWins
 * all tie, some deterministic final key is unavoidable; this one is stated
 * rather than implied.
 */
export function standings(tournament: Tournament): { teamId: Id; wins: number; gameWins: number }[] {
  const recs = records(tournament);
  const losses = new Map<Id, number>();
  const headToHead = new Map<string, Id>();
  for (const r of recs.values()) losses.set(r.team.id, 0);
  for (const m of tournament.matches) {
    if (m.teamAId && m.teamBId && m.winnerTeamId) {
      headToHead.set([m.teamAId, m.teamBId].sort().join(":"), m.winnerTeamId);
    }
    for (const g of m.games) {
      const loser =
        g.winnerTeamId === m.teamAId ? m.teamBId : g.winnerTeamId === m.teamBId ? m.teamAId : null;
      if (loser) losses.set(loser, (losses.get(loser) ?? 0) + 1);
    }
  }
  const tiedOnWins = new Map<number, number>();
  for (const r of recs.values()) tiedOnWins.set(r.wins, (tiedOnWins.get(r.wins) ?? 0) + 1);
  return [...recs.values()]
    .sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (tiedOnWins.get(a.wins) === 2) {
        const winner = headToHead.get([a.team.id, b.team.id].sort().join(":"));
        if (winner === a.team.id) return -1;
        if (winner === b.team.id) return 1;
      }
      return (
        (b.gameWins - (losses.get(b.team.id) ?? 0)) - (a.gameWins - (losses.get(a.team.id) ?? 0)) ||
        b.gameWins - a.gameWins ||
        a.team.id.localeCompare(b.team.id)
      );
    })
    .map((r) => ({ teamId: r.team.id, wins: r.wins, gameWins: r.gameWins }));
}

/** The tournament champion, or null if not decided yet. */
export function champion(tournament: Tournament): TournamentTeam | null {
  if (tournament.status !== "complete") return null;
  if (tournament.format === "swiss") {
    const top = standings(tournament)[0];
    return tournament.teams.find((t) => t.id === top?.teamId) ?? null;
  }
  const finalRound = tournament.format === "single-elim" ? roundsFor(tournament.format, tournament.teams.length) : 1;
  const final = tournament.matches.find((m) => m.round === finalRound && !m.isThirdPlace);
  if (!final?.winnerTeamId) return null;
  return tournament.teams.find((t) => t.id === final.winnerTeamId) ?? null;
}
