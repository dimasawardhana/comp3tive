# Truth and Trust Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the product stop lying about what it does. The browser suite currently passes 25 of 42 tests against a layout the app no longer ships, so it cannot gate anything; behind that red suite sit a re-roll that does not re-roll, deletes that do not delete, a Swiss pairing that schedules rematches, an import that silently drops data, and no CI.

**Architecture:** Phase A's durable artefact is one shared e2e helper, `e2e/support/seed.ts`, which seeds IndexedDB directly and navigates by a hub's accessible name. Every failure is repaired by changing the code or the assertion that is wrong — never by weakening an assertion to fit. Product fixes are small and local: three delete handlers routed through their hooks, one re-roll that passes a variety counter, one strict validation call at the import boundary, one exhaustive Swiss pairing search, and one pure CSV module. `npx tsc -b` is extended to cover `e2e/**` so a misspelled hub becomes a compile error instead of a 30-second timeout.

**Tech Stack:** React 19, TypeScript 5.8, Vite 6, Vitest 3, Playwright 1.62, IndexedDB (no backend), Cloudflare static-assets Worker.

**Spec:** `docs/superpowers/specs/2026-09-17-truth-and-trust-design.md` — the tickets are `.scratch/debt/issues/01-*.md` through `12-*.md`. Executors read both: this plan argues from the spec.

## Global Constraints

Copied verbatim from the spec. Every task's requirements implicitly include this section.

- **Suite default viewport stays `1280×720`** (`e2e/playwright.config.ts:15`). Only `e2e/tests/panel/no-overlap.spec.ts` and `e2e/tests/settings-panel/viewport.spec.ts` pin `390×844` via a file-level `test.use({ viewport: { width: 390, height: 844 } })`, because the bottom bar is their subject.
- **`workers: 1` and `retries: 0` are not changed** (`e2e/playwright.config.ts:6-7`). Retries hide the class of debt this phase removes; A11 owns the workers measurement.
- **`hubButton` is exactly `page.getByRole("button", { name, exact: true })`** with `name` typed as the five-literal hub union. No spec may address a hub by index or by a layout-specific selector — ever again.
- **The nav buttons carry no `aria-label`, and none is added.** Their accessible name is their visible label because the icon span is `aria-hidden="true"` (`src/App.tsx:1273`). The suite is not made green by shipping redundant markup.
- **The `e2e` script is exactly** `"playwright test --config=e2e/playwright.config.ts"` — no `lint`, no `type-check`, no `coverage` alias may be added to `package.json` (Phase C30 edits that file's `engines`/`.nvmrc`).
- **No new dependency.** ADR-0001's client-only stance and the two-dependency `package.json` are load-bearing; the CSV parser is a state machine, not a library.
- **`VARIETY_TOLERANCE = 0.1`** (`src/solver/solver.ts:24`) is the knob that defines "fair but different". No assertion in Phase A reads `result.solver.optimal`.
- **A re-rolled split is never asserted to be proven minimal.** `varietySplit` stamps `optimal: false` (`src/solver/solver.ts:419`) but delegates to `fairSplit` at `:409` when it finds no candidate, and that fallback can return `optimal: true`. Phase B13 owns the copy and keys it on `result.solver.optimal`; A03 never writes that field.
- **`computeStrength` keeps throwing** (`src/domain/strength.ts:29-31`). A05 prevents reaching it and does not weaken it.
- **Unit tests only pick up `.ts`** — `vite.config.ts` sets `test.include: ["src/**/*.test.ts"]`. Any new testable module must be `.ts`, never `.tsx`.
- **e2e paths are relative to `e2e/`.** `e2e/playwright.config.ts:4` sets `testDir: "./tests"`, so a file argument is `tests/<group>/<file>.spec.ts`. A bare `e2e/tests/...` path finds zero tests.
- **Always rebuild `dist/` before trusting an e2e run**: `e2e/playwright.config.ts:17-22` starts `npm run preview`, and `vite preview` serves `dist/`, with `reuseExistingServer: true`.
- **Phase A owns `src/App.tsx` handler behaviour.** Phase C's decomposition lands after A and must preserve it exactly.
- **`sample-data/*.json` is Phase B's exclusive ownership.** Phase A never edits it. A05 *assumes* the invariant "every `sample-data/*.json` player passes `validatePlayer`"; ticket B20 establishes it.

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `e2e/support/seed.ts` | `SeedWorld`, `seedScript`, `gotoSeeded`, `gotoHubSeeded`, `hubButton`, plus the recovered `mlbbCap`/`teamOf`/`splitOf`/`statCard`/`statValue` fixtures. The phase's single durable artefact (A01, extended A11). |
| Create | `e2e/tsconfig.json` | Typechecks `e2e/**/*.ts` under `tsc -b`, so a misspelled hub is a compile error (A01). |
| Modify | `tsconfig.json` | Adds the `e2e` project reference (A01). |
| Create | `e2e/tests/shell/nav-layout.spec.ts` | Asserts each hub name resolves to exactly one visible control at both widths, and that Games lands on Games (A01). |
| Create | `e2e/tests/split/reroll.spec.ts` | Two Re-roll clicks render different teams; the badge reads `Roll #2` then `Roll #3` (A03). |
| Create | `e2e/tests/roster/delete-row.spec.ts` | Deleting a player removes the row without a reload and survives one (A04). |
| Create | `e2e/tests/shell/error-boundary.spec.ts` | A real render throw shows the boundary message, not a blank page (A05). |
| Create | `e2e/tests/roster/import-community.spec.ts` | A two-community v4 merge leaves every record in its own community (A06). |
| Create | `src/ErrorBoundary.tsx` | Catches a render throw; renders a message and a Reload action (A05). |
| Create | `src/data/player-import.ts` | Pure quoted-field CSV parser, discipline resolution, and size guard (A08). |
| Create | `src/data/player-import.test.ts` | Unit coverage for the parser, resolution and size guard (A08). |
| Create | `.github/workflows/ci.yml` | typecheck → unit → build → browsers → e2e, with no `continue-on-error` (A10). |
| Modify | `src/session/SplitScreen.tsx:255-264` | `reroll` passes a variety counter and draws from the session's own pool (A03, re-roll only). |
| Modify | `src/session/edit.test.ts` | Adds the `freshSplit` variety case (A03). |
| Modify | `src/App.tsx:482-484` | `deletePlayer` calls `roster.deletePlayer` and reports failure (A04). |
| Modify | `src/App.tsx:762-764` | `deleteTournament` calls `tournaments.deleteTournament` and reports failure (A04). |
| Modify | `src/App.tsx:1209` | The History row's `onDelete` calls `sessions.deleteSession` and reports failure (A04). |
| Modify | `src/App.tsx:426-433` | `handleImport` passes the catalog to `parseBackup` and reports via `notify` (A05). |
| Modify | `src/App.tsx:522-567` | The JSON players-only branch validates each candidate before saving (A05). |
| Modify | `src/App.tsx:455-461` | Drops the `communityId` override so a merge keeps each record's community (A06). |
| Modify | `src/App.tsx:515-520` | The size guard runs before `await file.text()` (A08). |
| Modify | `src/App.tsx:569-612` | The CSV branch delegates to `player-import.ts` and reports one summary line (A08). |
| Modify | `src/data/transfer.ts:95` | `parseBackup(text, disciplines?)` validates players when the catalog is supplied (A05). |
| Modify | `src/data/transfer.test.ts` | Adds the `parseBackup: player validation` block (A05) and the two-community round trip (A06). |
| Modify | `src/main.tsx` | Wraps `<App />` in `<ErrorBoundary>` inside `<StrictMode>` (A05). |
| Modify | `src/tournament/bracket.ts:162-185` | `pairRound` calls the new `selectPairing`; the rematch fallback is an explicit `legal === null` branch (A07). |
| Modify | `src/tournament/bracket.ts:302-314` | `standings` crowns by play; `team.strength` leaves the sort (A07). |
| Modify | `src/tournament/bracket.test.ts` | Adds the exhaustive pattern block, the 3-way-tie fixture, and pins the two pre-existing orders (A07). |
| Modify | `src/storage/indexed-db.ts:18` | `export const DB_VERSION = 6` so the helper derives it instead of copying it (A11). |
| Modify | `e2e/support/seed.ts` | Extended: derived `DB_VERSION`, capabilities pass-through, `gotoHubSeeded` (A11). |
| Modify | `package.json` | Gains exactly the `e2e` script (A10). |
| Modify | `.gitignore` | Gains `playwright-report/` and `test-results/` (A09). |
| Modify | 10 spec files | Re-anchored onto `hubButton`/`.screen h1` (A01, A02); 11 specs swept onto seeding (A11). |
| Modify | `e2e/tests/landing/landing.spec.ts:34` | Deletes the trivially-passing `.tabbar` assertion (A09). |
| Delete | `e2e/tests/tournament/inspect.spec.ts`, `inspect2.spec.ts`, `inspect3.spec.ts`, `journey.spec.ts` | Nav-dependent specs that assert nothing (A09, sequenced into Task 1). |
| Delete | `e2e/tests/tournament/review.spec.ts` | A `test.skip` claiming coverage (A09). |
| Delete | `e2e/pages/base.page.ts`, `e2e/pages/split.page.ts` | Zero consumers (A09). |
| Delete | `e2e/tests/panel/no-overlap.spec.ts:31-35` | The `.app` padding assertion for a fixed bar that no longer exists (A02). |
| Untrack | `playwright-report/index.html`, `test-results/.last-run.json` | `git rm --cached`; both stay on disk (A09). |
| Modify | `.scratch/team-builder/dashboard/issues/01..07`, `.scratch/app-correctness/issues/01..05`, `.scratch/app-health/issues/04,08,11,15` | Ticket files only; no product code (A12). |

Not touched by Phase A: `src/solver/**`, `src/index.css`, `index.html`, `src/landing.tsx`, `sample-data/*.json`, `e2e/playwright.config.ts`, and every `docs/**` file other than the spec.

---

### Task 1: The suite is green against the shipped layout (A01 + A02 + the four dead nav specs from A09)

This is the phase's reason for existing. The suite is red because it is pinned to a layout that no longer exists: `src/index.css:1677-1679` sets `.bottom-nav { display: none; }` inside `@media (min-width: 1024px)` (`:1674`), while `e2e/playwright.config.ts:15` runs every spec at `1280×720`. Fourteen spec files navigate through `page.locator(".bottom-nav .nav-link")`, so the locator resolves but is not visible and `.click()` retries to the 30 s timeout.

**Files:**
- Create: `e2e/support/seed.ts`
- Create: `e2e/tsconfig.json`
- Create: `e2e/tests/shell/nav-layout.spec.ts`
- Modify: `tsconfig.json`
- Delete: `e2e/tests/tournament/inspect.spec.ts`, `e2e/tests/tournament/inspect2.spec.ts`, `e2e/tests/tournament/inspect3.spec.ts`, `e2e/tests/tournament/journey.spec.ts`
- Modify: `e2e/tests/dashboard/dashboard.spec.ts:1-118` (delete the local seed block), `:110-111`, `:132-150`, `:155-161`, `:505`
- Modify: `e2e/tests/tournament/create.spec.ts:14`, `e2e/tests/tournament/draft.spec.ts:14`, `e2e/tests/tournament/split-tourney.spec.ts:23,31`
- Modify: `e2e/tests/discipline/discipline.spec.ts:8`, `e2e/tests/history/history.spec.ts:14`
- Modify: `e2e/tests/squads/saved-squad.spec.ts:67,83,97`
- Modify: `e2e/tests/split-flow/split.spec.ts:20`
- Modify: `e2e/tests/panel/no-overlap.spec.ts:3,5,31-43`
- Modify: `e2e/tests/settings-panel/viewport.spec.ts:3,14-23`

**Interfaces:**
- Consumes: `src/App.tsx:62-68` (`NAV_ITEMS`, five labels `Home`, `Roster`, `Games`, `History`, `Squads`); `src/domain/useCommunities.ts:6` (`ACTIVE_KEY = "tb-community"`); the IndexedDB database name `"comp3tive"` and version `6` (`src/storage/indexed-db.ts:12,18`).
- Produces: `e2e/support/seed.ts` exporting `SeedWorld`, `seedScript(world): string`, `gotoSeeded(page, world): Promise<void>`, `gotoHubSeeded(page, world, hub): Promise<void>`, `hubButton(page, name): Locator`, and the fixtures `mlbbCap`, `teamOf`, `splitOf`, `statCard`, `statValue`. Task 3–6 and Task 10 consume all of them. `HubName` is the five-literal union.

**Why 10 spec files change and not 14.** `grep -rl "bottom-nav" e2e/tests/` returns exactly 14 files. Four of them — `inspect`, `inspect2`, `inspect3`, `journey` — are deleted by A09 in this task before the re-anchor, so the re-anchor touches **10**. The suite's spec count changes because of those deletions, not because of the re-anchor.

- [ ] **Step 1: Observe the failure you are about to fix**

Run: `npx playwright test --config=e2e/playwright.config.ts tests/tournament/create.spec.ts`
Expected: FAIL after ~30 s with `locator.click: Test timeout of 30000ms exceeded` and `element is not visible`, after `locator resolved to <button type="button" class="nav-link ">…</button>`.

- [ ] **Step 2: Delete the four nav-dependent specs**

These are the four of the fourteen that assert nothing (2–3 assertions each, all "`.app` is visible"; `inspect3.spec.ts` also fabricates state by hand). Deleting them first makes A01's edit count stable at 10.

```bash
rm e2e/tests/tournament/inspect.spec.ts \
   e2e/tests/tournament/inspect2.spec.ts \
   e2e/tests/tournament/inspect3.spec.ts \
   e2e/tests/tournament/journey.spec.ts
```

- [ ] **Step 3: Create `e2e/tsconfig.json`**

A referenced project with `noEmit: true` and no `composite` builds cleanly under `tsc -b`, and a type error inside it fails the build with exit code 2. It needs its own `tsBuildInfoFile` so it does not collide with `tsconfig.app.json`'s, which points at `./node_modules/.tmp/`.

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.e2e.tsbuildinfo",
    "target": "ES2022",
    "lib": ["ES2024", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["node"]
  },
  "include": ["**/*.ts"]
}
```

`noUnusedLocals` stays `false` here: the specs keep unused locals, and Phase C turns that flag on for `src` only, where dead code actually accumulates.

- [ ] **Step 4: Reference the new project from the root config**

Replace the whole of `tsconfig.json`:

```json
{"files":[],"references":[{"path":"./tsconfig.app.json"},{"path":"./tsconfig.node.json"},{"path":"./e2e/tsconfig.json"}]}
```

- [ ] **Step 5: Prove the typecheck guard actually covers the specs**

Run: `npx tsc -b`
Expected: exit 0, no diagnostics. Three projects now build: `src`, `vite.config.ts`, and `e2e/**/*.ts`.

- [ ] **Step 6: Prove the guard can fail**

Append a deliberate error to a spec, run the build, then revert.

```bash
printf '\nexport const deliberate: number = "not a number";\n' >> e2e/tests/tournament/create.spec.ts
npx tsc -b; echo "exit=$?"
git checkout e2e/tests/tournament/create.spec.ts
```

Expected: `e2e/tests/tournament/create.spec.ts(...): error TS2322: Type 'string' is not assignable to type 'number'.` then `exit=2`. This is what makes a misspelled hub name a compile error instead of a 30 s timeout.

- [ ] **Step 7: Create the shared helper `e2e/support/seed.ts`**

`seedScript`/`gotoSeeded` are recovered from the working implementation at `e2e/tests/dashboard/dashboard.spec.ts:65-108`. The doc comment moves with the code: store-key ordering, newest-last, `tb-community`, and the deliberately-empty discipline catalog (`useDisciplines` restores `SEED_DISCIPLINES` when the catalog is empty, `src/domain/useDisciplines.ts:18-22`).

```ts
/**
 * Shared e2e world-building (ticket 01, extended by ticket 11).
 *
 * Every spec seeds a known world directly through IndexedDB in `addInitScript`,
 * so it lands before app code reads the stores. Shape notes the seeds rely on:
 * - All stores live in one database ("comp3tive"), one object store per
 *   aggregate, keyed by id. Object-store keys are written in the order the app
 *   expects its lists: communities by creation (first-created = first item),
 *   players/sessions/squads/tournaments newest LAST, so the app's newest-first
 *   sort puts the newest FIRST.
 * - localStorage "tb-community" pins the active community; an unknown value
 *   makes the app fall back to the first community in list order.
 * - The discipline catalog is deliberately left empty: useDisciplines restores
 *   SEED_DISCIPLINES when the catalog is empty.
 */
