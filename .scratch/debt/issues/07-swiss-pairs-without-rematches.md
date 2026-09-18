# 07: Swiss pairs without rematches and crowns by play

**Status:** ready-for-agent

**What to build:** A Swiss round never repeats a pairing when a legal alternative exists, and two teams on the same win record are separated by what they did in the tournament rather than by how strong they were before it started.

**Evidence (absorbed from `.scratch/app-health/issues/08`).** `pairRound` (`src/tournament/bracket.ts:162-185`) walks the seed-sorted field and, for each team, takes the **first** legal opponent it finds:

```ts
const ai = remaining.findIndex(
  (b) => Math.abs(recs.get(a.id)!.wins - recs.get(b.id)!.wins) <= 1 &&
         !played.has([a.id, b.id].sort().join(":")),
);
if (ai === -1) { pairs.push([a, remaining.shift()!]); continue; }   // falls back to a rematch
```

Taking first-fit strands the final pair. Fuzzing every legal outcome pattern: **6 teams: 2,048 of 4,096 patterns** produce a round-3 rematch; **8 teams: 1,024 of 4,096**. Concrete 6-team case: round 2 pairs `team-4 v team-6`, then round 3 pairs `team-6 v team-4` — while `{3-2, 1-6, 5-4}` was legal *and* rematch-free. 4 teams are unaffected: the greedy choice happens to be optimal there. (Correction already recorded on the original ticket: the analysis's claim that "a team sits out a round" when a record group is odd did **not** reproduce — every round seated all n teams for 4, 6 and 8. The rematch is the defect.)

**The second defect.** `standings` (`src/tournament/bracket.ts:302-313`) sorts by `wins`, then `team.strength`, then `gameWins`. `team.strength` is the **pre-tournament seed** (`records()` at `:131-152` copies `team` straight through), so a shared top record is broken by how strong a team was *before* play — the opposite of what Swiss standings are for. A 3-way tie at 2 wins is reachable: teams 1, 2 and 5 all finishing 2-2 with 2 game wins, where the title goes to team 1 purely because it was seeded first.

**Decisions required by the original ticket, taken here:**

- **Tiebreak order (crowning):** `wins` desc → **head-to-head winner when exactly two teams are tied on wins** (Swiss guarantees at most one prior meeting per pair, so it is well defined exactly there) → **game difference** (`gameWins − gameLosses`) desc → `gameWins` desc → `team.id` asc for determinism.
- **`team.strength` is removed from the crowning sort.** Seeding and crowning are two different questions and get two different answers; `team.strength` remains the seed order used to build the bracket, which is what it is for.
- **Pairing:** extract `selectPairing(field, recs, played)` — a deterministic backtracking search over the seed-sorted field that takes the first unpaired team, tries candidates in a fixed order (fewest-wins-difference, then stronger seed), and backtracks when a choice strands the remainder. It returns `null` only when no rematch-free legal assignment exists.

**Acceptance criteria:**
- [ ] When a rematch-free pairing under the same-record (±1 wins) rule exists, it is chosen — asserted exhaustively over outcome patterns, not with a single fixture
- [ ] No rematch is produced for 4, 6 or 8 teams unless every legal pairing is a rematch
- [ ] The fallback becomes an explicit `if (legal === null)` branch with its own comment, so the last-resort path is distinguishable in code from the normal path; the old first-fit `if (ai === -1)` path is gone
- [ ] `standings` sorts by `wins` desc → head-to-head (two-team ties only) → game difference desc → game wins desc → `team.id` asc; `team.strength` no longer appears in it
- [ ] `src/tournament/bracket.test.ts` gains an exhaustive block: for `n ∈ {4, 6, 8}` and **every** legal round-1 × round-2 outcome pattern (16 / 64 / 256 patterns), the generated round-3 pairing repeats no pair whenever a rematch-free assignment exists; an independent brute-force oracle over permutations decides "exists", so the assertion cannot agree with a buggy implementation
- [ ] Round count and round size are unchanged: a round still seats every team, and swiss still runs `ceil(log2 n)` rounds (`roundsFor`, `src/tournament/bracket.ts:53`)
- [ ] A 3-way tie at 2 wins is ordered by game difference, not by `team.strength` — asserted with a direct fixture
- [ ] **Every pre-existing bracket test passes unchanged**, verified case by case: `bracket.test.ts:254-266` (t2/t3 never met, tied on wins/game difference/game wins → the id key decides, same order as today) and `bracket.test.ts:268-281` (c beat d → head-to-head puts c first, the recorded expectation)
- [ ] `single-elim` and `series` paths are untouched; `src/tournament/bracket.ts` is edited only in `pairRound`/`standings` and the new `selectPairing`

**Blocked by:** —

**Design reference:** the file header at `src/tournament/bracket.ts:3-15` states the conventions — teams in seed order, deterministic match ids `m-<round>-<position>`, round one generated at build time and subsequent rounds on completion. The fix must not disturb them.
