# What remains, and in what order

**Branch:** `feature/revamp` — 131 commits ahead of `master`, fully pushed, 764 unit / 109 e2e green.
**Scope:** everything outstanding **except Phase E** (the optional Account), which is specified in
`.scratch/backend/spec.md` with six tickets and belongs to the next iteration.

**Estimates are for one engineer with agent help, and they are estimates.** They are drawn from how
the equivalent work actually went on this branch, not from a guess. Anything marked *yours* is a gate
only you can pass, and **two of them are on the critical path** — no amount of work below shortens the
wait for them.

---

## The short version

Of the four phases, **A, B, C and D have all shipped.** What is left is:

| | Items | Kind |
|---|---|---|
| **Gates** | 4 | **yours** — CI, deploy, the offline claim, the merge |
| **Real code** | 2 | one button; one sweep |
| **Records** | 3 tracks | no code; a lying tracker, two stale statuses, an empty phase list |
| **Deliberately not doing** | 4 | recorded, with the reason |

**Only two items are actual engineering.** Everything else is either a gate you own or a record that
does not describe reality — and the records are worth fixing because this branch is a history of
records that lied, in both directions.

---

## The critical path is yours, not mine

```
  ┌─ CI green on feature/revamp ──────────────┐
  │                                           ├─► open + merge the PR ──► done
  └─ real deploy ─► verify offline claim ─────┘
```

**1. CI green.** The entire verification story for 131 commits is "I ran it on one machine". There is
an open PR adding the workflow; until it runs, nothing here has been verified by anything but me and
subagents. *Blocking, yours.*

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

**4. Merge.** The PR body is at `.superpowers/sdd/2026-09-30-pr-body.md`; the branch can be sliced into
eight reviewable PRs at `3beadc5` / `866a586` / `4298b6e` if a 131-commit diff will not get read.

---

## Real code — 2 items

### R1 · Swap mode has no entry point — **~half a day**

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

### R2 · The "prop nobody passes" sweep — **~half a day**

The sweep that found swap mode covered *"a state nothing can turn on"* and explicitly **not** *"a prop
nobody passes"*. It did not sweep module-level flags, CSS-only states, or render gating outside
`.tsx`. Given the class turned out to be real, the second sweep is worth running before the next
refactor rather than after one.

Worth knowing how the first one behaved: **two attempts missed `swapMode` before the third found it** —
one counting only `setter(` syntax, so `onMatch={setRecording}` was invisible; one testing the gate
line-locally, so a handler defined outside the gate read as an outside entry. Only the brace-matched,
reference-counting version works. **Do not run the cheap one and trust it.**

---

## Records — 3 tracks, no code

### D1 · `app-health` is a superseded duplicate of the debt tracker — **~2 hours**

**13 of its 16 tickets read `ready-for-agent` and their work shipped.** They are the same work filed
twice: `01`↔debt 21, `02`↔22, `03`↔23, `05`↔24, `06`↔25, `07`↔26, `09`↔13, `10`↔27, `12`↔34, `14`↔28,
`15`↔11, `16`↔30.

The debt tracker was reconciled this session; **`app-health` never came up.** It is the same defect as
everything else on this branch, in the opposite polarity to ticket 16's: work that shipped, recorded
as unstarted. Either reconcile it against the debt tracker's outcome or delete it as superseded — and
say which, because two trackers for one work is how the first one got stale.

### D2 · Two stale statuses in `app-correctness` — **~30 minutes**

- `03-validate-players-at-the-boundary` — its own 2026-09-18 correction already says its premise went
  stale, and `validatePlayer` is wired in `transfer.ts` and `sample-data.validation.test.ts`. Verify
  and close.
- `06-reconcile-stale-docs` — this session did most of it (`0002`, 24 plan checkboxes,
  `docs/design.md`, `contracts.md`). D1 is the remainder. Close it when D1 lands.

### D3 · Tickets 26, 30, 38 and the roadmap's own phase list — **~1 hour**

- **26** — `splitFlowRule` is already a named, exported, tested rule at `useSplitFlow.ts:31` with its
  truth table pinned in `split-flow.test.ts:15-19`. The ticket's remaining ask is met; close it.
- **30** — README, `.nvmrc` and `engines` all exist. The remainder is CI, which is gate 1.
- **38** — the advisory shipped and the decision is recorded. Close it, or keep it open deliberately
  if the search-widening question is still live.
- **The roadmap spec's phase list greps empty.** `docs/superpowers/specs/2026-09-17-debt-repayment-roadmap-design.md`
  is the sequencing authority and its own phase table did not come back. Fix it — an authority that
  cannot be read is not one.

---

## Deliberately not being done, and why

| | |
|---|---|
| **The 32 unclaimed `App.tsx` lines** | Phase C's target was abandoned with the arithmetic minuted, but removing the accepted 41-line residual still leaves 32 over. **No review accepted them and no ticket scoped them.** Documented decision ≠ unexamined remainder. |
| **Collapsing the 4 surviving `?? "?"` sites** | Two are in `SplitScreen.tsx`, held by `contracts.md`. R1's amendment can carry them, or they can wait. |
| **`benchAdvice` silent on `NODE_BUDGET` pools** | A deliberate trade: a 4× render cost on the largest pools, and those are exactly the pools where the split is already unproven. Revisit if the advisory is ever wanted there. |
| **A second CI node version** | `.nvmrc` pins 24.16.0, `engines` allows `^22.20 \|\| ^24.12 \|\| >=25`, and CI runs `node-version: 22`. Not a defect today, but a local/CI version difference is worth a deliberate answer once the workflow runs. |

---

## A suggested order

**Day 1, yours:** open the PR, land CI, one `curl`, deploy, verify, merge. That is the whole critical
path and nothing below competes with it.

**Day 2, in any order:** ~~R1 (swap mode — was the only user-facing bug left)~~ **landed 2026-10-01,
see above** · D1 (`app-health`) · R2 (the prop sweep). **R1 was the last user-facing bug in this
file**, so the two that remain are both sweeps, and neither of them is something a user is waiting
on.

**Day 3:** D2, D3, and a decision on the four "not doing" rows above — because a row that is
deliberately not being done needs to be a decision, not a drift.

**One thing worth doing before Day 2:** copy `.superpowers/` off this machine. It holds the per-task
briefs, the reports, the ~46 `CORRECTION` blocks' reasoning and the record of which of my premises
were wrong. It is gitignored, so it is on exactly one disk, and `git log` reconstructs what changed
without reconstructing why.
