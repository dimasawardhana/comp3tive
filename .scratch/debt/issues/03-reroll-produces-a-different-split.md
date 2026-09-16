# 03: Re-roll produces a different fair split

**Status:** ready-for-agent

**What to build:** Clicking Re-roll returns a *different*, still-fair arrangement of the session's own pool — and the `Roll #N` badge counts only rolls that actually changed the teams.

**Evidence (absorbed from `.scratch/app-correctness/issues/01`).** Reproduced live: 10 seeded players, split into 2 teams, Re-roll clicked twice.

```
clicked:   ["Re-roll", "Re-roll"]
badge:     ["Mobile Legends", "2 teams", "Roll #3"]
before:    "Player 2,Player 5,Player 10,Player 4,Player 1 || Player 8,Player 6,Player 3,Player 9,Player 7"
after1:    "Player 2,Player 5,Player 10,Player 4,Player 1 || Player 8,Player 6,Player 3,Player 9,Player 7"
after2:    "Player 2,Player 5,Player 10,Player 4,Player 1 || Player 8,Player 6,Player 3,Player 9,Player 7"
changed1:  false
changed2:  false
```

Cause — `src/session/SplitScreen.tsx:255-264` builds the pool from the on-screen teams and passes no `variety`:

```ts
const next = freshSplit(result.teams.flatMap((t) => t.slots.map((s) => s.playerId)), roster, discipline, { teamCount: result.teams.length });
```

`freshSplit` (`src/session/edit.ts:110-118`) falls through to deterministic `fairSplit` when `options?.variety` is `undefined`; the solver is deterministic by contract and by test (`src/solver/solver.test.ts:94-114` asserts identical output for identical input). `varietySplit` exists (`src/solver/solver.ts:359-423`) with tests (`src/solver/solver.test.ts:66-91`) and **zero call sites outside `edit.ts`**.

**Second defect in the same handler.** The pool is rebuilt from `result.teams`, so any player who sat out (an MLBB leftover, a futsal sub past capacity) is dropped from every later re-roll and can never come back.

**Provenance note (D1 — this is why no optimality is asserted anywhere in this ticket).** `varietySplit` is a near-optimal search: it returns `optimal: false` (`src/solver/solver.ts:414-421`), but it falls back to `fairSplit` at `:396` when it finds no candidate, and that fallback can legitimately return `optimal: true`. The honest rule is therefore **"proven iff `result.solver.optimal`"**, not "a re-roll is never proven". Phase B13 owns the gap copy in `SplitScreen.tsx:135` and `:339` and keys it on that field. This ticket never writes, overrides or fabricates `solver.optimal`, and does not change the `solver` object shape (`src/domain/types.ts:157`).

**Acceptance criteria:**
- [ ] `reroll` passes `{ variety: n }` alongside `{ teamCount }` to `freshSplit`, rebuilding the pool from `session.poolPlayerIds` (intersected with the roster), not from `result.teams`
- [ ] A bounded counter walk skips a variety index whose output matches the current teams, so a click that can change the teams does
- [ ] `rerollCount` increments **only** when the assignment actually changed, so `Roll #N` (`src/session/SplitScreen.tsx:305`) never reports a roll that did not happen
- [ ] Where the pool has exactly one fair arrangement, the badge stays and the screen does not claim a roll — a deliberate, documented outcome
- [ ] Every re-roll satisfies the discipline's constraints (MLBB teams cover all five roles; team sizes within range) and its gap stays within `VARIETY_TOLERANCE = 0.1` (`src/solver/solver.ts:24`, `:414`) of `fairSplit`'s gap
- [ ] A player flagged `leftover` is eligible again on the next re-roll
- [ ] Persistence is unchanged: re-rolling a `session`/`squad` source still persists nothing, an ad-hoc source still persists the new result (`src/App.tsx:1188-1191`)
- [ ] `src/session/edit.test.ts` gains a `freshSplit` variety case: `{variety: 0}` and `{variety: 1}` over the `tenPlayers()` futsal pool produce different signatures, both place all 10 players, and both sit within `VARIETY_TOLERANCE` of `fairSplit`'s gap
- [ ] New `e2e/tests/split/reroll.spec.ts` (seeded, 1 test): two Re-roll clicks render different team membership and the badge reads `Roll #2` then `Roll #3`
- [ ] No assertion in this ticket reads `result.solver.optimal`, and `src/solver/**` is unmodified

**Blocked by:** 01 — the new spec uses the shared seeded helper (`.scratch/debt/issues/01`)

**Design reference:** `docs/design.md` — the split screen's live gap meter re-settles on re-roll.

**Notes:** `VARIETY_TOLERANCE` is the knob that defines "fair but different". If two re-rolls legitimately return the same teams for a tiny pool (4 players, 2 teams, all equal strength), that is correct behaviour and the test must not demand a difference there. Phase A owns `reroll` only; B13 owns the gap copy at `:135` and `:339`.
