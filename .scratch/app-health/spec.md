# App health — make the repo match its own claims

**Status:** ready-for-agent

## Problem Statement

`COMP3TIVE_COMPREHENSIVE_ANALYSIS.md` (1,463 lines, added alongside this thread) audited the whole
project and returned fourteen prioritized recommendations. Four of them — Re-roll, the three
bypassing deletes, the validation gap, and the import merge — are the user-visible defects a
visitor hits first, and they are already ticketed as `.scratch/app-correctness/`.

The remaining ten have no ticket. They are not four bugs; they are four separate kinds of drift,
and each one costs something concrete:

- **Code that nothing calls.** 415 lines across three modules, one of which is a *second*
  definition of a validator that is also in use. An agent reading repo context cannot tell which
  tournament rule is the real one.
- **A compiler that cannot see dead code**, so a stale rename or an abandoned handler survives
  review and reaches the tree (`noUnusedLocals: false` hides 20 findings today, including six dead
  handlers in the shell).
- **The shell as the one place with no seam.** `src/App.tsx` is 1,280 lines holding fifteen state
  hooks, nine view modes rendered inline, and four copies of the community-scoping rule. Every
  feature so far has added to it. Nothing about it is testable without a browser.
- **Claims the code does not keep.** The split screen prints a bare `Gap 0.3` whether the solver
  proved that gap minimal or ran out of budget and returned its best guess — and on an ordinary
  futsal night (20 players, 4 teams) the budget *is* exhausted. A Swiss tournament can pair the
  same two teams twice in three rounds, and can crown a champion on pre-tournament seed order.
  The page promises to work with no signal while loading its fonts from a CDN. `navigator.storage`
  is never asked to keep the data, so an eviction is indistinguishable from an empty app — the
  exact failure the `loadError` banner was built to prevent.
- **No CI.** For a product whose value proposition is a *provable* fairness property, nothing runs
  the suite that proves it.

## Solution

Work through the analysis in dependency order, in five phases:

1. **Hygiene** — delete the unreachable code, turn the compiler's dead-code check on, and give the
   duplicated UI constants one home each. Cheap, zero-risk, and it makes everything after it
   easier to read.
2. **Confidence** — a CI workflow that runs typecheck, unit tests, coverage, build and Playwright
   on every push, so the remaining work cannot silently regress.
3. **The shell** — extract navigation, community scoping, and the split/tournament orchestration
   into hooks and pure functions that can be tested without a DOM.
4. **Tournament correctness** — fix Swiss pairing so a rematch is a last resort, and decide,
   explicitly, how a shared top record is broken.
5. **Claims vs reality** — surface the solver's provenance, stop using native dialogs, harden the
   import, give the data a durability story, settle the font question, and adopt the shared
   `Breadcrumb`/`PageHeader` primitives that were built for exactly this and never used.

## Implementation Decisions

- **Deletion over re-wiring.** For unreachable code the default is to delete it. Wiring something
  up is justified only when a real caller is clearly waiting for it; the ticket that deletes must
  record which choice it made, per symbol.
- **`noUnusedLocals` is the mechanism, not a style preference.** It is the only thing in the repo
  that catches a handler nobody calls.
- **The shell is decomposed, not rewritten.** Navigation, scoping, and the split/tournament flow
  move out one at a time, in that order, each landing green. `App.tsx` under 400 lines is the
  target, not a hard gate.
- **Swiss is fixed at the pairing algorithm and at the tiebreak.** The greedy `findIndex` takes
  the first legal opponent and strands the last pair; the fix is to backtrack (or to pair the
  whole round properly) rather than to fall back to an illegal pairing. The tiebreak order —
  `wins → team.strength → gameWins` — currently lets the pre-tournament seed decide a shared top
  record, which is the opposite of what a Swiss is for.
- **Provenance is stated, not implied.** `SplitResult.solver.optimal` already tells the truth; the
  header must say which of the two it is.
- **Durability is asked for, and mentioned.** `navigator.storage.persist()` plus a visible nudge to
  export — the migration path ADR-0001 documents should not depend on the user remembering it.
- **Nothing here changes the solver, the bracket's validation rules, or the storage interfaces.**
  The pure core is the part of this codebase that works.

## Testing Decisions

- **The refactors are guarded by the e2e suite, not by new unit tests.** The shell's behaviour is
  what the 19 specs already pin; each extraction lands with the suite green and no spec edited.
- **Anything extracted as a pure function or hook gets a direct test** — community scoping, the
  view stack, and the split-flow's persistence rule are the three with real logic in them.
- **Swiss gets an exhaustive test, not a fixture.** The defect is a property of the pairing
  algorithm, so the test enumerates outcome patterns and asserts that a legal rematch-free pairing
  is always chosen when one exists — the shape the existing bracket tests already use.
- **The pairing fix must not become a pairing regression**: every existing bracket test stays green,
  including the round-one adjacent-seed ordering and the Swiss progression tests.

## Out of Scope

- **The four defects in `.scratch/app-correctness/`** — they are ticketed, and two of them must land
  before ticket 10 touches the same handlers.
- **ESLint and a formatter.** A first run against 9,339 lines is a large diff of its own; it needs
  a dedicated pass, not a ride-along on the CI ticket.
- **Coverage thresholds.** Ticket 04 produces coverage so the shell's untested growth is *visible*;
  setting a gate is a later call once there is a number to gate on.
- **`src/index.css`.** 3,000 hand-written lines with computed-style assertions in e2e is a real
  risk, but scoping it, linting it, or splitting it is a design exercise, not an audit follow-up.
- **The dual version numbers** (IndexedDB `DB_VERSION` vs. backup `version`). They version
  different things and are correct; only the docs describing them are wrong
  (`.scratch/app-correctness/06`).
- **React component tests.** The `.tsx` files are excluded from the unit harness by configuration;
  changing that is a harness decision for whoever wants component tests, and nothing here needs
  them.

## Further Notes

- **`.scratch/` stays committed.** The analysis's recommendation 5 also proposed untracking it as a
  build artifact; it is the configured issue tracker (`docs/agents/issue-tracker.md`), not junk.
  Only `playwright-report/` and `test-results/` are untracked (`.scratch/app-correctness/05`).
- **Ticket 14 interacts with `.scratch/app-correctness/06`.** That ticket plans to record in
  `docs/FLOW.md` §3 that breadcrumbs are links that do not navigate. Landing 14 first makes the
  documentation true again instead — the ordering is deliberate.
- **One scheduling note that is not a dependency:** ticket 10 touches the same handlers as
  `.scratch/app-correctness/02` and `03`. Sequence them rather than interleaving.
- Two of these tickets (08 and 12) are defects the analysis lists in its risk tables but not in its
  numbered recommendations; they are here because both are user-visible and both were verified
  before being written down.
