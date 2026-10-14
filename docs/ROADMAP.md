# What remains, and in what order

**Branch:** everything is on **`master`**, level with `origin/master` at `3683974`; **0 open PRs**;
`feature/revamp` merged as `9e6a4a3`. **Updated 2026-10-13** against the live origin: **all four
gates are now closed**, and the deploy and its offline claim were verified against the deployed
Worker rather than a local build. The production hostname was never missing — it is
`comp3tive.dimasawardhana.workers.dev`, and the string this file asked for was in the deploy's own
URL the whole time (gate 3, below).
**Scope:** everything outstanding **except Phase E** (the optional Account), which is specified in
`.scratch/backend/spec.md` with six tickets and belongs to the next iteration.

**Estimates are for one engineer with agent help, and they are estimates.** **Every non-gate item
below was re-verified against the tree on 2026-10-01**, so where a heading still carries an estimate,
the estimate is for work that had not started when this file was written; the landed ones say so
instead.

**The one lesson worth carrying out of this pass** is in the gates section below, and it has now
happened twice. This file asserted that CI had never run, in three paragraphs, and it had run green
47 times. It then asserted, for two weeks and in five documents, that **no production hostname was
recorded anywhere** — and the deploy was live and reachable the whole time, at a URL the string could
be read off in ten seconds. Both times the author had no way to ask the question that would have
settled it (`gh` absent; a lapsed `wrangler` token), and **"I cannot check this" was written down as
"this is false."** A denial of a fact you cannot reach is not a finding — and, as gate 3 shows, the
fact was one `curl` away the entire time.

---

## The short version

**R1, R2, D1, both a11y tickets, the CSV validator call and all four gates have landed.** What is left is:

| | Items | Kind |
|---|---|---|
| **Gates** | **0** | **all four closed**, the last two 2026-10-13 against the live origin |
| **Records** | 1 | no code — the a11y row of debt 30 |
| **Real code** | **0** | debt 26's line count closed 2026-10-13 |
| **Deliberately not doing** | 4 | **decided 2026-10-01**, each with its reason written down |

**Every user-facing bug in this file is gone**, and so is the one real code item it named, and so are
the two gates that had no owner. What remains is one row of a ticket's own acceptance, four decisions,
and a custom domain that only Phase E needs.

---

## Records — 4 tracks, all four acted on

### D1 · `app-health` is a superseded duplicate of the debt tracker — **LANDED 2026-10-01**

`8d459cd` ("docs: retire the app-health tracker as a duplicate of the debt one"). The tracker is
retired, not merely reconciled: `.scratch/app-health/README.md` now carries the closed banner, all
sixteen tickets gained a **Superseded** header pointing at their live twin, and the sixteen-row
pairing table is written down **with a verdict per row, checked against the code**. That pairing is
the durable part — the ROADMAP's D1 got twelve of sixteen right and omitted `13 ↔ 33` entirely, and
the table as it now stands does not have that gap.

### D2 · Two stale statuses in `app-correctness` — **both now closed, 2026-10-01**

Both were verified against the code rather than against each other on the first pass, and the
verdict then was **neither closes**. One was wrong.

- **`03-validate-players-at-the-boundary`** — **now closed.** It carried the two rows this file
  named, and both are delivered. **The read-path decision is written** — `## Answer` in the ticket:
  *validate on write, trust storage on read*, with what that gives up stated rather than argued
  around, which is what the bullet asked for and what twelve hours of "nobody had chosen it" did not
  supply. **The CSV branch now calls `validatePlayer`** (`src/data/player-import.ts:230-236`) and
  routes an issue to `skipped` with the row's line. **Both shapes that defeated its build-by-
  construction are closed and each has a test**, and the second one is the interesting half: a
  discipline with **no attributes** produces `attributeRatings: {}`, which `validateCapability`
  **cannot catch** — it iterates the discipline's attributes and there are none to fail — so a guard
  refuses the row before anything is built. Both new tests were run with the fix stashed: **2 red of
  22.** The 2026-09-18 instruction not to close the file is superseded, and the file says so.
