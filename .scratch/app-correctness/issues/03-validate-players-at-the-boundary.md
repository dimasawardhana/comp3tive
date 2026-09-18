# 03: Validate players where data enters

**What to build:** The player data-model rules that already exist and are already tested finally run when data enters the app — and an error boundary turns any render-time throw into a message instead of a blank page.

**Correction (2026-09-18).** The original paragraph read "**No production code path calls them.**" and "there is **no error boundary anywhere in the tree**". Both are now stale. `src/roster/PlayerEditModal.tsx:126` calls `validatePlayer(draft, disciplines)` and renders the returned issues inline, and an `ErrorBoundary` wraps the tree in `src/main.tsx` (added by the successor below). The entry points still accepting unvalidated data when this was written were:

- `handlePlayerImport`, which accepted any object with a truthy `name` and copied `capabilities` verbatim (`src/App.tsx:515-620`; the JSON branch at `:542-566`).
- `parseBackup` (`src/data/transfer.ts:52-125`), which checked *shape* only: a player needed a string `id`/`name` and an array `capabilities`; a capability's `attributeRatings`, `eligibleRoles` and `preferredRole` were never inspected, and sessions/squads were only checked with `isRecord`.

**Why it crashes.** A capability missing one of its discipline's attribute ratings passed both gates, was persisted, and then made `computeStrength` throw by design (`src/domain/strength.ts:26-31`). That function is called **during render** — from `strengthsFor` (`src/App.tsx:123-129`) and again from the split screen. With no error boundary in the tree then, the user-visible result was a blank app and a console error, and because the bad record was persisted, a reload did not help.

- Call `validatePlayer` on save in `PlayerEditModal`, surfacing issues inline (the form already renders validation-style messages for disciplines).
- Validate every player in `handlePlayerImport` and `parseBackup`, rejecting the file with a specific, user-readable message naming the offending record — the same tone as `parseBackup`'s existing errors.
- Add an error boundary around the app tree so a throw during render shows "Something went wrong, your data is safe" plus a reload action, rather than nothing.
- Decide the read path deliberately: validate on write, and either trust storage or validate defensively on read. Write your choice into the ticket's Answer.

**Blocked by:** —

**Status:** open

**Corrected, not closed.** The successor that delivers the remaining gap is
`.scratch/debt/issues/05-validate-players-where-data-enters.md`; see `## Comments` below.

- [ ] A capability with a missing attribute rating is rejected at save with an inline message, not persisted
- [ ] The same malformed record in an imported backup file is rejected with a message naming the problem
- [ ] A capability with a rating outside `min..max`, an unknown role, or an empty eligibility list is rejected at every entry point
- [ ] Valid players are unaffected — the existing import fixtures (`sample-data/*.json`, `src/data/samplePlayers.ts`) still import cleanly
- [ ] A render-time throw shows the boundary's message instead of a blank page, with a way to recover
- [ ] `computeStrength`'s throw is still a throw (it is the last line of defence) — this ticket prevents reaching it, it does not weaken it
- [ ] Unit tests for the rejection cases at both entry points

**Design reference:** the inline validation pattern already used in `DisciplineEditModal` and `PlayerEditModal`.

**Notes:** This is the highest-value of the four fixes: the others are annoyances, this one loses the screen. It also needs no schema library — the validation function exists.

## Comments

Corrected 2026-09-18: `PlayerEditModal.tsx:126` already called
`validatePlayer(draft, disciplines)`, so the "no production code path calls them"
claim was stale and is removed. The remaining gap (parseBackup, the JSON/CSV
import branches) is delivered by
`.scratch/debt/issues/05-validate-players-where-data-enters.md` — commits `d00b683`
("fix: validate players at the import boundary and survive a render throw"),
`51ab51d` ("fix: let the import boundary restore dangling capabilities") and
`3a85f65` ("fix: import survives a bad file").

Status left as `open`: this ticket's acceptance also covers the read-path decision and
the per-entry-point rejection cases, and the Phase A copy is the one that owns them.
Do not close this file; see the successor above.
