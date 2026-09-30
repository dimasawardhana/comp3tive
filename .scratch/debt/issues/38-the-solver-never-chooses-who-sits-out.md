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

---

## Implemented, with what the implementation cost

`src/session/benchAdvice.ts` asks the question the search cannot and returns a fact: take one
player off the pool, re-run the **shipped** `fairSplit` on the rest, and see whether the number
on screen would have been smaller. The split is not changed, `src/solver/` is not touched, and
the sentence names a player and stops. The decision that dropping their best player is theirs
belongs to the organizer, and the sentence is where that decision stays.

**Silence is the default, and it is mostly free.** `null` for one team, for no leftover, for a
gap that already reads 0.0, for a pool it cannot rebuild from the roster, for a split whose own
search exhausted `NODE_BUDGET`, when nobody on a team outranks the bench, and when no swap
strictly improves the printed gap. **Zero of the nine shipped-roster configurations fire**, which
is the measurement this ticket was written on, re-pinned per roster and per team count with an
assertion that the loop really covered nine.

**The scope clause is built from the discipline, not from a single string.** The search fixes the
bench and minimises over the arrangements of whoever is left, so the number is a statement about
that field and about the splits the *discipline permits*. The phrase is composed from
`discipline.team.maxTeamSize` and `rolesRequired`, so Mobile Legends reads "the closest these 10
players come in 2 teams of 5, each covering every role", badminton reads "…in 2 teams of 2…",
and a discipline that requires no roles drops the role clause rather than hedging it. A literal
phrasing written for Mobile Legends would have been false on badminton, which fires too.

**Four things this cost, measured rather than assumed.**

1. **A render cliff on the largest pools.** ~135ms per `fairSplit` call on a 25-player pool, so
   nineteen candidates is 2.6 seconds, and the cliff lands exactly on the pools that exhaust
   `NODE_BUDGET` — which are also the pools the app is already saying it could not prove. The
   advisory is therefore **silent where `result.solver.nodesExplored >= NODE_BUDGET`**: 0ms on
   three 26-player pools at five teams that each cost ~200ms to split, against 3,594ms measured
   without the guard. On every pool the guard does not stop the worst case is 0.9x the split the
   screen already ran. **The trade is coverage for cost, and the coverage given up is the
   widest pools.** One residual: the guard reads the *current* result, and `swapPlayers` restamps
   `nodesExplored` to 0, so a wide pool becomes eligible again after a manual swap.
2. **The strength filter is sound as measured and is not free of proof.** Over 1,261 pools on
   which the advisory fires — every strength mix over four rating levels, eleven to seventeen MLBB
   players at two and three teams, seven to ten badminton players at two and three — the filter
   cost a better gap **zero** times. What that figure covers is the *gap*, not the name: on a pool
   where several removals evenest the teams equally, naming a different one of them has missed
   nothing, and a containment check would have called that a pass while proving nothing.
3. **The call cap does cost answers, and now by how much.** In the same 1,261 pools it cost a
   better gap **15 times, 1.2%**, never because of the strength filter and always because the
   answer was a mid-strength player at rank 4, 6 or 8 of the kept list. Every one is the same
   shape and one of them is pinned as a fixture, so the cost is a fixture rather than a hope.
4. **Futsal can never fire, and that is futsal's doing.** It sizes its teams from the pool
   (`solver.ts:477-481`), so its capacity is always at least the pool and it never has a leftover.
   The advisory speaks on MLBB, on badminton, and on any custom discipline with a hard
   `maxTeamSize` the pool overflows.

**Why the bound holds.** The leftover branch (`src/solver/solver.ts:631`) is only reachable once
every team is full, and players are dealt strongest-first, so who sits out is the tail of the
order rather than a choice the search gets to make. A pinned test asserts the consequence: the
bench never holds anyone stronger than the weakest person playing. A player no stronger than that
is one the field can do without, because taking him off leaves the whole bench's best still in
the pool, so the imbalance moves rather than leaves.

**Not verified here.** No browser run and no build, per the ticket's own constraints. What the
sentence looks like is unproven by eye; that it is a sibling of the readout and never a child of
it, and that the readout holds no paragraph at all, are asserted in
`src/session/SplitScreen.bench-advice.test.ts`. `landing.css`'s hero override for the new class
is sound by construction and **unexercised today**: the hero roster splits to gap 0.05 with no
leftover, so nothing renders it.
