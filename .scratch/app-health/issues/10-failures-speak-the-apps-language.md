# 10 — Failures and confirmations speak the app's language

**What to build:** No operation blocks the thread with a native browser dialog; a rejected domain
operation shows a message instead of vanishing into the console; and a write that fails is never
silent.

**Evidence.** Four different error strategies, applied inconsistently:

- **10 `alert()` calls in `src/App.tsx`** — the entire player-import path (six), tournament-create
  validation, backup import failure, and two "pick a community first" guards. They escape the app's
  visual language, block the thread, and are not announced politely.
- **7 `window.confirm()` calls across 5 files** for destructive actions — player, discipline,
  community, session, squad. Meanwhile `TournamentScreen` already shows the better in-app two-step
  pattern ("Cancel" / "Delete tournament"), so the precedent exists.
- **Throws that reach React uncaught.** `applyResult` and `undoLastGame` are documented to throw by
  design, and neither `recordResult` nor `undoLastResult` wraps the call. The frontier guard is
  reachable from the UI (two tabs on one tournament), so a rejected recording becomes an unhandled
  promise rejection rather than a message.
- **Silence on write failure.** The ad-hoc Session write is swallowed on purpose ("Non-fatal: still
  show the split if persistence failed") and the legacy adoption effect fires `void
  roster.savePlayer(...)` with no `.catch`, so a failure there is an unhandled rejection.
  `SplitScreen`'s inline "This arrangement wasn't saved." is the one place a persistence failure is
  honestly reported — that is the pattern to generalise.

**Blocked by:** `.scratch/app-correctness/02` and `.scratch/app-correctness/03` — both edit
`src/App.tsx`'s handlers, and 03 adds validation at exactly the entry points this ticket rewrites.
Land them first.

**Status:** ready-for-agent

- [ ] No `alert()` or `window.confirm()` remains in `src/` — verified by search, not by reading the diff
- [ ] Every current `alert()` becomes a toast or an inline message, keeping its existing text (the
      import confirmations that report a count are confirmations, not errors — check each one)
- [ ] Every current `window.confirm()` becomes an in-app confirmation following `TournamentScreen`'s
      two-step pattern
- [ ] `recordResult` and `undoLastResult` catch their domain throws and surface the message the throw
      already carries, rather than an unhandled rejection
- [ ] Both intentionally-swallowed writes say something when they fail: the ad-hoc Session write and
      the legacy adoption effect
- [ ] The toast region stays `role="status"` / `aria-live="polite"` and focus is not stolen by a
      confirmation
- [ ] The e2e suite passes with no spec edited

**Design reference:** `TournamentScreen`'s delete confirmation, and `SplitScreen`'s "This
arrangement wasn't saved." banner — both are in-app, both are already the right pattern.

**Notes:** Do not add a global error boundary here. `.scratch/app-correctness/03` owns that, and it
is the boundary that turns a render-time throw into a message. This ticket is about the handlers
around it.

When converting dialogs, keep the *copy* — the confirms carry real warnings ("Tournaments that used
it keep their teams.", the community cascade warning). None of them are throwaway.
