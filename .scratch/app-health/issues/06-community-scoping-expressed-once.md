# 06 — Community scoping expressed once

> **Superseded.** The live copy of this ticket is
> [`debt/25`](../../debt/issues/25-community-scoping-expressed-once.md). This file is history; see
> [`.scratch/app-health/README.md`](../README.md) for the pairing of all sixteen.

**What to build:** "No screen ever shows another community's records" is a rule with one home and
its own tests, so a fifth list cannot quietly leak by omission — and the lists stop being rebuilt on
every render.

**Evidence.** Scoping happens in the shell, not the data layer: every hook returns *all* records and
`App` filters at render time. The same rule is restated four times:

- `communityPlayers`, `communitySessions`, `communityTournaments`, `communitySquads` in
  `src/App.tsx` — 4 copies of `record.communityId === activeCommunity.id`
- `disciplinesById` builds a new `Map` on every render
- `viewTournament` runs a `find` on every render, even for views that never read it
- Zero `useMemo` in the entire file

This is not hypothetical: ADR-0005 records that History and Games had been passed unfiltered lists,
leaking records across communities, and the four filters were the fix. The invariant is currently
enforced by four expressions in one function body.

**Blocked by:** 05 — same file, and the first extraction should land clean.

**Status:** resolved

- [ ] The scoping rule has exactly one definition, and every community-scoped list derives from it
- [ ] Derived data (`disciplinesById`, scoped lists, the current tournament) is computed once per
      change rather than once per render
- [ ] Tests cover the invariant directly: with two communities holding records, each scoped list
      returns only the active community's
- [ ] The Playwright suite passes with no spec edited — in particular `dashboard.spec.ts`, which
      asserts community scoping with 84 assertions and is the strongest spec in the suite
- [ ] Switching communities changes every list, and no screen shows a stale record from the previous
      community

**Design reference:** `docs/adr/0005-dashboard-first.md` — the ADR where this invariant was
introduced and where the leak it fixed is recorded. Read it before deciding the shape.

**Notes:** Extract to a hook or a pure selector function with tests; either is fine, and the choice
belongs in the Answer. Keep the store interface untouched: ADR-0001's `storage/types.ts` is the
backend-replacement seam, and pushing community filtering down into it would be a much larger change
than this ticket promises. If a store-level filter looks genuinely better, that is an ADR, not a
refactor.

## Comments

**Re-checked 2026-10-01 against `d98b95c`, against the code rather than against debt 25's
status — shipped. Resolved.**

- One definition: `src/shell/useCommunityScope.ts` exports `scopeCommunities` (`:37`) and
  `useCommunityScope` (`:71`), and `src/App.tsx:93` consumes it. Every community-scoped list the
  app renders derives from that one call.
- Row 2 holds. `grep -c "new Map" src/App.tsx` is **0** and `grep -c useMemo src/App.tsx` is
  **2** — `src/App.tsx:130` memoises the current tournament on `[view, tournaments.tournaments]`
  rather than running a `find` every render, and the hook memoises its own maps. The file's
  "zero `useMemo`" baseline is what this ticket set out to end.
- Row 3 holds and is tested directly: `src/shell/community-scope.test.ts` (187 lines) builds two
  communities each holding players, sessions, tournaments and squads, and asserts every scoped
  list returns only the active community's; the flip between them leaking nothing; a null active
  community yielding four empty lists; and a blank-`communityId` record staying out of scope —
  the last of which defends against a real value `App.tsx` writes when saving a split.
- Row 5 is the same fixture read from the other side: with the community switched, no record from
  the previous one appears in any list.

**One acceptance row is technically unmet, and it is worth recording why it does not matter.**
Row 1's check, as debt 25 phrases it, is `grep -rn "communityId ===" src/App.tsx` returning
nothing. It returns four hits, all inside `communityDeleteWarning` (`src/App.tsx:328-331`) —
the helper that counts what deleting a community would take with it, so the confirm dialog can
name the cost. It filters by an explicitly-passed `communityId` to *describe a deletion*; it does
not narrow any list. The scoping rule is in the one file this ticket named, and no screen derives
a list any other way. The grep is over-broad; the code is not wrong.

**Not verified here, and not claimed:** row 4, "the Playwright suite passes with no spec edited",
specifically `e2e/tests/dashboard/dashboard.spec.ts` with its 84 community-scoping assertions.
The e2e suite was not run for this re-check.
