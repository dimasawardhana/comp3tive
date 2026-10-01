# What remains, and in what order

**Branch:** the work is on **`master`** as of `3297156`; `feature/revamp` is 6 commits behind it and
fully pushed. **Updated 2026-10-01** against the tree: R1, R2 and D1 all landed, and the four
"not doing" rows below are now decisions.
**Scope:** everything outstanding **except Phase E** (the optional Account), which is specified in
`.scratch/backend/spec.md` with six tickets and belongs to the next iteration.

**Estimates are for one engineer with agent help, and they are estimates.** Anything marked *yours* is
a gate only you can pass, and **two of them are on the critical path** — no amount of work below
shortens the wait for them. **Every non-gate item below was re-verified against the tree on
2026-10-01**, so where a heading still carries an estimate, the estimate is for work that had not
started when this file was written; the landed ones say so instead.

---

## The short version

**R1, R2 and D1 have all landed.** What is left is:

| | Items | Kind |
|---|---|---|
| **Gates** | 4 | **yours** — CI, deploy, the offline claim, the merge |
| **Records** | 4 tracks | no code; two live defects, an absent phase table, a stale status |
| **Real code** | 1 | the CSV import branch bypasses the validator |
| **Deliberately not doing** | 4 | **decided 2026-10-01**, each with its reason written down |

**The two user-facing bugs are gone.** R1 was the last one; what remains is a validator call, four
decisions and two tickets nobody is waiting on.

---

## Records — 4 tracks, no code

### D1 · `app-health` is a superseded duplicate of the debt tracker — **LANDED 2026-10-01**

`8d459cd` ("docs: retire the app-health tracker as a duplicate of the debt one"). The tracker is
retired, not merely reconciled: `.scratch/app-health/README.md` now carries the closed banner, all
sixteen tickets gained a **Superseded** header pointing at their live twin, and the sixteen-row
pairing table is written down **with a verdict per row, checked against the code**. That pairing is
the durable part — the ROADMAP's D1 got twelve of sixteen right and omitted `13 ↔ 33` entirely, and
the table as it now stands does not have that gap.

### D2 · Two stale statuses in `app-correctness` — **re-checked 2026-10-01, both stay open**

Both were verified against the code rather than against each other, and **neither closes.**

- **`03-validate-players-at-the-boundary`** — its own 2026-09-18 correction says its premise went
  stale, and `validatePlayer` is wired in `transfer.ts`, `usePlayerImport.ts` and
  `PlayerEditModal.tsx`. **Every entry point was walked**: three validate and reject with a message
  naming the record; the **CSV branch does not call the validator**
  (`src/data/player-import.ts:184-215`), which is safe by construction rather than by check. The
  ticket's own fifth bullet — write the read-path choice into the ticket's Answer — **has never been
  done**: there is no `## Answer` section and the choice is recorded nowhere. Two genuinely unmet
  rows; stays open.
- **`06-reconcile-stale-docs`** — five of its six rows verified true against the tree (FLOW's five
  hubs and `/app` entry; `spec/0002` reconciled to DB **v7**; ADR-0002 `accepted`; both root planning
  artifacts superseded; the Tailwind claim corrected). **The sixth row was the one that could not be
  ticked**: `README.md` denied a service worker, a manifest and CDN fonts, all three of which ship.
  **Closed 2026-10-01** — the denial section was rewritten against the tree (`README.md:143-195`),
  and the fourth false denial in the same sweep, "it is not offered in the app yet" for round robin,
  went with it.

### D3 · Tickets 26, 30, 38 and the roadmap's own phase list — **all four acted on 2026-10-01**

- **26** — verified: `splitFlowRule` at `src/shell/useSplitFlow.ts:31`, its truth table pinned for
  all four sources at `src/shell/split-flow.test.ts:14-28` plus the one-flag invariant at `:30-36`;
  `rerollPool` has a real caller at `src/session/SplitScreen.tsx:326`; every `ad-hoc`/`tournament`
  branch in `App.tsx` goes through the rule; the `consumeTeams` message is preserved byte-for-byte.
  **Not closed, because the headline acceptance row is still unmet**: `wc -l src/App.tsx` is **513**
  against a criterion of under 400. That criterion is stated in `contracts.md:180` too, so it is one
  unclosed row in three documents rather than a stale number in one ticket.
