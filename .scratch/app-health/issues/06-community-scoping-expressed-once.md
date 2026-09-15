# 06 — Community scoping expressed once

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

**Status:** ready-for-agent

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
