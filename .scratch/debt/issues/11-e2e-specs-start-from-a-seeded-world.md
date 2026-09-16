# 11: e2e specs start from a seeded world

**Status:** ready-for-agent

**What to build:** Every spec begins from a known world — the community, players and records it needs already in place — instead of building that world by clicking through the UI before the test starts. The suite stops depending on the create-community flow and stops duplicating fixture setup in every file.

**Evidence (absorbed from `.scratch/app-health/issues/15`).** Of 20 spec files, exactly **one** seeds deterministically: `e2e/tests/dashboard/dashboard.spec.ts` builds a `SeedWorld` and serializes it into an `addInitScript` that opens `comp3tive` at version 6 (matching `DB_VERSION`, `src/storage/indexed-db.ts:18`), creates the six object stores, writes the rows, and pins `localStorage["tb-community"]`. The other 19 drive the UI to construct their fixture — create a community by clicking, add players one at a time through a modal, then navigate. `match-setup/setup.spec.ts:19-31` does 4 modal round-trips per run; `panel/no-overlap.spec.ts:18-30` does 15. Thirteen spec files click `getByTitle("New community")`.

The audit calls the seeding pattern "the model worth keeping — it is the only spec that controls its world instead of clicking its way to one."

**Acceptance criteria:**
- [ ] `e2e/support/seed.ts` (created by ticket 01) is **extended, not duplicated** — no second seeding module exists
- [ ] **`DB_VERSION` is derived, not copied.** `src/storage/indexed-db.ts:18` becomes `export const DB_VERSION = 6` (it is module-private today), and `e2e/support/seed.ts` imports it and embeds the value in the generated init script, so a future bump changes one number in `src/` and the helper follows. A hard-coded `6` in test support is the same staleness class this phase exists to remove. Verified during design that a spec importing across into `src/` typechecks under `tsc -b` with ticket 01's project reference, and that `indexed-db.ts` is safe to import from the Node process Playwright runs specs in: it touches `indexedDB` only inside function bodies (`:33`, `:65`, `:101`, `:148`) and at module scope only binds constants and a `Map`. No `src/` module other than this one is imported by the helper
- [ ] **Player capabilities pass through.** Today `dashboard.spec.ts:62-66` overwrites every player's capabilities with one canned `mlbbCap`; the helper writes each `players` row as given and defaults to `mlbbCap` only when a row carries no `capabilities`, so `dashboard.spec.ts`'s behaviour is preserved while futsal-capable and deliberately-malformed players become seedable
- [ ] `gotoHubSeeded(page, world, hub)` = `gotoSeeded` + `hubButton(page, hub).click()` + assert `.screen h1` is visible
- [ ] The helper is generalised to seed a community, players with capabilities, a session, a tournament and a saved squad — the five `SeedWorld` collections plus the pinned active community
- [ ] **11 spec files move to seeding**: `discipline`, `history`, `match-setup/setup`, `panel/no-overlap`, `settings-panel/viewport`, `split-flow/split`, `squads/saved-squad`, `tournament/create`, `tournament/draft`, `tournament/split-tourney`, and `dashboard` itself (which switches from its local copy to the shared helper)
- [ ] **The two community specs keep clicking** — `community/community.spec.ts` and `community/cancel-dropdown.spec.ts` exist to test the create-community form; seeding is for preconditions, never for the setup path being tested
- [ ] Each moved spec still asserts what it asserted before: no assertion is weakened, dropped or reordered while its world changes
- [ ] `localStorage["tb-community"]` is pinned by the helper, so a spec switches community by clicking only when switching community is what it is testing
- [ ] **The wall-clock claim is measured honestly, and the audit's 7.1 min is not used as the baseline.** Fourteen tests waiting out a 30 s click timeout is 14 × 30 s = 7.0 min by itself, leaving almost nothing for the 25 tests that passed — so that figure is retry timers, not suite cost. The two numbers compared are the **green pre-seeding baseline** (recorded after tickets 01 and 02 land) and the **green post-seeding run**; both go in the ticket's closing comment
- [ ] `workers` is either raised above 1 without flakiness, or the ticket records **precisely** which shared record prevents it. Guessing is not acceptable; `workers: 1` stays the default until a measurement says otherwise
- [ ] `npx playwright test --config=e2e/playwright.config.ts` passes with the same real coverage

**The helper's additions**, so the sweep has one shape to follow:

```ts
// e2e/support/seed.ts (extended by this ticket)
import { DB_VERSION } from "../../src/storage/indexed-db";

/** Every player gets this capability unless the row carries its own. */
const DEFAULT_CAP = { disciplineId: "mlbb", attributeRatings: { mechanics: 4, "game-sense": 4, "hero-pool": 4, teamwork: 4 }, eligibleRoles: ["tank","assassin","mage","marksman","fighter"], preferredRole: null };

export function seedScript(world: SeedWorld): string {
  const players = world.players.map((p) => p.capabilities ? p : { ...p, capabilities: [DEFAULT_CAP] });
  // …same init script as today, but `indexedDB.open("comp3tive", ${DB_VERSION})`
}

export async function gotoHubSeeded(page, world, hub) {
  await gotoSeeded(page, world);
  await hubButton(page, hub).click();
  await expect(page.locator(".screen h1")).toBeVisible();
}
```

A spec's setup then reads as one line of intent instead of fifteen modal round-trips:

```ts
await gotoHubSeeded(page, tenFutsalPlayers(), "Roster");
```

**What each swept spec seeds** (so no spec is left clicking its fixture):

| Spec | World it needs |
|---|---|
| `discipline/discipline.spec.ts` | one community, no players |
| `history/history.spec.ts` | one community, one session |
| `match-setup/setup.spec.ts` | one community, 2 players with a futsal capability |
| `panel/no-overlap.spec.ts` | one community, 15 players (the row stack it scrolls) |
| `settings-panel/viewport.spec.ts` | one community, no players |
| `split-flow/split.spec.ts` | one community, no players |
| `squads/saved-squad.spec.ts` | one community, 10 MLBB players with distinct preferred roles |
| `tournament/create.spec.ts` | one community, no players |
| `tournament/draft.spec.ts` | one community, 4 players |
| `tournament/split-tourney.spec.ts` | one community, 4 futsal players |
| `dashboard/dashboard.spec.ts` | its existing worlds, now via the shared helper |

**Blocked by:** 01 (the helper, the re-anchor and the seed recovery), 02, 09 (the prune changes which specs exist to be swept), 10 (CI must be the thing that catches a regression introduced by the sweep)

**Notes:** A hard-coded DB version in a shared helper is a new kind of staleness — better to derive it from the source than to repeat the number. The dashboard seeding pattern's own doc comment (`e2e/tests/dashboard/dashboard.spec.ts:1-19`) documents the store-key ordering and the `tb-community` key, and that knowledge moves into the helper with the code.
