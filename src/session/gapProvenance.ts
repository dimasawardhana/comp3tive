import type { SplitResult } from "../domain/types";

export type GapKind = "proven" | "best-found";

/**
 * Whether the search that produced these teams ran to completion.
 *
 * Reads `result.solver.optimal` and nothing else. That is the only rule true
 * on every path: the budget is exhausted or not depending on the pool's
 * strength distribution, not on its size, so size, source, and re-roll count
 * are all the wrong inputs. `varietySplit` stamps `optimal: false`
 * (`src/solver/solver.ts:419`) but delegates to `fairSplit` at `:409` when it
 * finds no candidate, and that fallback really is the exact optimum.
 *
 * A `swapPlayers` result carries `optimal: true` with `nodesExplored: 0`
 * (`src/session/edit.ts:64`), which means "no search ran", not "this
 * arrangement is minimal". The split screen deliberately shows no provenance
 * word in that case rather than claiming a proof the user's own edit erased.
 */
export function gapKind(result: SplitResult): GapKind {
  return result.solver.optimal === true ? "proven" : "best-found";
}

/**
 * The screen's qualifier, or null when the gap is proven.
 *
 * Null is what keeps the proven path byte-identical to the pre-B13 markup: a
 * proven result must not be hedged, and a 2-team pool (where the claim is
 * strongest) still reads exactly as it did.
 */
export function gapQualifier(result: SplitResult): string | null {
  return gapKind(result) === "proven" ? null : "Best gap found.";
}
