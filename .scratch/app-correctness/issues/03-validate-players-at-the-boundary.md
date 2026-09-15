# 03: Validate players where data enters

**What to build:** The player data-model rules that already exist and are already tested finally run when data enters the app — and an error boundary turns any render-time throw into a message instead of a blank page.

**The defect.** `validatePlayer` / `validateCapability` (`src/domain/validation.ts`) encode exactly the `CONTEXT.md` invariants — at most one capability per discipline, ratings inside each attribute's `min..max`, eligibility inside the discipline's roles, `preferredRole ∈ eligibleRoles` — and they have 10 passing tests. **No production code path calls them.**

Two entry points accept data that can violate those rules:

- `PlayerEditModal` builds a `Player` and saves it without validation (`src/roster/PlayerEditModal.tsx:119-140`).
- `handlePlayerImport` accepts any object with a truthy `name` and copies `capabilities` verbatim (`src/App.tsx:515-620`; the JSON branch at `:542-566`).
- `parseBackup` (`src/data/transfer.ts:52-125`) checks *shape* only: a player needs a string `id`/`name` and an array `capabilities`; a capability's `attributeRatings`, `eligibleRoles` and `preferredRole` are never inspected, and sessions/squads are only checked with `isRecord`.

**Why it crashes.** A capability missing one of its discipline's attribute ratings passes both gates, is persisted, and then makes `computeStrength` throw by design (`src/domain/strength.ts:26-31`). That function is called **during render** — from `strengthsFor` (`src/App.tsx:123-129`) and again from the split screen — and there is **no error boundary anywhere in the tree**. The user-visible result is a blank app and a console error, and because the bad record is persisted, a reload does not help.

- Call `validatePlayer` on save in `PlayerEditModal`, surfacing issues inline (the form already renders validation-style messages for disciplines).
- Validate every player in `handlePlayerImport` and `parseBackup`, rejecting the file with a specific, user-readable message naming the offending record — the same tone as `parseBackup`'s existing errors.
- Add an error boundary around the app tree so a throw during render shows "Something went wrong, your data is safe" plus a reload action, rather than nothing.
- Decide the read path deliberately: validate on write, and either trust storage or validate defensively on read. Write your choice into the ticket's Answer.

**Blocked by:** —

**Status:** open

- [ ] A capability with a missing attribute rating is rejected at save with an inline message, not persisted
- [ ] The same malformed record in an imported backup file is rejected with a message naming the problem
- [ ] A capability with a rating outside `min..max`, an unknown role, or an empty eligibility list is rejected at every entry point
- [ ] Valid players are unaffected — the existing import fixtures (`sample-data/*.json`, `src/data/samplePlayers.ts`) still import cleanly
- [ ] A render-time throw shows the boundary's message instead of a blank page, with a way to recover
- [ ] `computeStrength`'s throw is still a throw (it is the last line of defence) — this ticket prevents reaching it, it does not weaken it
- [ ] Unit tests for the rejection cases at both entry points

**Design reference:** the inline validation pattern already used in `DisciplineEditModal` and `PlayerEditModal`.

**Notes:** This is the highest-value of the four fixes: the others are annoyances, this one loses the screen. It also needs no schema library — the validation function exists.
