import type { Discipline, Id, Player, SplitResult } from "../domain/types";
import { buildSettings, fairSplit, poolFromPlayers } from "../solver/solver";
import { gapKind } from "./gapProvenance";

/**
 * What one different bench choice would have produced, when one would have
 * been better. Facts, not a sentence: the words live in `benchAdviceLine` so
 * they can be tested in the `node` suite without rendering anything.
 *
 * The advisory does not change the split. The solver stays exactly as it is,
 * and so does the arrangement on screen: an organizer who picked eleven people
 * has asked for those eleven, and dropping their best player to win a
 * displayed number is the organizer-optimising-a-metric-over-what-they-asked-for
 * failure Phase B exists to remove. So this module measures the alternative and
 * hands back a name. Deciding what to do about it stays with the person.
 */
export interface BenchAdvice {
  /** The player currently on a team who would have to sit out instead. */
  sitOutInstead: Id;
  /**
   * The people that swap gives a game to: the current leftover, minus anyone
   * the alternative still leaves on the bench for its own reasons.
   *
   * It is not always the whole leftover, and the difference is load-bearing.
   * Removing one player from an eleven-player MLBB pool leaves ten, which fill
   * two teams of five outright, so the alternative has nobody out at all and
   * this names the whole current bench. Where the alternative keeps somebody
   * out, that person is dropped from the list, because "instead of" is a claim
   * that the named player is *playing* in the alternative, and the alternative
   * is the only thing that can say so.
   */
  insteadOf: Id[];
  gapNow: number;
  gapInstead: number;
}

export interface BenchAdviceInput {
  result: SplitResult;
  discipline: Discipline;
  roster: Player[];
}

/**
 * Solver runs one advisory may make.
 *
 * The cap trades breadth for a bound, and it is the only thing in this module
 * that can cost an answer. With the strength filter below, a pool with one
 * standout puts one player above the bench and costs one run; this only bites
 * on wide pools where many players outrank the bench, and on those `fairSplit`
 * is the same search the screen has already paid for, measured at roughly
 * 100ms a call on a 25-player pool. Nineteen calls is two seconds of solver
 * time to keep hunting after the answer has almost certainly been found.
 *
 * So the cap truncates rather than gives up: the candidates are taken
 * strongest-first (see below), so what survives is the end of the pool most
 * likely to be holding the imbalance, and the sentence still names one real
 * swap. What it can no longer promise is that the named swap is the *best* one,
 * which is why the copy never says so: it states a swap and the gap behind it,
 * and both are true whichever four the cap kept. A pool where the answer sits
 * below the cut gets no hint, and a test pins that pool and names what was
 * missed.
 */
const MAX_SOLVER_RUNS = 4;

/**
 * The gap at the one precision the screen prints it (`toFixed(1)`).
 *
 * Both the "did this help" test and the sentence read the number through this,
 * so they cannot disagree about it. Without it the module would fire on two
 * arrangements that differ in the fifteenth decimal place and print
 * "Gap 0.2 ... would bring the gap to 0.2", which is a sentence nobody reading
 * a screen can do anything with.
 */
const shown = (gap: number): number => Number(gap.toFixed(1));

/**
 * Whether a different choice of who sits out would have evened these teams, and
 * who it would have been.
 *
 * `fairSplit` arranges the pool it is given and never chooses the bench: the
 * leftover branch (`src/solver/solver.ts:631`) is only reachable once every
 * team is full, and players are dealt strongest-first, so who sits out is a
 * consequence of the order rather than a choice the search gets to make. This
 * asks the one question the search cannot: take one player away, re-run the
 * shipped solver on the rest, and see whether the number on screen would have
 * been smaller.
 *
 * `null` is the answer in every case where the screen should say nothing, and
 * it is the answer most of the time:
 *
 * - **One team or none.** There is no second average to be apart from, and the
 *   screen shows its own failure state rather than a gap.
 * - **Nobody sitting out.** The finding needs a forced leftover; with no
 *   leftover the question does not arise.
 * - **The gap already reads 0.0.** The gap is `max(avg) - min(avg)` over one
 *   array, so it cannot go below zero and no arrangement of any pool beats it.
 * - **An id the roster does not hold** (or holds without a rating in this
 *   discipline). The pool below would not be the pool the app split, so every
 *   number it could print would be about a different set of people.
 * - **Nobody on a team outranks the best player already on the bench.** The
 *   strength bound has nothing left to look at (see below).
 * - **No swap strictly improves the printed gap**, including every swap that
 *   only moves the digits after the decimal.
 *
 * And one case returns `null` that is not a guard at all: a pool whose answer
 * sits below the call cap's cut, where the module is silent because it did not
 * look, not because nothing was there.
 */
