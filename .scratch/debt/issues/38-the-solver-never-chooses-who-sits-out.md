# The solver never chooses who sits out, so a dominant player cannot be benched for a fair split

**Status:** ready-for-agent

## The finding

A fair split can exist and the solver will not find it, because **the sit-out is a by-product of the
arrangement rather than a choice the solver makes.**

Eleven players, two teams of five, one player rated 5/5/5/5 and ten rated 1/1/1/1. The only
arrangements with a gap of zero bench the dominant player and split the other ten 5/5. The solver
instead reports:

```
benched=["p9"]  gap=0.80  optimal=true   |  p0+p5+p6+p7+p8  |  p1+p10+p2+p3+p4
```

`optimal=true` is honest: given that `p0` must play, 0.80 **is** the best achievable split. The gap
is eight times `VARIETY_TOLERANCE` (`src/solver/solver.ts:24`). Re-roll reproduces it every click,
because every re-roll re-runs the same search.

**The app's claims stay true throughout.** The screen reads `Gap 0.8. Team A leads. Best gap found.`
— a measurement, an attribution and an honesty qualifier, and specifically *not* "proven". Nothing
here is a lie. What is wrong is that the number on screen is not the best the pool can do, while the
app's own metric is the gap.

## What this is not

- **Not the re-roll defect from ticket 03.** That one is fixed and verified: re-roll changes the
  teams, advances the badge only when they change, and restores the sit-out's eligibility.
- **Not pool-order dependent.** I tested it: the same eleven players with the dominant player first
  and last in the pool bench the *same* player and produce a byte-identical split. My first
  hypothesis was that iteration order decided the sit-out; it does not, and the test is recorded
  here so nobody repeats it.
- **Not a crash or a wrong result.** It is a search that does not span a dimension.

## The mechanism

`greedySplit` (`src/solver/solver.ts:157-217`) places each remaining player into the least-total
team with room, and pushes whoever does not fit into `leftover` (`:208-210`). `fairSplit` then
optimises the *arrangement* over that pool. Nothing anywhere takes "who is eligible to sit out" as
an input, so **the pool is a given and the leftover is an output.** There is no code path by which
`p0` could be benched.

## Why it is a ticket and not a fix

This is a product decision with two defensible answers, and picking one in a patch would bury it:

1. **Optimise the sit-out.** Search over which players are excluded, not only over who plays where.
   Cost: the search space grows from arrangements to arrangements × exclusions, so `fairSplit`'s
   node budget and its determinism guarantee both have to be re-argued. It would also bench good
   players more often, which an organizer may not want.
2. **Keep the current behaviour and say so.** The pool is the organizer's decision — they chose
   eleven players for two teams — and a tool that silently drops their best player to win a metric
   is doing something they did not ask for. The honest form of this answer is a sentence on the
   roster or the split screen: *the gap is the fairest split of the players who fit, and who sits
   out is not part of that number.*

Option 2 costs a sentence. Option 1 costs a solver redesign. **The ticket exists because nobody has
decided which, and the gap is only 0.8 in the pathological case** — with a normal pool the solver
finds a dead-even split, which is what the app usually shows.

## Acceptance

- A decision is recorded: optimise the sit-out, or keep it and document it on the surface.
- If option 2: the surface says what the gap covers and does not cover, and a test pins the wording.
  Something like "the fairest split of the players who fit" — **not** "the fairest split", which is
  what the current metric means and is false here.
- If option 1: `fairSplit`'s node budget, its determinism guarantee and `VARIETY_TOLERANCE` are
  re-argued, and the re-roll tolerance is re-checked against the widened search.
- Either way, a test pins one pool where the fairest arrangement of the players who play is worse
  than some other choice of who sits out, so the behaviour is recorded rather than rediscovered.

## Evidence

Measured with the shipped `fairSplit` and `poolFromPlayers` in a throwaway vitest run (since
removed):

| pool order | benched | gap | optimal |
|---|---|---|---|
| dominant first | `p9` | 0.80 | true |
| dominant last | `p9` | 0.80 | true |

In the browser, on the same pool, all eight re-roll clicks reported `Gap 0.8. Team A leads.`

## Comments
