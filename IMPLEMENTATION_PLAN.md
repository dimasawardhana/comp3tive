# comp3tive — implementation plan

**Status:** current as of 2026-09-28. This is the live index; the design behind each phase lives in
`docs/superpowers/`, and the cross-phase rules live in `contracts.md`.

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

**43 tickets. 12 shipped, 31 to go.**

```
Phase A · Truth and Trust          12 tickets   SHIPPED   edfd739
Phase B · Honest Claims             8 tickets   not started
Phase C · Shell and Structure      10 tickets   not started
Phase D · Product Completion        7 tickets   not started
Phase E · Account and Durability    6 tickets   not started
```

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

### Phase B — Honest Claims · not started · 8 tickets

**Goal:** every claim the product makes about itself is true. The split screen says whether a gap was
*proven* minimal or is the *best found*; the landing page stops promising what the build does not do;
"Community" is the only word for the group; the documents stop contradicting the code.

**The first thing to check:** `src/session/gapProvenance.ts` does not exist. It is the phase's
central module and the reason the rest is cheap. `src/session/SplitScreen.tsx:139,357` still
hardcode `Fair game.` regardless of provenance; `src/App.tsx:1090,1152` still say "squad".

Spec · plan · tickets: `docs/superpowers/specs/2026-09-17-honest-claims-design.md` ·
`docs/superpowers/plans/2026-09-17-honest-claims.md` (2,124 lines) · `.scratch/debt/issues/13-20`.

### Phase C — Shell and Structure · not started · 10 tickets

**Goal:** the code can absorb the next five features without the shell growing. `src/App.tsx` from
1,315 lines to under 400, holding no navigation, scoping or flow rules. 415 lines of dead modules
gone, one definition of the tournament validation rules, no native `alert`/`confirm`, and the
Landing Page stops downloading the app's stylesheet.

**The first thing to check:** `src/shell/` does not exist. Every file the phase creates is genuinely
new, and Phase D is hard-blocked on it.

Spec · plan · tickets: `docs/superpowers/specs/2026-09-17-shell-and-structure-design.md` ·
`docs/superpowers/plans/2026-09-17-shell-and-structure.md` (3,026 lines) ·
`.scratch/debt/issues/21-30`.

### Phase D — Product Completion · not started · 7 tickets

**Goal:** the organizer's evening closes. The teams can be sent to the group chat as text and as a
branded image, the app opens with no signal and installs to the home screen, the browser is asked to
protect the data, a 3- or 5-team night can run a tournament, and the roster stops being one player at
a time.

**Blocked.** The plan's own gate: if `src/shell/RosterScreen.tsx`, `src/shell/usePlayerImport.ts`,
`src/shell/useSplitFlow.ts`, `src/shell/useToasts.ts`, `src/ui/Modal.tsx`, `src/ui/constants.ts` or
`src/shell/useCommunityScope.ts` is missing, **stop** — a prerequisite phase has not landed.

Spec · plan · tickets: `docs/superpowers/specs/2026-09-17-product-completion-design.md` ·
`docs/superpowers/plans/2026-09-17-product-completion.md` (3,979 lines) ·
`.scratch/debt/issues/31-37`.

### Phase E — Account and Durability · not started · 6 tickets

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

**Not yet written:** its implementation plan. The design, the decisions and the six tickets exist;
`docs/superpowers/plans/2026-09-28-account-and-durability.md` does not. Write it after D, not before
— E's `contracts.md` row is the one place its frozen names get recorded, and a plan written before
the phase's place in the order was settled would freeze the wrong shapes.

Design · ADRs · tickets: `.scratch/backend/spec.md` · `docs/adr/0007-optional-backend.md` ·
`docs/adr/0008-account-identity.md` · `.scratch/backend/issues/01-06`.

## Recommended order, and why

**B → C → D → E.** B is eight tickets, most of it copy, and it unblocks D's share text. C is the only
pure-refactor phase and the browser suite is green enough to gate it now. D is the expensive product
work and it lands in the shell C builds. E is last because every one of its tickets lands in a file a
later phase creates or rewrites.

