/**
 * The round-robin schedule by the **circle method**: which teams play which,
 * in which round.
 *
 * Pairing is by team **index**, so this module holds no team, no player and no
 * state from the app, and it imports nothing at all. `buildBracket` maps the
 * indices onto matches and owns everything the app knows; that is the whole
 * reason this file is a function over a number instead of a function over a
 * tournament.
 *
 * **The algorithm.** On an even field of `m` slots, slot 0 never moves, slots
 * 1..m-1 turn one position per round, and each round pairs slot `i` with slot
 * `m - 1 - i`. Two teams meet twice before the ring returns to where it
 * started, so the schedule runs `m - 1` rounds and the first pairing of the
 * first round is always the two ends of the field.
 *
 * **The bye rule, for an odd count.** The field is padded with one empty slot
 * to make it even, and the empty slot *rotates with everybody else*: it is
 * never parked next to the fixed team, and no team is ever chosen to rest.
 * That is what makes it fair rather than arbitrary. Over the `m - 1` rounds the
 * empty slot visits every position in the ring exactly once, and a rotation
 * puts every team in every ring position exactly once, so the empty slot meets
 * every team exactly once — each team rests on exactly one round and no more.
 * A scheduler that benched team 0 five times running would look the same in
 * the type and be plainly unfair on the floor, where the organizer can read it
 * off the screen; here the byes are a consequence of the ring, and the
 * property "each team rests exactly once" is asserted for every `n` rather
 * than hoped for. The ring turns one way, not both, so a team never plays
 * home and away: that is a single-schedule tournament, not a home/away one.
 *
 * **What a bye is not.** `teamB: null` is a pairing that does not exist. It is
 * not a win, not a walkover, and it carries no score and no winner. This module
 * names the team that does not play a round and stops; what a bye is worth in
 * a standings table belongs to the bracket, and deciding it here would be this
 * file asserting an outcome it has no evidence for.
 *
 * **Round and match counts.** `n - 1` rounds for even `n`, `n` rounds for odd
 * `n`, and `n * (n - 1) / 2` real pairings either way. Every round holds
 * `floor(n / 2)` real pairings plus one bye when `n` is odd.
 *
 * **Fewer than two teams.** `0` and `1` return no pairings. Both are counts of
 * a real state, not a mistake — spec 0002 keeps a tournament in draft when the
 * pool is smaller than its team count, so zero teams is reachable — and for
 * both the true answer is the empty list: no opponent exists, so no pairing and
 * no round. `1` in particular does *not* return a single bye. A one-team
 * field is not an uneven field, it is a finished one, and a round whose only
 * content is a bye would be this module reporting a rest that no fixture can
 * have happened. A `n` that is not a count at all — negative, fractional, NaN
 * — is a caller's bug and throws, because an empty schedule returned for an
 * input that cannot exist is a silent lie about the input.
 */
export interface RoundRobinPairing {
  /** 1-based round number. */
  round: number;
  /** The team that plays, or the team taking the bye when `teamB` is null. */
  teamA: number;
  /** The opponent, or null for a bye. */
  teamB: number | null;
}

export function roundRobinSchedule(n: number): RoundRobinPairing[] {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`roundRobinSchedule: ${String(n)} is not a count of teams.`);
  }
  // Zero or one team: nobody has an opponent, so there is nothing to schedule.
  if (n < 2) return [];

  // An odd field gets one empty slot so the ring is even and every slot has a
  // mirror. The empty slot goes last, and from there it is rotated like any
  // other slot, which is the whole of the bye rule.
  const m = n % 2 === 1 ? n + 1 : n;
  const slots: (number | null)[] = Array.from({ length: m }, (_, i) => (i < n ? i : null));

  const out: RoundRobinPairing[] = [];
  for (let round = 1; round < m; round++) {
    for (let i = 0; i < m / 2; i++) {
      const a = slots[i];
      const b = slots[m - 1 - i];
      if (a !== null && b !== null) {
        out.push({ round, teamA: a, teamB: b });
      } else if (a !== null) {
        out.push({ round, teamA: a, teamB: null });
      } else if (b !== null) {
        out.push({ round, teamA: b, teamB: null });
      }
    }
    // Turn the ring: the last slot moves to the front of the rotating half and
    // everything else shifts up one place. Slot 0 never moves.
    const last = slots[m - 1];
    for (let i = m - 1; i > 1; i--) slots[i] = slots[i - 1];
    slots[1] = last;
  }
  return out;
}
