# 15 — e2e specs start from a seeded world

> **Superseded.** The live copy of this ticket is
> [`debt/11`](../../debt/issues/11-e2e-specs-start-from-a-seeded-world.md). This file is history; see
> [`.scratch/app-health/README.md`](../README.md) for the pairing of all sixteen.

**What to build:** Every spec begins from a known world — the community, players and records it needs
already in place — instead of building that world by clicking through the UI before the test starts.
The suite stops depending on the create-community flow, stops duplicating fixture setup in every
file, and gets faster.

**Evidence.** Of 19 specs, exactly **one** seeds deterministically:
`e2e/tests/dashboard/dashboard.spec.ts` builds a `SeedWorld` object and serializes it into an
`addInitScript` that opens `comp3tive` at version 6 (matching `DB_VERSION`), creates the six object
stores, writes the rows, and pins `localStorage["tb-community"]` — then every test starts from a
known world.

The other 18 specs drive the UI to construct their fixture: create a community by clicking, add
players one at a time through a modal, then navigate. That is slower, duplicates the same setup in
every file, and makes the whole suite fail whenever the create-community flow breaks — for reasons
that have nothing to do with what those specs assert.

The analysis calls this pattern "the model worth keeping — it is the only spec that controls its
world instead of clicking its way to one."

**Blocked by:** `.scratch/app-correctness/05` (which prunes the dead specs and untracks the report
artifacts) and `.scratch/landing-page/06` (which re-anchors every spec to `/app`). Both change the
spec files this ticket rewrites; landing it first guarantees a conflict.

**Status:** resolved

- [ ] The seeding helper is shared — one module, not a copy per spec — and generalised enough to seed
      what the specs actually need (a community, players with capabilities, a session, a tournament,
      a saved squad)
- [ ] Every spec that currently clicks its way to a fixture uses the shared helper instead
- [ ] Each spec still asserts what it asserted before: no assertion is weakened or dropped while
      moving to seeding
- [ ] `localStorage["tb-community"]` is pinned by the helper, so a spec does not have to switch
      community by clicking
- [ ] The suite passes, with the same real coverage, and a measurably shorter wall-clock run
- [ ] A spec that genuinely tests the create-community flow still does so by clicking — seeding is for
      setting up a precondition, not for testing the setup path
- [ ] `workers` can be raised above 1 without flakiness, or the ticket records precisely which shared
      state prevents it

**Design reference:** `e2e/tests/dashboard/dashboard.spec.ts` — its `SeedWorld` + `addInitScript`
pattern is the one to generalise.

**Notes:** The DB version in the seed script must track `DB_VERSION` from `src/storage/indexed-db.ts`.
It is 6 today, and the analysis flags that a hard-coded copy in a shared helper is a new kind of
staleness — better to derive it from the source than to repeat the number.

**Possible split.** This may be two tickets once the sweep is scoped: the helper plus the specs in
one directory, then the rest. Decide when you can see how many specs actually need seeding versus how
many need only a community. Do not force it into one ticket if it does not fit one context window.

## Comments

Absorbed into Phase A of the debt repayment effort as
`.scratch/debt/issues/11-e2e-specs-start-from-a-seeded-world.md`. Status left as-is; do not start
this ticket. As of `88d45e8` ("test: seed every spec deterministically") that successor has run; see
`.scratch/debt/issues/11-e2e-specs-start-from-a-seeded-world.md`. Ticket 12's rule left this ticket's
status as-is, so it still reads `ready-for-agent` — that is bookkeeping, not outstanding work.

**Re-checked 2026-10-01 against `d98b95c`, against this ticket's own acceptance rows rather than
against debt 11's status — shipped. Resolved.**

The comment above is right that the stale status was bookkeeping rather than outstanding work.
What it did not do was check. Checked:

- Row 1 holds: `e2e/support/seed.ts` is the one seeding module, and it generalises past this
  ticket's original `SeedWorld` — `gotoSeeded` / `gotoHubSeeded` / `seedScript` (`:81,118,139`)
  plus ready-made worlds (`tenFutsalPlayers`-style builders, `teamOf`, `splitOf`).
- Row 4 holds, and the Notes' warning about staleness was heeded: `DB_VERSION` is **imported**
  from `src/storage/indexed-db.ts` and re-exported (`e2e/support/seed.ts:31,34`), not copied, so
  the harness cannot drift from the app's schema.
- Row 2 holds: **28 of the 31 spec files** now seed through the helper. The three that do not
  are `community/community.spec.ts` and `community/cancel-dropdown.spec.ts`, which row 6
  explicitly exempts — they test the create-community flow by clicking it — and
  `landing/landing.spec.ts`, which deliberately bypasses the suite's `baseURL` because it
  asserts the `/` versus `/app/` boundary itself.
- Row 3 cannot be checked from the tree and is not claimed here: that no assertion was weakened
  while moving to seeding is a record of the diff, not a state. `git log` on
  `e2e/tests/**` is where that argument lives.
- Row 5's wall-clock half is recorded in debt 11's ledger rather than in code: the audit baseline
  was 7.1 min with 16 specs timing out, and the branch ended at 43 passed / 0 failed.

**One acceptance row took a third answer, and the ticket's own wording is why that needs saying.**
Row 7 offers two branches: raise `workers` above 1, *or* record precisely which shared state
prevents it. Neither happened. `e2e/playwright.config.ts:7` is still `workers: 1`, and nothing
blocks raising it — debt 11 measured `workers: 2` green three times (29.3 s, 31.0 s, 29.9 s
against roughly 60 s at 1) and left it at 1 anyway, because changing the suite's execution model
was outside that phase's exit criterion. The honest reading of row 7 today is: nothing prevents
it, and nobody has taken the decision. That is a live item, not a closed one, and it lives on
debt 11.
