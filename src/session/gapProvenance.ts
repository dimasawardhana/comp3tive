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
 * A `swapPlayers` result is stamped `optimal: false, nodesExplored: 0`
 * (`src/session/edit.ts:72`) — no search ran, so the screen says **"Best gap
 * found."** rather than reading the absence of a qualifier as minimality. It
 * used to stamp `optimal: true` here, which suppressed the qualifier and left
 * the screen's own `Gap 0.3. <Team> leads.` / `Dead even. Fair game.` to
 * stand as an affirmative fairness claim on an arrangement nobody proved.
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
