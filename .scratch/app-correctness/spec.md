# App correctness pass

**Status:** ready-for-agent

## Problem Statement

comp3tive builds, its 1,700-line unit suite is green, and its e2e suite passes — the architecture is sound and the domain core is well tested. But four defects sit exactly where a new user will hit them, and they are the kind that make a tool feel broken rather than limited:

- **Re-roll does nothing.** The button produces an identical split while the UI increments a "Roll #N" badge, so the product claims an action it did not take.
- **Three deletes lie.** Deleting a player, a tournament, or a session removes the record from storage but not from the screen, so the row survives until a reload.
- **A malformed import blanks the app.** Imported data is shape-checked but not value-checked, and invalid data throws inside render — where nothing catches it.
- **An import can strand records.** Restoring a multi-community backup re-homes the players to the active community while leaving sessions, tournaments and squads on their own, so records end up where no screen can reach them.

None of these is architectural. Each has a small, well-understood fix, and the first two are one-liners. They are tracked here, separately from the Landing Page feature, because the sequencing is a priority call rather than a technical dependency.

## Solution

Fix the four defects at their source, keep the domain core untouched, and add the two guards that would have caught them: validation at the boundary where data enters, and an error boundary so a render-time throw degrades into a message instead of a blank page.

## Implementation Decisions

- **Re-roll uses the machinery that already exists.** `varietySplit` and `FairSplitOptions.variety/seed` were built for exactly this and are unit-tested — the UI simply never passes a counter. The fix is to pass one, and to rebuild the re-roll pool from the session's own `poolPlayerIds` rather than from the current teams, so a player who sat out can come back.
- **Deletes go through their hooks.** Each hook exposes a delete that updates both the store and the in-memory list; three call sites bypass it and hit the store directly. Use the hook.
- **Validation is wired where data enters**, using the `validatePlayer`/`validateCapability` rules that already exist and are already tested — they have simply never been called in production.
- **An error boundary wraps the app**, so a throw during render is a message, not a white screen.
- **The import merge stops re-homing records that already have a home.**
- No behaviour in the solver, the bracket machine, or the storage interfaces changes.

## Testing Decisions

- Each fix gets the smallest test that fails before it and passes after: a variety assertion for re-roll, a hook-state assertion for the deletes, a malformed-capability case for validation, and a multi-community round-trip for the merge.
- Prefer a test at the seam that actually broke. The deletes are shell behaviour, so the guard is an e2e check that the row disappears; the others are pure or hook-level and belong in the unit suite.
- The existing suite must stay green, unchanged: these are fixes, not refactors.

## Out of Scope

- The Landing Page and the `/app` path change (`.scratch/landing-page/`).
- Restructuring `src/App.tsx` (1,280 lines, fifteen `useState`s). A decomposition is the right follow-up, but it is a refactor with regression risk and should not ride along with correctness fixes.
- Removing the two dead modules (`src/tournament/tournament-domain-fix.ts`, `src/session/split-module.ts`) — worth doing, tracked as its own cleanup rather than bundled here.
- Any backend work.
- The weaker e2e specs beyond pruning the ones that assert nothing (ticket 05).

## Further Notes

- These are the four things a brand-new visitor is most likely to touch, which is why they matter more once a Landing Page starts sending strangers in.
- `docs/FLOW.md` still describes four hubs with no Home, and `DOMAIN_MODEL.md` / `IMPLEMENTATION_PLAN.md` describe work that has already shipped. Ticket 06 reconciles the documentation, because agent and human context both read these files.