- **30** — verified: README (9,317 B), `.nvmrc` (`24.16.0`), `engines`, the browser-suite row, and
  `npx tsc -b` exits 0. **The live defect is gone as of 2026-10-01** — `README.md:143-195` now
  describes the service worker, manifest, self-hosted fonts and install surface that ship, and the
  two other rows the same sweep falsified ("The 22 specs", now 32, and round robin being unoffered)
  were corrected in the same pass. **What the fix does not close is the reason it was missed**,
  which is written down below because it will outlive the paragraph. The `grep` this ticket's own
  acceptance row uses to check for false claims **passes on a false denial**, because the denial
  explicitly denies the claim — it needed reading, not running, and it will need reading again.
- **38** — **closed.** `src/session/benchAdvice.ts` ships; nine separate cases pin silence as the
  default; the opposite case is pinned at `benchAdvice.test.ts:502`; the three shipped rosters still
  split to gap 0, proven, zero flags (`:633`). **The search-widening decision is recorded rather than
  open**: the search is *not* widened, because that turns arrangements into arrangements × exclusions
  and benches good players more often — optimising a metric over what the person asked for.
- **The roadmap spec's own phase table did not exist.** Confirmed: the spec had five `## Phase`
  sections and a dependency graph, and **no table**, so "did B ship?" had to be answered by reading
  five ticket lists in a different directory. An authority that cannot answer its own question is
  not one.

**Repaired 2026-10-01.** The spec now carries **Where each phase stands** — order, owed, shipped,
still open — with every row read from the tracker's `Status:` lines rather than from the document, so
the two can be checked independently. Its answer, per phase: **A, B and D shipped in full; C is at
8 of 10, and its shortfall is the one row debt 26 still holds open; E has not started.**

### D4 · Two a11y gaps the reviews found — **filed 2026-10-01**

Both are in `.scratch/debt/issues/`, in the tracker's own shape, with evidence and acceptance:

- **`40-swap-mode-entry-is-never-announced.md`** — `role="status"` announces *changes* to a live
  region, not a region being **inserted**, and entering swap mode inserts it (`SplitScreen.tsx:392`).
  Every later transition works because `swapMode` holds the element mounted while `pick` mutates it.
  **`src/session/SplitScreen.swap-entry.test.ts` is written to be broken on purpose by whoever fixes
  this**, and the ticket says so — the failing test reads as the specification, not as a bug.
  It names the collisions first: `e2e/tests/split/swap.spec.ts:326` (count 0 when off) and
  `.swap-banner` as a styled hook at `src/split.css:636`.
- **`41-settings-trigger-has-no-aria-expanded.md`** — the ⚙ trigger at
  `src/shell/AppChrome.tsx:163-172` carries none, while the **same file uses it correctly twice**
  (`:81`, `:105`). Found while removing the dead `showAddCommunity` prop, which invited a wrong
  `aria-expanded` on the ✚ button — the ticket records that the ✚ must **not** get one, because its
  form's visibility is App's and not the chrome's.

### A note for the next audit — **a denial is a claim too**

**Nothing mechanical in this repo can catch a false denial, and one shipped anyway.**
`.scratch/debt/issues/30-project-hygiene.md`'s fifth acceptance row — *"The README makes no
offline, install, account or backend claim: `grep -niE "service worker|offline|installable|
manifest|account|server|sync" README.md` returns only lines that explicitly deny the claim"* —
**passed on a paragraph in which every one of those words was a lie**, and it passes today too. The
scan is built to find over-claiming: a promise the app cannot keep. *"There is no service worker"*
contains no promise, so the scan has nothing to flag and the line never gets a vote. **The grep
cannot fail, which is the same thing as saying it cannot pass.**

**So every denial has to be read by hand, and read as a claim about the build.** The direction the
scan does not cover is the one that costs a newcomer most, because a denial is the one sentence
about the build a reader is most likely to act on: this one said there was nothing to install and
nothing cached, ten lines above a `public/sw.js` and a manifest. **An audit of what this build
claims reads denials in both directions** — the sentence, and the tree that falsifies it — before it
calls a document clean. D2 and D3 above had to do exactly that, by hand, twice.