- **`06-reconcile-stale-docs`** — closed on the first pass. Five of six rows verified true against
  the tree (FLOW's five hubs and `/app` entry; `spec/0002` reconciled to DB **v7**; ADR-0002
  `accepted`; both root planning artifacts superseded; the Tailwind claim corrected), and the sixth
  was the one that could not be ticked: `README.md` denied a service worker, a manifest and CDN
  fonts, all three of which ship. **The denial section was rewritten against the tree**
  (`README.md:143-195`), and the fourth false denial in the same sweep — "it is not offered in the
  app yet" for round robin — went with it.

**What the two together are worth as a method.** D2 was the item on this list most likely to be
closed by ticking the boxes, and it would have been: five of six rows and four of four entry points
were true, and a reviewer reading only the verdicts would have seen one open ticket with two
documented reasons. **It took reading the code to find the fourth entry point had no validator, and
it took running the fix against the unfixed file to find that one of the two shapes was the
validator's and the other was nobody's.**
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
  **CLOSED 2026-10-13**: `wc -l src/App.tsx` is **391**, under the 400 criterion stated here,
  in `contracts.md:180` and in debt 26 — the one row that was open in three documents at once is
  now closed in all three. See the closing section for what closed it.
- **30** — verified: README (9,317 B), `.nvmrc` (`24.16.0`), `engines`, the browser-suite row, and
  `npx tsc -b` exits 0. **The live defect is gone as of 2026-10-01** — `README.md:143-195` now
  describes the service worker, manifest, self-hosted fonts and install surface that ship, and the
  two other rows the same sweep falsified ("The 22 specs" — then 32, and **33 as of 2026-10-13, when
  TASK-107 added one; the count has now gone stale three times, so the README no longer carries it**)
  and round robin being unoffered) were corrected in the same pass. **What the fix does not close is
  the reason it was missed**, which is written down below because it will outlive the paragraph. The
  `grep` this ticket's own acceptance row uses to check for false claims **passes on a false denial**,
  because the denial explicitly denies the claim — it needed reading, not running, and it will need
  reading again.
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
the two can be checked independently. Its answer, per phase: **A, B, C and D have all shipped in
full** — C's last row closed 2026-10-13 — **and E has not started.**

### D4 · Two a11y gaps the reviews found — **filed, then fixed, 2026-10-01**

Both were in `.scratch/debt/issues/`, in the tracker's own shape, with evidence and acceptance. Both
are now **`resolved`**, and both went through `contracts.md` §5 **before** the code, which is the
first time a non-phase fix in this repo has written its amendment down first rather than after.

- **`40-swap-mode-entry-is-never-announced.md`** — `role="status"` announces *changes* to a live
  region, not a region being **inserted**, and entering swap mode inserts it
  (`SplitScreen.tsx:392`). **Fixed by a sibling that is mounted and empty from the first render**:
  `.swap-entry-notice`, filled by `toggleSwapMode` and emptied by `handlePick`.
  **The ticket's own shape was wrong twice, and both corrections are in the amendment rather than in
  the code's history.** It proposed moving the region out of `.swap-banner`; that cannot be done by
  making the banner's *container* the region, because `e2e/tests/split/swap.spec.ts:364` asserts
  `role="status"` **on `.swap-banner`** and two nested live regions announce every later transition
  twice. And it claimed the fix "needs no declaration changed", which is false for a sibling holding
  a sentence the banner is already printing — **a visible second copy is the failure mode, not a
  cost.** `position: absolute` is what makes it free twice over: hidden, and out of `.screen`'s
  `gap`, so no bar measurement moved.
  **The ticket's red test was written first and watched fail — 2 red of 9 — and the mutation test at
  `swap.spec.ts:336-383` is green unedited.** Full browser suite: **117 passed, 0 failed.**
