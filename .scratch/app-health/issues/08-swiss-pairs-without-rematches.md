# 08 — Swiss pairs without rematches, and crowns by play

**What to build:** A Swiss round never repeats a pairing when a legal alternative exists, and two
teams on the same win record are separated by what they did in the tournament rather than by how
strong they were before it started.

**The defect, reproduced.** `pairRound` walks the seed-sorted field and, for each team, takes the
**first** legal opponent it finds:

```ts
const ai = remaining.findIndex(
  (b) => Math.abs(recs.get(a.id)!.wins - recs.get(b.id)!.wins) <= 1 &&
         !played.has([a.id, b.id].sort().join(":")),
);
if (ai === -1) { pairs.push([a, remaining.shift()!]); continue; }   // falls back to a rematch
```

Taking first-fit strands the final pair. Fuzzing every legal outcome pattern:

- **6 teams: 2,048 of 4,096 patterns** produce a round-3 rematch; **8 teams: 1,024 of 4,096**.
- Concrete 6-team case: round 2 pairs `team-4 v team-6`, then round 3 pairs `team-6 v team-4` — while
  `{3-2, 1-6, 5-4}` was legal *and* rematch-free.
- 4 teams are unaffected: the greedy choice happens to be optimal there.

**The second defect.** `standings` sorts by `wins`, then `team.strength`, then `gameWins`.
`team.strength` is the pre-tournament seed order, so a shared top record is broken by how strong a
team was *before* play — the opposite of what Swiss standings are for. A 3-way tie at 2 wins is
reachable: teams 1, 2 and 5 all finishing 2-2 with 2 game wins, where the title goes to team 1 purely
because it was seeded first.

**Blocked by:** None — can start immediately.

**Status:** resolved

- [ ] When a rematch-free pairing under the same-record (±1 wins) rule exists, it is chosen —
      asserted exhaustively over outcome patterns, not with a single fixture
- [ ] No rematch is ever produced for 4, 6 or 8 teams unless every legal pairing is a rematch
- [ ] The fallback stays as the genuine last resort it was meant to be, and the path that reaches it
      is distinguishable in code from the path that pairs normally
- [ ] A shared top record is broken by tournament play, not by `team.strength` — the rule is recorded
      in the ticket's Answer before it is implemented
- [ ] Every existing bracket test passes **unchanged**, including round-one adjacent-seed pairing
      (strongest vs weakest is *not* Swiss round one) and the Swiss progression tests
- [ ] Round count and round size are unchanged: a round still seats every team

**Design reference:** `src/tournament/bracket.ts`'s file header states the conventions — teams in
seed order, deterministic match ids, round one generated at build time and subsequent rounds on
completion. The fix must not disturb them.

**Notes:** **Correction to the analysis.** It claims "a team sits out a round" when a record group is
odd. That did **not** reproduce — every round seated all n teams for 4, 6 and 8. The rematch is the
real defect, and it is the one to fix.

**The tiebreak needs a product decision before it is coded.** Candidate rules: head-to-head among the
tied teams, game difference, or an explicit final between tied leaders. Which one is a judgement
about what the product's fairness claim means once a bracket is involved, and it belongs in this
ticket's Answer. The current order is defensible for *seeding* and wrong for *crowning*; those may
want to be two different sorts.

## Comments

Resolved by commit `feb79b7` ("fix: swiss pairs without rematches and crowns by play"), which
replaces the first-fit pairing with a search that prefers a rematch-free pairing when one exists
and drops `team.strength` from the crowning sort. `src/tournament/bracket.test.ts` gains the
exhaustive pattern block and the 2–4 tie fixture.

Also absorbed into Phase A of the debt repayment effort as
`.scratch/debt/issues/07-swiss-pairs-without-rematches.md`. Do not start that copy — this ticket's
work has shipped.
