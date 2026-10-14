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

**Status:** resolved (second re-check 2026-10-01, against `master`; both remaining rows delivered —
the read-path decision is in `## Answer` above, and the CSV branch now calls the validator)

**Corrected, not closed** — as written on 2026-09-18, and superseded by the 2026-10-01 pass below,
which closed the two rows that kept it open. The successor that delivered the bulk of the work is
`.scratch/debt/issues/05-validate-players-where-data-enters.md`.

- [ ] A capability with a missing attribute rating is rejected at save with an inline message, not persisted
- [ ] The same malformed record in an imported backup file is rejected with a message naming the problem
- [ ] A capability with a rating outside `min..max`, an unknown role, or an empty eligibility list is rejected at every entry point
- [ ] Valid players are unaffected — the existing import fixtures (`sample-data/*.json`, `src/data/samplePlayers.ts`) still import cleanly
- [ ] A render-time throw shows the boundary's message instead of a blank page, with a way to recover
- [ ] `computeStrength`'s throw is still a throw (it is the last line of defence) — this ticket prevents reaching it, it does not weaken it
- [ ] Unit tests for the rejection cases at both entry points

**Design reference:** the inline validation pattern already used in `DisciplineEditModal` and `PlayerEditModal`.

**Notes:** This is the highest-value of the four fixes: the others are annoyances, this one loses the screen. It also needs no schema library — the validation function exists.

## Answer

**Written 2026-10-01. This is the decision the fifth bullet asked for, and it had never been
stated anywhere in the tree.**

**Validate on write; trust storage on read.**

**What "on write" covers, now that the CSV branch is in it.** Four entry points, and every one
refuses the record with a message naming it rather than persisting it: `PlayerEditModal.tsx:141-146`
(inline, before `onSave`), `parseBackup` (`src/data/transfer.ts:139-144`), the players-only JSON
branch (`src/shell/usePlayerImport.ts:356-360`), and `csvRowsToPlayers`
(`src/data/player-import.ts:230-236`), which routes a failed check to `skipped` with the row's line.
The boundary is the claim; the read path is not asked to re-prove it on every render.

**What "on read" means, exactly.** `src/storage/indexed-db.ts:310` hands records back as stored —
`listPlayers: crud.list` — and no read path calls `validatePlayer`. **That is the decision, stated,
rather than the omission it used to be.**

**Why it is the right way round for this app.** Every screen renders every player on the roster, and
`computeStrength` runs during render from two places; validating on read would put an O(players)
allocation and a rule walk on the render path of every screen, to re-check a fact the write path
already established and which storage cannot change on its own. **The check belongs where the record
is untrusted, which is the boundary, not the render.**

**What the decision gives up, named rather than hidden.** A record that reached storage by some other
route — a database edited by hand, a write path from an older install, a future writer that forgets —
is **not** caught by a validator on read. It is caught by `computeStrength`, which still throws by
design (`src/domain/strength.ts:28-32`, asserted not weakened by this ticket), and that throw is
inside `ErrorBoundary`, so the result is the message and a Reload rather than a blank page. **That is
a crash rather than a refusal, and it is the accepted cost:** the alternative is validating on every
read to defend against a route this app does not have. The third line of defence — refusing to
persist — is the one that is cheap, and it is the one that is enforced.

**Revisit if** a write path is ever added that this list does not cover, because the argument above
rests on the boundary being exhaustive. `src/data/transfer.ts` and `usePlayerImport.ts` are where to
look first.

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
message, not persisted*" — is met in code (`:141-146` returns before `onSave`) but had **no test at
any layer**: `PlayerEditModal.test.ts` covers the rating controls, not the refusal, and no e2e drove
it.

**CLOSED 2026-10-13 (TASK-107), and the coverage gap was the reason it took a browser case.**
`e2e/tests/roster/editor-refusal.spec.ts` now drives the refusal through the real UI and asserts the
three things the branch means: the modal stays open, `.field-errors` carries the validator's own
sentence, and the player is not on the roster afterwards. It was mutation-tested — deleting the
`return` in `PlayerEditModal.save` turns it **red** while its control case stays green, so it pins
the refusal and not the dialog.

**It could not have been a unit case.** `PlayerEditModal.test.ts` renders with
`renderToStaticMarkup`, which runs no handlers, so `save()` is unreachable from that layer; and this
repo has no jsdom, no testing library and no `*.test.tsx` — `vite.config.ts` includes only
`src/**/*.test.ts`, and `README.md` states the convention outright: a `.tsx` screen is proven in a
browser. `validatePlayer`'s own rules were already unit-tested in `src/domain/validation.test.ts`;
what was untested was the *wiring*, and wiring needs a click.

**The spec found something while being written, and it is recorded rather than fixed.** Five of the
six refusal rules cannot be broken from the shipped UI — ratings always carry a value, the bounds
are hardcoded 1–5 with no input, `buildCapabilities` heals a stray preferred role and an emptied
eligibility list, and duplicates are filtered out of the add-a-capability strip. The one reachable
path is a discipline that declares **no roles**: `DisciplineEditModal` permits saving one, and
`validateCapability` then demands an eligible role from a list that is empty — so the dialog refuses
with **no control that can clear it**. Refusing the discipline at creation or relaxing the player
rule are both product decisions, so the spec records the dead end in its header instead of closing
it.

## Re-checked 2026-10-01 (second pass) — both rows closed, and this file is

The two rows above were correct when written and are both delivered now. That section is left as it
was found, because it is the dated record of why the ticket stayed open and these closures only make
sense against it.

**1. The read-path decision — now written.** `## Answer`, above: *validate on write, trust storage
on read*, with what that costs stated rather than argued around. It was already the de facto
behaviour (`src/storage/indexed-db.ts:310` returns records unvalidated); what was missing was anyone
having chosen it.

**2. The CSV branch — now calls `validatePlayer`.** `csvRowsToPlayers` builds the player, validates
it and routes any issue to `skipped` with the row's line
(`src/data/player-import.ts:230-236`). Both shapes that defeated the construction are closed and each
has a test in `src/data/player-import.test.ts`:

| Shape | Outcome | Test |
|---|---|---|
| discipline with no roles | `eligibleRoles: []`, rejected by `validateCapability:57-59`; the skip carries **the validator's own sentence**, not a phrase written beside it | `refuses a row whose discipline has no roles, by line and by the validator's own reason` |
| discipline with no attributes | `attributeRatings: {}`, **which no validator catches** — `validateCapability` iterates the discipline's attributes and there are none to fail — so a guard refuses the row before anything is built | `refuses a row whose discipline has no attributes, because the strength would be discarded` |

Both new tests were run against `src/data/player-import.ts` with the fix stashed: **2 failed, 20
passed.** A test that cannot fail on the unfixed file is not the test.

**The authority for the change** is `contracts.md` §5, Day 3, (c), written before the code — which
also records why §4's "*reads, never writes*" is not in conflict: that row is **Phase D's** right,
and no phase holds this edit.

**The two ambiguous rows are still ambiguous, and this close does not claim them.** "*Unit tests for
the rejection cases at both entry points*" names two and four validate; and the editor's inline
refusal is met in code but has no test at any layer. **The first is now moot** — there is no longer
a pair of entry points, only four — and the second remains a coverage gap on a behaviour that works.
It is recorded in `docs/ROADMAP.md`'s known-open list rather than silently absorbed here.

**The 2026-09-18 instruction not to close this file is superseded, and the reason is in it.** It said
not to close while the ticket's own acceptance was open and owned by the successor. It is not owned
by the successor any more.