- **`41-settings-trigger-has-no-aria-expanded.md`** — the ⚙ trigger at
  `src/shell/AppChrome.tsx:163-172` carried none, while the **same file used it correctly twice**
  (`:81`, `:105`). **Fixed with one inserted line**, `aria-expanded={showSettings}`, read from the
  state the chrome already holds. The ✚ button was left alone, for the reason the ticket gives and
  `contracts.md` §5, Day 2, (a) already gave: its form's visibility is App's and the chrome never
  learns the answer, so an `aria-expanded` there would be a false claim. **No exception was
  required** — `AppChrome` is in no row of §6 — and that is recorded as the finding it is.

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
With the README repaired the grep returned **17** lines on 2026-10-01 — ten of them inside the
rewritten section, describing the service worker, the manifest and the install surface that actually
ship, and the rest unrelated hits like `webServer` and "Vite dev server". So "returns only lines that
explicitly deny the claim" **can no longer be satisfied by any honest document**: describing the PWA
and denying it are the same words. The row was never a check; it was a description of the shape the
false denial had. **It returns 21 today** — the four extra lines are the `npm run e2e:live` row and
the deployed-origin paragraphs, added 2026-10-13, every one of them true. Both numbers are recorded
because the second is what a reader gets now and the first is what the row was measured against.

**`docs/agents/document-claims.md` is the durable form of this note**, written 2026-10-13: every
sentence that asserts a capability — *and every sentence that denies one* — names the tree it was
checked against, and the check was a reading. The row was **deleted rather than re-worded**, as
recommended here, and the ticket closed; the README was re-read against the tree in the same pass
and is clean. Nothing here was left to a third file on purpose: the ticket's own status is a records
decision, not this fix's.

---

## The critical path — **all four gates closed**

```
  ┌─ CI green on master ── CLOSED, 2026-09-28 ─────┐
  │                                                ├─► merge ── CLOSED ──► done
  └─ real deploy ─► verify offline claim ── CLOSED, 2026-10-13 ─┘
```

**1. CI green — CLOSED, and it closed without anyone noticing.** This file said, until today: *"What
has never happened is a run… no GitHub runner is reachable from this workstation. Until it runs,
nothing here is verified by anything but me and subagents."* **All four clauses are false, and the
evidence is one unauthenticated request — no `gh`, no token:**

```bash
curl -s "https://api.github.com/repos/dimasawardhana/comp3tive/actions/runs?per_page=100" \
  | jq -r '.workflow_runs[] | "\(.run_number)\t\(.created_at)\t\(.head_branch)\t\(.head_sha[0:7])\t\(.conclusion)"'
```

**52 runs, 47 success and 5 failure.** The five failures are runs 1–5 on 2026-09-18, the day the
workflow was added. **Run 6 on 2026-09-28 was the first green**, and every run since is green:
**run 52, `master` at `3683974` — this `HEAD` — success at 2026-10-01T02:30Z**, with all eight steps
green in order, `npx tsc -b` → `npx vitest run` → `npx vite build` → `npx playwright install` →
`npm run e2e`.

**Why it survived two audits, because the reason is the useful part.** Debt 10 closed as `resolved`
on the strength of *the workflow existing*. The records pass of 2026-10-01 re-asserted the denial
twelve hours ago and could not have found otherwise: `gh` is not installed here, so it asked the
machine, and the machine has no way to ask GitHub. **The check that was available is the check that
was run**, and "no tool can do this" reads exactly like "this is false" to every step downstream. It
is the same shape as the failure this file warns about three sections up, one level up: a denial of a
capability, made of words that look like evidence.

**2. The `Vary` question — CLOSED 2026-10-13, and the answer is "there is nothing to honour".**

```bash
curl -sI https://comp3tive.dimasawardhana.workers.dev/ | grep -i 'vary\|cache-control'
```

`cache.match` honours `Vary: Origin`, and the fear was that the deployed host would send it while
`vite preview` did. **It does not.** The deployed origin returns **no `Vary` header at all** — checked
on `/`, `/app/`, `/sw.js`, `/manifest.webmanifest`, `/404.html`, a hashed asset under `/assets/`, a
`/fonts/*.woff2`, and an icon, by `HEAD` **and** by `GET` twice (with and without
`Accept-Encoding: gzip, deflate, br`). Every response carried zero `Vary` lines.

So `cache.match` has no `Vary` to honour and `{ ignoreVary: true }` (`public/sw.js:171`) is
**harmless rather than load-bearing** on this host. The fix stays — it costs nothing and it is the
correct thing to do if a rule is ever added that does send `Vary` — but the assumption that the whole
precache rested on it is retired, and it was never the "single largest unverified assumption in the
branch" that this file called it. **The worrying part was not the header; it was that two weeks
passed without anyone spending the ten seconds.**

