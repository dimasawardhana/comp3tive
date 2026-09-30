# When a leftover is forced and one player outclasses the field, the solver benches someone else

**Status:** ready-for-agent

## The finding

`fairSplit` optimises **who plays where** over a pool it is given. **Who sits out is an output of
that arrangement, never an input** — there is no code path by which the solver can choose to bench a
player. So when a team count forces a leftover *and* one player substantially outclasses the field,
the solver benches a weaker player and the gap equals the standout's excess, when benching the
standout would give a dead-even split.

Eleven players, two teams of five, one player rated 5/5/5/5:

```
solver:      benched a weak player   gap 0.8   optimal=true
best over
every
bench
choice:      bench the standout      gap 0.0
```

`optimal=true` is honest: given that the standout must play, 0.8 **is** the best achievable split.
The gap is eight times `VARIETY_TOLERANCE` (`src/solver/solver.ts:24`), and every re-roll reproduces
it, because every re-roll re-runs the same search.

**The app's claims stay true.** The screen reads `Gap 0.8. Team A leads. Best gap found.` — a
measurement, an attribution, and specifically not "proven". Nothing here is a lie; the number on
screen is simply not the best the pool can do, and the app's own metric is the gap.

## What the measurement actually found

Sixteen pools measured with the shipped `fairSplit`, `poolFromPlayers` and `buildSettings`: the three
**shipped** sample rosters at nine team counts, plus synthetic pools with one standout at four
different margins.

| pool | leftover | solver gap | best over every bench choice | recoverable |
|---|---|---|---|---|
| futsal 25 → 2 / 3 / 4 | 0 | 0.096 / 0.139 / 0.119 | — | n/a |
| mlbb 25 → 2 / 3 / 4 | 5 / 10 / 5 | **0** | 0 | 0 |
| badminton 10 → 2 / 3 | 6 / 4 | **0** | 0 | 0 |
| 1 standout 5 vs field 4 · 11 → 2 | 1 | 0.2 | **0** | **0.2** |
| 1 standout 5 vs field 3 · 11 → 2 | 1 | 0.4 | **0** | **0.4** |
| 1 standout 5 vs field 2 · 11 → 2 | 1 | 0.6 | **0** | **0.6** |
| 1 standout 5 vs field 1 · 11 → 2 | 1 | 0.8 | **0** | **0.8** |
| 1 standout 5 vs field 4 · 15 → 3 | 0 | 0.2 | 0.2 | 0 |

**Three things fall out of this, and the first two are the ticket.**

1. **It requires a leftover.** Every row where a different bench choice would help has
   `leftover = 1`. Where nobody sits out the question does not arise, and the recoverable amount is
   0 by construction.
2. **The recoverable gap is exactly the standout's excess, and the alternative is always a perfect
   0.** 0.2 / 0.4 / 0.6 / 0.8 in step with the margin, and `bestIfDifferentBench = 0` in all four.
   So the advisory can be exact rather than approximate: when it fires, it can name the player.
3. **It never fires on any shipped roster.** Nine team counts across the three sample rosters, and
   every one that forces a leftover solves to **gap 0**. The non-zero futsal gaps occur where nobody
   sits out, so no bench choice would have helped.

## What this is not

- **Not the re-roll defect from ticket 03.** That is fixed and verified: re-roll changes the teams,
  advances the badge only when they change, and restores a sit-out's eligibility.
- **Not pool-order dependent.** The same eleven players with the standout first and last bench the
  *same* player and produce an identical split. My first hypothesis was iteration order, the test
  disproved it, and it is recorded here so nobody repeats it.
- **Not a wrong result, and not a crash.** It is a search that does not span one dimension.

## The mechanism

`greedySplit` (`src/solver/solver.ts:157-217`) places each remaining player into the least-total
team with room and pushes whoever does not fit into `leftover` (`:208-210`). `fairSplit` then
optimises the arrangement over that pool. Nothing takes "who is eligible to sit out" as an input.

## Recommendation

**Do not widen the search. Add a non-acting advisory.**

Widen the search means the space goes from *arrangements* to *arrangements × exclusions*, so the node
budget, the determinism guarantee and `VARIETY_TOLERANCE` all need re-arguing — and it benches good
players more often, which an organizer building a tournament does not want. The roster they selected
*is* the pool, and dropping their best player to win a displayed number is the same failure class
Phase B exists to remove: optimising a metric over what the person asked for.

The advisory keeps the pool the user's and their decision, and tells them what widening the search
would have done: **when a leftover exists and a different bench choice would produce a smaller gap,
say so, and name the player.** It is a local check, not a search — for each benched player and each
placed player, swap and recompute. With one benched and ten placed that is ten evaluations.

The measurement says it will be quiet: it fires on **zero** of the nine shipped-roster configurations,
and only when someone is a material fraction stronger than the field. A cheap, exact, rarely-firing
advisory is a good trade; a solver redesign for a case this rare is not.

## Acceptance

- The advisory names a specific player and is silent when no bench choice would have been better.
  Silence must be the default — a hint that cries wolf is worse than none.
- A test pins one pool where the fairest arrangement of the players who play is worse than another
  choice of who sits out, with the named player, so the behaviour is recorded not rediscovered.
- A test pins the opposite: a pool where the solver's bench is already the best one, and the
  advisory says nothing.
- The three shipped sample rosters still split to **gap 0, proven, zero flags** at their suggested
  counts — `src/data/sample-data.validation.test.ts` already asserts this and must stay green.
- If the wording is added to the surface rather than the behaviour, it states the *scope* of the
  number and does not use the word "fairest" of the pool as a whole.

## Evidence

All figures from the shipped solver, in a throwaway vitest run (since removed). The browser check
that prompted this: on the one-standout pool, all eight re-roll clicks reported
`Gap 0.8. Team A leads.`

## Comments