The runtime guard has the same shape and no hole in this direction: the Landing Page's four trust
rows are asserted **whole** at `e2e/tests/landing/landing.spec.ts:92-117`, scoped text and not
keyword, precisely so a claim cannot be deleted or quietly widened without the assertion going red.
That is the pattern the static scan cannot imitate — a test pins the exact sentence, a grep only
notices when the word stops appearing.

**That row is now wrong in the other direction too, and that is the second half of the lesson.**
With the README repaired the grep returns **17** lines — ten of them inside the rewritten section,
describing the service worker, the manifest and the install surface that actually ship, and the
rest unrelated hits like `webServer` and "Vite dev server". So "returns only lines that explicitly
deny the claim" **can no longer be satisfied by any honest document**: describing the PWA and
denying it are the same words. The row was never a check; it was a description of the shape the
false denial had.

**Whoever owns `.scratch/debt/issues/30-project-hygiene.md` should delete the row rather than
re-word it**, and replace it with the hand-read rule: every sentence in a document that asserts a
capability — *and every sentence that denies one* — names the tree it was checked against, and the
check was a reading. Nothing here was left to a third file on purpose: the ticket's own status is a
records decision, not this fix's.

---

## The critical path is yours, not mine

```
  ┌─ CI green on master ────────────────────────┐
  │                                           ├─► review + merge ──► done
  └─ real deploy ─► verify offline claim ─────┘
```

**1. CI green.** The entire verification story for this branch is "I ran it on one machine", and the
workflow is **already committed** — `c3d7cb4` added `.github/workflows/ci.yml` and it is an ancestor
of `HEAD`. **What has never happened is a run**: debt 10 records that no GitHub runner is reachable
from this workstation. So gate 1 is *push and let it go red or green*, not "add the workflow". Until
it runs, nothing here is verified by anything but me and subagents. *Blocking, yours.*

**2. One `curl` before you deploy, because it decides whether gate 3 matters:**

```bash
curl -sI https://<your-domain>/ | grep -i 'vary\|cache-control'
```

`cache.match` honours `Vary: Origin`. If your host sends it, the whole precache depends on the
`{ ignoreVary: true }` fix, which is currently proven only against `vite preview`. If it does not, the
fix is harmless and you can stop thinking about it. **Ten seconds, and it is the single largest
unverified assumption in the branch.**

**3. Real deploy, then verify the offline claim there.** A whole tournament with the network cut, and
the old `comp3tive-<hex>` cache gone from `caches.keys()`. If the version does not change after a real
build, the hash is not seeing your content. *Blocking, yours.*

**4. Merge.** The work is **already on `master`** as of `3297156`, so this gate is now about what
the PR review needs rather than about landing the branch: `.superpowers/sdd/2026-09-30-pr-body.md`
still holds the body written for PR #5. **Not verified here:** whether a PR is currently open — `gh`
is not installed on this machine, so this file's claim that "an open PR adds the workflow" has been
removed rather than rewritten.

---

## Real code — 1 item

### R1 · Swap mode has no entry point — **LANDED 2026-10-01**

Ticket 39. `swapMode` is `useState(false)` at `src/session/SplitScreen.tsx:266` and can never become
`true`: `setSwapMode` is called only from `toggleSwapMode`, and `toggleSwapMode` is bound only to the
"Done swapping" button, which renders only when the mode is already true. **The entry point is the
exit.** The feature shipped, worked, and lost its two `Swap` buttons in one unrelated hunk of
`36d32b6` on 2026-09-07; the commit kept the handler, the branch, the exit and the banner.

Nothing needs designing — `swapPlayers`, the two-step pick, the CSS and `DESIGN.md:100`'s "each card
is a swap target" are all present. **It needs a `contracts.md:538` amendment first**, because that
file is held to zero removed lines and the current grant is one character. Then: a button, a test
that enters the mode and performs a swap, and the four documents that still describe it as shipped.

**This is a user-facing bug, not a chore.** It has been dead for ten weeks and no test can catch it,
because entering the mode is the thing that is missing.

**Landed 2026-10-01.** The amendment came first: `contracts.md` §5 now carries a named exception
granting **one** `Swap` ghost button, bound to the existing `toggleSwapMode`, plus one comment-only
correction to `src/split.css:784-814` — which stated "one to four actions" and described the
tournament bar breaking 2+2, both falsified by the fifth button. The button was inserted, not
substituted, so `git diff -U0 src/session/SplitScreen.tsx | grep -E "^-[^-]"` still returns nothing
and the row's zero-removed-lines rule is untouched. It is gated on `result.teams.length > 1`, the
gate `Share` already had, because a swap needs two teams and the screen below that renders "Solver
failed".

