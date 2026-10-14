# comp3tive — implementation plan

**Status:** **corrected 2026-10-01** — this file was three days stale and said so nowhere. It claimed
Phases C and D had not started, that `feature/revamp` was 26 commits ahead of `master` and unpushed,
and that 23 of 43 tickets remained. **All three were false when written and stayed false until
today.** Every count below is read from `.scratch/debt/issues/*`'s own `Status:` lines and from the
tree, not from this file's memory. The design behind each phase lives in `docs/superpowers/`, and the
cross-phase rules live in `contracts.md`.

> **What this file used to be.** Until 2026-09-28 this was a 235-line draft claiming comp3tive had no
> `Session` type, needed bye handling, needed Swiss completion criteria, needed `roleComplete` and
> `immutable` flags, and needed an undo stack. Every one of those was either already shipped or
> deliberately decided against: `Session` has existed at `src/domain/types.ts:165-175` all along,
> byes were ruled out at `docs/spec/0002-tournaments-v1.md:12`, Swiss completion ships at
> `src/tournament/bracket.ts:238-239` (the last-round filter `requiredMatches` uses for Swiss) with
> the verdict at `:245`, role coverage is a split-time constraint rather than a
> tournament flag, and `undoLastGame` ships at `src/tournament/bracket.ts:320-338`. It also
> reserved `docs/adr/0003`…`0006` for decisions that were never taken, at numbers four shipped ADRs
> already occupy. The audit that found this is in the rewrite history below. One real gap survived
> it: there is no `Sub` type anywhere, so tournament subs are unimplemented and unspecified.

## Read these first

| | |
|---|---|
| [`contracts.md`](contracts.md) | Phase order, file ownership, frozen interface names, and thirteen recorded spec-vs-plan disagreements. Twenty documents cite it; it is the file they all mean. |
| [`docs/superpowers/specs/2026-09-17-debt-repayment-roadmap-design.md`](docs/superpowers/specs/2026-09-17-debt-repayment-roadmap-design.md) | The roadmap. Five phases, five locked decisions, the reasoning for the order. |
| [`docs/adr/`](docs/adr/) | Eight decisions. ADR-0001 is superseded by ADR-0007; ADR-0008 defines identity. |
| [`CONTEXT.md`](CONTEXT.md) | The vocabulary. Authoritative, and a document that contradicts the code is a defect. |
| [`.scratch/`](.scratch/) | Tickets, by track. `debt` is the live one; the others are their predecessors. |

## Where the work stands

**43 tickets. 40 shipped, 3 to go** — read from the tracker's `Status:` lines on 2026-10-01:

```
Phase A · Truth and Trust          12 tickets   SHIPPED   edfd739
Phase B · Honest Claims             8 tickets   SHIPPED   9e6a4a3 (PR #5)
Phase C · Shell and Structure      10 tickets   SHIPPED   2026-10-13 (all 10)
Phase D · Product Completion        7 tickets   SHIPPED   d98b95c
Phase E · Account and Durability    6 tickets   not started
```

**On `master`, not on a branch.** `feature/revamp` merged as `9e6a4a3` and is 8 commits behind;
`master` is level with `origin/master` at `3683974` and there are **0 open PRs**. **CI runs on every
push and has been green since 2026-09-28** — 47 of 52 runs successful, the 5 failures all on
2026-09-18, the day the workflow was added — and the latest green run is this `HEAD`. That last
sentence is new: `docs/ROADMAP.md` spent 2026-10-01 denying it, and `gh` is not installed on this
machine, so the way to check is one unauthenticated request to
`api.github.com/repos/dimasawardhana/comp3tive/actions/runs`.

**Nothing is left open in A–D.** `app-correctness/03`'s read-path decision and CSV validation were
delivered 2026-10-01, and **debt 26's `wc -l src/App.tsx` closed 2026-10-13 at 391 lines** against
the under-400 criterion — see Phase C below.

### Phase A — Truth and Trust · shipped

