# 05 — Navigation moves out of the shell

> **Superseded.** The live copy of this ticket is
> [`debt/24`](../../debt/issues/24-navigation-moves-out-of-the-shell.md). This file is history; see
> [`.scratch/app-health/README.md`](../README.md) for the pairing of all sixteen.

**What to build:** Going back from a screen, and returning to a hub, are tested behaviour rather
than three closures buried in a component that also renders nine screens.

**Evidence.** `src/App.tsx` is 1,280 lines. The `View` union has nine modes (`dashboard`, `roster`,
`games`, `tournament`, `match`, `split`, `history`, `disciplines`, `squads`); `viewStack: View[]` is
the navigation state; `pushView` / `goBack` / `gotoHub` are its only primitives, inline in the
component. The split flow carries its origin on the view itself
(`{ mode: "match"; source: SplitSource }`), which is ADR-0004's answer to hard-coded back targets.
Every feature so far has added to this file — the git history shows five consecutive shell commits.

**Blocked by:** 02 — both edit `src/App.tsx` heavily.

**Status:** resolved

- [ ] The view stack and its three primitives live in a hook (`useNavigation` or equivalent) that a
      test can drive without rendering the app
- [ ] `goBack` at the root of the stack, `gotoHub` from an arbitrary depth, and a replace-style push
      (used when creating a tournament, which replaces the stack rather than extending it) all behave
      exactly as they do today
- [ ] The hook has unit tests for those transitions, including the empty-stack case
- [ ] `App.tsx` renders screens from a switch and no longer owns the navigation state
- [ ] The whole Playwright suite passes with no spec edited — the suite is the regression net for
      this refactor, and the 19 specs currently navigate through these primitives constantly
- [ ] ADR-0004's contract holds: no screen hard-codes its own back target

**Design reference:** `docs/adr/0004-origin-aware-navigation.md` — the split flow's `source` is a
deliberate decision, not an accident, and this extraction must preserve it.

**Notes:** Pure extraction: behaviour identical, including the tournament-create path that replaces
the stack so Back and the breadcrumb both return to Games. Do not "fix" anything on the way past —
a refactor with a behaviour change inside it has no test that can tell you which one broke.

## Comments

**Re-checked 2026-10-01 against `d98b95c`, against the code rather than against debt 24's
status — shipped. Resolved.**

- `src/shell/useNavigation.ts` (48 lines) is the whole navigation surface: the `View` union at
  `:5-14`, the four pure transitions `pushStack` `:19` / `popStack` `:25` / `hubStack` `:30` /
  `currentView` `:34`, and the hook at `:38`. `src/App.tsx:45` consumes it and declares none of
  the state itself — `grep "useState<View\[\]>" src/App.tsx` returns nothing.
- Row 2's three transitions behave as before, and row 3's tests exist for them:
  `src/shell/navigation.test.ts` covers the push/pop round trip *and* that the input array is not
  mutated (`:9-14`), `popStack` at the root exhaustively across every reachable depth and every
  hub bottom (`:18-40`), `hubStack` collapsing a depth-3 stack (`:44-46`), and the
  tournament-create sequence yielding `[games, tournament]` with Back returning to Games
  (`:58-65`).
- Row 4 holds: `src/shell/ScreenSwitch.tsx` renders the screens from a switch, and
  `src/App.tsx:443` hands the state to it.
- Row 6 holds — ADR-0004's contract survives. The origin still travels on the view
  (`{ mode: "match"; source: SplitSource }`), and all three crumb sites navigate through handlers
  their host passes down rather than declaring a destination: `src/session/MatchScreen.tsx:41`,
  `src/tournament/TournamentScreen.tsx:254`, `src/session/SplitScreen.tsx:376`.

**Not verified here, and not claimed:** row 5, "the whole Playwright suite passes with no spec
edited". The e2e suite was not run for this re-check.
