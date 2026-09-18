# 15 — e2e specs start from a seeded world

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

**Status:** ready-for-agent

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
this ticket. As of 2026-09-18 that successor has **not** run: `e2e/support/seed.ts` exists and
`dashboard.spec.ts`-style seeding is not yet generalised across the suite, so this work is genuinely
outstanding and this ticket has deliberately not been resolved.