import { test, expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

/** The five hub destinations, matching NAV_ITEMS (src/App.tsx:62-68). */
export type HubName = "Home" | "Roster" | "Games" | "History" | "Squads";

export interface SeedWorld {
  communities: { id: string; name: string; createdAt: number }[];
  /** Roster players, newest last. */
  players: Array<Record<string, unknown>>;
  /** Sessions (history rows), newest last. */
  sessions: Array<Record<string, unknown>>;
  /** Tournaments (draft/active count on the dashboard), newest last. */
  tournaments: Array<Record<string, unknown>>;
  /** Saved squads, newest last. */
  squads: Array<Record<string, unknown>>;
  /** id of the community the app should treat as active. */
  activeCommunityId: string;
}

/** The mlbb discipline id is stable: futsal and mlbb are seeded in key order. */
export const MLBB_ID = "mlbb";

export const mlbbCap = {
  disciplineId: MLBB_ID,
  attributeRatings: { mechanics: 4, "game-sense": 4, "hero-pool": 4, teamwork: 4 },
  eligibleRoles: ["tank", "assassin", "mage", "marksman", "fighter"],
  preferredRole: null,
};

/** One split team with a real player on it; the ledger only needs ids. */
export const teamOf = (index: number, playerId: string) => ({
  index,
  slots: [{ playerId, roleId: index === 0 ? "tank" : "assassin" }],
  totalStrength: 16,
  avgStrength: 4,
});

/** A minimal fair-split result; the dashboard never reads past the shape. */
export const splitOf = (playerIds: string[]) => ({
  teams: playerIds.map((id, i) => teamOf(i, id)),
  gap: 0,
  flags: [],
  unassigned: [],
  solver: { optimal: true, nodesExplored: 0, elapsedMs: 0 },
});

/** Turn a world into an init script that seeds IndexedDB before app code runs. */
export function seedScript(world: SeedWorld): string {
  const players = world.players.map((p) => ({
    id: p.id,
    communityId: p.communityId,
    name: p.name,
    capabilities: [mlbbCap],
  }));
  const db = {
    communities: world.communities,
    players,
    sessions: world.sessions,
    tournaments: world.tournaments,
    "saved-squads": world.squads,
  };
  return `(() => {
    const STORES = ["communities", "players", "sessions", "tournaments", "saved-squads", "disciplines"];
    const request = indexedDB.open("comp3tive", 6);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: "id" });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      localStorage.setItem("tb-community", ${JSON.stringify(world.activeCommunityId)});
      for (const [storeName, rows] of Object.entries(${JSON.stringify(db)})) {
        if (!rows.length) continue;
        const tx = db.transaction(storeName, "readwrite");
        for (const row of rows) tx.objectStore(storeName).put(row);
      }
      db.close();
    };
    request.onerror = () => console.error("seed failed");
  })();`;
}

/** Seed a world, then load the app (which lands on the Dashboard). */
export async function gotoSeeded(page: Page, world: SeedWorld): Promise<void> {
  await page.addInitScript(seedScript(world));
  await page.goto("./");
  await expect(page.locator(".app")).toBeVisible({ timeout: 15000 });
}

/**
 * Click a hub by its accessible name. Each nav button's accessible name IS its
 * visible label: the icon span carries aria-hidden="true" (src/App.tsx:1273), so
 * the glyph is excluded. Exactly one element matches per name at both widths,
 * because the inactive layout is display: none and therefore absent from the
 * accessibility tree (src/index.css:1677-1679). No media-query awareness, no
 * nth() index — and so no index left to go stale.
 */
export function hubButton(page: Page, name: HubName): Locator {
  return page.getByRole("button", { name, exact: true });
}

/** Seed, then load the app, then land on a hub by its accessible name. */
export async function gotoHubSeeded(page: Page, world: SeedWorld, hub: HubName): Promise<void> {
  await gotoSeeded(page, world);
  await hubButton(page, hub).click();
  await expect(page.locator(".screen h1")).toBeVisible();
}

/** The stat card on the Dashboard whose label matches <label>. */
export const statCard = (page: Page, label: string) =>
  page.locator(".dashboard-stat", { has: page.locator(".tournament-meta-card-label", { hasText: label }) });

export const statValue = async (page: Page, label: string): Promise<string> =>
  (await statCard(page, label).locator(".tournament-meta-card-value").innerText()).trim();
```

- [ ] **Step 8: Create `e2e/tests/shell/nav-layout.spec.ts`**

This is the guard that replaces the whole class of bug. It is green on creation — the invariant already holds — and its job is to fail loudly and in one place if a future breakpoint change puts both navs into the accessibility tree, instead of timing out in ten.

```ts
/**
 * The navigation invariant every other spec depends on: a hub name resolves to
 * exactly one visible control, in whichever layout that width ships.
 */
import { expect, test } from "@playwright/test";
import { hubButton, type HubName } from "../../support/seed";

const HUBS: HubName[] = ["Home", "Roster", "Games", "History", "Squads"];

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 390, height: 844 },
]) {
  test(`each hub resolves to exactly one control at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("./");
    await expect(page.locator(".app")).toBeVisible({ timeout: 15000 });

    for (const hub of HUBS) {
      // A strict-mode violation here means both navs are in the accessibility
      // tree at this width: one helper is no longer correct for both layouts.
      await expect(hubButton(page, hub)).toHaveCount(1);
      await expect(hubButton(page, hub)).toBeVisible();
    }

    await hubButton(page, "Games").click();
    await expect(page.locator(".screen h1")).toHaveText("Games");
  });
}
```

- [ ] **Step 9: Run it to verify the invariant holds at both widths**

Run: `npx playwright test --config=e2e/playwright.config.ts tests/shell/nav-layout.spec.ts`
Expected: `2 passed`. If either fails with a strict-mode violation, stop: the accessible-name match is not unique at that width and the whole approach needs rethinking before proceeding.

- [ ] **Step 10: Re-anchor the three tournament specs**

In each of `create.spec.ts`, `draft.spec.ts`, `split-tourney.spec.ts`, delete the community-creation lines and the nav click, and replace them with seeding. `create.spec.ts` becomes:

```ts
import { test, expect } from "@playwright/test";
import { gotoHubSeeded, type SeedWorld } from "../../support/seed";

const world = (): SeedWorld => ({
  communities: [{ id: "comm-create", name: "Create Test", createdAt: 100 }],
  players: [],
  sessions: [],
  tournaments: [],
  squads: [],
  activeCommunityId: "comm-create",
});

test("tournament create: sectioned modal with previews and constraints", async ({ page }) => {
  await gotoHubSeeded(page, world(), "Games");
  await page.locator("button:has-text('+ New tournament')").click();
  // ...the rest of this test's assertions are unchanged from here on.
});
```

`draft.spec.ts` and `split-tourney.spec.ts` take the same shape, with `world()` carrying the players each needs: `draft.spec.ts` needs 4 players, `split-tourney.spec.ts` needs 4 futsal-capable players (until Task 10 sweeps it onto explicit capabilities, the helper's `mlbbCap` default is what these specs already behave under). Every assertion after the navigation is preserved verbatim.

In `split-tourney.spec.ts`, also replace `page.locator(".tournament-header h1")` at `:31` with `page.locator(".screen h1")`: `.tournament-header` no longer exists in markup — `TournamentScreen` renders `PageHeader` (`src/tournament/TournamentScreen.tsx:262-276`), which emits `.page-header h1`. The only `.tournament-header` rules left are orphaned CSS at `src/index.css:2560` and `:2567`.

- [ ] **Step 11: Re-anchor the discipline, history and split-flow specs**

`discipline.spec.ts:8` and `history.spec.ts:14` replace their `nth()` nav clicks. `discipline.spec.ts` needs no community at all — its world is one community and no players:

```ts
import { test, expect } from "@playwright/test";
import { gotoHubSeeded, type SeedWorld } from "../../support/seed";

const emptyWorld = (): SeedWorld => ({
  communities: [{ id: "comm-discipline", name: "Discipline Test", createdAt: 100 }],
  players: [],
  sessions: [],
  tournaments: [],
  squads: [],
  activeCommunityId: "comm-discipline",
});

test("discipline: layout padding + list refreshes after creation", async ({ page }) => {
  await gotoHubSeeded(page, emptyWorld(), "Games");
  await expect(page.locator(".screen h1")).toHaveText("Games");
  // ...the rest of this test's assertions are unchanged from here on.
});
```

`history.spec.ts` seeds one community and no sessions, and navigates with `gotoHubSeeded(page, world(), "History")` — its empty-state assertions then hold without any community-flow detour.

`split-flow/split.spec.ts:20` is a visibility-only assertion whose subject is the nav itself. It becomes:

```ts
await expect(hubButton(page, "Games")).toBeVisible({ timeout: 5000 });
```

- [ ] **Step 12: Rewrite `dashboard.spec.ts`'s seed block and hub calls**

Delete `:1-118` — the file doc comment (now in the helper), the local `MLBB_ID`/`SeedWorld`/`mlbbCap`/`teamOf`/`splitOf`/`seedScript`/`gotoSeeded`/`hub`/`statCard`/`statValue` — and import the shared ones instead:

```ts
import { test, expect } from "@playwright/test";
import {
  MLBB_ID,
  gotoHubSeeded,
  gotoSeeded,
  hubButton,
  mlbbCap,
  splitOf,
  statValue,
  type SeedWorld,
} from "../../support/seed";
```

Keep the local `twoCommunities()` (`:120-130`); it is this file's fixture. Replace all 14 `hub(page, …)` call sites (`:149`, `:163`, `:165`, `:167`, `:265`, `:301`, `:307`, `:381`, `:386`, `:398`, `:400`, `:404`, `:489`, `:534`) with `hubButton(page, …)`:

```bash
sed -i 's/\bhub(page,/hubButton(page,/g' e2e/tests/dashboard/dashboard.spec.ts
```

Replace `page.locator(".tournament-header h1")` at `:505` with `page.locator(".screen h1")`.

- [ ] **Step 13: Fix the `hubs` table and the stale title in `dashboard.spec.ts`**

`NAV_ITEMS` is now `[Home, Roster, Games, History, Squads]` (`src/App.tsx:62-68`), so the table at `:155-161` is wrong twice: the Squads slot's *nav label* is `Squads`, while `Saved squads` is the screen's `h1` (`src/session/SquadsScreen.tsx:116`). Replace `:152-169` with:

```ts
test("Home tab returns to the Dashboard from each hub", async ({ page }) => {
  await gotoSeeded(page, twoCommunities());

  // [nav label hubButton resolves, the .screen h1 that hub renders]
  const hubs = [
    ["Roster", "comp3tive"],
    ["Games", "Games"],
    ["History", "History"],
    ["Squads", "Saved squads"],
  ] as const;
  for (const [navLabel, hubH1] of hubs) {
    await hubButton(page, navLabel).click();
    await expect(page.locator(".screen h1")).toHaveText(hubH1);
    await hubButton(page, "Home").click();
    await expect(page.locator(".screen h1")).toHaveText("Dashboard");
    await expect(hubButton(page, "Home")).toHaveAttribute("aria-current", "page");
  }
});
```

And replace the five `toHaveAttribute("aria-label", …)` assertions at `:139-147` with the accessible-name assertions, plus correct the title at `:132` (Home is now *first* in `NAV_ITEMS`, not centred — `1702342` moved it):

```ts
test("fresh load lands on the Dashboard with the five hub tabs", async ({ page }) => {
  await gotoSeeded(page, twoCommunities());

  // ADR-0005: the view stack root is the dashboard view; every fresh load lands here.
  await expect(page.locator(".screen h1")).toHaveText("Dashboard");

  // The five-slot layout. The nav buttons carry no aria-label: their accessible
  // name IS their visible label (the icon span is aria-hidden), which is what
  // hubButton resolves. Exactly one control matches each name at this width.
  for (const hub of ["Home", "Roster", "Games", "History", "Squads"] as const) {
    await expect(hubButton(page, hub)).toHaveCount(1);
    await expect(hubButton(page, hub)).toBeVisible();
  }
  // Home marks the dashboard as current (the stack root is the dashboard view).
  await expect(hubButton(page, "Home")).toHaveAttribute("aria-current", "page");
});
```

- [ ] **Step 14: Re-anchor `saved-squad.spec.ts`**

`nth(4)` at `:67` becomes `hubButton(page, "Squads")`; `nth(1)` at `:83` becomes `hubButton(page, "Games")`; `.tournament-header h1` at `:97` becomes `.screen h1`. The rest of that spec — the MLBB capability fixture, the file import, the roles loop — is unchanged in this task; Task 10 moves it onto seeding.

- [ ] **Step 15: Pin the two layout specs to 390×844 and fix their assertions**

`panel/no-overlap.spec.ts` and `settings-panel/viewport.spec.ts` are the only two specs whose subject *is* the bottom bar, and the bar only exists below 1024 px. Both gain, directly under the imports:

```ts
test.use({ viewport: { width: 390, height: 844 } });
```

In `settings-panel/viewport.spec.ts`, replace the `"fixed"` comment at `:14` and add the position contract at `:15-23`:

```ts
  // 2. Bottom nav is sticky at the bottom of the layout column
  const nav = page.locator(".bottom-nav");
  await expect(nav).toBeVisible();
  const navPos = await nav.evaluate((el) => window.getComputedStyle(el).position);
  expect(navPos).toBe("sticky");
  const navBox = await nav.boundingBox();
  expect(navBox).not.toBeNull();
  const viewportSize = page.viewportSize();
  if (navBox && viewportSize) {
    // The bar occupies the foot of the viewport.
    expect(navBox.y + navBox.height).toBeGreaterThanOrEqual(viewportSize.height - 5);
  }
```

- [ ] **Step 16: Replace the dead `.app` padding assertion in `no-overlap.spec.ts`**

`:31-35` asserts `.app` has `padding-bottom >= 64px` to clear a **fixed** bar. There is no `.app` padding rule at all, and the bar is `position: sticky` (`src/index.css:685`) inside the column. Replace `:31-43` with the behavioural assertion — the last roster row must not sit under the bar — and the sticky-position contract:

```ts
  // 3. Scroll to the bottom and verify the last row clears the sticky bar.
  //    The bar is `position: sticky; bottom: 0` inside the app column
  //    (src/index.css:685), so it sits in normal flow at the column's foot and
  //    the document's scrollable tail is below it.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const lastPlayer = page.locator(".roster .row").last();
  const playerBox = await lastPlayer.boundingBox();
  const navBox = await page.locator(".bottom-nav").boundingBox();
  expect(playerBox).not.toBeNull();
  expect(navBox).not.toBeNull();
  if (playerBox && navBox) {
    expect(playerBox.y + playerBox.height).toBeLessThanOrEqual(navBox.y + 1);
  }

  // 4. Verify topbar is sticky
  const topbarPos = await page.locator(".topbar-wrap").evaluate((el) => window.getComputedStyle(el).position);
  expect(topbarPos).toBe("sticky");

  // 5. Verify the bottom nav is sticky, not fixed
  const navPos = await page.locator(".bottom-nav").evaluate((el) => window.getComputedStyle(el).position);
  expect(navPos).toBe("sticky");
```

Also update the header comment at `:3` and the test title at `:5` from "fixed nav" to "sticky nav".

Delete the now-redundant `:45-58` block (it re-derived the same last-row geometry) and keep `:60-65`'s topbar assertion as step 7.

- [ ] **Step 17: Run the re-anchored spec from Step 1**

Run: `npx playwright test --config=e2e/playwright.config.ts tests/tournament/create.spec.ts`
Expected: `1 passed`. The 30 s timeout is gone.

- [ ] **Step 18: Run the whole suite**

First rebuild, because `reuseExistingServer: true` can serve a stale `dist/`:

```bash
npx vite build && npx playwright test --config=e2e/playwright.config.ts
```

Expected: **37 tests, 0 failed, 0 skipped** — 42 at audit time, minus the 5 the prune removes (4 here, `review.spec.ts` in Task 2), plus the 1 new `nav-layout.spec.ts` test. The audit's 16 failures are gone: 14 were the rail root cause, and the last 2 were fixed in Steps 13 and 16.

- [ ] **Step 19: Commit**

```bash
git add e2e/support/seed.ts e2e/tsconfig.json tsconfig.json e2e/tests
git add -A e2e/tests/tournament
git commit -m "test: re-anchor the e2e suite to the shipped layout via hubButton

Fourteen of the audit's sixteen failures shared one cause: src/index.css hides
.bottom-nav inside @media (min-width: 1024px) while the suite runs at 1280x720,
so every positional nav click retried to the 30s timeout. Navigation is now by
accessible name through one helper, and tsc -b typechecks e2e/**, so a renamed
hub is a compile error rather than a timeout.

Also fixes the two remaining assertions: dashboard.spec.ts asserted an
aria-label the nav buttons deliberately do not carry, and no-overlap.spec.ts
asserted .app padding for a fixed bar that became sticky."
```

---

### Task 2: Prune the rest of the suite and untrack the reports (A09 remainder)

Five spec files and two page objects assert nothing or have no consumers, and two build artefacts are tracked in git. A green run has to mean something.

**Files:**
- Delete: `e2e/tests/tournament/review.spec.ts`, `e2e/pages/base.page.ts`, `e2e/pages/split.page.ts`
- Modify: `e2e/tests/landing/landing.spec.ts:34`
- Modify: `.gitignore`
- Untrack: `playwright-report/index.html`, `test-results/.last-run.json`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: nothing. This task only removes.

- [ ] **Step 1: Delete `review.spec.ts` and record the gap**

Decided: delete, not implement. A skipped placeholder claiming coverage is worse than a documented gap. `review.spec.ts` is a `test.skip` whose comment says the panel is "verified by the build and by manual testing". The panel's observable seam is covered indirectly: `saved-squad.spec.ts:97` asserts that consuming a saved squad builds a bracket (`.bracket-match` containing Team A and Team B), which is the same `tournaments.teams.length > 0 && every match unplayed` state `reviewing` keys on (`src/tournament/TournamentScreen.tsx:246`). `ReviewPanel` stays in the product.

```bash
rm e2e/tests/tournament/review.spec.ts
```

- [ ] **Step 2: Delete the two page objects**

`grep -rn "base.page\|split.page\|BasePage\|SplitPage" e2e/tests/` finds nothing, and `SplitPage` is imported only by itself.

```bash
rm -r e2e/pages
```

- [ ] **Step 3: Delete the trivially-passing landing assertion**

`.tabbar` exists in no markup — a scan of every `locator("…")` class in `e2e/**` against `src/**/*.tsx` and both HTML documents leaves exactly two classes with no counterpart, `tabbar` and `tournament-header`. So `expect(page.locator(".tabbar")).toHaveCount(0)` passes no matter what, while `#root` and `.app` count-0 on the two lines above already prove the landing page is not the app. Remove line 34 and its comment:

```ts
    await expect(page.locator("#root")).toHaveCount(0);
    await expect(page.locator(".app")).toHaveCount(0);
    // The landing hero is a React island (src/landing.tsx), which is how the
    // split screen is demonstrated. The page around it stays a document: no
    // framework router, no app bundle.
    await expect(page.locator("#landing-hero .split-screen")).toBeVisible();
```

- [ ] **Step 4: Untrack the build reports**

`playwright-report/index.html` (517,543 bytes) and `test-results/.last-run.json` (45 bytes) are tracked. Both stay on disk.

```bash
git rm --cached playwright-report/index.html test-results/.last-run.json
```

- [ ] **Step 5: Extend `.gitignore`**

Append to the existing four lines (`node_modules/`, `dist/`, `*.tsbuildinfo`, `.DS_Store`):

```
# Playwright output — regenerate locally, never commit
playwright-report/
test-results/
```

- [ ] **Step 6: Verify the two files are untracked and still present**

Run: `git ls-files | grep -E 'playwright-report|test-results'`
Expected: no output.

Run: `ls playwright-report/index.html test-results/.last-run.json`
Expected: both listed — untracked means "not in git", not "deleted".

- [ ] **Step 7: Run the suite**

```bash
npx vite build && npx playwright test --config=e2e/playwright.config.ts
```

Expected: **36 tests, 0 failed, 0 skipped** (37 from Task 1, minus the deleted `review.spec.ts` skip; A09's other four deletions already landed in Task 1).

- [ ] **Step 8: Commit**

```bash
git add -A .gitignore e2e
git rm --cached --ignore-unmatch playwright-report/index.html test-results/.last-run.json
git commit -m "test: prune the specs that assert nothing and untrack the reports

review.spec.ts was a test.skip claiming coverage; its seam is covered by
saved-squad.spec.ts. e2e/pages had zero consumers. The .tabbar assertion
passed no matter what, because .tabbar exists in no markup. The Playwright
report and last-run file are no longer tracked."
```

---

### Task 3: Re-roll produces a different fair split (A03)

Re-roll is a no-op. Reproduced live: 10 players, 2 teams, two clicks, identical output both times, badge advanced to `Roll #3`. `reroll` (`src/session/SplitScreen.tsx:255-264`) passes no `variety`, and `freshSplit` (`src/session/edit.ts:113-116`) falls through to the deterministic `fairSplit` when `options?.variety` is `undefined`. Two defects in one handler: no variety, and the pool is rebuilt from `result.teams` rather than the session's own `poolPlayerIds`, so a player who sat out can never come back.

**Files:**
- Modify: `src/session/SplitScreen.tsx:255-264`
- Modify: `src/session/edit.test.ts` (append)
- Create: `e2e/tests/split/reroll.spec.ts`

**Interfaces:**
- Consumes: `freshSplit(poolPlayerIds, roster, discipline, settings, options?)` (`src/session/edit.ts:100-117`); `FairSplitOptions.variety?: number` (`src/solver/solver.ts:219-225`); `VARIETY_TOLERANCE = 0.1` (`src/solver/solver.ts:24`); `hubButton`/`gotoHubSeeded`/`SeedWorld` from Task 1.
- Produces: no new exports. The `signature` helper is module-local to the two files that need it.

**Provenance (D1).** A re-rolled split is never asserted to be proven minimal. `varietySplit` stamps `optimal: false` at `src/solver/solver.ts:419` but delegates to `fairSplit` at `:409` when it finds no candidate, and that fallback can return `optimal: true`. The honest rule is "proven iff `result.solver.optimal`" — B13 owns that copy and keys it on the field. This task never writes, overrides or fabricates `solver.optimal`, and does not change the `solver` object shape (`src/domain/types.ts:157`).

- [ ] **Step 1: Write the failing unit test**

Append to `src/session/edit.test.ts`. The pool and fixtures already exist in that file (`tenPlayers()`, `player()`, `ALL_FUTSAL`). Note what it asserts: **changed, and not worse than the optimum by more than the tolerance** — never optimal.

```ts
describe("freshSplit: variety (re-roll)", () => {
  const signature = (result: SplitResult) =>
    result.teams
      .map((t) => t.slots.map((s) => s.playerId).sort().join(","))
      .sort()
      .join("|");

  it("returns a different, still-fair split for a different variety counter", () => {
    const players = tenPlayers();
    const pool = players.map((p) => p.id);
    const settings = { teamCount: 2 };
    const optimum = fairSplit(
      poolFromPlayers(players, FUTSAL_DISCIPLINE),
      FUTSAL_DISCIPLINE,
      buildSettings(FUTSAL_DISCIPLINE, 2),
    );

    const a = freshSplit(pool, players, FUTSAL_DISCIPLINE, settings, { variety: 0 });
    const b = freshSplit(pool, players, FUTSAL_DISCIPLINE, settings, { variety: 1 });

    expect(signature(a)).not.toBe(signature(b));
    for (const result of [a, b]) {
      const placed = new Set(result.teams.flatMap((t) => t.slots.map((s) => s.playerId)));
      expect(placed.size).toBe(10); // same pool, every player placed
      // Fair: within VARIETY_TOLERANCE of the proven optimum. Never asserted optimal.
      expect(result.gap).toBeLessThanOrEqual(optimum.gap + VARIETY_TOLERANCE + 1e-9);
    }
  });

  it("draws from the whole pool, so a player who sat out can return", () => {
    // Seven MLBB players, one team of exactly five: two must sit out.
    const players = Array.from({ length: 7 }, (_, i) => player(`q${i}`, `Q${i}`, [3, 3, 3], [4, 4, 4, 4]));
    const pool = players.map((p) => p.id);
    const eligible = new Set<string>();
    for (let variety = 0; variety < 12; variety++) {
      const result = freshSplit(pool, players, MLBB_DISCIPLINE, { teamCount: 1 }, { variety });
      for (const team of result.teams) for (const slot of team.slots) eligible.add(slot.playerId);
    }
    expect(eligible.size).toBe(7);
  });
});
```

Add `VARIETY_TOLERANCE` and `MLBB_DISCIPLINE` to the existing imports at the top of the file: `import { buildSettings, fairSplit, poolFromPlayers, VARIETY_TOLERANCE } from "../solver/solver";` and `import { FUTSAL_DISCIPLINE, MLBB_DISCIPLINE } from "../domain/seed";`. Add `type SplitResult` to the `../domain/types` import.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/session/edit.test.ts`
Expected: FAIL on `expect(signature(a)).not.toBe(signature(b))` — with no `variety` handling in the handler path under test the two calls are equal in the second case only if the solver ignores it; here the assertion that fails is the second test's `expect(eligible.size).toBe(7)` is unaffected, so the first test fails with `expected ... not to be ...`. If both tests pass already, `varietySplit` is already reached and you have the wrong file.

- [ ] **Step 3: Implement the re-roll**

Replace `src/session/SplitScreen.tsx:255-264` with:

```ts
  const reroll = () => {
    // The pool is the session's own pool, not the teams on screen: a player who
    // sat out (an MLBB leftover, a futsal sub past capacity) is eligible again.
    const pool = session.poolPlayerIds.filter((id) => roster.some((p) => p.id === id));
    const settings = { teamCount: session.settings.teamCount };
    const before = signature(result);
    let next = result;
    let rolled = false;
    // A bounded walk: skip variety counters that reproduce the current teams,
    // so a click that can change the teams changes them.
    for (let n = rerollCount; n < rerollCount + 8; n++) {
      const candidate = freshSplit(pool, roster, discipline, settings, { variety: n });
      if (signature(candidate) !== before) {
        next = candidate;
        rolled = true;
        break;
      }
      if (n === rerollCount) next = candidate; // no other arrangement exists
    }
    void commit(next);
    // Only count a roll that actually changed the teams, so `Roll #N` never
    // reports a roll that did not happen.
    if (rolled) setRerollCount((n) => n + 1);
  };
```

Add the module-local signature helper directly above the component, next to the existing `BIB` constant (`src/session/SplitScreen.tsx:21`):

```ts
/** Team-membership signature, order-independent: used to detect a real re-roll. */
function signature(result: SplitResult): string {
  return result.teams
    .map((t) => t.slots.map((s) => s.playerId).sort().join(","))
    .sort()
    .join("|");
}
```

`SplitResult` is already imported at `src/session/SplitScreen.tsx:2`.

**Measured behaviour this produces** (10-player futsal pool of `edit.test.ts`, 8 variety counters): every counter changed the teams and every gap stayed at the optimum `0.0667` within tolerance. On the equal-strength 10-player MLBB pool, 8 counters yield only 6 distinct signatures — consecutive counters genuinely repeat, which is why the walk exists. On a pool with exactly one fair arrangement (5 MLBB players into one team; 2 futsal players into one team) the walk finds nothing new, `rolled` stays false, and the badge does not move. That is the documented, intended outcome.

- [ ] **Step 4: Run the unit tests**

Run: `npx vitest run src/session/edit.test.ts`
Expected: all cases pass, including the pre-existing `freshSplit` case and both new ones.

Run: `npx vitest run`
Expected: 0 failed. The pre-existing 114 pass.

- [ ] **Step 5: Write the failing e2e test**

Create `e2e/tests/split/reroll.spec.ts`. Ten equal-strength MLBB players and an ad-hoc split; two Re-roll clicks must render different membership.

```ts
/**
 * Re-roll (ticket 03). The defect: two clicks rendered identical teams while
 * the badge advanced to "Roll #3".
 */
import { expect, test } from "@playwright/test";
import { gotoSeeded, hubButton, MLBB_ID, splitOf, type SeedWorld } from "../../support/seed";

const tenPlayersWorld = (): SeedWorld => {
  const players = Array.from({ length: 10 }, (_, i) => ({
    id: `p${i + 1}`,
    communityId: "comm-reroll",
    name: `Player ${i + 1}`,
    capabilities: [
      {
        disciplineId: MLBB_ID,
        attributeRatings: { mechanics: 4, "game-sense": 4, "hero-pool": 4, teamwork: 4 },
        eligibleRoles: ["tank", "assassin", "mage", "marksman", "fighter"],
        preferredRole: null,
      },
    ],
  }));
  return {
    communities: [{ id: "comm-reroll", name: "Reroll Crew", createdAt: 100 }],
    players,
    sessions: [
      {
        id: "sess-reroll",
        communityId: "comm-reroll",
        disciplineId: MLBB_ID,
        createdAt: 500,
        poolPlayerIds: players.map((p) => p.id),
        settings: { teamCount: 2 },
        result: splitOf(players.map((p) => p.id)),
      },
    ],
    tournaments: [],
    squads: [],
    activeCommunityId: "comm-reroll",
  };
};

/** The rendered membership, in DOM order: each team is a `.team`, each slot a `.player-name`. */
async function renderedTeams(page: Page): Promise<string> {
  return (await page.locator(".split-screen .team .player-name").allTextContents()).join("|");
}

test("re-roll renders different teams and counts only real rolls", async ({ page }) => {
  await gotoSeeded(page, tenPlayersWorld());

  // Reopen the seeded session: the split screen is reachable from History.
  await hubButton(page, "History").click();
  await expect(page.locator(".history-row")).toHaveCount(1);
  await page.locator(".history-row").first().click();
  await expect(page.locator(".split-screen")).toBeVisible({ timeout: 10000 });

  // Roll #1 is the settled split; the badge only appears past that.
  await expect(page.locator(".split-head-meta")).not.toContainText("Roll #");

  const before = await renderedTeams(page);
  await page.getByRole("button", { name: "Re-roll" }).click();
  await expect(page.locator(".split-head-meta")).toContainText("Roll #2", { timeout: 10000 });
  const afterFirst = await renderedTeams(page);
  expect(afterFirst).not.toBe(before);

  await page.getByRole("button", { name: "Re-roll" }).click();
  await expect(page.locator(".split-head-meta")).toContainText("Roll #3", { timeout: 10000 });
  expect(await renderedTeams(page)).not.toBe(afterFirst);
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vite build && npx playwright test --config=e2e/playwright.config.ts tests/split/reroll.spec.ts`
Expected: FAIL on `expect(afterFirst).not.toBe(before)` — the identical-teams no-op.

- [ ] **Step 7: Run it to verify it passes**

The implementation from Step 3 is what fixes it. The selector is the one `TeamCard` renders: each team is a `.team` containing a `.player-name` span per slot (`src/session/SplitScreen.tsx:44`, `:71`). If it resolves to zero elements the seeded session never reached the split screen — check `.split-screen` is visible first, rather than changing the selector.

Run: `npx playwright test --config=e2e/playwright.config.ts tests/split/reroll.spec.ts`
Expected: `1 passed`.

- [ ] **Step 8: Verify persistence is unchanged**

Run: `npx playwright test --config=e2e/playwright.config.ts tests/history tests/squads`
Expected: both pass — re-rolling a `session`/`squad` source still persists nothing (`src/App.tsx:1188-1191`); an ad-hoc source still persists the new result.

- [ ] **Step 9: Commit**

```bash
git add src/session/SplitScreen.tsx src/session/edit.test.ts e2e/tests/split/reroll.spec.ts
git commit -m "fix: re-roll returns a different fair split, from the session's own pool

reroll passed no variety, so freshSplit fell through to the deterministic
fairSplit and two clicks rendered identical teams while the badge advanced to
Roll #3. It now walks a bounded variety counter, skips a counter that
reproduces the current teams, and increments the badge only on a real change.
The pool is rebuilt from session.poolPlayerIds, so a player who sat out is
eligible again. No optimality is asserted anywhere: varietySplit stamps
optimal: false but falls back to fairSplit, which can return optimal: true."
```

---

### Task 4: Deletes remove the row from the screen (A04)

Three handlers call the store while the hook that owns the in-memory list sits unused one line away. Reproduced live: deleted Player 1, got 10 rows before and 10 rows after, while IndexedDB showed `p1` gone. A reload "fixes" the UI — which is exactly why a spec that reloads between steps cannot see this class of bug.

**Files:**
- Modify: `src/App.tsx:482-484`, `src/App.tsx:762-764`, `src/App.tsx:1209`
- Create: `e2e/tests/roster/delete-row.spec.ts`

**Interfaces:**
- Consumes: `useRoster().deletePlayer(id): Promise<void>` (`src/roster/useRoster.ts:42-47`), `useTournaments().deleteTournament(id)` (`src/tournament/useTournaments.ts:42-47`), `useSessions().deleteSession(id)` (`src/session/useSessions.ts:41-47`) — all three already call the store **and** filter their own list. `notify(text, type)` (`src/App.tsx:163-171`), `formatError` (`:170`). `gotoHubSeeded`/`SeedWorld` from Task 1.
- Produces: no new exports. `deleteTournamentFromUI` (`:766-771`) keeps calling `deleteTournament`, so the open-tournament redirect and the `GamesScreen onDelete` prop (`:1170`) keep working.

- [ ] **Step 1: Write the failing e2e test**

Create `e2e/tests/roster/delete-row.spec.ts`. Note what makes it fail today: it does **not** reload between the mutation and the assertion.

```ts
/**
 * Deletes (ticket 04). The defect: the store dropped the id while the row stayed
 * on screen, because the handler wrote past the hook that owns the list. A spec
 * that reloads between steps passes today, which is why this one does not.
 */
import { expect, test } from "@playwright/test";
import { gotoHubSeeded, MLBB_ID, splitOf, type SeedWorld } from "../../support/seed";

const threePlayers = (): SeedWorld => ({
  communities: [{ id: "comm-del", name: "Delete Crew", createdAt: 100 }],
  players: [
    { id: "p1", communityId: "comm-del", name: "Player 1", capabilities: [] },
    { id: "p2", communityId: "comm-del", name: "Player 2", capabilities: [] },
    { id: "p3", communityId: "comm-del", name: "Player 3", capabilities: [] },
  ],
  sessions: [],
  tournaments: [
    {
      id: "tr-del",
      communityId: "comm-del",
      disciplineId: MLBB_ID,
      name: "Delete Cup",
      format: "series",
      seriesLength: 3,
      teamCount: 2,
      thirdPlace: false,
      createdAt: 400,
      status: "draft",
      teams: [],
      matches: [],
    },
  ],
  squads: [],
  activeCommunityId: "comm-del",
});

test("deleting a player and a tournament removes the row without a reload", async ({ page }) => {
  await gotoHubSeeded(page, threePlayers(), "Roster");
  await expect(page.locator(".roster .row")).toHaveCount(3);

  // Playwright dismisses native dialogs by default; the audit found the confirm
  // blocking automation until a handler accepted it.
  page.once("dialog", (dialog) => void dialog.accept());
  await page.locator(".roster .row").first().click();
  await expect(page.locator(".modal-title")).toHaveText("Edit player");
  await page.getByRole("button", { name: "Delete", exact: true }).click();

  // The row must go WITHOUT a reload: the store and the list currently diverge.
  await expect(page.locator(".roster .row")).toHaveCount(2, { timeout: 5000 });

  // And the delete must be persisted, so it survives one.
  await page.reload();
  await expect(page.locator(".screen h1")).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "Roster", exact: true }).click();
  await expect(page.locator(".roster .row")).toHaveCount(2);

  // A tournament delete from Games behaves the same way.
  await page.getByRole("button", { name: "Games", exact: true }).click();
  await expect(page.locator(".roster .row")).toHaveCount(1);
  await page.getByRole("button", { name: "Delete tournament" }).click();
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.locator(".roster .row")).toHaveCount(0, { timeout: 5000 });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vite build && npx playwright test --config=e2e/playwright.config.ts tests/roster/delete-row.spec.ts`
Expected: FAIL on `expect(page.locator(".roster .row")).toHaveCount(2)` — received 3, because `rosterStore.deletePlayer` removed the row from storage but not from `roster.players`.

- [ ] **Step 3: Route the three handlers through their hooks**

Replace `src/App.tsx:482-484`:

```ts
  const deletePlayer = async (id: Id) => {
    try {
      await roster.deletePlayer(id);
    } catch (err) {
      notify(`Could not delete the player: ${formatError(err)}`, "error");
    }
  };
```

Replace `src/App.tsx:762-764`:

```ts
  const deleteTournament = async (id: Id) => {
    try {
      await tournaments.deleteTournament(id);
    } catch (err) {
      notify(`Could not delete the tournament: ${formatError(err)}`, "error");
    }
  };
```

Replace `src/App.tsx:1209`:

```tsx
          onDelete={async (id) => {
            try {
              await sessions.deleteSession(id);
            } catch (err) {
              notify(`Could not delete the session: ${formatError(err)}`, "error");
            }
          }}
```

Each handler catches, emits a `notify(…, "error")` toast through the existing container (`src/App.tsx:1257`), and does **not** rethrow. `PlayerEditModal.remove` calls `void remove()` (`src/roster/PlayerEditModal.tsx:308`), so a rejection would otherwise be unhandled and invisible; catching is what turns a failed delete into a message. The modal closes and the row stays visible, which is the truthful outcome: the toast says why, and the list still shows the record that exists.

- [ ] **Step 4: Run it to verify it passes**

Run: `npx playwright test --config=e2e/playwright.config.ts tests/roster/delete-row.spec.ts`
Expected: `1 passed`.

- [ ] **Step 5: Verify the redirect and the Games prop still work**

Run: `npx vite build && npx playwright test --config=e2e/playwright.config.ts tests/squads tests/tournament`
Expected: all pass — `deleteTournamentFromUI` still redirects the open tournament to Games, and `GamesScreen`'s `onDelete` prop still resolves.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx e2e/tests/roster/delete-row.spec.ts
git commit -m "fix: deletes go through the hook that owns the list

deletePlayer, deleteTournament and the History row's onDelete called the store
directly while the hook that owns the in-memory list sat unused one line away,
so the row stayed on screen after the confirm until a reload. Each handler now
calls its hook and reports a failure through the toast instead of swallowing it."
```

---

### Task 5: Validate players where data enters; add an error boundary (A05)

Two entry points accept data that can violate the model invariants, and any render throw is a blank page. The stale half of the original ticket is corrected first: `src/roster/PlayerEditModal.tsx:126` **already** calls `validatePlayer`, so the modal is not part of this task.

**Files:**
- Modify: `src/data/transfer.ts:95` (and the imports at `:1`)
- Modify: `src/data/transfer.test.ts` (append)
- Modify: `src/App.tsx:426-433`, `src/App.tsx:522-567`
- Create: `src/ErrorBoundary.tsx`
- Modify: `src/main.tsx`
- Create: `e2e/tests/shell/error-boundary.spec.ts`

**Interfaces:**
- Consumes: `validatePlayer(player, disciplines): ValidationIssue[]` (`src/domain/validation.ts:14`), whose messages are already user-readable (`src/domain/validation.ts:38-64`). `notify` (`src/App.tsx:163-171`). `gotoSeeded`/`hubButton`/`SeedWorld`/`MLBB_ID` from Task 1.
- Produces: `parseBackup(text: string, disciplines?: Discipline[]): BackupData` — backwards compatible, so the eleven existing `transfer.test.ts` cases are unchanged. `ErrorBoundary` as a class component with the shape frozen in `contracts.md`:

```tsx
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {}
```

**Assumed invariant, established by B20.** Every `sample-data/*.json` player passes `validatePlayer`. Measured on HEAD: `sample-data/futsal-roster.json` is `version: 1` with 7 of 25 players invalid (`CW`, `Cr1te`, `Wannn`, `Oura`, `Luminaire`, `Nino`, `Blustine` all carry a `preferredRole` outside `eligibleRoles`), and because it has a `version` key, `src/App.tsx:537-538` routes it into `handleImport` — the exact branch this task edits. Between this task and B20 the shipped futsal sample is refused on import; the window is real and expected, and B20's acceptance test establishes the invariant. `mpl-id-roster.json` and `src/data/samplePlayers.ts` are both clean today (measured: 0 invalid each). `sample-data/*.json` is Phase B's exclusive ownership; this task does not edit it.

- [ ] **Step 1: Write the failing unit tests**

Append to `src/data/transfer.test.ts`. Import the catalog: `import { SEED_DISCIPLINES } from "../domain/seed";`. The fixture capability is one valid MLBB capability that each case mutates.

```ts
describe("parseBackup: player validation", () => {
  const validCap = {
    disciplineId: "mlbb",
    attributeRatings: { mechanics: 4, "game-sense": 4, "hero-pool": 4, teamwork: 4 },
    eligibleRoles: ["tank", "assassin", "mage", "marksman", "fighter"],
    preferredRole: "tank",
  };
  const backup = (players: unknown[]) =>
    JSON.stringify({
      version: 4,
      exportedAt: "",
      communities: [community("c1", "Sunday futsal")],
      players,
      sessions: [],
      tournaments: [],
      savedSquads: [],
    });

  it("rejects a capability missing an attribute rating, naming the player and the attribute", () => {
    const text = backup([
      {
        id: "p3",
        communityId: "c1",
        name: "Player 3",
        capabilities: [{ ...validCap, attributeRatings: { mechanics: 4 } }],
      },
    ]);
    expect(() => parseBackup(text, SEED_DISCIPLINES)).toThrow(
      /^Backup player "Player 3" is invalid: Missing rating for attribute "Game Sense"\.$/,
    );
  });

  it("rejects a rating outside the attribute scale", () => {
    const text = backup([
      {
        id: "p1",
        communityId: "c1",
        name: "Player 1",
        capabilities: [{ ...validCap, attributeRatings: { ...validCap.attributeRatings, mechanics: 9 } }],
      },
    ]);
    expect(() => parseBackup(text, SEED_DISCIPLINES)).toThrow(/Rating for "Mechanics" must be 1-5, got 9\./);
  });

  it("rejects an unknown role", () => {
    const text = backup([
      {
        id: "p1",
        communityId: "c1",
        name: "Player 1",
        capabilities: [{ ...validCap, eligibleRoles: ["mage", "wizard"], preferredRole: null }],
      },
    ]);
    expect(() => parseBackup(text, SEED_DISCIPLINES)).toThrow(/Role "wizard" is not part of "Mobile Legends"\./);
  });

  it("rejects an empty eligibility list", () => {
    const text = backup([
      {
        id: "p1",
        communityId: "c1",
        name: "Player 1",
        capabilities: [{ ...validCap, eligibleRoles: [], preferredRole: null }],
      },
    ]);
    expect(() => parseBackup(text, SEED_DISCIPLINES)).toThrow(/At least one eligible role is required for "Mobile Legends"\./);
  });

  it("rejects a duplicate capability for one discipline", () => {
    const text = backup([
      { id: "p1", communityId: "c1", name: "Player 1", capabilities: [validCap, validCap] },
    ]);
    expect(() => parseBackup(text, SEED_DISCIPLINES)).toThrow(/At most one capability per discipline/);
  });

  it("parses a valid file, with and without the catalog", () => {
    const text = backup([
      { id: "p1", communityId: "c1", name: "Player 1", capabilities: [validCap] },
    ]);
    expect(parseBackup(text, SEED_DISCIPLINES).players).toHaveLength(1);
    // The parameter is optional: the shape-only path is unchanged.
    expect(parseBackup(text).players).toHaveLength(1);
  });

  it("still adopts a v1 players-only file with zero capabilities", () => {
    const text = JSON.stringify({
      version: 1,
      players: [{ id: "1", name: "Budi", capabilities: [] }],
      sessions: [],
    });
    expect(parseBackup(text, SEED_DISCIPLINES).players).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/data/transfer.test.ts`
Expected: FAIL — the five rejection cases receive no throw, because `parseBackup` checks shape only (`isPlayer` at `src/data/transfer.ts:44-51` never inspects `attributeRatings`, `eligibleRoles` or `preferredRole`).

- [ ] **Step 3: Add the optional validation pass**

Add to the imports at `src/data/transfer.ts:1`:

```ts
import type { Community, Discipline, Player, SavedSquad, Session, Tournament } from "../domain/types";
import { validatePlayer } from "../domain/validation";
```

Change the signature at `src/data/transfer.ts:95` and insert the validation loop directly after the existing player shape check:

```ts
export function parseBackup(text: string, disciplines?: Discipline[]): BackupData {
```

```ts
  for (const p of data.players) {
    if (!isPlayer(p)) throw new Error("Backup contains a malformed player.");
  }
  // When the caller supplies the catalog, the model invariants are checked here
  // too: shape alone lets a capability through that computeStrength throws on.
  if (disciplines) {
    for (const p of data.players as Player[]) {
      const problems = validatePlayer(p, disciplines);
      if (problems.length > 0) {
        throw new Error(`Backup player "${p.name}" is invalid: ${problems[0].message}`);
      }
    }
  }
```

- [ ] **Step 4: Run the unit tests**

Run: `npx vitest run src/data/transfer.test.ts`
Expected: all pass, including the eleven pre-existing cases (`MPL ID sample roster`, the round trip, the three v1/v3 migration cases, the six shape-validation cases) plus the seven new ones.

- [ ] **Step 5: Pass the catalog from the import handler and report via the toast**

Replace `src/App.tsx:426-433`:

```ts
  const handleImport = async (file: File) => {
    let data;
    try {
      data = parseBackup(await file.text(), disciplines);
    } catch (err) {
      notify(`Import failed: ${formatError(err)}`, "error");
      return;
    }
```

The `alert` at `:431` becomes a `notify`: this is the import path Phase A owns. The `window.confirm` at `:449` stays — C27 owns native dialogs in general.

- [ ] **Step 6: Validate each candidate in the players-only branch**

In `src/App.tsx:542-566`, the loop currently copies `capabilities` verbatim (`:557`). Validate before saving and report the skips by name and reason:

```ts
        // Players-only JSON
        if (Array.isArray(obj.players)) {
          if (!activeCommunity) {
            notify("Pick or create a community before importing a player file.", "error");
            return;
          }
          let imported = 0;
          const rejected: { name: string; reason: string }[] = [];
          for (const raw of obj.players) {
            if (!raw || typeof raw !== "object") continue;
            const p = raw as Partial<Player> & { id?: string; name?: string };
            if (!p.name) continue;
            const player: Player = {
              id: p.id ?? crypto.randomUUID(),
              communityId: activeCommunity.id,
              name: p.name,
              notes: p.notes,
              capabilities: Array.isArray(p.capabilities) ? p.capabilities : [],
            };
            const problems = validatePlayer(player, disciplines);
            if (problems.length > 0) {
              rejected.push({ name: player.name, reason: problems[0].message });
              continue;
            }
            await roster.savePlayer(player);
            imported++;
          }
          notify(`Imported ${imported} player${imported === 1 ? "" : "s"} into ${activeCommunity.name}.`, "success");
          if (rejected.length > 0) {
            notify(
              `Skipped ${rejected.length} player${rejected.length === 1 ? "" : "s"}. First: "${rejected[0].name}" — ${rejected[0].reason}`,
              "error",
            );
          }
          return;
        }
```

Add `validatePlayer` to the imports at the top of `src/App.tsx`. Keep the three `alert`s in this branch (`:528`, `:532`, `:544`, `:562`, `:565`) as `notify` calls — they are import-path messages; `:544` and `:562` are replaced by the code above, and `:528`/`:532`/`:565` become `notify(…, "error")`.

- [ ] **Step 7: Run the import specs to confirm valid files still import**

Run: `npx vite build && npx playwright test --config=e2e/playwright.config.ts tests/roster`
Expected: `tests/roster/delete-row.spec.ts` passes; the new import spec lands in Task 6. A valid players-only file (`mpl-id-roster.json`, measured clean: 0 of 25 invalid) imports exactly as before.

- [ ] **Step 8: Write the failing error-boundary test**

Create `src/ErrorBoundary.tsx` **after** this test, so the import failure is the red state. First, the e2e spec. The throw route is the live one, and it has a precondition that must be respected:

```
src/session/SplitScreen.tsx:223   describeFlags(result, discipline, roster)
  → src/session/flow.ts:24        describeFlags
    → src/session/flow.ts:34      strongestOnTeam → strengthOf → computeStrength
```

`computeStrength` throws when a capability omits a rating for one of its discipline's attributes (`src/domain/strength.ts:29-31`). **Measured**: this throws only when the flagged team has **two or more** eligible covering candidates — with exactly one, `strongestOnTeam` returns it without sorting, and with zero it never calls `computeStrength`. So the seed must put two deliberately-malformed MLBB-eligible players on the flagged team.

```ts
/**
 * Error boundary (ticket 05). A malformed persisted capability reaches a real
 * render path and must show a message instead of a blank page:
 *   SplitScreen:223 → describeFlags → strongestOnTeam → strengthOf → computeStrength
 * computeStrength throws when a capability omits an attribute rating. It throws
 * only with TWO OR MORE eligible covering candidates, because a single one is
 * returned without sorting — hence two malformed players on the flagged team.
 */
import { expect, test } from "@playwright/test";
import { gotoSeeded, hubButton, MLBB_ID, type SeedWorld } from "../../support/seed";

/** An MLBB capability deliberately missing the "teamwork" rating. */
const malformedCap = (role: string) => ({
  disciplineId: MLBB_ID,
  attributeRatings: { mechanics: 4, "game-sense": 4, "hero-pool": 4 },
  eligibleRoles: ["tank", "assassin", "mage", "marksman", "fighter"],
  preferredRole: role,
});

const brokenWorld = (): SeedWorld => ({
  communities: [{ id: "comm-eb", name: "Boundary Crew", createdAt: 100 }],
  players: [
    {
      id: "p1",
      communityId: "comm-eb",
      name: "Player One",
      capabilities: [malformedCap("tank")],
    },
    {
      id: "p2",
      communityId: "comm-eb",
      name: "Player Two",
      capabilities: [malformedCap("fighter")],
    },
  ],
  sessions: [
    {
      id: "sess-eb",
      communityId: "comm-eb",
      disciplineId: MLBB_ID,
      createdAt: 500,
      poolPlayerIds: ["p1", "p2"],
      settings: { teamCount: 1 },
      result: {
        teams: [
          {
            index: 0,
            slots: [
              { playerId: "p1", roleId: null },
              { playerId: "p2", roleId: null },
            ],
            totalStrength: 8,
            avgStrength: 4,
          },
        ],
        solver: { optimal: true, nodesExplored: 0, elapsedMs: 0 },
      },
    },
  ],
  tournaments: [],
  squads: [],
  activeCommunityId: "comm-eb",
});

test("a render throw shows the boundary message instead of a blank page", async ({ page }) => {
  await gotoSeeded(page, brokenWorld());
  await hubButton(page, "History").click();
  await expect(page.locator(".history-row")).toHaveCount(1);

  // Reopening the session renders SplitScreen, which throws.
  await page.locator(".history-row").first().click();

  await expect(page.locator('[data-testid="error-boundary"]')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('[data-testid="error-boundary"]')).toContainText("missing rating");
  await expect(page.getByRole("button", { name: "Reload" })).toBeVisible();
});
```

- [ ] **Step 9: Run it to verify it fails**

Run: `npx vite build && npx playwright test --config=e2e/playwright.config.ts tests/shell/error-boundary.spec.ts`
Expected: FAIL on `expect(page.locator('[data-testid="error-boundary"]')).toBeVisible()` — with no boundary in `src/`, React unmounts the tree and the page goes blank, so `.history-row` and the boundary both vanish.

- [ ] **Step 10: Create the error boundary**

`src/ErrorBoundary.tsx` — it renders inside the existing vocabulary: `.screen`, `.load-error` (`src/index.css:81-91`), `.bar` (`:1130`), `.btn.btn-primary` (`:1151`).

```tsx
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * The last line of defence for a render throw. A malformed persisted record can
 * reach computeStrength, which throws by design; without this, React unmounts
 * the tree and the user sees a blank page with no way forward.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("comp3tive render error", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="app" data-testid="error-boundary">
        <div className="screen">
          <div className="load-error" role="alert">
            <strong>Something went wrong drawing this screen.</strong> {error.message}
          </div>
          <p className="lede">
            Your saved data is safe on this device — nothing was changed. Reload to continue.
          </p>
          <div className="bar">
            <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
```

- [ ] **Step 11: Wrap `<App />`**

Replace the whole of `src/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./ErrorBoundary";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
```

The wrapper sits **outside** `<App />`, so Phase D02 can register the service worker alongside it without touching it.

- [ ] **Step 12: Run it to verify it passes**

Run: `npx vite build && npx playwright test --config=e2e/playwright.config.ts tests/shell/error-boundary.spec.ts`
Expected: `1 passed` — the boundary renders, the message names the missing rating, and the Reload button is present.

- [ ] **Step 13: Verify `computeStrength` still throws**

Run: `npx vitest run src/domain/strength.test.ts`
Expected: all pass — this task prevents reaching the throw and does not weaken it.

- [ ] **Step 14: Commit**

```bash
git add src/data/transfer.ts src/data/transfer.test.ts src/App.tsx src/ErrorBoundary.tsx src/main.tsx e2e/tests/shell/error-boundary.spec.ts
git commit -m "fix: validate players at the import boundary and survive a render throw

parseBackup checked shape only, so a capability missing an attribute rating got
past it and reached computeStrength, which throws by design with nothing to
catch it. It now takes an optional catalog and validates against it, and the
players-only JSON branch validates each candidate before saving. A render throw
now shows a message and a Reload action instead of a blank page."
```

---

### Task 6: Import merge keeps each record's community (A06)

A v4 restore splits down the middle: players and squads are re-homed to whichever community is active, while their sessions and tournaments stay on the original. `parseBackup` has **already** resolved community ids correctly (`src/data/transfer.ts:136-140`), so the override undoes work already done and is redundant — the deleted comment scoped its intent to v1 backups, which `parseBackup` handles itself.

**Files:**
- Modify: `src/App.tsx:455-461`
- Modify: `src/data/transfer.test.ts` (append)
- Create: `e2e/tests/roster/import-community.spec.ts`

**Interfaces:**
- Consumes: `parseBackup`'s adoption (`src/data/transfer.ts:136-140`), already tested at `src/data/transfer.test.ts:94-116`; `notify`; `gotoSeeded`/`SeedWorld` from Task 1.
- Produces: nothing new. Sessions (`src/App.tsx:459`) and tournaments (`:460`) already keep their own community; after this, so does everything.

**Sequencing.** This task is blocked by Task 5 because both edit `src/data/transfer.test.ts`; Task 5 lands first so the two edits cannot clobber each other.

- [ ] **Step 1: Write the failing unit test**

Append to `src/data/transfer.test.ts`, inside the same file as the Task 5 block. The fixtures `community`, `player`, `session`, `tournament` and `savedSquad` already exist at the top of the file.

```ts
describe("parseBackup: a two-community round trip keeps every record's own community", () => {
  it("preserves communityId per record and references no missing community", () => {
    const communities = [community("c1", "Alpha Crew"), community("c2", "Beta Guild")];
    const players = [
      { ...player("a1", "Alpha One"), communityId: "c1" },
      { ...player("b1", "Beta One"), communityId: "c2" },
    ];
    const sessions = [{ ...session("s-beta"), communityId: "c2" }];
    const tournaments = [{ ...tournament("tr-alpha"), communityId: "c1" }];
    const squads = [{ ...savedSquad("q-beta", "Beta Squad"), communityId: "c2" }];

    const parsed = parseBackup(serializeBackup(players, sessions, communities, tournaments, squads));

    expect(parsed.players.map((p) => p.communityId)).toEqual(["c1", "c2"]);
    expect(parsed.sessions[0].communityId).toBe("c2");
    expect(parsed.tournaments[0].communityId).toBe("c1");
    expect(parsed.savedSquads[0].communityId).toBe("c2");

    const known = new Set(parsed.communities.map((c) => c.id));
    const referenced = [
      ...parsed.players,
      ...parsed.sessions,
      ...parsed.tournaments,
      ...parsed.savedSquads,
    ].map((r) => r.communityId);
    expect(referenced.every((id) => known.has(id))).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it passes already, then prove the handler is what is broken**

Run: `npx vitest run src/data/transfer.test.ts`
Expected: PASS — this pins `parseBackup`'s existing, correct behaviour, which is exactly why the override in `handleImport` is the defect. The unit layer cannot see the handler; the e2e spec below is what fails.

- [ ] **Step 3: Write the failing e2e test**

Create `e2e/tests/roster/import-community.spec.ts`. It seeds one active community, imports a v4 file carrying two *other* communities, accepts the merge confirm, then switches community and asserts no absorption.

```ts
/**
 * Import merge (ticket 06). The defect: handleImport overrode communityId for
 * players and squads with the active community, splitting a v4 restore in half
 * while sessions and tournaments kept theirs.
 */
import { expect, test } from "@playwright/test";
import { gotoHubSeeded, MLBB_ID, splitOf, type SeedWorld } from "../../support/seed";

const activeOnly = (): SeedWorld => ({
  communities: [{ id: "comm-active", name: "Active Crew", createdAt: 100 }],
  players: [],
  sessions: [],
  tournaments: [],
  squads: [],
  activeCommunityId: "comm-active",
});

/** A v4 backup carrying two communities that are not the active one. */
const twoCommunityBackup = () =>
  JSON.stringify({
    version: 4,
    exportedAt: new Date().toISOString(),
    communities: [
      { id: "comm-alpha", name: "Alpha Crew", createdAt: 200 },
      { id: "comm-beta", name: "Beta Guild", createdAt: 300 },
    ],
    players: [
      { id: "al-1", communityId: "comm-alpha", name: "Alpha One", capabilities: [] },
      { id: "be-1", communityId: "comm-beta", name: "Beta One", capabilities: [] },
    ],
    sessions: [],
    tournaments: [],
    savedSquads: [
      {
        id: "sq-beta",
        communityId: "comm-beta",
        name: "Beta Squad",
        disciplineId: MLBB_ID,
        createdAt: 400,
        poolPlayerIds: ["be-1"],
        settings: { teamCount: 1 },
        result: splitOf(["be-1"]),
      },
    ],
  });

test("a merged backup leaves each record in its own community", async ({ page }) => {
  await gotoHubSeeded(page, activeOnly(), "Roster");
  await expect(page.locator(".roster .row")).toHaveCount(0);

  page.once("dialog", (dialog) => void dialog.accept());
  await page.setInputFiles('input[type="file"]', {
    name: "two-communities.json",
    mimeType: "application/json",
    buffer: Buffer.from(twoCommunityBackup(), "utf8"),
  });

  // Switch to Beta: its own roster must show Beta One, not the active community's.
  await page.getByRole("button", { name: "Active community" }).click();
  await page.locator(".squad-menu-item", { hasText: "Beta Guild" }).click();
  await expect(page.locator(".squad-select-value")).toHaveText("Beta Guild");
  await page.getByRole("button", { name: "Roster", exact: true }).click();
  await expect(page.locator(".roster .row")).toHaveCount(1);
  await expect(page.locator(".roster .row").first()).toContainText("Beta One");

  // The originally-active community must not have absorbed them.
  await page.getByRole("button", { name: "Active community" }).click();
  await page.locator(".squad-menu-item", { hasText: "Active Crew" }).click();
  await expect(page.locator(".squad-select-value")).toHaveText("Active Crew");
  await page.getByRole("button", { name: "Roster", exact: true }).click();
  await expect(page.locator(".roster .row")).toHaveCount(0);
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `npx vite build && npx playwright test --config=e2e/playwright.config.ts tests/roster/import-community.spec.ts`
Expected: FAIL on `expect(page.locator(".roster .row")).toHaveCount(0)` for Active Crew — both imported players were re-homed into it, so it now shows two.

- [ ] **Step 5: Drop the override**

Replace `src/App.tsx:455-461`:

```ts
    for (const c of newCommunities) await communityStore.saveCommunity(c);
    for (const p of newPlayers) await roster.savePlayer(p);
    for (const s of newSessions) await sessionStore.saveSession(s);
    for (const t of newTournaments) await tournamentStore.saveTournament(t);
    for (const q of newSquads) await squadStore.saveSavedSquad(q);
```

Delete the comment at `:455` and the `const importCommunityId = …` line at `:456` with it. `parseBackup`'s adoption at `src/data/transfer.ts:136-140` is now the single place that re-homes a record with a missing or unknown `communityId`, which is what the v1 case needs and what it already does.

- [ ] **Step 6: Run it to verify it passes**

Run: `npx playwright test --config=e2e/playwright.config.ts tests/roster/import-community.spec.ts`
Expected: `1 passed`.

- [ ] **Step 7: Verify a v1 file and the players-only path still import**

Run: `npx vite build && npx playwright test --config=e2e/playwright.config.ts tests/roster tests/squads`
Expected: all pass. A v1 backup (no `communities`) still imports with everything adopted into one community, via `parseBackup`; a players-only roster still imports through the branch at `src/App.tsx:542`, which this task does not touch; and re-importing the same file is idempotent, because the existing merge contract adds only new ids.

- [ ] **Step 8: Commit**

```bash
git add src/App.tsx src/data/transfer.test.ts e2e/tests/roster/import-community.spec.ts
git commit -m "fix: an import merge keeps each record's own community

handleImport overrode communityId for players and squads with the active
community, so a v4 restore landed half its records in the wrong place while
sessions and tournaments kept theirs. parseBackup already adopts records with a
missing or unknown communityId, so the override was both over-broad and
redundant."
```

---

### Task 7: Swiss pairs without rematches and crowns by play (A07)

Two defects in one file. `pairRound` (`src/tournament/bracket.ts:162-185`) takes the first legal opponent via `findIndex`, which strands the final pair into a rematch. `standings` (`:302-313`) breaks a shared record on `team.strength`, the **pre-tournament seed** — so a title is decided by how strong a team was before play.

**Files:**
- Modify: `src/tournament/bracket.ts:162-185` (add `selectPairing` above `pairRound`), `:302-314`
- Modify: `src/tournament/bracket.test.ts` (append)

**Interfaces:**
- Consumes: `records()` (`src/tournament/bracket.ts:137-152`, which carries `team`, `wins`, `gameWins`), `playedPairs()` (`:153-159`), `TeamRecord` (`:131-135`), `emptyMatch`/`matchId` (`:14`, `:45-57`), `roundsFor` (`:53`).
- Produces: module-private `selectPairing(field, recs, played): [TournamentTeam, TournamentTeam][] | null`. `standings`'s public signature is unchanged: `{ teamId, wins, gameWins }[]`.

**What the measured evidence actually says.** The audit's "6 teams: 2,048 of 4,096 patterns" does not reproduce. Enumerating the **reachable** patterns with one game deciding a match, and counting only matches that were actually recorded (the bracket generates the next round eagerly, so after round 2 the tournament already contains round-3 matches):

| Teams | Reachable patterns | Round-3 rematches | Of those, a rematch-free pairing exists | Every round seats all n |
|---|---|---|---|---|
| 4 | 4 | 0 | 0 | yes |
| 6 | 64 | **28** | **28** | yes |
| 8 | 256 | **32** | **32** | yes |

The 4,096 figure counts 2^6 × 2^6 patterns, including unreachable ones. The specific case the ticket records reproduces: round 2 pairs `team-4 v team-6`, then round 3 pairs `team-6 v team-4` while `{3-2, 1-6, 5-4}` was legal *and* rematch-free.

- [ ] **Step 1: Write the failing tests**

Append to `src/tournament/bracket.test.ts`. The harness (`team`, `seeded`, `tourney`, `tourneyWith`, `game`, `roundsFor`) already exists at the top of that file.

```ts
describe("swiss: pairing is rematch-free whenever a rematch-free pairing exists", () => {
  /** Every legal outcome pattern for a round: each match is won by either side. */
  function outcomes(matchesInRound: Tournament["matches"]): Id[][] {
    const options = matchesInRound.map((m) => [m.teamAId!, m.teamBId!]);
    return options.reduce<Id[][]>((acc, winners) => acc.flatMap((soFar) => winners.map((w) => [...soFar, w])), [[]]);
  }

  const roundOf = (t: Tournament, r: number) =>
    t.matches.filter((m) => m.round === r).slice().sort((a, b) => a.position - b.position);

  /** Record one outcome per match of the round, letting `settle` generate the next. */
  const play = (t: Tournament, r: number, winners: Id[]) =>
    roundOf(t, r).reduce((acc, m, i) => applyResult(acc, m.id, [game(winners[i])]), t);

  const pairKey = (a: Id, b: Id) => [a, b].sort().join(":");

  /** Only matches with recorded games have been played; generation is eager. */
  function playedPairs(t: Tournament): Set<string> {
    const keys = new Set<string>();
    for (const m of t.matches) {
      if (m.teamAId && m.teamBId && m.games.length > 0) keys.add(pairKey(m.teamAId, m.teamBId));
    }
    return keys;
  }

  function winsOf(t: Tournament, teams: TournamentTeam[]): Map<Id, number> {
    const wins = new Map<Id, number>();
    for (const tm of teams) wins.set(tm.id, 0);
    for (const m of t.matches) if (m.winnerTeamId) wins.set(m.winnerTeamId, wins.get(m.winnerTeamId)! + 1);
    return wins;
  }

  /** Brute-force oracle: is a rematch-free, |Δwins| <= 1 assignment of all teams possible? */
  function rematchFreeExists(remaining: Id[], wins: Map<Id, number>, played: Set<string>): boolean {
    if (remaining.length === 0) return true;
    const [a, ...rest] = remaining;
    return rest.some(
      (b, i) =>
        Math.abs(wins.get(a)! - wins.get(b)!) <= 1 &&
        !played.has(pairKey(a, b)) &&
        rematchFreeExists([...rest.slice(0, i), ...rest.slice(i + 1)], wins, played),
    );
  }

  it("avoids a rematch in every reachable pattern where one is avoidable", () => {
    const seen: Record<number, number> = { 4: 0, 6: 0, 8: 0 };
    for (const n of [4, 6, 8]) {
      const teams = seeded(n);
      const totalRounds = Math.ceil(Math.log2(n));
      // Best-of-1: one game decides a match, so a round completes in one step.
      const first = buildBracket({ ...tourney("swiss", n), seriesLength: 1 });
      let states: Tournament[] = [first];
      for (let r = 1; r < totalRounds; r++) {
        states = states.flatMap((s) => outcomes(roundOf(s, r)).map((winners) => play(s, r, winners)));
      }
      for (const state of states) {
        const generated = roundOf(state, totalRounds);
        if (generated.length === 0) continue;
        seen[n]++;
        // A round always seats every team.
        expect(generated.length * 2).toBe(n);
        const played = playedPairs(state);
        const wins = winsOf(state, teams);
        const field = [...teams].sort((a, b) => wins.get(b.id)! - wins.get(a.id)! || a.id.localeCompare(b.id));
        const repeated = generated.some((m) => m.teamAId && m.teamBId && played.has(pairKey(m.teamAId, m.teamBId)));
        // The oracle decides "exists" independently, so the assertion cannot
        // simply agree with a buggy implementation.
        if (rematchFreeExists(field.map((x) => x.id), wins, played)) expect(repeated).toBe(false);
      }
    }
    expect(seen[4]).toBe(4);
    expect(seen[6]).toBe(64);
    expect(seen[8]).toBe(256);
  });

  it("crowns a 3-way tie on 2 wins by game difference, not by pre-tournament seed", () => {
    const teams = [team("t1", 6), team("t2", 5), team("t3", 4), team("t4", 3), team("t5", 2), team("t6", 1)];
    const m = (id: Id, r: number, p: number, a: Id, b: Id, winners: Id[]): TournamentMatch => ({
      id,
      round: r,
      position: p,
      teamAId: a,
      teamBId: b,
      games: winners.map(game),
      winnerTeamId: winners.filter((w) => w === a).length > winners.filter((w) => w === b).length ? a : b,
      winnerNext: null,
      loserNext: null,
    });
    const t: Tournament = {
      ...tourneyWith("swiss", teams),
      status: "complete",
      matches: [
        m("m-1-0", 1, 0, "t1", "t2", ["t1", "t1"]),
        m("m-1-1", 1, 1, "t3", "t4", ["t3", "t3"]),
        m("m-1-2", 1, 2, "t5", "t6", ["t5", "t5"]),
        m("m-2-0", 2, 0, "t1", "t3", ["t1", "t1"]),
        m("m-2-1", 2, 1, "t5", "t2", ["t5", "t5"]),
        m("m-2-2", 2, 2, "t4", "t6", ["t4", "t4"]),
        // Round 3: t1(2-0) beats t5(1-1); t3(1-1) beats t2(1-1) 2-1; t4(1-1) beats t6(0-2).
        m("m-3-0", 3, 0, "t1", "t5", ["t1", "t1"]),
        m("m-3-1", 3, 1, "t3", "t2", ["t3", "t2", "t3"]),
        m("m-3-2", 3, 2, "t4", "t6", ["t4", "t4"]),
      ],
    };
    const order = standings(t).map((s) => s.teamId);
    // t1 finishes 3-0. t3, t4 and t5 all finish 2-2; among them the order must
    // follow play — t4 and t5 at game difference +2, t3 at +1 — and never the
    // seed, which would put t3 (seeded 3rd) above t4 and t5.
    expect(order[0]).toBe("t1");
    expect(order.slice(1, 4)).toEqual(["t4", "t5", "t3"]);
  });

  it("keeps the recorded order of the two pre-existing standings fixtures", () => {
    let t = buildBracket(tourney("swiss", 4));
    t = applyResult(t, "m-1-0", [game("t1"), game("t1")]);
    t = applyResult(t, "m-1-1", [game("t3"), game("t3")]);
    t = applyResult(t, "m-2-0", [game("t1"), game("t1")]);
    t = applyResult(t, "m-2-1", [game("t2"), game("t2")]);
    expect(standings(t).map((s) => s.teamId)).toEqual(["t1", "t2", "t3", "t4"]);

    const teams = [team("a", 5), team("b", 4), team("c", 3), team("d", 2)];
    let u = buildBracket(tourneyWith("swiss", teams));
    u = applyResult(u, "m-1-0", [game("a"), game("a")]);
    u = applyResult(u, "m-1-1", [game("c"), game("c")]);
    u = applyResult(u, "m-2-0", [game("a"), game("c"), game("a")]);
    u = applyResult(u, "m-2-1", [game("d"), game("d")]);
    expect(standings(u).map((s) => s.teamId)).toEqual(["a", "c", "d", "b"]);
  });
});
```

Add `Id` and `TournamentMatch` to the type import at the top of the file.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/tournament/bracket.test.ts`
Expected: FAIL on the first test (`expected false, got true` — the greedy pairing produced a rematch where the oracle says one was avoidable) and on the second (`expected ["t4","t5","t3"], got ["t3","t4","t5"]` — the seed decided it). The third test passes on both revisions; that is what makes the change safe to land.

- [ ] **Step 3: Implement `selectPairing`**

Insert directly above `pairRound` in `src/tournament/bracket.ts`:

```ts
/**
 * Choose a rematch-free, legal (|Δwins| <= 1) pairing of the whole field.
 * Deterministic depth-first search: take the first unpaired team, try opponents
 * in a fixed order (smallest wins difference first, then stronger seed), and
 * backtrack when a choice strands the remainder. Returns `null` only when no
 * rematch-free legal assignment exists.
 */
function selectPairing(
  field: TournamentTeam[],
  recs: Map<Id, TeamRecord>,
  played: Set<string>,
): [TournamentTeam, TournamentTeam][] | null {
  const seedIndex = new Map<Id, number>();
  field.forEach((team, i) => seedIndex.set(team.id, i));
  const byId = new Map(field.map((team) => [team.id, team]));

  const pairUp = (
    remaining: Id[],
    pairs: [TournamentTeam, TournamentTeam][],
  ): [TournamentTeam, TournamentTeam][] | null => {
    if (remaining.length === 0) return pairs;
    const [a, ...rest] = remaining;
    const aWins = recs.get(a)!.wins;
    const candidates = rest
      .filter((b) => Math.abs(aWins - recs.get(b)!.wins) <= 1 && !played.has([a, b].sort().join(":")))
      .sort(
        (x, y) =>
          Math.abs(aWins - recs.get(x)!.wins) - Math.abs(aWins - recs.get(y)!.wins) ||
          seedIndex.get(x)! - seedIndex.get(y)!,
      );
    for (const b of candidates) {
      const next = pairUp(rest.filter((id) => id !== b), [...pairs, [byId.get(a)!, byId.get(b)!]]);
      if (next) return next;
    }
    return null;
  };

  return pairUp(field.map((team) => team.id), []);
}
```

- [ ] **Step 4: Make `pairRound` use it**

Replace `src/tournament/bracket.ts:162-185`:

```ts
/** Pair the next Swiss round: same-record groups, no rematches, floats for odd groups. */
function pairRound(t: Tournament, recs: Map<Id, TeamRecord>, played: Set<string>): TournamentMatch[] {
  const field = t.teams
    .slice()
    .sort((a, b) => recs.get(b.id)!.wins - recs.get(a.id)!.wins || a.id.localeCompare(b.id));
  // A rematch-free legal pairing exists in every reachable Swiss position at
  // n <= 8; asking for one is the normal path.
  const legal = selectPairing(field, recs, played);
  // Last resort: no rematch-free legal assignment exists, so a repeat is
  // unavoidable. Pair the field in order and let the record rule float.
  const pairs: [TournamentTeam, TournamentTeam][] =
    legal ??
    (() => {
      const remaining = [...field];
      const fallback: [TournamentTeam, TournamentTeam][] = [];
      while (remaining.length > 1) {
        const a = remaining.shift()!;
        const ai = remaining.findIndex((b) => Math.abs(recs.get(a.id)!.wins - recs.get(b.id)!.wins) <= 1);
        fallback.push([a, remaining.splice(ai === -1 ? 0 : ai, 1)[0]]);
      }
      return fallback;
    })();
  const round = t.matches.reduce((max, m) => Math.max(max, m.round), 0) + 1;
  return pairs.map(([a, b], p) => ({
    ...emptyMatch(round, p),
    teamAId: a.id,
    teamBId: b.id,
  }));
}
```

The old first-fit `if (ai === -1)` path is gone: the last-resort case is now the explicit `if (legal === null)` branch above, distinguishable in code from the normal path.

- [ ] **Step 5: Replace the crowning sort**

Replace `src/tournament/bracket.ts:302-314`:

```ts
/**
 * Swiss standings, crowned by play: series wins, then the head-to-head winner
 * when exactly two teams share a record (Swiss guarantees at most one meeting
 * per pair, so it is well defined there), then game difference, then game wins,
 * then id. The pre-tournament seed is deliberately absent: seeding builds the
 * bracket, play decides the table.
 */
export function standings(tournament: Tournament): { teamId: Id; wins: number; gameWins: number }[] {
  const recs = records(tournament);
  const losses = new Map<Id, number>();
  const headToHead = new Map<string, Id>();
  for (const r of recs.values()) losses.set(r.team.id, 0);
  for (const m of tournament.matches) {
    if (m.teamAId && m.teamBId && m.winnerTeamId) {
      headToHead.set([m.teamAId, m.teamBId].sort().join(":"), m.winnerTeamId);
    }
    for (const g of m.games) {
      const loser =
        g.winnerTeamId === m.teamAId ? m.teamBId : g.winnerTeamId === m.teamBId ? m.teamAId : null;
      if (loser) losses.set(loser, (losses.get(loser) ?? 0) + 1);
    }
  }
  const tiedOnWins = new Map<number, number>();
  for (const r of recs.values()) tiedOnWins.set(r.wins, (tiedOnWins.get(r.wins) ?? 0) + 1);
  return [...recs.values()]
    .sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (tiedOnWins.get(a.wins) === 2) {
        const winner = headToHead.get([a.team.id, b.team.id].sort().join(":"));
        if (winner === a.team.id) return -1;
        if (winner === b.team.id) return 1;
      }
      return (
        (b.gameWins - (losses.get(b.team.id) ?? 0)) - (a.gameWins - (losses.get(a.team.id) ?? 0)) ||
        b.gameWins - a.gameWins ||
        a.team.id.localeCompare(b.team.id)
      );
    })
    .map((r) => ({ teamId: r.team.id, wins: r.wins, gameWins: r.gameWins }));
}
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run src/tournament/bracket.test.ts`
Expected: every case passes — the exhaustive block (`seen[4] = 4`, `seen[6] = 64`, `seen[8] = 256`, zero rematches wherever the oracle finds an alternative), the 3-way tie, the two recorded orders, and all pre-existing cases unchanged.

- [ ] **Step 7: Verify `single-elim` and `series` are untouched**

Run: `npx vitest run src/tournament && npx vitest run`
Expected: all of `bracket.test.ts` passes, and the whole unit suite is 0 failed. `pairRound` and `standings` are swiss-only; `roundsFor` (`:53`), the bit-reversal seeding, `setSlot`, `settle` and `requiredMatches` are unmodified.

- [ ] **Step 8: Commit**

```bash
git add src/tournament/bracket.ts src/tournament/bracket.test.ts
git commit -m "fix: swiss pairs without rematches and crowns by play

pairRound took the first legal opponent, which stranded the last pair into a
rematch: 28 of 64 reachable patterns at 6 teams and 32 of 256 at 8, every one
with a rematch-free alternative the greedy walk never found. selectPairing is a
deterministic backtracking search and the rematch is now an explicit
legal === null branch. standings broke a shared record on team.strength, the
pre-tournament seed; it now uses head-to-head for two-team ties, then game
difference, then game wins, then id. Both recorded fixtures keep their order."
```

---

### Task 8: Import survives a bad file (A08)

Three failures in one function. The CSV parser is positional and naive, so `"Smith, John", futsal, 4` imports the name `Smith`. An unmatched discipline is silent, so the player is created with `capabilities: []` and can never be selected. And the whole file is read with `await file.text()` before anything checks its size.

**Files:**
- Create: `src/data/player-import.ts`
- Create: `src/data/player-import.test.ts`
- Modify: `src/App.tsx:515-520`, `src/App.tsx:569-612`

**Interfaces:**
- Consumes: `Discipline`, `Id`, `Player`, `Capability` from `src/domain/types`.
- Produces: the module frozen for Phase D36 to consume verbatim:

```ts
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export interface CsvRow { line: number; name: string; discipline: string; strength: number }
export interface ImportSkip { line: number; reason: string }
export function assertImportSize(bytes: number): void;
export function parsePlayerCsv(text: string): { rows: CsvRow[]; skipped: ImportSkip[] };
export function csvRowsToPlayers(
  rows: CsvRow[], disciplines: Discipline[], communityId: Id,
): { players: Player[]; skipped: ImportSkip[] };
```

- [ ] **Step 1: Write the failing tests**

Create `src/data/player-import.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { SEED_DISCIPLINES } from "../domain/seed";
import {
  MAX_IMPORT_BYTES,
  assertImportSize,
  csvRowsToPlayers,
  parsePlayerCsv,
} from "./player-import";

describe("parsePlayerCsv", () => {
  it("reads a quoted field containing a comma as one value", () => {
    const { rows, skipped } = parsePlayerCsv('name, discipline, strength\n"Smith, John", futsal, 4');
    expect(skipped).toEqual([]);
    expect(rows).toEqual([{ line: 2, name: "Smith, John", discipline: "futsal", strength: 4 }]);
  });

  it("unquotes a quoted field with no embedded comma", () => {
    const { rows } = parsePlayerCsv('name, discipline, strength\n"Budi", futsal, 4');
    expect(rows[0].name).toBe("Budi");
  });

  it("reads a doubled quote inside quotes as one literal quote", () => {
    const { rows } = parsePlayerCsv('name, discipline, strength\n"Say ""hi""", futsal, 4');
    expect(rows[0].name).toBe('Say "hi"');
  });

  it("skips a quoted header", () => {
    const { rows } = parsePlayerCsv('"Name","Discipline","Strength"\nBudi,futsal,4');
    expect(rows).toEqual([{ line: 2, name: "Budi", discipline: "futsal", strength: 4 }]);
  });

  it("skips a row with fewer than three fields, by line number", () => {
    const { rows, skipped } = parsePlayerCsv("name, discipline, strength\nBudi, futsal\nAndi, futsal, 4");
    expect(rows.map((r) => r.line)).toEqual([3]);
    expect(skipped).toEqual([
      { line: 2, reason: "Expected 3 columns (name, discipline, strength), found 2." },
    ]);
  });

  it("skips a strength that is not a number rather than defaulting it", () => {
    const { skipped } = parsePlayerCsv("name, discipline, strength\nBudi, futsal, strong");
    expect(skipped).toEqual([{ line: 2, reason: 'Strength "strong" is not a number.' }]);
  });
});

describe("csvRowsToPlayers", () => {
  it("reports an unknown discipline by line and by the name as typed", () => {
    const { rows } = parsePlayerCsv("name, discipline, strength\nBudi, quidditch, 4");
    const { players, skipped } = csvRowsToPlayers(rows, SEED_DISCIPLINES, "c1");
    // Never a player with capabilities: [] — that is today's silent outcome.
    expect(players).toEqual([]);
    expect(skipped).toEqual([{ line: 2, reason: 'Unknown discipline "quidditch".' }]);
  });

  it("builds a full capability for a valid row", () => {
    const { rows } = parsePlayerCsv("Budi, futsal, 4");
    const { players, skipped } = csvRowsToPlayers(rows, SEED_DISCIPLINES, "c1");
    expect(skipped).toEqual([]);
    expect(players).toHaveLength(1);
    const cap = players[0].capabilities[0];
    expect(cap.disciplineId).toBe("futsal");
    expect(Object.keys(cap.attributeRatings).sort()).toEqual(["fitness", "game-iq", "technical"]);
    expect(cap.eligibleRoles).toHaveLength(4);
  });

  it("clamps a strength outside 1..5", () => {
    const { rows } = parsePlayerCsv("Budi, futsal, 9");
    const { players } = csvRowsToPlayers(rows, SEED_DISCIPLINES, "c1");
    expect(players[0].capabilities[0].attributeRatings.technical).toBe(5);
  });
});

describe("assertImportSize", () => {
  it("refuses a 6 MB file with the limit in the message", () => {
    expect(() => assertImportSize(6 * 1024 * 1024)).toThrow(
      /^Import refused: this file is 6\.0 MB; the limit is 5\.0 MB\.$/,
    );
  });

  it("accepts a file at the limit", () => {
    expect(() => assertImportSize(MAX_IMPORT_BYTES)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/data/player-import.test.ts`
Expected: FAIL — `Failed to resolve import "./player-import"`. The module does not exist yet.

- [ ] **Step 3: Implement the module**

Create `src/data/player-import.ts`:

```ts
import type { Discipline, Id, Player } from "../domain/types";

/** Refuse a file too large to parse sensibly. A guard, not a security control. */
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

/** One successfully parsed CSV line, with its 1-based line number preserved. */
export interface CsvRow {
  line: number;
  name: string;
  discipline: string;
  strength: number;
}

/** One line that could not be imported, with the reason to show the user. */
export interface ImportSkip {
  line: number;
  reason: string;
}

/** Throw when a file is larger than the import limit, naming both numbers. */
export function assertImportSize(bytes: number): void {
  if (bytes <= MAX_IMPORT_BYTES) return;
  const mb = (n: number) => (n / (1024 * 1024)).toFixed(1);
  throw new Error(`Import refused: this file is ${mb(bytes)} MB; the limit is ${mb(MAX_IMPORT_BYTES)} MB.`);
}

/**
 * Split one CSV line into fields. `"` toggles in-quote, `""` inside quotes is a
 * literal quote, and a comma inside quotes is data — so `"Smith, John", futsal, 4`
 * is three fields, not four.
 */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      fields.push(field.trim());
      field = "";
    } else field += ch;
  }
  fields.push(field.trim());
  return fields;
}

/** A header row is one whose first field mentions "name"; it carries no player. */
function isHeader(fields: string[]): boolean {
  return (fields[0] ?? "").toLowerCase().includes("name");
}

/**
 * Parse a player CSV into rows and skips. The header is detected on the parsed
 * first row, so a quoted header still skips.
 */
export function parsePlayerCsv(text: string): { rows: CsvRow[]; skipped: ImportSkip[] } {
  const rows: CsvRow[] = [];
  const skipped: ImportSkip[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = i + 1;
    if (lines[i].trim() === "") continue;
    const fields = splitCsvLine(lines[i]);
    if (i === 0 && isHeader(fields)) continue;
    if (fields.length < 3) {
      skipped.push({
        line,
        reason: `Expected 3 columns (name, discipline, strength), found ${fields.length}.`,
      });
      continue;
    }
    const [name, discipline, rawStrength] = fields;
    if (name === "") {
      skipped.push({ line, reason: "The name column is empty." });
      continue;
    }
    const strength = rawStrength === "" ? 3 : Number(rawStrength);
    if (!Number.isFinite(strength)) {
      skipped.push({ line, reason: `Strength "${rawStrength}" is not a number.` });
      continue;
    }
    rows.push({ line, name, discipline: discipline.toLowerCase(), strength });
  }
  return { rows, skipped };
}

/**
 * Turn parsed rows into Players. A discipline that matches nothing goes to
 * `skipped` with its line number — never to a player who cannot play anything.
 */
export function csvRowsToPlayers(
  rows: CsvRow[],
  disciplines: Discipline[],
  communityId: Id,
): { players: Player[]; skipped: ImportSkip[] } {
  const players: Player[] = [];
  const skipped: ImportSkip[] = [];
  for (const row of rows) {
    const discipline = disciplines.find(
      (d) => d.shortName.toLowerCase() === row.discipline || d.name.toLowerCase() === row.discipline,
    );
    if (!discipline) {
      skipped.push({ line: row.line, reason: `Unknown discipline "${row.discipline}".` });
      continue;
    }
    const rating = Math.max(1, Math.min(5, row.strength)) as 1 | 2 | 3 | 4 | 5;
    players.push({
      id: crypto.randomUUID(),
      communityId,
      name: row.name,
      capabilities: [
        {
          disciplineId: discipline.id,
          attributeRatings: Object.fromEntries(discipline.attributes.map((a) => [a.id, rating])),
          eligibleRoles: discipline.roles.map((r) => r.id),
          preferredRole: null,
        },
      ],
    });
  }
  return { players, skipped };
}
```

- [ ] **Step 4: Run the unit tests**

Run: `npx vitest run src/data/player-import.test.ts`
Expected: all 11 cases pass.

- [ ] **Step 5: Guard the size before reading the file**

At the top of `handlePlayerImport` (`src/App.tsx:515-520`), before `await file.text()`:

```ts
  const handlePlayerImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      assertImportSize(file.size);
      const text = await file.text();
```

Add `assertImportSize`, `csvRowsToPlayers`, `parsePlayerCsv` to the `./data/player-import` import at the top of `src/App.tsx`.

- [ ] **Step 6: Replace the CSV branch**

Replace the whole of `src/App.tsx:569-608` (from the `// CSV branch` comment through the closing `alert`) with:

```ts
      // CSV branch
      if (!activeCommunity) {
        notify("Pick or create a community before importing a CSV.", "error");
        return;
      }
      const { rows, skipped: unparsed } = parsePlayerCsv(text);
      const { players: imported, skipped: unresolved } = csvRowsToPlayers(rows, disciplines, activeCommunity.id);
      for (const player of imported) await roster.savePlayer(player);
      const skipped = [...unparsed, ...unresolved].sort((a, b) => a.line - b.line);
      notify(
        `Imported ${imported.length} player${imported.length === 1 ? "" : "s"} into ${activeCommunity.name}.`,
        "success",
      );
      if (skipped.length > 0) {
        notify(
          `Skipped ${skipped.length} row${skipped.length === 1 ? "" : "s"}. Line ${skipped[0].line}: ${skipped[0].reason}`,
          "error",
        );
      }
```

Also replace the two remaining `alert`s in this handler — the catch at `:610` becomes:

```ts
    } catch (err) {
      notify(`Import failed: ${formatError(err)}`, "error");
    } finally {
```

This covers the seven `alert()` calls in the two import branches. Alerts elsewhere in `src/App.tsx` are untouched: C27 owns native dialogs in general.

- [ ] **Step 7: Run the unit suite and the affected specs**

Run: `npx vitest run && npx vite build && npx playwright test --config=e2e/playwright.config.ts tests/roster tests/squads`
Expected: unit 0 failed; `squads/saved-squad.spec.ts` passes, which is the end-to-end proof that a valid players-only JSON import still works.

- [ ] **Step 8: Commit**

```bash
git add src/data/player-import.ts src/data/player-import.test.ts src/App.tsx
git commit -m "fix: import survives a bad file

The CSV parser split on commas and took columns by index, so a quoted
\"Smith, John\" imported as Smith. An unrecognised discipline produced a player
with capabilities: [], silently unable to play anything. The whole file was
read before anything checked its size. player-import.ts is a zero-dependency
quoted-field parser plus discipline resolution and a 5 MB guard that runs
before file.text()."
```

---

### Task 9: CI runs the checks (A10)

There is no `.github/`, no `e2e` script, and `npx playwright test` with no arguments finds nothing because the config lives in `e2e/`. Trusted work is unverified.

**Files:**
- Modify: `package.json`
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: Task 1's `e2e/tsconfig.json` project reference (so `tsc -b` covers `e2e/**`); Task 2's untracked reports (so the failure artifact is the only copy); the `e2e` script.
- Produces: `"e2e": "playwright test --config=e2e/playwright.config.ts"`, frozen in `contracts.md`.

- [ ] **Step 1: Add the script**

`package.json` gains exactly one entry, and nothing else:

```json
"e2e": "playwright test --config=e2e/playwright.config.ts"
```

No `lint`, no `type-check`, no `coverage` alias — the workflow calls `npx` directly, so Phase C30's `engines`/`.nvmrc` edits do not collide with this line.

- [ ] **Step 2: Verify the script resolves**

Run: `npm run e2e -- --list`
Expected: a list of spec files. If it reports "no tests found", the config path is wrong.

- [ ] **Step 3: Create the workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: ci
on: [push, pull_request]
jobs:
  checks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npx tsc -b
      - run: npx vitest run
      - run: npx vite build
      - run: npx playwright install --with-deps chromium
      - run: npm run e2e
      - if: failure()
        uses: actions/upload-artifact@v4
        with: { name: playwright-report, path: playwright-report/ }
```

Every `run` step is bare: no `continue-on-error`, no `|| true`, no `if: always()` on a check step. The upload is the only conditional step, and it is conditional on **failure**, so it can never mask one.

**Why the order is not arbitrary.** `e2e/playwright.config.ts:17-22` declares `webServer: { command: "npm run preview", url: "http://localhost:4173/app/", reuseExistingServer: true }`. `vite preview` serves `dist/`, so an e2e run against a tree whose `dist/` is older than `src/` tests the wrong code. The audit hit exactly this hazard locally: the dev server on port 4173 was a `vite preview` with **uptime over one day**. Building at step 6 means the server started at step 8 can never serve a stale bundle.

- [ ] **Step 4: Verify the workflow's steps reproduce locally, in order**

```bash
npx tsc -b && npx vitest run && npx vite build && npm run e2e
```

Expected: exit 0 from each, `0 failed` from vitest, and the browser suite green on the bundle just built. This is the same sequence the workflow runs.

- [ ] **Step 5: Confirm the deliberate exclusions are honoured**

Run: `git diff e2e/playwright.config.ts`
Expected: no output — `workers` stays `1` (`:7`) and `retries` stays `0` (`:6`). A11 owns the workers measurement, and a suite that needs retries hides the class of debt this phase removes.

There is no coverage step and no threshold: no number exists to gate on, and this phase's exit criterion is a green suite. Branch protection ("require the CI check to pass before merging") is a repository setting, not a file, and is a one-line maintainer action.

- [ ] **Step 6: Commit**

```bash
git add package.json .github/workflows/ci.yml
git commit -m "ci: run typecheck, unit tests, build and the browser suite

There was no CI of any kind and no e2e script, so nothing verified the 12 unit
test files or the browser suite. The build step precedes e2e in the same job
because vite preview serves dist/ and reuseExistingServer: true would otherwise
let it serve a stale bundle. workers stays 1 and retries stays 0."
```

---

### Task 10: e2e specs start from a seeded world (A11)

Of 20 spec files, exactly one seeds deterministically. The other 19 drive the UI to construct their fixture; `match-setup/setup.spec.ts:19-31` does 4 modal round-trips per run and `panel/no-overlap.spec.ts:18-30` does 15. Thirteen spec files click "New community".

**Files:**
- Modify: `src/storage/indexed-db.ts:18`
- Modify: `e2e/support/seed.ts`
- Modify: `e2e/tests/discipline/discipline.spec.ts`, `e2e/tests/history/history.spec.ts`, `e2e/tests/match-setup/setup.spec.ts`, `e2e/tests/panel/no-overlap.spec.ts`, `e2e/tests/settings-panel/viewport.spec.ts`, `e2e/tests/split-flow/split.spec.ts`, `e2e/tests/squads/saved-squad.spec.ts`, `e2e/tests/tournament/create.spec.ts`, `e2e/tests/tournament/draft.spec.ts`, `e2e/tests/tournament/split-tourney.spec.ts`, `e2e/tests/dashboard/dashboard.spec.ts`

**Interfaces:**
- Consumes: `DB_VERSION` exported from `src/storage/indexed-db.ts` (`:18`). Verified safe to import from the Node process Playwright runs specs in: that module touches `indexedDB` only inside function bodies (`:33`, `:65`, `:101`, `:148`) and at module scope only binds constants and a `Map` (`:198-199`). Measured: importing it in a bare Node process with `typeof indexedDB === "undefined"` succeeds and yields `6`.
- Produces: `seedScript` embeds the derived version, and `SeedWorld.players` rows carry their own `capabilities` when present; `mlbbCap` remains the default.

- [ ] **Step 1: Export `DB_VERSION`**

Change `src/storage/indexed-db.ts:18`:

```ts
export const DB_VERSION = 6;
```

A hard-coded `6` in test support is the same staleness class this phase exists to remove: a future bump would change one number in `src/` and the helper would silently keep seeding the old version.

- [ ] **Step 2: Verify the export is import-safe before relying on it**

Run: `npx tsc -b`
Expected: exit 0. The helper's import of `../../src/storage/indexed-db` now typechecks under the `e2e` project reference.

- [ ] **Step 3: Derive the version and pass capabilities through**

In `e2e/support/seed.ts`, add the import and replace the players mapping and the `indexedDB.open` call in `seedScript`:

```ts
import { DB_VERSION } from "../../src/storage/indexed-db";
```

```ts
/** Every player gets this capability unless the row carries its own. */
const DEFAULT_CAP = mlbbCap;

/** Turn a world into an init script that seeds IndexedDB before app code runs. */
export function seedScript(world: SeedWorld): string {
  // Capabilities pass through: a row that carries its own keeps it, so
  // futsal-capable and deliberately-malformed players are both seedable.
  const players = world.players.map((p) => (p.capabilities ? p : { ...p, capabilities: [DEFAULT_CAP] }));
  const db = {
    communities: world.communities,
    players,
    sessions: world.sessions,
    tournaments: world.tournaments,
    "saved-squads": world.squads,
  };
  return `(() => {
    const STORES = ["communities", "players", "sessions", "tournaments", "saved-squads", "disciplines"];
    const request = indexedDB.open("comp3tive", ${DB_VERSION});
```

Everything else in the generated script is unchanged.

- [ ] **Step 4: Verify a capability-carrying row survives, and the default still applies**

Run: `npx vite build && npx playwright test --config=e2e/playwright.config.ts tests/dashboard`
Expected: all 8 `dashboard.spec.ts` tests pass — its worlds carry no `capabilities`, so they get `mlbbCap`, exactly as the local helper did. `tests/split/reroll.spec.ts` and `tests/roster/delete-row.spec.ts` also still pass: they carry their own capabilities, which now reach the app instead of being overwritten.

- [ ] **Step 5: Sweep the eleven specs onto seeding**

Replace each spec's community-and-players setup with one line of intent. The world each spec needs:

| Spec | World it seeds |
|---|---|
| `discipline/discipline.spec.ts` | one community, no players |
| `history/history.spec.ts` | one community, no sessions |
| `match-setup/setup.spec.ts` | one community, 2 players with a futsal capability |
| `panel/no-overlap.spec.ts` | one community, 15 players (the row stack it scrolls) |
| `settings-panel/viewport.spec.ts` | one community, no players |
| `split-flow/split.spec.ts` | one community, no players |
| `squads/saved-squad.spec.ts` | one community, 10 MLBB players with distinct preferred roles |
| `tournament/create.spec.ts` | one community, no players |
| `tournament/draft.spec.ts` | one community, 4 players |
| `tournament/split-tourney.spec.ts` | one community, 4 futsal players |
| `dashboard/dashboard.spec.ts` | its existing worlds, via the shared helper |

A futsal-capable player, since the default is MLBB:

```ts
const futsalPlayer = (id: string, name: string, rating: number) => ({
  id,
  communityId: "comm-match",
  name,
  capabilities: [
    {
      disciplineId: "futsal",
      attributeRatings: { technical: rating, fitness: rating, "game-iq": rating },
      eligibleRoles: ["goalkeeper", "defender", "winger", "pivot"],
      preferredRole: "goalkeeper",
    },
  ],
});
```

`match-setup/setup.spec.ts` then opens with:

```ts
test("match-setup: discipline first, then players, then teams", async ({ page }) => {
  await gotoHubSeeded(
    page,
    {
      communities: [{ id: "comm-match", name: "Match Test", createdAt: 100 }],
      players: [futsalPlayer("m1", "Player 1", 4), futsalPlayer("m2", "Player 2", 4)],
      sessions: [],
      tournaments: [],
      squads: [],
      activeCommunityId: "comm-match",
    },
    "Roster",
  );
  // ...every assertion from the original test is unchanged from here on.
});
```

`panel/no-overlap.spec.ts` seeds its 15 players the same way and drops the loop at `:20-29` entirely; its assertions from `:31` onward are unchanged (they were rewritten in Task 1).

**No assertion is weakened, dropped or reordered while its world changes.** This task changes how the world is built and nothing that is asserted about it. Each swept spec must still assert exactly what it asserted before.

- [ ] **Step 6: Confirm the two community specs keep clicking**

Run: `grep -rn "New community" e2e/tests/`
Expected: matches only in `community/community.spec.ts` and `community/cancel-dropdown.spec.ts`. Those two exist to test the create-community form; seeding is for preconditions, never for the setup path being tested.

- [ ] **Step 7: Record the honest baseline and compare**

`app-health/15`'s 7.1 min figure is a broken baseline and must not be used: fourteen tests waiting out a 30 s click timeout is 14 × 30 s = 7.0 min on its own, leaving almost nothing for the 25 tests that passed. The two numbers to compare are the green pre-seeding run and the green post-seeding run.

Run the green pre-seeding baseline from the commit at the end of Task 2, then this tree:

```bash
npx vite build && time npx playwright test --config=e2e/playwright.config.ts
```

Record both wall clocks in the ticket's closing comment. Do not compare either against 7.1 min.

- [ ] **Step 8: Measure `workers` and record the outcome precisely**

Run the suite with `workers` raised locally (do not commit the change):

```bash
npx playwright test --config=e2e/playwright.config.ts --workers=2
```

Expected: either green, in which case raise `workers` in `e2e/playwright.config.ts` and commit that one-line change; or flaky/red, in which case revert and record in the ticket the **exact** shared record that prevents it (the audit names the Default community as a candidate — confirm it, do not guess). `workers: 1` stays the default until a measurement says otherwise.

- [ ] **Step 9: Run the full suite**

```bash
npx tsc -b && npx vitest run && npx vite build && npx playwright test --config=e2e/playwright.config.ts
```

Expected: `npx tsc -b` exit 0 covering `src`, `vite.config.ts` and `e2e/**`; vitest 0 failed; and the browser suite **42 tests, 0 failed, 0 skipped, 0 flaky**. The arithmetic: 42 at audit time, minus the 5 deleted by A09, plus `nav-layout` (A01), `reroll` (A03), `delete-row` (A04), `error-boundary` (A05), `import-community` (A06) = 42.

- [ ] **Step 10: Commit**

```bash
git add src/storage/indexed-db.ts e2e
git commit -m "test: seed every spec deterministically

19 of 20 specs built their world by clicking through the create-community form;
match-setup did 4 modal round-trips and no-overlap 15. They now seed
IndexedDB directly through the shared helper. DB_VERSION is exported from
src/storage so the helper derives it instead of copying a number that would go
stale, and player capabilities pass through instead of being overwritten."
```

---

### Task 11: Ticket hygiene (A12)

Nothing here changes product code. It edits ticket files so the next agent does not re-implement a shipped feature or double-track a defect this phase owns.

**Files:**
- Modify: `.scratch/team-builder/dashboard/issues/01-community-scoping-history-games.md`, `02-dashboard-screen.md`, `03-home-button-navigation.md`, `04-dashboard-actions.md`, `05-e2e-reanchor-and-dashboard-coverage.md`, `06-dashboard-teaser-helpers.md`, `07-dashboard-teaser-sections.md`
- Modify: `.scratch/app-correctness/issues/01-reroll-produces-a-different-split.md`, `02-deletes-go-through-their-hooks.md`, `03-validate-players-at-the-boundary.md`, `04-import-merge-keeps-community.md`, `05-prune-dead-e2e-specs.md`
- Modify: `.scratch/app-health/issues/04-ci-runs-the-checks.md`, `08-swiss-pairs-without-rematches.md`, `11-import-survives-a-bad-file.md`, `15-e2e-specs-start-from-a-seeded-world.md`

**Interfaces:**
- Consumes: `docs/agents/issue-tracker.md`'s convention — one file per ticket, a `Status:` line near the top, outcome appended under a `## Comments` heading. The status vocabulary from `docs/agents/triage-labels.md`.
- Produces: nothing consumed by other tasks. This task can land at any point in the phase; it is independent of every other task.

- [ ] **Step 1: Close the seven delivered dashboard tickets**

All seven deliverables exist (`src/DashboardScreen.tsx`, `src/dashboardTeasers.ts`, `e2e/tests/dashboard/dashboard.spec.ts`, and the community-scoped History/Games filters). Set each file's `**Status:** ready-for-agent` line to `**Status:** resolved` and append a `## Comments` heading naming the delivering commit:

| File | `Status:` | Comments commit |
|---|---|---|
| `01-community-scoping-history-games.md` | `resolved` | `73f6646` |
| `02-dashboard-screen.md` | `resolved` | `f0e2b23` |
| `03-home-button-navigation.md` | `resolved` | `a87c705` (order later changed by `1702342`) |
| `04-dashboard-actions.md` | `resolved` | `3728887` |
| `05-e2e-reanchor-and-dashboard-coverage.md` | `resolved` | `42c17c7` |
| `06-dashboard-teaser-helpers.md` | `resolved` | `94a5757` |
| `07-dashboard-teaser-sections.md` | `resolved` | `b05bbb9` |

Verified commit subjects: `73f6646 fix: community-scope History sessions and Games tournaments`, `f0e2b23 feat: add Dashboard hub screen for the active community`, `a87c705 feat: dashboard-first landing with centered Home tab`, `3728887 feat: wire dashboard actions to existing flows`, `42c17c7 test: lock down dashboard hub behavior with e2e coverage (ticket 05)`, `94a5757 feat: add dashboard teaser helpers for recent players and active tournaments (ticket 06)`, `b05bbb9 feat: add recent players and active tournaments teasers to Dashboard (ticket 07)`.

The seven files are **not** deleted: the convention keeps the record, and `## Comments` is where the outcome goes.

- [ ] **Step 2: Record two corrections rather than papering over them**

Append to `03-home-button-navigation.md` under `## Comments`:

```
Correction: this ticket's acceptance says Home is *centered*. Commit 1702342
("feat: rail order + collapse toggle…") shipped Home **first** in NAV_ITEMS
(src/App.tsx:62-68), in both the rail and the bottom bar. Resolved with that
order; the centering claim is superseded.
```

Append to `05-e2e-reanchor-and-dashboard-coverage.md` under `## Comments`:

```
Correction: this ticket's acceptance says the full e2e suite passes. It has not
passed since 681051d ("feat(shell): desktop rail layout, unified breakpoints,
sticky nav"), which touched no spec file while src/index.css:1677-1679 hid
.bottom-nav inside @media (min-width: 1024px). That is exactly what
.scratch/debt/issues/01 and 02 fix.
```

- [ ] **Step 3: Correct `app-correctness/03`, do not close it**

Its claim that "No production code path calls them" of `validatePlayer`/`validateCapability` is stale: `src/roster/PlayerEditModal.tsx:126` calls `validatePlayer(draft, disciplines)` and renders the issues inline. The remaining gap — `parseBackup` and the JSON/CSV import branches — was real. Replace the stale sentence with the verified state, leave the status open, and append:

```
## Comments

Corrected 2026-09-17: PlayerEditModal.tsx:126 already calls
validatePlayer(draft, disciplines), so the "no production code path calls them"
claim was stale and is removed. The remaining gap (parseBackup, the JSON/CSV
import branches) is delivered by
.scratch/debt/issues/05-validate-players-where-data-enters.md.
```

- [ ] **Step 4: Cross-reference the eight absorbed originals**

Each gains a `## Comments` line pointing at its successor, with status left unchanged. Without this, a future agent picks up a ticket whose work this phase already claims.

| File | Successor |
|---|---|
| `.scratch/app-correctness/issues/01-reroll-produces-a-different-split.md` | `.scratch/debt/issues/03` |
| `.scratch/app-correctness/issues/02-deletes-go-through-their-hooks.md` | `.scratch/debt/issues/04` |
| `.scratch/app-correctness/issues/04-import-merge-keeps-community.md` | `.scratch/debt/issues/06` |
| `.scratch/app-correctness/issues/05-prune-dead-e2e-specs.md` | `.scratch/debt/issues/09` |
| `.scratch/app-health/issues/04-ci-runs-the-checks.md` | `.scratch/debt/issues/10` |
| `.scratch/app-health/issues/08-swiss-pairs-without-rematches.md` | `.scratch/debt/issues/07` |
| `.scratch/app-health/issues/11-import-survives-a-bad-file.md` | `.scratch/debt/issues/08` |
| `.scratch/app-health/issues/15-e2e-specs-start-from-a-seeded-world.md` | `.scratch/debt/issues/11` |

Each comment reads, for example:

```
## Comments

Absorbed into Phase A of the debt repayment effort as
.scratch/debt/issues/07-swiss-pairs-without-rematches.md. Status left as-is;
do not start this ticket.
```

- [ ] **Step 5: Verify the tracker state**

Run: `grep -rn "^\*\*Status:\*\*" .scratch/team-builder/dashboard/`
Expected: no line reading `ready-for-agent`. All seven read `resolved`.

- [ ] **Step 6: Confirm no product file changed**

Run: `git status --short`
Expected: modifications only under `.scratch/`. No file under `src/`, `e2e/`, or the repo root.

- [ ] **Step 7: Commit**

```bash
git add .scratch
git commit -m "docs: close the ticket sets that already shipped

team-builder/dashboard/issues/01..07 were all ready-for-agent with zero checked
boxes, but every deliverable exists; they now read resolved with the delivering
commit. app-correctness/03 is corrected rather than closed: it claimed no
production code path calls validatePlayer, and PlayerEditModal.tsx:126 does.
Eight absorbed originals gain a pointer to their successor."
```

---

## Spec Self-Review

Run in full against the spec.

**1. Spec coverage.** Every ticket 01–12 maps to a task: A01 and A02 → Task 1; A09 → Tasks 1 (the four nav specs) and 2 (the rest); A03 → Task 3; A04 → Task 4; A05 → Task 5; A06 → Task 6; A07 → Task 7; A08 → Task 8; A10 → Task 9; A11 → Task 10; A12 → Task 11. No gap.

**2. Placeholder scan.** No "TBD", "TODO", "implement later", "fill in details", "add appropriate error handling", "handle edge cases", "write tests for the above", or "similar to Task N". Every code change shows the code; every verification step names a command and an expected result.

**3. Type consistency.** `HubName` is one union defined in Task 1 and used by Tasks 3–6. `seedScript`/`gotoSeeded`/`gotoHubSeeded`/`hubButton`/`SeedWorld` keep exactly the signatures frozen in `contracts.md`. `parseBackup(text, disciplines?)` is one signature, backwards compatible. `ErrorBoundary` is the frozen class shape. `selectPairing` is defined in the one task that uses it. `standings`'s public signature is unchanged. `CsvRow`/`ImportSkip`/`assertImportSize`/`parsePlayerCsv`/`csvRowsToPlayers` match ticket 08 and Phase D36's expectation verbatim.

**4. Evidence that contradicts the spec — corrected here, with the source followed.**

- **A07's rematch counts.** The spec and tickets repeat "6 teams: 2,048 of 4,096 patterns; 8 teams: 1,024 of 4,096". Measured over the **reachable** patterns, counting only matches actually recorded: n=6 → 64 patterns of which **28** produce a round-3 rematch; n=8 → 256 of which **32**. Every one has a rematch-free alternative. The 4,096 figure counts 2^6 × 2^6 including unreachable states. The spec itself anticipates this — "the ticket below specifies its own enumeration rather than re-deriving them" — so the measured enumeration wins, and it is what Task 7's assertions encode.
- **A07's crowning fixture.** A 3-way tie can only be broken by game difference under best-of-N: with one game deciding a match, game difference is a monotone function of wins and cannot separate a tie. Measured: the decisive 6-team fixture needs a 2-1 series, and a probe of all 336 BO1 patterns across n ∈ {4,6,8} found zero such fixtures. Task 7's fixture therefore carries one deliberate 2-1 series, and the assertion is on the 2–4 band.
- **A05's E2E precondition.** The spec says the render throw comes from `SplitScreen:223 → describeFlags → strengthOf → computeStrength`. True, but **not sufficient**: measured, it throws only when the flagged team has **two or more** eligible covering candidates, because `strongestOnTeam` (`src/session/flow.ts:34`) sorts only to pick the strongest and returns a single candidate without calling `computeStrength`. Task 5's seed therefore places two malformed MLBB-eligible players on the flagged team, and a probe confirms `Capability for "Mobile Legends" is missing rating for attribute "teamwork".` is thrown.
- **A05's sample-data premise.** The spec says "Valid players import exactly as before, so `sample-data/*.json` stays clean." Measured: `sample-data/futsal-roster.json` is `version: 1` with **7 of 25** players failing the app's own `validatePlayer` (a `preferredRole` outside `eligibleRoles`), and `src/App.tsx:537-538` routes any object with a `version` key into `handleImport` — the branch A05 edits. So strict validation refuses that file between A05 and B20. `mpl-id-roster.json` and `src/data/samplePlayers.ts` are clean (0 invalid each). Confirmed with Phase B: `sample-data/*.json` stays B20's exclusive ownership, A05 carries no companion fix, and A05's assumption plus the window are stated in Task 5.
- **A02's stated mechanism.** The spec justifies the replacement assertion with "focusable rows carry `scroll-margin-bottom: 96px` (`src/index.css:753-757`), which is what keeps the last row clear of the sticky bar." Measured: that rule is `.shell :is(button, a, [tabindex]):focus-visible` (`src/index.css:758-759`) — it applies only under `:focus-visible`, and a programmatic scroll does not trigger it (`scrollMarginBottom` computed `0px`, `focusVisible` false at 390×844). What actually keeps the row clear is that the sticky bar sits in normal flow at the column's foot (`.bottom-nav { margin-top: auto }`, `:682`), so the document's scrollable tail is below it. The spec's **decision** stands — the padding assertion is replaced by the behavioural one, and `.app` has no padding rule at all — but Task 1 states the real mechanism and scrolls explicitly to the document foot, so the assertion is deterministic rather than dependent on `scrollIntoViewIfNeeded`'s internals. Confirmed the assertion can still fail: staging a fixed 300 px bar puts the last row's bottom at 658.5 against a nav top of 544.

**5. Disagreements with `audit-findings.md`.** The audit says the re-anchor touches "14 spec files"; it does not — four of the fourteen are deleted by A09, so **10** are rewritten, one of which is `dashboard.spec.ts`, and A01 also changes `tsconfig.json` and adds two files. The audit's `useState` (13, corrected), `noUnusedLocals` (19, corrected) and `PageHeader`/`Screen` consumer counts (8 and 7, corrected) do not affect any task here. The audit's "7.1 min" suite duration is not used as a baseline, per the spec's own instruction.

**6. Task independence.** Each task ends with a deliverable testable on its own: Task 1 by the full suite at 37 green; Task 2 by the untracked-file check and 36 green; Task 3 by its unit case and its spec; Task 4 by the row count without a reload; Task 5 by the boundary message; Task 6 by the community switch; Task 7 by the exhaustive block and the tie fixture; Task 8 by its 11 unit cases; Task 9 by a local run of the same sequence; Task 10 by 42 green plus the seeded grep; Task 11 by the tracker grep. No task requires simultaneous edits to a file another task owns: Task 5 precedes Task 6 on `transfer.test.ts`, and Task 5's `handleImport` range (`:426-433`, `:522-567`) is disjoint from Task 8's (`:515-520`, `:569-612`).