**It is gated on one team count that no design had to decide:** at 390 the five-action bars wrap to
**3+2** from History and **2+2+1** from a tournament draft, against 350 of content width. No
declaration changed, no label truncates, no action dropped below 44px, and the three-action and
two-action bars still fit on one line. `action-bar.spec.ts` now pins a line count **per state**
rather than one global number, because a single global number would have been one of those two
lying.

**The coverage is the part that matters, and it is not the arithmetic.** `swapPlayers` was already
unit-tested and the card affordances were never touched, which is exactly why ten weeks passed:
the function was covered and the reaching was not. `e2e/tests/split/swap.spec.ts` now enters the
mode through the button, trades two players, and asserts the gap moved 4.0 → 2.4 on a seed built so
the number cannot drift by chance; it also covers the same-team clear, Enter and Space, the
`role="button"` / `tabIndex={0}` affordances, and the transitions in and out. Against `497aa8b` —
three commits back, and byte-identical to `HEAD` for this file — **all six go red**, four of them on
`waiting for getByTestId('swap-mode')`. The sixth is a negative assertion (Swap withheld below two
teams) and passes on both commits by construction; `SplitScreen.swap-entry.test.ts` is 5-red of 6
for the same reason. **That split is the finding, not a caveat: a test that cannot fail on the
broken commit is not the test, and the one that survives is the one making a negative claim.**

### R2 · The "prop nobody passes" sweep — **LANDED 2026-10-01**

`3297156` ("R2: close three review findings, each under its own named amendment"). The sweep itself
found nothing new; **what it turned up was that the removals it had made were still on the books.**
Three findings, each closed under its own `contracts.md` amendment because each sat under a
different rule:

1. **`AppChrome.showAddCommunity`** — declared, passed, never read. The feature was never dead (App's
   gate at `src/App.tsx:426` is correct) and the gate was never misplaced. The defect was narrower
   and more interesting: a boolean on the chrome's interface *claimed a knowledge the chrome does
   not have*, which is exactly what invites a wrong `aria-expanded` on the ✚. Removed from the
   interface, its doc line and its call site; the doc's fact survived, moved onto
   `onToggleAddCommunity`, which is actually read.
2. **`SplitScreen.tsx:397`** → `nameOf(roster, pick.playerId)`. The last of the eight copies the
   resolver's own contract names, and the only one of the four survivors that is the same work in
   the same shape.
3. **The swap banner's live region** — the check came before the fix, and it found the *inverse* of
   what the attribute looks like. Recorded in the ticket as `.scratch/debt/issues/40-*.md`, because
   the check found a real defect and fixing it is not the same work as finding it.

**Why this is worth knowing before the next refactor.** The class was real — one hit in 91
`useState` declarations — and **two attempts missed it before the third found it**: one counting
only `setter(` syntax, so `onMatch={setRecording}` was invisible; one testing the gate line-locally,
so a handler defined outside the gate read as an outside entry. Only the brace-matched,
reference-counting version works. **Do not run the cheap one and trust it.** And the sweep still
does not answer *"a prop nobody passes"* by construction — it answered a different question, and
the three findings above came from reading what it had already flagged rather than from the sweep
finding them.

---

## Deliberately not being done — decided 2026-10-01

These were rows waiting on a decision. **They are decisions now**, each written as one, with the
reason it is a choice rather than an omission. Revising any of them is a deliberate act, not
something a later agent trips over.