Branch `feature/debt-truth-and-trust`, `c05c58f..d057c89`, merged as `edfd739` (PR #4). The browser
suite went from 16 failed / 25 passed / 1 skipped to **43 passed / 0 failed / 0 skipped**; unit tests
from 114 to **154**. The four audited user-visible defects are fixed at source, an error boundary and
an import boundary exist, CI runs typecheck → unit → build → browser and a red run blocks, and
`src/solver/**` is byte-identical across the branch.

Not observed: CI has never run on a GitHub runner — none is reachable from this workstation. The
workflow's contents and step sequence were verified locally in order. **Branch protection is still a
one-line maintainer action.**

Ledger: [`.superpowers/sdd/2026-09-17-truth-and-trust/progress.md`](.superpowers/sdd/2026-09-17-truth-and-trust/progress.md).
Tickets `.scratch/debt/issues/01-*.md` … `12-*.md`, all now `resolved` with their delivering commits.

### Phase B — Honest Claims · shipped

Branch `feature/revamp`, 26 commits, unpushed. The product no longer claims things it does not do.

- **The split screen says whether a gap was *proven* or is the *best found*.** New
  `src/session/gapProvenance.ts` reads `result.solver.optimal` and nothing else; the qualifier
  `Best gap found.` rides inside the existing markup, and the proven path is byte-identical.
- **One noun for the group.** Five user-visible strings moved from "squad" to Community/roster; the
  Saved Squad artifact keeps its name everywhere.
- **Badminton ships as a real discipline**, with a sample roster the app can actually round-trip —
  and a version-gated backfill, so existing installs gain it rather than only fresh ones.
- **The landing page makes no claim the build outruns**, and the documents agree with the code.

Gate on this branch, cold: `npx tsc -b` exit 0 · **180 unit** · **50 e2e, 0 failed** ·
`src/solver/solver.ts` byte-identical to the fork.

Eleven tasks, each through its own implementer → review → fix → re-review loop; **no review in the
phase ever returned "Approved, nothing to fix."** Three product defects surfaced that no ticket asked
for — the inert landing re-roll, the dark-mode bib contrast, and the new-tournament modal silently
defaulting to badminton. All three are in the known-open table below.

Ledger: [`.superpowers/sdd/2026-09-17-honest-claims/progress.md`](.superpowers/sdd/2026-09-17-honest-claims/progress.md)

### Phase C — Shell and Structure · **shipped, all 10 tickets, 2026-10-13**

**Goal:** the code can absorb the next five features without the shell growing. `src/App.tsx` from
1,315 lines to under 400, holding no navigation, scoping or flow rules. 415 lines of dead modules
gone, one definition of the tournament validation rules, no native `alert`/`confirm`, and the
Landing Page stops downloading the app's stylesheet.

**Landed.** `src/shell/` exists with all seven files Phase D was hard-blocked on, plus
`src/session/flow.ts`; the three deleted modules are gone. **The headline criterion is now met:
`wc -l src/App.tsx` is 391**, under the 400 stated in this file, `contracts.md:180` and debt 26 — so
the one row that was open in three documents at once is closed in all three.

**What closed it, 2026-10-13.** The residual was not 113 loose lines. Of the 513, 28 were blank and
57 comment-only, leaving **428 code lines**; three self-contained behaviours still lived in the
component. They are now `src/shell/useAppCommands.ts` (the store writes, the export, the delete
censuses), `src/shell/useLegacyAdoption.ts` (the pre-community adoption effect and its two warning
refs) and `useThemeAndLayout` in `src/shell/usePreferences.ts`. No e2e spec was edited: **117/117
browser, 788/788 unit, `tsc -b` clean**. The phase's own rule — *a region's line cost is its read
set, not its length* — is what made this cheap; moving the one-to-three-line navigation closures
would have gained nothing.

Spec · plan · tickets: `docs/superpowers/specs/2026-09-17-shell-and-structure-design.md` ·
`docs/superpowers/plans/2026-09-17-shell-and-structure.md` (3,026 lines) ·
`.scratch/debt/issues/21-30`.

### Phase D — Product Completion · **shipped** · 7 tickets

**Goal:** the organizer's evening closes. The teams can be sent to the group chat as text and as a
branded image, the app opens with no signal and installs to the home screen, the browser is asked to
protect the data, a 3- or 5-team night can run a tournament, and the roster stops being one player at
a time.

**Shipped, and the plan's own gate is satisfied.** All seven gate files exist — `RosterScreen.tsx`,
`usePlayerImport.ts`, `useSplitFlow.ts`, `useToasts.ts`, `Modal.tsx`, `constants.ts`,
`useCommunityScope.ts` — checked 2026-10-01. `src/share/**` ships text and poster sharing, round
robin, bulk rating and the CSV path, and `public/sw.js` + `manifest.webmanifest` make the offline
promise true.

Spec · plan · tickets: `docs/superpowers/specs/2026-09-17-product-completion-design.md` ·
`docs/superpowers/plans/2026-09-17-product-completion.md` (3,979 lines) ·
`.scratch/debt/issues/31-37`.

### Phase E — Account and Durability · **plan written 2026-10-14, not started** · 6 tickets

**Goal:** the evening survives the device. A Guest is unchanged. An Organizer who signs in gets
their roster on a second device, and gets it back after losing the first.

This is the phase the 2026-09-17 roadmap explicitly put out of scope, and the reversal is deliberate
and recorded: **ADR-0007 supersedes ADR-0001**. Offline-first holds for everyone, including a signed-in
Organizer's Account is the source of truth, and no screen ever waits on the network: reads come from
a write-through cache in IndexedDB, so a signed-in Organizer on a court with no signal sees their
roster rather than an error, while a write goes server-first and is mirrored into that cache. An edit
made offline is pushed on reconnect, and **rejected with a message** if another device changed the
same Community first — never dropped quietly. No existing feature is gated behind signing in, because
the Guest path is the funnel, not a trial.

**The seam does not change shape**, which is what makes the authority move affordable. The wire
format is the backup format, one document per `(account, community)` — no second schema, no merge
algorithm, no duplicated validation. Nothing is normalized server-side: Player deletion leaves
dangling ids by design, and a relational schema would reject what the app deliberately does.

**Written 2026-10-14:** `docs/superpowers/plans/2026-09-28-account-and-durability.md`. It is written
**after** D, as this row required, and the condition that held it back is discharged: C's last row
closed 2026-10-13, so the phase's place in the order is settled. Its first act was to freeze E's
frozen names — `contracts.md` §4's "Created by E" row had read *"Not yet frozen — the names are Phase
E's plan to freeze"* — so the plan records shapes rather than assuming them. **Every ticket's line
anchor into `src/App.tsx` was stale** (written before C and D decomposed it); the plan cites what it
read and lists the three regions that moved.

Design · ADRs · tickets: `.scratch/backend/spec.md` · `docs/adr/0007-optional-backend.md` ·
`docs/adr/0008-account-identity.md` · `.scratch/backend/issues/01-06`.

## Recommended order, and why

**B → C → D → E, as written — and three of the four are behind us.** B is eight tickets, most of it
copy, and it unblocks D's share text. C is the only pure-refactor phase and the browser suite was
green enough to gate it. D is the expensive product work and it lands in the shell C builds. E is
last because every one of its tickets lands in a file a later phase creates or rewrites. **As of
2026-10-14 the order that remains is E alone**: C's last row closed, all four gates are closed, and
E's plan — the one thing this file was waiting on before E could start — is written.

**They are not file-disjoint, whatever the roadmap says.** B and C shared two files, with four
different owners between them: `src/App.tsx` (B15's two strings sat inside the region C26 moved) and
`src/session/SplitScreen.tsx` (B13's gap copy and B15's two strings, against C28's crumb block and
C26's re-roll expression). Two agents in those files at once is the failure Phase A recorded as
Ruling R16. **That constraint is spent, and `contracts.md` §6 records the two amendments that came
after it** — both written before their code, which is the habit this file should be recommending by
now rather than documenting.

**Two new obligations arrived with Phase B, both recorded in `contracts.md`:**
- **Adding a discipline needs a `SEEDS_ADDED_IN` entry and a `DB_VERSION` bump.** Without the bump
  every existing install runs forever on the old catalog, with no path to the new one — which is
  exactly the defect B19 had to find and fix.
- **The catalog's order is a contract, not a byproduct.** `disciplines[0]` is the new-tournament
  default and `startMatch`'s tie-break, and a store's natural order is alphabetical, not seed order.


## Known-open items

Not scheduled anywhere. Recorded so they are not rediscovered as if they were new.

| Item | Where it is recorded | Size |
|---|---|---|
| ~~CI has never run on a GitHub runner~~ — **false, and now corrected:** 52 runs, green since 2026-09-28, latest on this `HEAD`. **Branch protection is still unverified** (the API answers 401 unauthenticated from here) | Phase A ledger, "Not observed" | one line in the repo settings |
| `workers: 2` is measured and green (29.9 s against ~60 s) but deliberately left at 1 | Phase A ledger, Ruling R15 | one character |
| The standings tiebreak's last key is seed-ordered, not seed-neutral, and decides the title in 1,688 of 262,144 reachable 6-team Swiss final states | Phase A ledger, Ruling R8 | documented residue, defensible |
| A depth-3 quoted name in a CSV still leaks its tail as a row; the cap narrows that class rather than closing it | Phase A ledger, deferred under R12 | one honest comment |
| `src/tournament/TournamentScreen.tsx` has no spec coverage for the ReviewPanel state | Phase A ledger, Task 2 deferral | one new spec |
| The v1 import route through `handleImport` has no e2e coverage | Phase A ledger, Task 6 deferral | one `it` |
| A tournament delete is not re-asserted after a reload in `delete-row.spec.ts` (players and sessions are) | `.scratch/debt/issues/04` Comments | one assertion |
| ~~Handlers write stores rather than hooks in three places Phase A did not touch~~ — **done by C24–C27** | Phase A ledger, carry-forward | — |
| **Tournament subs are unimplemented and unspecified** — no `Sub` type exists anywhere | the audit below | a decision, not a ticket |
| `src/landing.css` is granted to Phase B but written by no task; B's spec claims exclusive ownership of nine paths it does not own | `contracts.md` §3, §7 D5 | bookkeeping |
| ~~The roster editor's **refusal** is met in code (`PlayerEditModal.tsx:141-146` returns before `onSave` and renders `.field-errors`) but has **no test at any layer**~~ — **closed 2026-10-13 by TASK-107**: `e2e/tests/roster/editor-refusal.spec.ts` drives it through the real UI, mutation-verified. It had to be a browser case, not the "one unit case" this row predicted: `renderToStaticMarkup` runs no handlers, and the repo has no jsdom or `*.test.tsx` | `.scratch/app-correctness/issues/03`, second pass | done |
| `.swap-entry-notice` duplicates the nine visually-hidden declarations of `.sr-only` (`src/landing.css:319-329`). The two stylesheets are never loaded together, so the right home is `src/tokens.css` — which `contracts.md` §7 D7 records is not a phase's file | `contracts.md` §5, Day 3, (a) | nine declarations, and a decision |
| `docs/BUSINESS_FLOW_REVIEW.md:13` still states "There is no server, no auth, no network roundtrip" | the backend spec's Further Notes | dated analysis, deliberately out of E03's copy pass |
| **A sign-in must not overwrite an account that has already synced.** The adoption guard is on the *account's* state, not the device's — and a bad overwrite now destroys the authoritative copy, where before it damaged only the local one | ADR-0007, backend spec Implementation Decisions | Phase E's plan must pin the guard and its test |
| **A pending offline write blocks sign-out, or is discarded behind an explicit confirm.** Signing out empties the stores and a queued write then has nowhere to go | ADR-0007, backend spec | Phase E's plan |
| **A cache served while the account is unreachable must say it is a cache.** Token expiry keeps data readable so a signed-in Organizer never finds an empty app; without a signal, someone enters tournament results into a stale copy believing they are saved | ADR-0007, backend spec | Phase E's plan, plus copy in E's UI |
| `src/roster/PlayerEditModal.tsx:170,183` still shows `e.g. Kairi` and `e.g. ONIC · Jungle` as placeholder examples — the last user-visible surface teaching the vocabulary Phase B's ticket 20 removes from the sample rosters | found at B20's Task 4; out of that ticket's file ownership | two placeholder strings, plus whatever the reviewer finds in the same component |
| The landing hero's re-roll goes inert after the first click — clicks 2-5 change nothing and the gap worsens 0.10 -> 0.80, because `rerollCount` only advances on a changed roll so the eight-counter window repeats | found at B14's Task 6; `src/session/SplitScreen.tsx:212,274-286` | a product bug; the "Re-rolls inf" claim stays until it is fixed |
| White-on-bib fails the 4.5:1 contrast floor in dark mode — `#ffffff` on the five `--bib-*` values measures 1.60-3.35:1, and the bib colours are theme-invariant so dark inherits the light ones | found at B17's Task 8; `src/index.css:1982`, `src/landing.css:478`, `src/tokens.css:19-23,51-55` | a CSS decision: darken the bibs or drop the white |
| `docs/design.md` still exists and still competes with `DESIGN.md`; the deletion needs an explicit owner confirmation recorded in ticket 17's `## Comments` | Phase B, all three rounds | one owner decision |
| `## Docs: reject a duplicate trust row` — the `landing-trust` list is pinned by an ordered-array `toContainText` plus `toHaveCount(3)` | verified by mutation at B14 round 2 | nothing to do; recorded so the belief survives |
| **The e2e suite is not reliably green under repeated runs.** Two full-suite runs each failed a *different* pre-existing test — `landing.spec.ts:249` ("the deal repeats") and `:345` ("storage that throws shows the Landing Page rather than erroring") — both as `page.goto` timeouts against the 30 s limit at `e2e/playwright.config.ts:8`. Neither reproduced across two subsequent clean 50/50 runs, and the fix wave added no test block to that file, so neither failure came from it. CI has still never run on a GitHub runner, so nothing has ever watched this suite go twice | Phase B final review | unquantified; a flake rate needs a repeat-run history only CI can give |
| Three class names render with no rule anywhere in the repo: `.sep` (the breadcrumb separator), `.badge--tournament`, `.modal-section-hint`. **`.sep` is the sharpest** — Task 8 made the breadcrumb shared and the Landing Page mounts `SplitScreen`, so a separator with no rule is visibly live on the public page. The other two inherit, so they are benign | found at C29's Task 9; the stylesheet split cannot fix them, because adding a rule is not a move | three declarations, plus a decision on what `.sep` should look like |
| The Landing Page's Re-roll button focus radius changes 6px -> 12px (`var(--r-md)`). Focus-state only, ring unaffected, and the 12px is the landing's own token | found at C29's Task 9 — the landing's focus radius previously came from the app's stylesheet, which is exactly the dependency that task removes | none; recorded so it is not re-opened |
| After a hand swap the split screen says "Best gap found." — true-ish, since nothing was searched either, but "found" implies a search. Fixed from "proven" by C11's fix round (the stamp now defaults to `optimal: false`); closing it properly needs a third provenance state, which is a redesign | Phase C final review, C11 fix round 1 | a design decision for Phase D, whose ticket 31 already has a recorded provenance hazard |

## How this file was rewritten

An audit on 2026-09-28 checked all eight plan documents and six ticket tracks against the working tree.
Result: Phase A shipped; B, C, D and the backend plan had not started; three legacy plans were
implemented; one was moot; and this file was fiction. The audit also found that `contracts.md` — cited
twenty times as the authority for phase order, ownership and frozen names — had never been committed,
which is why it was written alongside this rewrite rather than referenced from it.