export function benchAdvice(input: BenchAdviceInput): BenchAdvice | null {
  const { result, discipline, roster } = input;
  if (result.teams.length < 2 || result.unassigned.length === 0 || shown(result.gap) <= 0) return null;

  // The pool this split came from, rebuilt from the result itself:
  // `SplitResult` carries no pool, and the two sites this mounts at already
  // hold `result`, `discipline` and `roster` and nothing else, so the advisory
  // derives its own rather than adding a prop to a function this phase is not
  // allowed to change.
  const everyone = new Set<Id>([
    ...result.teams.flatMap((t) => t.slots.map((s) => s.playerId)),
    ...result.unassigned,
  ]);
  const pool = poolFromPlayers(roster.filter((p) => everyone.has(p.id)), discipline);
  if (pool.length !== everyone.size) return null;
  const strength = new Map(pool.map((p) => [p.playerId, p.strength] as const));

  /**
   * The bound: only a player stronger than the best player already on the
   * bench can be the one worth moving.
   *
   * The bench is the tail of the strongest-first order, so the weakest person
   * playing is at least as strong as the strongest person sitting out (pinned
   * by a test, because the scope sentence below rests on it). A player no
   * stronger than that is one the field can do without: the alternative pool
   * still carries the whole bench's best, so the imbalance moves from one side
   * to the other instead of leaving. Removing someone who outranks the entire
   * bench is the only change that takes a driver out of the field rather than
   * swapping it for something as strong, and that is the case this advisory
   * exists for.
   *
   * Candidates are taken strongest-first, so the cap keeps the end of the pool
   * most likely to be holding the imbalance rather than whichever four the
   * team order happened to produce.
   *
   * This is a direction argument about the objective, not a theorem about a
   * heuristic: nothing in `src/solver/` is promised to be monotone in any one
   * player's strength, and the solver is off limits to this phase in any case.
   * So the bound is checked rather than trusted. One test re-runs the
   * unbounded enumeration over every placed player, on every pool in this file
   * where the advisory speaks, and asserts it names the same player.
   */
  const benchBest = Math.max(...result.unassigned.map((id) => strength.get(id) ?? 0));
  const candidates = result.teams
    .flatMap((t) => t.slots.map((s) => s.playerId))
    .filter((id) => (strength.get(id) ?? 0) > benchBest)
    .sort((a, b) => (strength.get(b) ?? 0) - (strength.get(a) ?? 0) || a.localeCompare(b))
    .slice(0, MAX_SOLVER_RUNS);
  if (candidates.length === 0) return null;

  // The counterfactual is asked with the team count on screen. `SplitResult`
  // does not record the settings the split was asked for, and a result can
  // carry fewer teams than were requested (a candidate with an empty team is
  // rejected at `solver.ts:514`, so a pool that cannot fill them is split
  // smaller). Asking with what the reader can see keeps the comparison inside
  // one question, and the shape is re-checked per candidate below.
  const settings = buildSettings(discipline, result.teams.length);
  const now = shown(result.gap);
  let best: BenchAdvice | null = null;

  for (const sitOutInstead of candidates) {
    const alternative = fairSplit(pool.filter((p) => p.playerId !== sitOutInstead), discipline, settings);
    // The same number of teams, or the two gaps are about two different games.
    if (alternative.teams.length !== result.teams.length) continue;
    // Strictly smaller as printed, which is also "smaller than the number the
    // readout is about to say". Ties keep the earlier candidate and the
    // candidate order is fixed, so one split always names one player.
    if (!(shown(alternative.gap) < now)) continue;
    if (best !== null && alternative.gap >= best.gapInstead) continue;
    best = {
      sitOutInstead,
      insteadOf: result.unassigned.filter((id) => !alternative.unassigned.includes(id)),
      gapNow: result.gap,
      gapInstead: alternative.gap,
    };
  }
  return best;
}

/**
 * The advisory in one line: the scope of the number on screen, then the named
 * swap, then a stop.
 *
 * Clause by clause, because each one is a claim and only claims the module can
 * back are allowed here:
 *
 * - "Gap 0.2 is the closest the 10 players on these teams can be split." The
 *   figure is quoted rather than re-derived so it cannot drift from the
 *   readout, and the scope names **these players**, not the roster: the search
 *   fixes the bench and then minimises the gap over the arrangements of
 *   whoever is left, so the number is a statement about that field. Reading it
 *   as a claim about everyone who could have played is exactly the misreading
 *   the second clause then corrects. "Closest" is the exact search's word and
 *   "best split found" is the truncated one's, decided by `gapKind` so the one
 *   place that knows what the app may claim about a search owns it.
 * - "Rangga sitting out instead of Kresna." The player, and who the alternative
   puts on a team in their place. On every shipped discipline the list is
   exactly one name: a leftover needs a hard `maxTeamSize` to exist at all, and
   on that path taking one player away always leaves exactly one fewer person
   out, so the sentence always reads as a substitution. The clause is dropped
   when the list is empty, which those disciplines cannot produce and a custom
   one with role-constrained benches conceivably could, because "instead of"
   would then be a claim about a bench the alternative does not have.
 * - "would bring the gap to 0.0." What the shipped solver produces on the pool
 *   without that player. It is a number and not a bound because `fairSplit` is
 *   deterministic, so the counterfactual is a fact rather than a hope, and it
 *   is quoted at the same precision as the readout, so the two figures a
 *   reader compares are the two figures the screen would print. It never says
 *   "would even them": a swap can improve the gap without reaching zero, and
 *   the measured claim is the one the module can prove.
 *
 * There is no fourth clause. No "you could", no "consider", no second number
 * to weigh. The organizer chose the roster, and what to do about their best
 * player is theirs to decide; the whole reason this is an advisory rather than
 * a wider search is that the decision does not belong to the metric.
 */
export function benchAdviceLine(advice: BenchAdvice, input: BenchAdviceInput): string {
  const { result, roster } = input;
  const playing = result.teams.reduce((n, t) => n + t.slots.length, 0);
  const now = shown(advice.gapNow).toFixed(1);
  const scope =
    gapKind(result) === "proven"
      ? `Gap ${now} is the closest the ${playing} players on these teams can be split.`
      : `Gap ${now} is the best split found for the ${playing} players on these teams.`;
  const who = roster.find((p) => p.id === advice.sitOutInstead)?.name ?? "?";
  const instead = advice.insteadOf.map((id) => roster.find((p) => p.id === id)?.name ?? "?").join(", ");
  const swap = instead === "" ? `${who} sitting out` : `${who} sitting out instead of ${instead}`;
  return `${scope} ${swap} would bring the gap to ${shown(advice.gapInstead).toFixed(1)}.`;
}
