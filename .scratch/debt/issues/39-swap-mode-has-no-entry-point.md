# Swap mode has no entry point: a shipped feature cannot be started

**Status:** ready-for-agent
**Found:** 2026-09-30, while cleaning up a one-character copy fix. The character was unreachable too.

## The defect

`swapMode` is `useState(false)` at `src/session/SplitScreen.tsx:266` and **can never become `true`.**

- `setSwapMode` is called at exactly one site: `toggleSwapMode` (`:348-349`).
- `toggleSwapMode` is bound at exactly one site: `:498`, the **"Done swapping"** button.
- That button renders only inside `{swapMode ? (` (`:497`) — it is the *exit*.

So the entry point is the exit, the entry point is unreachable, and **the whole feature is dead.** The two-step banner at `:392-401` is under `{swapMode && (` and never renders. Every `<li>` in `TeamCard` is inert, because `onClick={() => swapMode && onPick(...)}` (`:81`) and the keyboard path (`:82-87`) both require the flag.

**A manual swap is a documented, specified, styled feature that no user can perform.** It has been dead since 2026-09-07 — through all four phases and 118 commits — and **no test can catch it**, because entering the mode is the thing that is missing.

## How it got orphaned: removed, not retired

It was built and it worked. At the root commit `45f2eed` the bar had **three** buttons bound to
`toggleSwapMode`: "Done swapping", plus a `Swap` ghost in each of two branches. Commit **`36d32b6`
"tourney creation fix" (2026-09-07)** rewrote that region to add the `inTournament` prop and a
`← Tournament` back button, and **in the same hunk dropped both `Swap` buttons.**

The removal was not explained by the commit's purpose. Collapsing the tournament branch from three
actions to the single `Save tournament squad →` primary was right; the non-tournament branch kept its
multi-button shape and simply lost its first button, leaving `Re-roll` alone. The commit kept
`toggleSwapMode`, kept the `{swapMode ? (` branch and its exit, and kept the banner — **it removed the
only two callers of the handler and kept everything they reached.** That is the shape of an accidental
removal inside a refactor, not a retirement.

**What this cannot prove is intent, and the ticket does not guess at it.** What is provable: the
feature shipped, worked, and lost its two entry points in one unrelated hunk.

## Four documents still describe it as shipped

| | |
|---|---|
| `docs/spec/0001-team-builder-v1.md:45` | user story 22, "swap any two players between teams" |
| `docs/spec/0001-team-builder-v1.md:77` | "solver output is editable — manual player swaps between teams with a live strength-gap indicator" |
| `docs/FLOW.md:168` | `| swap mode | in-place | user |` |
| `DESIGN.md:100` | "Edit affordance: each card is a swap target" |

`README.md:16` reasons about what a manual swap means for provenance. So the documentation set is
currently *false in four places* about a feature that does not work — which is the Phase B defect,
unnoticed, for ten weeks.

## What the feature is, since the ticket has to survive being read cold

`pick` (`:267`) holds the first player chosen. `onPick(teamIndex, playerId)` is bound to every `<li>`
in `TeamCard` and fires only when the mode is on, by click (`:81`) or Enter/Space (`:82-87`), with
`role="button"` and `tabIndex={0}` added for the duration (`:78-80`). `handlePick` (`:307-321`) stores
the first pick, clears it if you tap the same team again, and otherwise calls `swapPlayers` and
commits. `swapPlayers` (`src/session/edit.ts:29-56`) trades the two slots, re-derives both teams' role
assignments, and recomputes totals, averages, gap and flags — so the gap meter moves under your finger,
which is the point of the feature. Entering the mode also hides Back, Save squad and Share (`:459`,
`:464`, `:487`) and relabels the primary, so the bar becomes a single exit. The CSS is all there:
`.team li.swappable` has a pointer, a hover fill and an accent `.picked` state
(`src/split.css:401-415`, `:733-736`).

**Nothing needs designing. A button needs putting back.**

## Acceptance

- **A reachable entry to swap mode**, from the split screen's action bar, in the shape the bar
  already has. If the correct control is the `Swap` ghost the root commit had, restore that; if a
  different shape is better, say why.
- **A test that enters the mode and performs a swap.** The mode is a precondition for every assertion
  about it, so the first thing any such test does is fail today. That is the test that would have
  caught the removal.
- **`swapPlayers` is exercised through the UI**, so the two-step pick, the same-team clear, and the
  live gap update are all covered rather than only the commit.
- **The four documents stop describing a feature that does not work.** Either the feature works or the
  documents change; the current state is both broken and claimed, which is the worst of the two.
- `src/session/SplitScreen.tsx` stays within `contracts.md:538` — note its **one named exception** is the
  trailing full stop at `:397` and nothing else, so **restoring a button is outside the current grant
  and needs its own amendment.** Say what you need and it will be given.

## How the sweep that found this works, because it is not repeatable by accident

All 91 `useState` declarations in every non-test `.ts`/`.tsx` under `src/`, in two passes: any setter
never referenced anywhere, and any state whose only entry is a handler bound inside that same state's
own gate. **Exactly one hit: `swapMode`/`toggleSwapMode`.** Three near-misses are the correct shape
and are not defects: `deleteConfirm` and `deleteId` are the Cancel/Delete confirm pattern entered
from outside the branch, and `recording` passes its setter out as `onMatch`.

**Two attempts missed it before the third found it**, and the reason matters more than the result:
- one counted only `setter(` call syntax, so prop-style references like `onMatch={setRecording}` were
  invisible;
- one tested the gate line-locally, so a handler defined *outside* the gate read as an outside entry.

**Only the brace-matched, reference-counting version finds this class.** It is invisible to a naive
sweep by construction.

**What that sweep does not answer, stated so nobody treats it as exhaustive:** it answers *"a state
nothing can turn on"*. It does not answer *"a prop nobody passes"*, and it did not sweep module-level
flags, CSS-only states, or render gating outside `.tsx`. That is a different sweep, and given this
class turns out to be real, it is probably worth running.

## Comments
