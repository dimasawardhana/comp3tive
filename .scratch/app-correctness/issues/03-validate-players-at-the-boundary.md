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

**Status:** open (re-checked 2026-10-01 against `feature/revamp`; every entry point verified, two rows genuinely unmet)

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

## Re-checked 2026-10-01 — every entry point, checked against the code

The entry points this ticket names were **relocated** by Phase C before they were verified, so the
`:515-620` anchors above no longer resolve. The functions are real; the paths moved to
`src/shell/usePlayerImport.ts`. That is history and is left as written — `contracts.md:508-512`
drews the rule this follows: **a citation describing a past state may name a line that has since
moved.**

| Entry point | Where it is now | Verdict |
|---|---|---|
| `PlayerEditModal` save | `src/roster/PlayerEditModal.tsx:141-146` | **validates**, refuses the write, renders inline |
| full backup file | `src/shell/usePlayerImport.ts:251` → `parseBackup` | **validates** every player when the catalog is passed |
| players-only JSON | `src/shell/usePlayerImport.ts:356-360` | **validates**, per player, naming the record |
| CSV | `src/shell/usePlayerImport.ts:406` → `csvRowsToPlayers` | **does not call `validatePlayer`** — see below |
| render-time throw | `src/main.tsx:15-17` → `src/ErrorBoundary.tsx` | **wrapped**, message + Reload |

**The three JSON-shaped paths all reject, and each with a message that names the problem.**
`parseBackup` throws ``Backup player "${p.name}" is invalid: ${problems[0].message}``
(`src/data/transfer.ts:142-144`); the players-only branch pushes `{name, reason}` and reports
`Skipped N players. First: "…" — …` (`usePlayerImport.ts:375-380`); the editor renders the issues as
`.field-errors` and returns before `onSave` (`PlayerEditModal.tsx:141-146`, `:341-346`). **No
malformed record reaches storage through any of the three.**

**The acceptance row's specific cases are all pinned at the backup boundary**
(`src/data/transfer.test.ts:135-239`): a missing rating (`:198-200`), a rating outside the scale
(`:212`), an unknown role (`:215`), an empty eligibility list (`:236`), and a duplicate capability
(`:239`). Valid fixtures still import cleanly — `sample-data.validation.test.ts:104` asserts every
player in every `sample-data/*.json` passes `validatePlayer`.

**The boundary works and `computeStrength`'s throw is intact.** `ErrorBoundary.tsx:30-46` renders
the message and a Reload button; `src/domain/strength.ts:28-32` still throws on a missing rating,
so the last line of defence was not weakened. `e2e/tests/shell/error-boundary.spec.ts:70-71`
asserts a real render throw produces the boundary and surfaces the message.

### What is genuinely unmet, and stays open

**1. The read-path decision was never written.** This ticket's fifth bullet says: "*Decide the read
path deliberately: validate on write, and either trust storage or validate defensively on read.
Write your choice into the ticket's Answer.*" **There is no `## Answer` section in this file, and no
choice is recorded anywhere in the tree** — grepping for the decision's own vocabulary finds only
this line. Meanwhile `src/storage/indexed-db.ts:310` hands records back unvalidated
(`listPlayers: crud.list`), so the de facto position is *validate on write, trust storage on read* —
but it was arrived at by omission and has never been stated, which is what the bullet asked for.

**2. The CSV branch bypasses `validatePlayer`.** `csvRowsToPlayers`
(`src/data/player-import.ts:184-215`) writes no validation call, and `usePlayerImport.ts:406` does
not add one. It is **structurally safer than the JSON branch** — a CSV row carries a name, a
discipline and a strength, and the capability is *constructed* from the discipline's own attributes
(`:207`) with every role eligible (`:208`) and `preferredRole: null`, so it cannot carry a missing
rating, an unknown role or an out-of-range value. **But that is a property of how the record is
built, not a check**, and the acceptance row says "*rejected at every entry point*". Two shapes
defeat it: a discipline whose `attributes` list is empty produces an empty `attributeRatings`, and a
discipline with no roles produces `eligibleRoles: []` — which `validateCapability:57-59` rejects
outright. **No test pins either.**

**The other two rows are ambiguous rather than unmet, and are left as they are.** "*Unit tests for
the rejection cases at both entry points*" names two entry points and three validate, so which two
was meant is not recoverable from the file. And the first row — "*rejected at save with an inline
message, not persisted*" — is met in code (`:141-146` returns before `onSave`) but has **no test at
any layer**: `PlayerEditModal.test.ts` covers the rating controls, not the refusal, and no e2e drives
it. That is a coverage gap on a met behaviour, not a defect in it.

**Verdict: stays open.** Three of the four entry points validate, the boundary is in place and
proven, and `computeStrength` still throws. The two things missing are the decision this ticket
explicitly asked to be written down, and a check on the one entry point that does not call the
validator.
