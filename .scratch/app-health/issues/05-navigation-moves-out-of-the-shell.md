# 05 — Navigation moves out of the shell

**What to build:** Going back from a screen, and returning to a hub, are tested behaviour rather
than three closures buried in a component that also renders nine screens.

**Evidence.** `src/App.tsx` is 1,280 lines. The `View` union has nine modes (`dashboard`, `roster`,
`games`, `tournament`, `match`, `split`, `history`, `disciplines`, `squads`); `viewStack: View[]` is
the navigation state; `pushView` / `goBack` / `gotoHub` are its only primitives, inline in the
component. The split flow carries its origin on the view itself
(`{ mode: "match"; source: SplitSource }`), which is ADR-0004's answer to hard-coded back targets.
Every feature so far has added to this file — the git history shows five consecutive shell commits.

**Blocked by:** 02 — both edit `src/App.tsx` heavily.

**Status:** ready-for-agent

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