**3. The deploy and its offline claim — CLOSED 2026-10-13, verified against the deployed origin.**

**The production hostname was never missing. It is `https://comp3tive.dimasawardhana.workers.dev/`,
and this file, ADR-0007, ADR-0008, the backend spec and two tickets spent two weeks asserting that no
such string existed in the repo — while `wrangler.jsonc`'s `"name": "comp3tive"` was the correct
Worker name the whole time.** A workers.dev host is always `<worker>.<account>.workers.dev`, so the
name in the config *is* the origin's first label; the file called it "a documented placeholder"
(`docs/adr/0008:86`) and stopped one step short of the URL that proves it is not. The Pages 404 that
"recorded no deployments" is also a red herring: the target is a static-assets **Worker**, and the
Pages API knows nothing about Workers.

**What the origin serves, proven rather than asserted.** It serves `master` at `3683974`, and
**byte-identically**: `/`, `/app/`, `/404.html`, `/sw.js` and `manifest.webmanifest`, plus all nine
hashed assets, five fonts and three icons, each `diff`ed against a build of that commit made in a
clean worktree — not one byte differs. The `WorkerConstants` in the live `/sw.js` are
`VERSION = "b12c14230adf"`, 17 precached URLs and 6 documents, and **that version recomputes from the
deployed bytes**: `sha256` over every precached URL's path and its own served bytes, the same algorithm
`vite.config.ts` uses, is `b12c14230adf` when run against 23 live responses. So the version is derived
from content, not typed, which is the failure mode this file named ("If the version does not change
after a real build, the hash is not seeing your content").

**The offline claim, on the deployed build, with the network cut.** `e2e/live/offline.spec.ts` (run
with `npx playwright test --config=e2e/live.playwright.config.ts`; deliberately outside the default
suite, which points at `./tests`) drives a real Chromium against Cloudflare's edge and passes four
tests, three times in a row:

- **No request leaves the origin** — the deployed app and Landing Page reach no host but their own.
- **A whole tournament runs with no network** — create a round-robin, split fifteen players into
  three teams, hand them to the bracket, play all three fixtures to a decided BO3 each, and crown a
  champion that matches the standings leader, all after `context.setOffline(true)`. The device holds
  exactly `["comp3tive-b12c14230adf"]` and 23 precached entries afterwards.
- **The version is derived from deployed bytes** — recomputed from the live origin, matches.
- **A stale cache is purged, and only ours** — a `comp3tive-deadbeefdead` cache and a foreign
  `some-other-app-cache` are planted from the Landing Page (which never registers a worker), then the
  app's first load installs and activates: the stale `comp3tive-` key is gone and the foreign one is
  untouched, which is `public/sw.js`'s own rule ("reaching outside its own name").

The first draft of that last test **re-registered an unchanged worker and asserted a purge that could
not have happened** — the browser byte-compares the script, finds it identical, and never fires
`activate`. It failed, and the fix was to plant the caches before the genuine *first* install. That
correction is in the spec's own comments, because the next person to reason about the purge will make
the same mistake.

**What is still yours, and it is Phase E's, not a gate.** A **custom domain** is needed before any
passkey is registered: a `*.workers.dev` host is on the Public Suffix List's private section, so it
can never share a credential with a custom domain (`docs/adr/0008-account-identity.md`). That is a
decision for the Account phase, not a blocker on a deploy that is already live and already serving
the offline claim. `wrangler.jsonc` now records the live name and origin and says so.

**4. Merge — CLOSED.** PR #5 merged as `9e6a4a3`, `git ls-remote origin 'refs/pull/*'` shows five
PRs and `refs/pull/5/head` is `497aa8b`, which is an ancestor of `master`; there are **0 open PRs** and
`master` is level with `origin/master`. Everything after it — `d98b95c`, `af3828e`, `8d459cd`,
`eab22bf`, `3297156`, `cc111e5`, `a6c341f`, `3683974` — is on `master` already. **The PR body at
`.superpowers/sdd/2026-09-30-pr-body.md` is now dead weight**: it describes a review that happened.

---

## Real code — 3 items, all landed

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
| **The 32 unclaimed `App.tsx` lines** | **Closed 2026-10-13 — they were examined, and they were three cohesive behaviours.** | The row is kept for its lesson rather than deleted, because the correction is the useful part: "left unexamined, on purpose" was true of the *number* and false of the *file*. Of 513 lines, 28 were blank and 57 comment-only — **428 code lines**, not 513 of code. Three self-contained behaviours were still in the component: the store writes and their toasts, the pre-community adoption effect, and the theme/layout DOM binding. Each moved to its own hook. **`wc -l src/App.tsx` is now 391**, and nothing was a style change: 117/117 browser, 788/788 unit, `tsc -b` clean. The lesson: **a line count is a proxy, and re-reading what the lines *are* is the only thing that can settle it** — the same reading-not-running rule D3 states above, one level down. |
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

## A suggested order — **updated 2026-10-13, third pass**

**Day 1 and Day 2 and Day 3 are done, and so are the two gates that had no owner.** Every item this
file listed has been either closed with evidence or is one of the four decisions. What is left is
below, and for the first time there is nothing here that needs you before an agent can start it.

**Gates 2 and 3 — CLOSED 2026-10-13.** The production hostname was never missing:
`https://comp3tive.dimasawardhana.workers.dev/` was live the whole time, serving `master` at
`3683974` byte-identically, and `wrangler.jsonc`'s `"name"` was the real Worker name this file kept
calling a placeholder. Gate 2's answer is that the host sends **no `Vary`** anywhere, so the
`ignoreVary` fix is harmless rather than load-bearing. Gate 3's is that the offline claim holds **on
the deployed origin**: a whole tournament with the network cut, a version recomputed from the live
bytes, and a stale cache purged. Evidence and commands are in the gates section above; the
re-runnable proof is `npx playwright test --config=e2e/live.playwright.config.ts`.

**The last open code row — CLOSED 2026-10-13.** Debt 26's `wc -l src/App.tsx` is **391**, under the
400 criterion stated here, in `contracts.md:180` and in the ticket. Of the 513 lines, 28 were blank
and 57 comment-only — **428 code lines** — and three self-contained behaviours were still in the
component. They are now `src/shell/useAppCommands.ts`, `src/shell/useLegacyAdoption.ts` and
`useThemeAndLayout` in `src/shell/usePreferences.ts`. **No e2e spec was edited: 117/117 browser,
788/788 unit, `tsc -b` clean.** The phase ledger's own rule — *a region's line cost is its read set,
not its length* — is why the one-to-three-line navigation closures were left alone; moving them
would have bought nothing.

**Phase E's plan — WRITTEN 2026-10-14 (TASK-108).** Six tickets, two ADRs and a spec existed; the
plan did not, and `docs/superpowers/plans/2026-09-28-account-and-durability.md` is now that file —
the last thing this repo had agreed to do and the last with a phase-sized estimate attached. Writing
it also **froze `contracts.md` §4's "Created by E" row**, which had read *"Not yet frozen — the names
are Phase E's plan to freeze"*; the ticket that asked for the plan was gated on that row, so the two
landed together rather than the plan freezing shapes nobody had recorded. **That closes every item
this file names**: A–D shipped in full, all four gates closed, and E now has its plan.

**The one thing Phase E must decide that a deploy did not settle:** a **custom domain**. A
`*.workers.dev` host cannot share a passkey with a custom domain, so the canonical origin has to be
chosen before any credential is registered. That is the residue of the "production hostname" this
file chased for two weeks — the *origin* was never unknown, only the canonical one Phase E needs.

**Done, and worth saying so:** every user-facing bug this file named is fixed, D1's tracker is
retired, the roadmap spec can be read for what it is supposed to answer, **CI has been green since
2026-09-28**, and **the app is deployed and its offline claim is proved against the deployment**.

**One thing worth doing before anything else:** copy `.superpowers/` off this machine. It holds the per-task
briefs, the reports, the ~46 `CORRECTION` blocks' reasoning and the record of which of my premises
were wrong. It is gitignored, so it is on exactly one disk, and `git log` reconstructs what changed
without reconstructing why.