| | Decision | Why it holds |
|---|---|---|
| **The 32 unclaimed `App.tsx` lines** | **Left as they are. They stay unexamined, on purpose.** | Phase C's under-400 target was abandoned with the arithmetic minuted, but removing the accepted 41-line residual still leaves 32 over. **No review accepted them and no ticket scoped them.** The honest state of this is *not known* — a documented decision to leave them would require someone to look, and nobody has. Recorded so the difference between "decided" and "unexamined" is not lost: **this row is the second.** It stays open inside debt 26, which is the ticket that owns the number. |
| **The 3 surviving `?? "?"` sites** | **They stay, and the reason is the *shape of the expression*, not a duplicate that escaped.** | Each is a resolver call that does not fit the resolver's parameter. **`SplitScreen.tsx:91`** binds `player` at `:71` and needs the whole `Player` at `:73` too — `nameOf(roster, slot.playerId)` would be a second scan of the roster for a value already in hand. **`TournamentScreen.tsx:490`** resolves a tournament **team** via `teamOf(tournament, row.teamId)`, while `nameOf`'s first parameter is `Player[]`; no conversion exists that is not a cast, and the same file already has a team-name resolver with a `"TBD"` fallback, so collapsing would be a false unification of two subjects. **`share/fairness.test.ts:304`** builds this repo's own oracle, so it must not build itself out of the helper it is checking. The fourth, `SplitScreen.tsx:397`, was the same work in the same shape and was converted in `3297156` — **which is the test of the rule: the three that stayed are the ones where the shape differs, and the one that went was the one where it did not.** |
| **`benchAdvice` silent on `NODE_BUDGET` pools** | **Kept. It is a trade, and the side given up is the widest pools.** | `benchAdvice.ts:122` returns `null` when `result.solver.nodesExplored >= NODE_BUDGET`. The reason is a render cliff: ~135ms per `fairSplit` call on a 25-player pool makes nineteen candidates 2.6 seconds, and the cliff lands **exactly** on the pools that exhaust the budget — the ones the screen is already saying it could not prove. 0ms on three 26-player pools against 3,594ms measured without the guard. **Coverage was traded for cost and the coverage given up is the widest pools.** Revisit only if the advisory is wanted there, and expect to change the cap rather than the guard. |
| **One-site-only props: `Screen.className` and three on `SplitScreen`** | **Correct today. Swap mode the day their second call site is deleted.** | `Screen.className` (`src/ui/Screen.tsx:6`) has exactly one caller, `MatchScreen.tsx:39`. Three `SplitScreen` props have exactly one apiece — `onSubmitTournament`, `onSaveSquad` and `share`, all three at `ScreenSwitch.tsx:316`/`:321`/`:327` — against a second mount at `src/landing.tsx:153` that passes none of them. **None is dead: each is absent where it must be absent.** `share` is the clearest case — the Landing Page hero mounts the same screen with no `share`, and a Share button on a public marketing page would offer to publish a fabricated roster, which is why it is a prop and not a flag. **A one-site prop is the cheapest possible seam**, and deleting its second call site removes the reason it exists. No action; the row is here so a future sweep does not read a small call-site count as an orphan. |

**The fifth row is now written down, because it was the one nobody had answered:** a **second CI
node version**. `.nvmrc` pins `24.16.0`, `engines` allows `^22.20 || ^24.12 || >=25`, and
`ci.yml:8` runs `node-version: 22`. Not a defect today — but the local version, the declared floor
and the version CI runs are three different numbers, and **that is a deliberate answer waiting to
be made, not a settled one.** It belongs with gate 1, because deciding it before the workflow has
ever run would be deciding it without evidence.

---

## A suggested order — **updated 2026-10-01**

**Day 1, yours, unchanged:** open the PR, land CI, one `curl`, deploy, verify, merge. That is the
whole critical path and nothing below competes with it.

**Day 2, in any order:** D4's two tickets (the swap-mode entry announcement and the ⚚ trigger's
`aria-expanded`) are the only new code, and both are small. **Both are a11y, neither is a user-
visible bug**, and both are filed with their evidence and their collisions already written down.

**Day 3:** the one real code item — **the CSV import branch's missing `validatePlayer` call** — and
the read-path decision that `app-correctness/03` has been carrying since 2026-09-18. Both are
inside tickets that are already open with the finding recorded; neither needs a decision from you.

**Done, and worth saying so:** R1 was the last user-facing bug in this file, D1's tracker is
retired, and the roadmap spec can be read for what it is supposed to answer.

**One thing worth doing before Day 2:** copy `.superpowers/` off this machine. It holds the per-task
briefs, the reports, the ~46 `CORRECTION` blocks' reasoning and the record of which of my premises
were wrong. It is gitignored, so it is on exactly one disk, and `git log` reconstructs what changed
without reconstructing why.
