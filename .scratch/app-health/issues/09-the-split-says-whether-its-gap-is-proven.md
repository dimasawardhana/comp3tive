# 09 — The split says whether its gap is proven

**What to build:** The split screen distinguishes a gap that was *proven* minimal from the best gap
the solver found before it ran out of search — so the product's fairness claim is honest on a big
pool instead of quietly rounding a guess up into a promise.

**Evidence.** `SplitResult` already carries its own provenance — `solver: { optimal, nodesExplored,
elapsedMs }` — and `optimal` is `!aborted`, i.e. false only when the node budget (`NODE_BUDGET =
4_000_000`) was exhausted. Measured on ordinary pools:

| Pool | `optimal` | nodes | time | gap |
|---|---|---|---|---|
| futsal, 20 players, 4 teams | **false** | 4,000,001 | 1,974 ms | 0.020 |
| futsal, 30 / 6 | **false** | 4,000,001 | 695 ms | 0.020 |
| futsal, 30 / 8 | **false** | 4,000,001 | 798 ms | 0.125 |
| MLBB, 25 / 5 | **false** | 4,000,001 | 755 ms | 0.320 |
| MLBB, 40 / 8 | **false** | 4,000,001 | 999 ms | 0.460 |
| futsal 20 / 2, mlbb 25 / 2 | true | ≤ 443 | ≤ 1 ms | 0.000 |

So the proof holds for a night of two teams and **fails for anything with four or more** — which is
the case most tournaments are.

**What the screen shows today:** `Gap 0.3`, a `tag-gap` reading `OK` whenever `gap <= 0.1` and the
raw number otherwise, and nothing about provenance. `.optimal` is read in exactly one place in the
codebase: `src/solver/solver.test.ts`. The UI presents a heuristic result and a proven one
identically.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] The split screen states which of the two it is showing, in the product's voice — no jargon like
      "aborted" or "node budget"
- [ ] `optimal: false` is visibly **not** the same as a proven-minimal gap; a reader can tell at a
      glance
- [ ] `optimal: true` still reads as the strong claim it is — do not soften a proven result into a
      hedge
- [ ] The distinction survives on both the two-team pitch layout and the 3+ team stack
- [ ] Nothing about the solver changes: this surfaces a field that already exists
- [ ] The e2e suite passes with no spec edited

**Design reference:** `docs/design.md` — the split screen's gap meter is the product's signature
moment, and this is copy inside it, not a new panel.

**Notes:** `elapsedMs` and `nodesExplored` are available if a "took N ms" line ever earns its place.
It does not for this ticket: the user-visible question is "is this the best possible split?", not
"how long did you think about it?".

**Related, not in scope:** `varietySplit` produces near-optimal splits by design, so a re-rolled
split is *never* a proven minimum. When `.scratch/app-correctness/01` lands, the qualifier has to
stay true through a re-roll — coordinate the copy with that ticket rather than asserting the
strong claim unconditionally.