**They are not file-disjoint, whatever the roadmap says.** B and C share two files, with four
different owners between them: `src/App.tsx` (B15's two strings sit inside the region C26 moves) and
`src/session/SplitScreen.tsx` (B13's gap copy and B15's two strings, against C28's crumb block and
C26's re-roll expression). Two agents in those files at once is the failure Phase A recorded as
Ruling R16. So: **run B, then C.** C gains nothing by starting early, because D is hard-blocked on C
either way — the parallelism buys no critical-path time and costs a merge.

## Known-open items

Not scheduled anywhere. Recorded so they are not rediscovered as if they were new.

| Item | Where it is recorded | Size |
|---|---|---|
| CI has never run on a GitHub runner; branch protection is not set | Phase A ledger, "Not observed" | one line in the repo settings |
| `workers: 2` is measured and green (29.9 s against ~60 s) but deliberately left at 1 | Phase A ledger, Ruling R15 | one character |
| The standings tiebreak's last key is seed-ordered, not seed-neutral, and decides the title in 1,688 of 262,144 reachable 6-team Swiss final states | Phase A ledger, Ruling R8 | documented residue, defensible |
| A depth-3 quoted name in a CSV still leaks its tail as a row; the cap narrows that class rather than closing it | Phase A ledger, deferred under R12 | one honest comment |
| `src/tournament/TournamentScreen.tsx` has no spec coverage for the ReviewPanel state | Phase A ledger, Task 2 deferral | one new spec |
| The v1 import route through `handleImport` has no e2e coverage | Phase A ledger, Task 6 deferral | one `it` |
| A tournament delete is not re-asserted after a reload in `delete-row.spec.ts` (players and sessions are) | `.scratch/debt/issues/04` Comments | one assertion |
| Handlers write stores rather than hooks in three places Phase A did not touch | Phase A ledger, carry-forward | Phase C's C24–C27 |
| **Tournament subs are unimplemented and unspecified** — no `Sub` type exists anywhere | the audit below | a decision, not a ticket |
| `src/landing.css` is granted to Phase B but written by no task; B's spec claims exclusive ownership of nine paths it does not own | `contracts.md` §3, §7 D5 | bookkeeping |
| `docs/BUSINESS_FLOW_REVIEW.md:13` still states "There is no server, no auth, no network roundtrip" | the backend spec's Further Notes | dated analysis, deliberately out of E03's copy pass |
| **A sign-in must not overwrite an account that has already synced.** The adoption guard is on the *account's* state, not the device's — and a bad overwrite now destroys the authoritative copy, where before it damaged only the local one | ADR-0007, backend spec Implementation Decisions | Phase E's plan must pin the guard and its test |
| **A pending offline write blocks sign-out, or is discarded behind an explicit confirm.** Signing out empties the stores and a queued write then has nowhere to go | ADR-0007, backend spec | Phase E's plan |
| **A cache served while the account is unreachable must say it is a cache.** Token expiry keeps data readable so a signed-in Organizer never finds an empty app; without a signal, someone enters tournament results into a stale copy believing they are saved | ADR-0007, backend spec | Phase E's plan, plus copy in E's UI |
| `src/roster/PlayerEditModal.tsx:170,183` still shows `e.g. Kairi` and `e.g. ONIC · Jungle` as placeholder examples — the last user-visible surface teaching the vocabulary Phase B's ticket 20 removes from the sample rosters | found at B20's Task 4; out of that ticket's file ownership | two placeholder strings, plus whatever the reviewer finds in the same component |

## How this file was rewritten

An audit on 2026-09-28 checked all eight plan documents and six ticket tracks against the working tree.
Result: Phase A shipped; B, C, D and the backend plan had not started; three legacy plans were
implemented; one was moot; and this file was fiction. The audit also found that `contracts.md` — cited
twenty times as the authority for phase order, ownership and frozen names — had never been committed,
which is why it was written alongside this rewrite rather than referenced from it.
