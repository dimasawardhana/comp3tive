# 13: The split says whether its gap is proven

**Status:** ready-for-agent

**What to build:** The split screen states, in the product's voice, whether the gap it is showing
was *proven* minimal or is the *best gap the search found* before it stopped — so a 5-team
tournament night is not sold the same guarantee as a 2-team pick-up game. A proven result keeps
its current, unhedged wording.

**Evidence.** `SplitResult.solver` already carries `{ optimal, nodesExplored, elapsedMs }`
(`src/domain/types.ts:157`), and `optimal` is `!aborted` (`src/solver/solver.ts:685`) — false only
when the search exhausts `NODE_BUDGET = 4_000_000` (`src/solver/solver.ts:21`). `optimal` is read
in exactly one place in the whole codebase: `src/solver/solver.test.ts`. No `.tsx` file references
it, so the UI renders a proven minimum and a best-found heuristic identically
(`src/session/SplitScreen.tsx:135`, and the same copy again at `:334`).

Measured (audit `.scratch/app-health/issues/09`, re-measured for the spec):

| Pool | `optimal` | nodes | time | gap |
|---|---|---|---|---|
| futsal 20 / 2, mlbb 25 / 2 | true | ≤ 443 | ≤ 1 ms | 0.000 |
| landing hero (mlbb 10 / 2) | true | 51 | 7 ms | 0.10 |
| futsal, 20 players, 4 teams | **false** | 4,000,001 | 1,974 ms | 0.020 |
| futsal, 30 / 6 | **false** | 4,000,001 | 695 ms | 0.020 |
| MLBB, 25 / 5 (the shipped sample) | **false** | 4,000,001 | — | 0.350 |

So the proof holds for a night of two teams and fails for anything with four or more, which is
what tournaments need.

`optimal: true` behind a **swap** is not a claim of optimality: `swapPlayers` returns
`recomputeResult(teams, discipline, result.unassigned, roster)` (`src/session/edit.ts:55`), whose
`solver` parameter defaults to `{ optimal: true, nodesExplored: 0, elapsedMs: 0 }`
(`src/session/edit.ts:64`). Verified by probe: a split at `optimal: true, gap 0.100` becomes, after
swapping Citra for Joko, `optimal: true, nodesExplored: 0, gap 0.500`.

**What to build, exactly.**

1. New module `src/session/gapProvenance.ts`:

```ts
import type { SplitResult } from "../domain/types";

export type GapKind = "proven" | "best-found";

/** "proven" iff the search that produced these teams ran to completion. */
export function gapKind(result: SplitResult): GapKind;

/** The screen's qualifier, or null when the gap is proven (nothing to qualify). */
export function gapQualifier(result: SplitResult): string | null;
```

`gapKind` returns `"proven"` **iff** `result.solver.optimal === true`. Read the field and nothing
else — not the source, not a re-roll counter, not `nodesExplored`. That is the only rule true on
every path: `varietySplit` stamps `optimal: false` (`src/solver/solver.ts:419`), but it delegates
to `fairSplit` when it finds no candidate (`src/solver/solver.ts:409`), and that fallback really
is the exact optimum. Phase A03 has confirmed in writing that it will not write `result.solver`,
so this rule holds through a re-roll.

2. Both render sites change — `src/session/SplitScreen.tsx:135` (inside `GapMeter`, the 2-team
pitch layout) and `:334` (the 3+ team stack). Exact strings:

- Proven (`optimal: true`) — unchanged, because a proven result must not be hedged:
  - balanced: `Dead even. Fair game.`
  - otherwise: `Gap 0.1. Team A leads.`
- Best-found (`optimal: false`):
  - balanced: `Dead even. Best gap found.`
  - otherwise: `Gap 0.3. Team A leads. Best gap found.`

Exact JSX for the unproven, non-balanced case at both sites:

```tsx
Gap {gap.toFixed(1)}.{" "}
<span className="fine">
  {leader ? teamName(leader.index) : "?"} leads{gapQualifier(result) ? ` ${gapQualifier(result)}` : ""}.
</span>
```

Balanced branch:

```tsx
{balanced ? (
  <>Dead even. <span className="fine">{gapQualifier(result) ?? "Fair game."}</span></>
) : ( … )}
```

Because `gapQualifier` returns `null` when proven, the proven path emits byte-identical markup to
today.

3. No new CSS. The qualifier rides inside the existing `<span className="fine">`
(`src/index.css:2149`). No new classes, no layout change.

4. Do not touch anything else in `SplitScreen.tsx`. `contracts.md` scopes B13 to gap copy only;
`reroll`, the header, and the deal animation belong to other tickets.

**Acceptance criteria:**
- [ ] `src/session/gapProvenance.ts` exports `gapKind` and `gapQualifier` with the signatures above
- [ ] `gapQualifier` returns `null` for a result with `solver.optimal === true`, and `"Best gap found."` for `optimal === false`
- [ ] A 2-team split of the landing roster (10 MLBB players) reads `Gap 0.1. Team A leads.` with no provenance word — measured `optimal: true`, `nodesExplored: 51`
- [ ] A 5-team split of the shipped MLBB sample (25 players) reads `Gap 0.4. Team A leads. Best gap found.` — measured `optimal: false`, 4,000,001 nodes
- [ ] Both layouts show the qualifier: the `GapMeter` path (2 teams) and the `.readout` path (3+ teams)
- [ ] Clicking Re-roll on the landing hero makes the qualifier appear (`varietySplit` stamps `optimal: false`, `src/solver/solver.ts:419`)
- [ ] The copy contains no "aborted", "node budget", "heuristic", "search", or "exhaustive"
- [ ] The copy contains no em-dash (`docs/design.md:72` bans it in visible copy)
- [ ] No solver file is modified
- [ ] `npx vitest run` passes; `npm run e2e` passes with no spec edited

**Blocked by:** —
