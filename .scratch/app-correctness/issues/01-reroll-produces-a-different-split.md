# 01: Re-roll produces a different fair split

**What to build:** The Re-roll action returns a *different* split of the same pool, as the product promises, instead of recomputing the identical one.

**The defect.** `SplitScreen.reroll` (`src/session/SplitScreen.tsx:255-264`) calls

```ts
freshSplit(result.teams.flatMap((t) => t.slots.map((s) => s.playerId)), roster, discipline, { teamCount: result.teams.length })
```

with no `options`, and `freshSplit` (`src/session/edit.ts:110-117`) falls through to plain `fairSplit` when `options?.variety` is `undefined`. The solver is deterministic by contract and by test (`src/solver/solver.test.ts:94-114` asserts identical output for identical input), so Re-roll returns exactly the teams already on screen — while the UI increments a `Roll #{n}` badge (`src/session/SplitScreen.tsx:305`) as though it had done something.

`varietySplit` (`src/solver/solver.ts:359-423`) and `FairSplitOptions.variety`/`seed` exist precisely for this and are covered by `solver.test.ts:66-91`. The only caller that could have supplied a counter — `src/session/split-module.ts:27` — is dead code.

**The second defect in the same handler.** The pool is rebuilt from the *current teams* rather than from the session's own pool, so any player who sat out (an MLBB leftover, or a futsal sub beyond capacity) is dropped from every subsequent re-roll and can never be brought back.

- Pass an incrementing `variety` counter: keep a `useRef`/state counter in `SplitScreen` and pass `{ variety: n }` to `freshSplit`.
- Rebuild the pool from `session.poolPlayerIds` (intersected with the roster), not from `result.teams`.
- Keep re-roll's output within the solver's existing tolerance (`VARIETY_TOLERANCE = 0.1`, `src/solver/solver.ts:24`) — a re-roll must stay a *fair* split, never trade fairness for novelty.

**Blocked by:** —

**Status:** open

- [ ] Re-roll can produce a different team assignment for the same pool (asserted by comparing two consecutive re-rolls at a fixed seed)
- [ ] Every re-roll still satisfies the discipline's constraints: MLBB teams cover all five roles, team sizes stay within range
- [ ] The re-rolled gap stays within `VARIETY_TOLERANCE` of the proven optimum
- [ ] A player who was unassigned (flagged `leftover`) is eligible again on the next re-roll
- [ ] Re-roll on a session/squad source still persists nothing, and on an ad-hoc source still persists the new result
- [ ] The `Roll #N` badge is accurate — it never reports a roll that did not change the teams
- [ ] Unit test at the `freshSplit`/`fairSplit` seam plus an e2e check that two re-rolls differ

**Design reference:** `docs/design.md` — the split screen's live gap meter re-settles on re-roll.

**Notes:** `VARIETY_TOLERANCE` is the knob that defines "fair but different". If two re-rolls legitimately return the same teams for a tiny pool (e.g. 4 players, 2 teams, all equal strength), that is correct behaviour and the test must not demand a difference there.
