# Honest Claims Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every claim comp3tive makes about itself true — in the split screen, on the landing page, in the seeded data, and in the documents humans and agents read.

**Architecture:** One new pure module (`src/session/gapProvenance.ts`) becomes the single phrasing source for solver provenance, consumed by the split screen's two readout sites and reserved for Phase D's share text. Everything else is a scoped rewrite of a string, a JSON file, or a Markdown document: the landing page's claims, five "squad"-means-community strings, three sample rosters, one seeded discipline, and eight contradicting documents. No solver code changes; no new CSS; no visual redesign.

**Tech Stack:** React 19, TypeScript 5.8, Vite 6, Vitest 3 (`test.include: ["src/**/*.test.ts"]` — `.ts` only, `.tsx` excluded), Playwright 1.62 (`workers: 1`, `viewport 1280x720`), IndexedDB with `fake-indexeddb`.

**Spec:** `docs/superpowers/specs/2026-09-17-honest-claims-design.md`

## Global Constraints

Every task's requirements implicitly include this section. Values are copied verbatim from the spec.

- **Provenance rule.** `proven` **iff** `result.solver.optimal === true`. Read that field and nothing else — not the source, not a re-roll counter, not `nodesExplored`. The budget is **not** predictable from pool size, so no copy may encode a size rule.
- **Exact copy, proven path (unchanged, must stay byte-identical):** balanced `Dead even. Fair game.` · otherwise `Gap {gap.toFixed(1)}. {Team} leads.`
- **Exact copy, best-found path:** balanced `Dead even. Best gap found.` · otherwise `Gap {gap.toFixed(1)}. {Team} leads. Best gap found.`
- **The qualifier is the five words `Best gap found.`** It rides inside the existing `<span className="fine">`. No new CSS, no new classes, no layout change.
- **Banned from the qualifier's copy:** `aborted`, `node budget`, `heuristic`, `search`, `exhaustive`, and any em-dash (`docs/design.md:72`: "**No em-dashes in visible copy.**").
- **The one noun is Community.** `CONTEXT.md` is authoritative: Community is the group; **Saved Squad** keeps its name. Six preserved strings that genuinely mean Saved Squad must not change.
- **Landing trust list is exactly three rows, in this order, verbatim:**
  1. `The gap is the proven minimum for a two-team split.`
  2. `Your data stays on your device. No account, no server.`
  3. `Free, no account. Runs in your browser.`
- **The offline claim is deleted, not softened.** `contracts.md` D4 freezes the sequencing: B14 removes it, D02 restores it when the PWA ships.
- **Landing lede, verbatim:** `comp3tive splits your roster into teams with the smallest strength gap it can prove, honoring every role along the way. Futsal, MLBB, badminton, then the tournament on those teams.`
- **Badminton ships as doubles:** roles `front-court` / `rear-court`, `team: { minTeamSize: 2, maxTeamSize: 2, rolesRequired: true }`, `strengthModel: { kind: "mean" }`. `SEED_DISCIPLINES` becomes `[FUTSAL_DISCIPLINE, MLBB_DISCIPLINE, BADMINTON_DISCIPLINE]`, in that order.
- **Sample data format is v1, unchanged:** `"version": 1`, an `exportedAt` ISO string, `players`, and `sessions: []`.
- **The solver is not touched.** No ticket here changes `NODE_BUDGET` (`src/solver/solver.ts:21`), the pruning bound, the search order, or any file under `src/solver/`.
- **File ownership.** Phase B owns: `index.html`, `src/landing.tsx`, `src/landing.css`, `src/session/SplitScreen.tsx` (**gap copy only**), `src/domain/seed.ts`, `docs/FLOW.md`, `docs/design.md`, `docs/spec/0002-tournaments-v1.md`, `docs/adr/0002-*.md`, `sample-data/*.json`, root `DOMAIN_MODEL.md` / `IMPLEMENTATION_PLAN.md`. Three named additions this plan justifies: the new `src/session/gapProvenance.ts`; the five test files B19 shifts; and three e2e spec files (B13's, B14's, B15's).
- **The "no spec edited" rule does not apply to B14.** It guards Phase C's behaviour-preserving refactors. B14 changes user-visible copy, so editing `e2e/tests/landing/landing.spec.ts` is correct and required. Do not preserve the old assertions to keep the file byte-stable.
- **Unit tests are `.ts` only.** `vite.config.ts` sets `test.include: ["src/**/*.test.ts"]`; `.tsx` is excluded. Any extracted logic you want under unit test must live in a `.ts` file.
- **Always rebuild before trusting an e2e run.** `e2e/playwright.config.ts` serves `dist/` via `npm run preview` with `reuseExistingServer: true`.
- **Playwright path argument is relative to `e2e/`.** `testDir` is `./tests`, so a single-spec run is `npx playwright test --config=e2e/playwright.config.ts tests/<group>/<file>.spec.ts`. A bare `e2e/tests/...` path finds no tests.
- **Owner-authored files.** `DOMAIN_MODEL.md`, `IMPLEMENTATION_PLAN.md`, `COMP3TIVE_COMPREHENSIVE_ANALYSIS.md`, and `docs/design.md` were authored by the repo owner. Nothing is moved or deleted without explicit confirmation, recorded in the ticket's `## Comments`.

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `src/session/gapProvenance.ts` | `GapKind`, `gapKind(result)`, `gapQualifier(result)` — the single phrasing source for solver provenance |
| Create | `src/session/gapProvenance.test.ts` | Unit tests for both functions, including the swap-provenance case |
| Modify | `src/session/SplitScreen.tsx:130-141` | `GapMeter`'s readout: qualified balanced + non-balanced branches (2-team pitch) |
| Modify | `src/session/SplitScreen.tsx:334-345` | The 3+ team stack's `.readout`: same two branches |
| Create | `e2e/tests/split/gap-provenance.spec.ts` | Proves both render sites in both provenance states, and the re-roll path |
 | Modify | `src/App.tsx:1061` | Roster empty state: "No players in this community" (moves to `src/shell/RosterScreen.tsx` when C26 lands) |
| Modify | `src/App.tsx:1123` | Roster CTA: "Split the roster" (moves to `src/shell/RosterScreen.tsx` when C26 lands) |
| Modify | `src/session/MatchScreen.tsx:48` | Match setup lede: "then the roster" |
| Modify | `src/session/SplitScreen.tsx:304` | Tournament badge: "Tournament teams" |
| Modify | `src/session/SplitScreen.tsx:400` | Submit button: "Save teams to tournament →" |
| Create | `e2e/tests/community/noun.spec.ts` | Pins the corrected Roster empty state and split CTA |
| Modify | `sample-data/futsal-roster.json` | 25-player audience-shaped roster that passes `validatePlayer` |
| Modify | `sample-data/mpl-id-roster.json` | 25-player roster with five specialists per role |
| Create | `sample-data/badminton-roster.json` | 10-player doubles roster for B19 |
| Create | `src/data/sample-data.validation.test.ts` | Proves all three files pass `validatePlayer` and split clean |
| Modify | `src/domain/seed.ts:52` | `BADMINTON_DISCIPLINE` + three-entry `SEED_DISCIPLINES` |
| Modify | `src/data/sample-data.ts:2-7` | Registers `badminton-roster.json` in `SAMPLE_DATA` |
| Modify | `src/domain/seed.test.ts:6` | Catalog assertion becomes three ids; badminton shape assertions |
| Modify | `src/storage/indexed-db.test.ts:73,85,97` | Seeded catalog becomes three ids; custom fixture id becomes `padel` |
| Modify | `src/storage/migration.test.ts:170,176` | Custom-discipline fixture id becomes `padel` |
| Modify | `src/domain/validation.test.ts:42,44` | Unknown-discipline probe becomes `padel` |
| Modify | `src/data/sample-data.test.ts:17-23` | Catalog length becomes 3; adds `hasSampleData("badminton")` |
| Modify | `index.html:9` | Meta description drops the offline half |
| Modify | `index.html:71-75` | Lede: "the smallest strength gap it can prove" |
| Modify | `index.html:123` | "the number that shows it" |
| Modify | `index.html:145` | "the solver just balanced" |
| Modify | `index.html:157` | Roster rail `Disciplines` fact becomes `3` |
| Modify | `index.html:180-184` | Trust list: the three corrected rows |
| Modify | `src/landing.tsx:110-116` | Badminton card: the shipped doubles definition |
| Modify | `e2e/tests/landing/landing.spec.ts:57-63` | Trust assertions match the corrected strings |
| Modify | `e2e/tests/landing/landing.spec.ts:47-66` | Adds the copy-pinning assertions |
| Modify | `docs/adr/0002-tournament-first-flow.md:5,16` | Status accepted + dated; `nextMatchId` consequence corrected |
| Modify | `docs/adr/0004-origin-aware-navigation.md:8` | Gains its missing status line |
| Modify | `DESIGN.md:195` | Absorbs `## Copy voice` and `## Accessibility & quality floor` |
| Delete | `docs/design.md` | The losing direction (owner-confirmed, with a pointer fallback) |
 | Modify | `docs/FLOW.md:1,26-34,43,74-86,120,137-138,153,167,174-175,179` | Five hubs with Home, the tournaments hub named Games, §3 records the rendered depth and the one dead crumb site |
| Modify | `docs/spec/0002-tournaments-v1.md:4,31,46,48,52,54,63` | v6 / backup v4; Data Model matches `src/domain/types.ts` |
| Modify | `docs/spec/0001-team-builder-v1.md:94` | Badminton ships in v1 |
| Modify | `docs/superpowers/plans/2026-09-10-paper-pencil-redesign.md:9` | Drops the Tailwind claim |
| Move | `DOMAIN_MODEL.md` → `docs/archive/DOMAIN_MODEL.md` | With a superseded banner (owner-confirmed) |
| Move | `IMPLEMENTATION_PLAN.md` → `docs/archive/IMPLEMENTATION_PLAN.md` | With a superseded banner (owner-confirmed) |

**Task order and its one real dependency.** Tasks 1–3 are independent of everything else. Task 4 (B20) writes `sample-data/badminton-roster.json`; Task 5 (B19) registers it and asserts the catalog, so **4 before 5** (ticket 19 declares `Blocked by: 20`). Task 6 (B14) needs Task 5's badminton definition for the card strings and the rail count, so **5 before 6** (ticket 14 declares `Blocked by: 19`). Tasks 7–11 are documentation and independent of all of the above.

---

### Task 1: The provenance module

**Files:**
- Create: `src/session/gapProvenance.ts`
- Test: `src/session/gapProvenance.test.ts`

**Interfaces:**
- Consumes: `SplitResult` from `src/domain/types.ts:150-158`, whose `solver` field is `{ optimal: boolean; nodesExplored: number; elapsedMs: number }` (line 157).
- Produces:
  - `export type GapKind = "proven" | "best-found";`
  - `export function gapKind(result: SplitResult): GapKind;`
  - `export function gapQualifier(result: SplitResult): string | null;`

Phase D's share text (`src/share/**`) imports `gapQualifier` from this module. Keep the module free of React, DOM, and solver imports so it stays importable from a plain `.ts` unit test and from a worker-free share path.

- [ ] **Step 1: Write the failing test**

Create `src/session/gapProvenance.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { gapKind, gapQualifier } from "./gapProvenance";
import type { SplitResult } from "../domain/types";

/** A minimal result whose gap is the only thing the module reads. */
const resultWith = (solver: SplitResult["solver"], gap = 0.3): SplitResult => ({
  teams: [
    { index: 0, slots: [], totalStrength: 0, avgStrength: 3 },
    { index: 1, slots: [], totalStrength: 0, avgStrength: 3 - gap },
  ],
  gap,
  flags: [],
  unassigned: [],
  solver,
});

describe("gapKind", () => {
  it("is proven when the search ran to completion", () => {
    expect(gapKind(resultWith({ optimal: true, nodesExplored: 51, elapsedMs: 7 }))).toBe("proven");
  });

  it("is best-found when the search stopped short", () => {
    expect(gapKind(resultWith({ optimal: false, nodesExplored: 4_000_001, elapsedMs: 273 }))).toBe("best-found");
  });

  it("reads only `optimal`: a swap's nodesExplored of 0 is still proven", () => {
    // `swapPlayers` stamps `optimal: true, nodesExplored: 0` (src/session/edit.ts:64).
    // The field is provenance, not a property of the current teams.
    expect(gapKind(resultWith({ optimal: true, nodesExplored: 0, elapsedMs: 0 }))).toBe("proven");
  });

  it("does not infer provenance from the pool or the gap", () => {
    // Identical gaps, different provenance: the only honest rule is the field.
    const a = resultWith({ optimal: true, nodesExplored: 2, elapsedMs: 0 });
    const b = resultWith({ optimal: false, nodesExplored: 4_000_001, elapsedMs: 200 });
    expect(a.gap).toBe(b.gap);
    expect(gapKind(a)).not.toBe(gapKind(b));
  });
});

describe("gapQualifier", () => {
  it("returns null when proven, so the proven path emits no qualifier", () => {
    expect(gapQualifier(resultWith({ optimal: true, nodesExplored: 51, elapsedMs: 7 }))).toBeNull();
  });

  it("returns the five-word qualifier when best-found", () => {
    expect(gapQualifier(resultWith({ optimal: false, nodesExplored: 4_000_001, elapsedMs: 273 })))
      .toBe("Best gap found.");
  });

  it("never says what the engine did, only what the number is", () => {
    const words = gapQualifier(resultWith({ optimal: false, nodesExplored: 4_000_001, elapsedMs: 273 }))!;
    for (const banned of ["aborted", "node budget", "heuristic", "search", "exhaustive", "—"]) {
      expect(words.toLowerCase()).not.toContain(banned);
    }
    expect(words).not.toContain("\u2014");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/session/gapProvenance.test.ts`
Expected: FAIL — `Failed to resolve import "./gapProvenance"`.

- [ ] **Step 3: Write the minimal implementation**

Create `src/session/gapProvenance.ts`:

```ts
import type { SplitResult } from "../domain/types";

export type GapKind = "proven" | "best-found";

/**
 * Whether the search that produced these teams ran to completion.
 *
 * Reads `result.solver.optimal` and nothing else. That is the only rule true
 * on every path: the budget is exhausted or not depending on the pool's
 * strength distribution, not on its size, so size, source, and re-roll count
 * are all the wrong inputs. `varietySplit` stamps `optimal: false`
 * (`src/solver/solver.ts:419`) but delegates to `fairSplit` at `:409` when it
 * finds no candidate, and that fallback really is the exact optimum.
 *
 * A `swapPlayers` result carries `optimal: true` with `nodesExplored: 0`
 * (`src/session/edit.ts:64`), which means "no search ran", not "this
 * arrangement is minimal". The split screen deliberately shows no provenance
 * word in that case rather than claiming a proof the user's own edit erased.
 */
export function gapKind(result: SplitResult): GapKind {
  return result.solver.optimal === true ? "proven" : "best-found";
}

/**
 * The screen's qualifier, or null when the gap is proven.
 *
 * Null is what keeps the proven path byte-identical to the pre-B13 markup: a
 * proven result must not be hedged, and a 2-team pool (where the claim is
 * strongest) still reads exactly as it did.
 */
export function gapQualifier(result: SplitResult): string | null {
  return gapKind(result) === "proven" ? null : "Best gap found.";
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/session/gapProvenance.test.ts`
 Expected: PASS — 7 tests (4 `gapKind`, 3 `gapQualifier`).

- [ ] **Step 5: Commit**

```bash
git add src/session/gapProvenance.ts src/session/gapProvenance.test.ts
git commit -m "feat(session): state whether a split's gap was proven

One rule, read from the field: proven iff result.solver.optimal. The
budget is not predictable from pool size, so no size rule can be honest."
```

---

### Task 2: Both render sites state their provenance

**Files:**
- Modify: `src/session/SplitScreen.tsx:130-141` (inside `GapMeter`, the 2-team pitch layout)
- Modify: `src/session/SplitScreen.tsx:334-345` (the 3+ team stack's `.readout`)
- Create: `e2e/tests/split/gap-provenance.spec.ts`

**Interfaces:**
- Consumes: `gapQualifier(result: SplitResult): string | null` from Task 1.
- Produces: no new export. The two `.readout` render sites emit the qualifier.

**Scope discipline.** `contracts.md` scopes B13 to "gap copy only" in `SplitScreen.tsx`. Do not touch `reroll` (Phase A03 owns `:255-264`), the header, the badges, the deal animation, or the `SaveSquadModal`. The only edits are the two readout blocks. The `import` line gains one name.

- [ ] **Step 1: Write the failing e2e test**

`e2e/support/seed.ts` does not exist until Phase A01 lands. Even once it does, A01's `seedScript` normalises **every** player to one fixed all-rounder capability (`mechanics: 4, "game-sense": 4, "hero-pool": 4, teamwork: 4`, all five roles eligible). Verified by probe: that pool yields `gap=0`, `optimal=true`, `nodes=2` for 10/2, 25/2, 25/3, 25/4 and 25/5 — so it can produce the proven path but **never** the best-found path. This spec therefore seeds its own capabilities inline and does not use the shared helper. (Recorded as a cross-phase finding; it is not a defect in A01, which only needs shape, not varied strengths.)

Create `e2e/tests/split/gap-provenance.spec.ts`:

```ts
/**
 * B13: the split screen says whether its gap was proven minimal or is the best
 * the search found before it stopped.
 *
 * This spec seeds its own capabilities rather than using e2e/support/seed.ts's
 * world: that helper normalises every player to one uniform all-rounder, which
 * measures `gap=0, optimal=true, nodes=2` at every team count and can therefore
 * never exercise the best-found path. Both states are the subject here.
 *
 * Measured on HEAD (shipped solver, 2026-09-17):
 *   PROVEN-A    10 MLBB, teamCount 2 -> optimal=true,  nodes=52,  gap=0.1  "Gap 0.1. Team B leads."
 *   BESTFOUND-A 25 futsal, teamCount 3 -> optimal=false, nodes=4,000,001, gap=0.1322 "…Team C leads. Best gap found."
 *   BESTFOUND-B 25 futsal, teamCount 5 -> optimal=false, nodes=4,000,001, gap=0     "Dead even. Best gap found."
 */
import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

const MLBB_ROLES = ["tank", "assassin", "mage", "marksman", "fighter"];
const FUTSAL_ROLES = ["goalkeeper", "defender", "winger", "pivot"];

/** teamCount 2 against 10 players is proven: 5+5, gap 0.1 (avg 3.60 / 3.70). */
const PROVEN_TEN = [
  [4, 4, 3, 5], [3, 3, 3, 4], [5, 4, 4, 4], [3, 4, 3, 3], [4, 4, 4, 4],
  [3, 3, 4, 3], [4, 5, 4, 3], [4, 3, 3, 3], [4, 4, 3, 5], [3, 4, 3, 3],
] as const;

interface Seed {
  world: Record<string, unknown[]>;
  activeCommunityId: string;
}

/** Seed IndexedDB before app code runs, then load the app. */
async function gotoSeeded(page: Page, seed: Seed) {
  const script = `(() => {
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
      localStorage.setItem("tb-community", ${JSON.stringify(seed.activeCommunityId)});
      for (const [storeName, rows] of Object.entries(${JSON.stringify(seed.world)})) {
        if (!rows.length) continue;
        const tx = db.transaction(storeName, "readwrite");
        for (const row of rows) tx.objectStore(storeName).put(row);
      }
      db.close();
    };
    request.onerror = () => console.error("seed failed");
  })();`;
  await page.addInitScript(script);
  await page.goto("./");
  await expect(page.locator(".app")).toBeVisible({ timeout: 15000 });
}

const community = { id: "comm-gap", name: "Gap Crew", createdAt: 100 };

/** The 10-player proven pool above. */
const provenPlayers = () =>
  PROVEN_TEN.map((r, i) => ({
    id: `pp-${i + 1}`,
    communityId: "comm-gap",
    name: `Player ${i + 1}`,
    capabilities: [{
      disciplineId: "mlbb",
      attributeRatings: { mechanics: r[0], "game-sense": r[1], "hero-pool": r[2], teamwork: r[3] },
      eligibleRoles: MLBB_ROLES,
      preferredRole: MLBB_ROLES[i % 5],
    }],
  }));

/** 25 futsal players, all four roles eligible, varied ratings: the budget is exhausted. */
const exhaustedPlayers = () =>
  Array.from({ length: 25 }, (_, i) => ({
    id: `fp-${i + 1}`,
    communityId: "comm-gap",
    name: `Player ${i + 1}`,
    capabilities: [{
      disciplineId: "futsal",
      attributeRatings: {
        technical: 1 + ((i * 7) % 5),
        fitness: 1 + ((i * 5) % 5),
        "game-iq": 1 + ((i * 3) % 5),
      },
      eligibleRoles: FUTSAL_ROLES,
      preferredRole: FUTSAL_ROLES[i % 4],
    }],
  }));

/** Walk the Roster "Split match" -> "Set the match" flow to a split, with teamCount dialled in. */
async function splitWith(page: Page, disciplineName: string, teamCount: number) {
  await page.getByRole("button", { name: "Split match" }).click();
  await expect(page.locator(".match-setup")).toBeVisible({ timeout: 5000 });
  await page.locator(".game", { hasText: disciplineName }).click();
  await expect(page.locator(".chip-player").first()).toBeVisible({ timeout: 5000 });

  // Every eligible player on.
  const chips = page.locator(".chip-player");
  const count = await chips.count();
  for (let i = 0; i < count; i++) {
    const chip = chips.nth(i);
    if ((await chip.getAttribute("aria-pressed")) !== "true") await chip.click();
  }

  // Dial the stepper to the requested team count.
  for (let guard = 0; guard < 10; guard++) {
    const current = Number(await page.locator(".stepper .count").innerText());
    if (current === teamCount) break;
    await page.getByRole("button", { name: current < teamCount ? "More teams" : "Fewer teams" }).click();
  }
  await expect(page.locator(".stepper .count")).toHaveText(String(teamCount));

  await page.getByTestId("split-button").click();
  await expect(page.locator(".split-screen")).toBeVisible({ timeout: 15000 });
}

/** The `.readout` copy, collapsed to single spaces so a line break cannot fail the match. */
const readout = async (page: Page) =>
  (await page.locator(".readout").first().innerText()).replace(/\s+/g, " ").trim();

test.describe("gap provenance", () => {
  test("a proven 2-team split carries no provenance word (the GapMeter site)", async ({ page }) => {
    await gotoSeeded(page, {
      activeCommunityId: "comm-gap",
      world: { communities: [community], players: provenPlayers(), sessions: [], tournaments: [], "saved-squads": [] },
    });
    await splitWith(page, "Mobile Legends", 2);

    // The 2-team branch mounts GapMeter (src/session/SplitScreen.tsx:330).
    await expect(page.locator(".pitch .scale")).toBeVisible();
    // `gapQualifier` returns null when proven, so the readout is the pre-B13 string.
    await expect(page.locator(".readout").first()).toHaveText("Gap 0.1. Team B leads.");
    await expect(page.locator(".readout").first()).not.toContainText("Best gap found.");
  });

  test("an exhausted 3-team split says so (the 3+ stack site)", async ({ page }) => {
    await gotoSeeded(page, {
      activeCommunityId: "comm-gap",
      world: { communities: [community], players: exhaustedPlayers(), sessions: [], tournaments: [], "saved-squads": [] },
    });
    await splitWith(page, "Futsal", 3);

    // The 3+ branch renders its own `.readout` (src/session/SplitScreen.tsx:334-345)
    // and no GapMeter, so this asserts the second site independently.
    await expect(page.locator(".team-stack")).toBeVisible();
    await expect(page.locator(".pitch .scale")).toHaveCount(0);
    await expect(page.locator(".readout").first()).toHaveText("Gap 0.1. Team C leads. Best gap found.");
  });

  test("an exhausted but balanced split says so", async ({ page }) => {
    await gotoSeeded(page, {
      activeCommunityId: "comm-gap",
      world: { communities: [community], players: exhaustedPlayers(), sessions: [], tournaments: [], "saved-squads": [] },
    });
    await splitWith(page, "Futsal", 5);

    await expect(page.locator(".team-stack")).toBeVisible();
    await expect(page.locator(".readout").first()).toHaveText("Dead even. Best gap found.");
  });

  test("re-rolling a proven split makes the qualifier appear", async ({ page }) => {
    await gotoSeeded(page, {
      activeCommunityId: "comm-gap",
      world: { communities: [community], players: provenPlayers(), sessions: [], tournaments: [], "saved-squads": [] },
    });
    await splitWith(page, "Mobile Legends", 2);

    await expect(page.locator(".readout").first()).toHaveText("Gap 0.1. Team B leads.");

    // Re-roll goes through varietySplit, which stamps optimal: false.
    await page.getByRole("button", { name: "Re-roll" }).click();
    await expect(page.locator(".readout").first()).toContainText("Best gap found.");
  });
});
```

- [ ] **Step 2: Build and run the test to verify it fails**

```bash
npx vite build && npx playwright test --config=e2e/playwright.config.ts tests/split/gap-provenance.spec.ts
```

Expected: FAIL. The first test fails because `.readout` currently reads `Gap 0.1. Team B leads.` — wait, that already passes. The **second, third and fourth** tests fail because the readout currently reads `Gap 0.1. Team C leads.`, `Dead even. Fair game.` and `Gap 0.1. Team B leads.` with no qualifier in each case. If the first test fails on something else (a locator or the flow), fix the locator in the test generator's own before-touch, not the app.

Verification of the *failing* direction: run only the provenance-bearing cases:

```bash
npx playwright test --config=e2e/playwright.config.ts tests/split/gap-provenance.spec.ts --grep "says so|qualifier appear"
```

Expected: 3 failed, each with an error of the form `Expected: "…Best gap found." Received: "…"`.

- [ ] **Step 3: Implement the 2-team site**

In `src/session/SplitScreen.tsx`, add the import after line 5 (`import { freshSplit, swapPlayers } from "./edit";`):

```tsx
import { gapQualifier } from "./gapProvenance";
```

Replace the readout block inside `GapMeter` (currently `src/session/SplitScreen.tsx:130-141`):

```tsx
      <div className="readout">
        {balanced ? (
          <>Dead even. <span className="fine">Fair game.</span></>
        ) : (
          <>
            Gap {gap.toFixed(1)}.{" "}
            <span className="fine">
              {leader ? teamName(leader.index) : "?"} leads.
            </span>
          </>
        )}
      </div>
```

with:

```tsx
      <div className="readout">
        {balanced ? (
          <>Dead even. <span className="fine">{gapQualifier(result) ?? "Fair game."}</span></>
        ) : (
          <>
            Gap {gap.toFixed(1)}.{" "}
            <span className="fine">
              {leader ? teamName(leader.index) : "?"} leads
              {gapQualifier(result) ? ` ${gapQualifier(result)}` : ""}.
            </span>
          </>
        )}
      </div>
```

- [ ] **Step 4: Implement the 3+ team site**

Replace the readout block inside the `result.teams.length > 2` branch (currently `src/session/SplitScreen.tsx:334-345`):

```tsx
          <div className="readout">
            {balanced ? (
              <>Dead even. <span className="fine">Fair game.</span></>
            ) : (
              <>
                Gap {result.gap.toFixed(1)}.{" "}
                <span className="fine">
                  {teamName(result.teams.reduce((a, b) => (a.avgStrength > b.avgStrength ? a : b)).index)} leads.
                </span>
              </>
            )}
          </div>
```

with:

```tsx
          <div className="readout">
            {balanced ? (
              <>Dead even. <span className="fine">{gapQualifier(result) ?? "Fair game."}</span></>
            ) : (
              <>
                Gap {result.gap.toFixed(1)}.{" "}
                <span className="fine">
                  {teamName(result.teams.reduce((a, b) => (a.avgStrength > b.avgStrength ? a : b)).index)} leads
                  {gapQualifier(result) ? ` ${gapQualifier(result)}` : ""}.
                </span>
              </>
            )}
          </div>
```

Note the move of the full stop: the proven path emits `leads.` and the best-found path emits `leads. Best gap found.` — two sentences, both with terminal periods. No em-dash anywhere.

- [ ] **Step 5: Prove the proven path is byte-identical**

Run: `git diff --stat src/session/SplitScreen.tsx`
Expected: one import line added and the two readout blocks changed; nothing else in the file. Then confirm the proven markup is unchanged by running the pre-existing landing spec, which mounts `SplitScreen` over the real hero roster and asserts the surrounding structure:

```bash
npx vite build && npx playwright test --config=e2e/playwright.config.ts tests/landing/landing.spec.ts
```

Expected: PASS, 16 passed / 0 failed (unchanged from the audit's landing result — `landing.spec.ts` can be run whole because the file passes 16/16 today). The hero roster measures `optimal: true, nodesExplored: 51, gap 0.1`, so `gapQualifier` returns `null` there and the markup is byte-identical.

- [ ] **Step 6: Run the new spec to verify it passes**

```bash
npx vite build && npx playwright test --config=e2e/playwright.config.ts tests/split/gap-provenance.spec.ts
```

Expected: PASS, 4 passed.

- [ ] **Step 7: Run the unit suite**

Run: `npx vitest run`
 Expected: PASS. The count rises from 114 by Task 1's 7 tests.

- [ ] **Step 8: Commit**

```bash
git add src/session/SplitScreen.tsx e2e/tests/split/gap-provenance.spec.ts
git commit -m "feat(session): the split says whether its gap was proven

Both readout sites now read gapQualifier. Proven stays hedgeless: the
null return is why the 2-team case emits byte-identical markup."
```

---

### Task 3: One noun — Community

**Files:**
- Modify: `src/App.tsx:1061`
- Modify: `src/App.tsx:1123`
- Modify: `src/session/MatchScreen.tsx:48`
- Modify: `src/session/SplitScreen.tsx:304`
- Modify: `src/session/SplitScreen.tsx:400`
- Create: `e2e/tests/community/noun.spec.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: no new export. Five user-visible strings change; the preserved set below is unchanged.

**The six colliding strings (the group meaning "squad", all replaced):**

| File:line | Current | After |
|---|---|---|
| `src/App.tsx:1061` | `No players in this squad` | `No players in this community` |
| `src/App.tsx:1123` | `Split the squad` | `Split the roster` |
| `src/session/MatchScreen.tsx:48` | `then the squad` | `then the roster` |
| `src/session/SplitScreen.tsx:304` | `Tournament squad` | `Tournament teams` |
| `src/session/SplitScreen.tsx:400` | `Save tournament squad →` | `Save teams to tournament →` |

**The six uses to preserve, verified to mean Saved Squad (never touch these):**

| File:line | String | Why it stays |
|---|---|---|
| `src/App.tsx:67` | nav label `"Squads"` | names the Saved Squads hub; matches that screen's h1 (`src/session/SquadsScreen.tsx:116`) and A11's `hubButton` accessible name |
| `src/App.tsx:450` | `…and N saved squads?` | the import merge prompt, naming the SavedSquad records |
| `src/session/SquadsScreen.tsx:88` | `← Squads` | the hub back control |
| `src/session/SquadsScreen.tsx:115` | `kicker="Squad bank"` | the Saved Squads screen's kicker |
| `src/session/SplitScreen.tsx:375` | `"Squad detail"` | the split's back button for `source === "squad"` |
| `src/session/SplitScreen.tsx:378` + `:410` | `onSaveSquad` … `<SaveSquadModal` | the Saved Squad save path (`data-testid="save-squad-button"` at `:383`) |

Also already correct, verified, and unchanged: the switcher's kicker `Community` (`src/App.tsx:821`), the menu heading `Community` (`:838`), the switcher `aria-label="Active community"` (`:829`), the add-community button's `aria-label`/`title="New community"` (`:883-884`), and the add form's label `New community` (`:931`). There is **no** user-visible `SQUAD` string in the app: `grep -rn "SQUAD" src/` matches only the internal constant `SAVED_SQUAD_STORE` and its five uses in `src/storage/indexed-db.ts` (`:24`, `:27`, `:48`, `:49`, `:319`, `:325`), which is a store name, never rendered. The audit's "SQUAD ▾" label came from `docs/BUSINESS_FLOW_REVIEW.md` §2, which describes a superseded UI.

- **No existing spec assertion changes.** `getByTitle("New community")` does not change, so the 13 spec files that create a community through it need no edit (verified: 13 `e2e/**/*.ts` files contain that exact call; a further 12 use the `.add-community` form input, which also does not change). No spec asserts any of the five replaced strings — the one apparent hit, `e2e/tests/tournament/split-tourney.spec.ts:2`, is the file's header comment (`* Tournament squad split: verify SplitScreen shows tournament context`), not an assertion; the comment may be reworded, no locator moves.

**Two of these five strings move to another file after Phase C26, and C must carry them.** Phase C26 extracts the roster hub out of `src/App.tsx` into `src/shell/RosterScreen.tsx`, so both of the `src/App.tsx` edits in this task travel with it: the empty state at `:1061` (`No players in this community`) and the CTA label at `:1123` (`Split the roster`). C is already told not to rename independently (`contracts.md` D2: "**C must not rename independently** — it reads B15's outcome"), so the rule for C26 is: move the strings, do not re-derive them. Confirm both read as this task set them after C26 lands. The other three strings (`src/session/MatchScreen.tsx:48`, `src/session/SplitScreen.tsx:304`, `:400`) are already outside `src/App.tsx` and are unaffected.

This spec (`e2e/tests/community/noun.spec.ts`) is therefore deliberately assertion-side only: it drives the running app to the Roster hub rather than locating a file, so it survives C26's move without an edit. That is why it uses `getByRole("button", { name: "Roster", exact: true })` rather than any class inside the roster screen.

- [ ] **Step 1: Write the failing test**

Create `e2e/tests/community/noun.spec.ts`:

```ts
/**
 * B15: the group is a Community in every string a user reads.
 *
 * "Squad" survives only where it names the curated, named split (Saved Squad),
 * which CONTEXT.md deliberately calls a squad. These two assertions cover the
 * two replaced strings that render on a seeded, empty-roster screen.
 */
import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

/** Seed an empty community so the Roster renders its empty state. */
async function gotoSeededEmptyRoster(page: Page) {
  const script = `(() => {
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
      localStorage.setItem("tb-community", "comm-noun");
      const tx = db.transaction("communities", "readwrite");
      tx.objectStore("communities").put({ id: "comm-noun", name: "Noun Crew", createdAt: 100 });
      db.close();
    };
    request.onerror = () => console.error("seed failed");
  })();`;
  await page.addInitScript(script);
  await page.goto("./");
  await expect(page.locator(".app")).toBeVisible({ timeout: 15000 });
}

test("the roster calls the group a community, not a squad", async ({ page }) => {
  await gotoSeededEmptyRoster(page);

  await page.getByRole("button", { name: "Roster", exact: true }).click();
  await expect(page.locator(".screen h1")).toHaveText("comp3tive");

  // src/App.tsx:1061. An empty roster is the only state that renders this.
  await expect(page.locator(".empty .big")).toHaveText("No players in this community");
  // And the CTA below it speaks about the roster, not a squad (src/App.tsx:1123).
  await expect(page.locator(".cta-label")).toContainText("Split the roster");
  await expect(page.locator(".cta-label")).not.toContainText("squad");
});
```

- [ ] **Step 2: Build and run the test to verify it fails**

```bash
npx vite build && npx playwright test --config=e2e/playwright.config.ts tests/community/noun.spec.ts
```

Expected: FAIL — `Expected: "No players in this community" / Received: "No players in this squad"`.

- [ ] **Step 3: Apply the five string replacements**

```
src/App.tsx:1061                       `No players in this squad`      -> `No players in this community`
src/App.tsx:1123                       `Split the squad`               -> `Split the roster`
src/session/MatchScreen.tsx:48         `then the squad`                -> `then the roster`
src/session/SplitScreen.tsx:304        `Tournament squad`              -> `Tournament teams`
src/session/SplitScreen.tsx:400        `Save tournament squad →`       -> `Save teams to tournament →`
```

Note `src/App.tsx:1123` wraps the phrase in `<strong>`, so the replacement targets the text node inside it:

```tsx
                  Ready to play? <strong>Split the roster</strong> and check the balance.
```

And `src/session/MatchScreen.tsx:48` is a `lede` string prop:

```tsx
        lede="Pick the game first, then the roster. Teams are sized to the game."
```

- [ ] **Step 4: Prove the preserved uses are untouched**

```bash
grep -rn "No players in this squad\|Split the squad\|then the squad\|Tournament squad\|Save tournament squad" src/
```

Expected: no output.

```bash
grep -rn "kicker=\"Squad bank\"\|← Squads\|Saved squads\|label: \"Squads\"\|Save squad\|onSaveSquad\|Squad detail" src/ | grep -v "useSavedSquads\|SavedSquadStore\|savedSquads\|squad.result\|squad.name\|squad.id\|squad.disciplineId\|squad.poolPlayerIds\|squad.settings\|squad.communityId"
```

Expected: the six preserved strings still present — `src/App.tsx:67` (`label: "Squads"`), `:450` (`saved squad`), `src/session/SquadsScreen.tsx:88`, `:115`, `src/session/SplitScreen.tsx:375`, `:378`, `:385`, `:410`.

- [ ] **Step 5: Run the new spec to verify it passes**

```bash
npx vite build && npx playwright test --config=e2e/playwright.config.ts tests/community/noun.spec.ts
```

Expected: PASS, 1 passed.

- [ ] **Step 6: Confirm no other spec regressed**

```bash
npx playwright test --config=e2e/playwright.config.ts tests/community/ tests/squads/ tests/tournament/split-tourney.spec.ts
```

Expected: PASS. `saved-squad.spec.ts` exercises the save path (`#squad-name`, `save-squad-button`) and `split-tourney.spec.ts` the tournament context — both target preserved strings. If any fails, the cause is a replacement that reached a Saved Squad string; revert that one edit, do not adjust the spec.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/session/MatchScreen.tsx src/session/SplitScreen.tsx e2e/tests/community/noun.spec.ts
git commit -m "fix(ui): the group is a Community, never a squad

Five strings still called the community or a submitted team set a
'squad', contradicting the switcher's own label and CONTEXT.md. Saved
Squad keeps its name: those six uses are untouched."
```

---

### Task 4: Sample data that matches the audience

**Files:**
- Modify: `sample-data/futsal-roster.json`
- Modify: `sample-data/mpl-id-roster.json`
- Create: `sample-data/badminton-roster.json`
- Test: `src/data/sample-data.validation.test.ts`

**Interfaces:**
- Consumes: `validatePlayer(player, disciplines)` from `src/domain/validation.ts:14`; `fairSplit` / `buildSettings` / `poolFromPlayers` / `suggestTeamCount` from `src/solver/solver.ts`; `FUTSAL_DISCIPLINE`, `MLBB_DISCIPLINE` from `src/domain/seed.ts`.
 Produces: three JSON files in the shape `parseBackup` accepts (`src/data/transfer.ts:9` declares `version: 4`; `:104` is the accepted-version check, which admits `1`) — `"version": 1`, an `exportedAt` ISO string, `players`, `sessions: []`. `sample-data/badminton-roster.json` is Task 5's registry input; B19 imports it, B20 authors it.

**The measured defect being repaired.** `sample-data/futsal-roster.json` fails the app's own `validatePlayer` for **7 of 25** players (`cw`, `cr1te`, `wannn`, `oura`, `luminaire`, `nino`, `blustine`, all for `Preferred role "X" must be inside the eligibility list`), and its role spread makes `goalkeeper` and `defender` eligible for 25/25 players while `pivot` is eligible for 0/25 — so a 5-team default split emits **8 `role-uncovered` flags**. Both files are 25 Indonesian esports professionals and share all 25 names between the two disciplines. Reproduced on HEAD with the shipped solver:

```
futsal n=25 invalid=7 teamCount=5 teams=5 sizes=[5,5,5,5,5] gap=0.0667 optimal=false nodes=4000001 flags=8
mlbb   n=25 invalid=0 teamCount=5 teams=5 sizes=[5,5,5,5,5] gap=0.3500 optimal=false nodes=4000001 flags=0
```

**The construction rules for the replacements.** Do not hand-type 25 × 2 capability blocks; generate them so the rules are auditable and typo-free, then commit the generated JSON.

- **futsal** — 25 players, five bands of five. `roles = ["goalkeeper","defender","winger","pivot"]`; for 0-based index `i`: `eligibleRoles = roles` (all four), `preferredRole = roles[floor(i/5) % 4]`, `attributeRatings = { technical: r, fitness: r, "game-iq": r }` where `r = 2 + (floor(i/5) % 4)`. Bands: 0–4 goalkeeper/2, 5–9 defender/3, 10–14 winger/4, 15–19 pivot/5, 20–24 goalkeeper/2.
- **mlbb** — 25 players, five specialists per role. `roles = ["tank","assassin","mage","marksman","fighter"]`; `preferredRole = roles[i % 5]`, `eligibleRoles = [roles[i % 5], roles[(i + 2) % 5]]`, and all four attributes rated `2 + ((i + k) % 4)` for `k = 0..3`.
- **badminton** — 10 players. `roles = ["front-court","rear-court"]`; `eligibleRoles = roles` for all; `preferredRole` alternating `rear-court`/`front-court`; three attributes rated `3 + ((i + k) % 3)` for `k = 0..2`.

Names, in order, verbatim from the spec:

- futsal: `Rangga, Bayu, Dimas, Yoga, Fikri, Adit, Gilang, Reza, Tio, Bagas, Nanda, Ucok, Wahyu, Ilham, Rafi, Bima, Sandi, Arif, Doni, Hendra, Yudi, Panji, Aldo, Bram, Cakra`; ids `futsal-01`…`futsal-25`; `notes` `"Sunday League · <Role name>"`.
- mlbb: `Kiww, Jendral, Saber, Lumos, Renz, Vandal, Ozzy, Kenz, Ryuu, Taka, Nori, Zeke, Panca, Vier, Monz, Kuro, Kaze, Sora, Volt, Refa, Tora, Wira, Yuki, Zenn, Ari`; ids `mlbb-01`…`mlbb-25`; `notes` `"Ranked squad"`.
- badminton: `Rizky, Sari, Dwi, Putri, Galih, Ayu, Arman, Nadia, Wisnu, Intan`; ids `badminton-01`…`badminton-10`; `notes` `"Club night"`.

No new name collides with the landing hero's roster (`Budi, Andi, Citra, Dewi, Eka, Fajar, Gita, Hana, Irfan, Joko`, declared at `src/landing.tsx:20-31`) or its bracket preview (the `.landing-bracket` element, `src/landing.tsx:55-91`, naming `Eka, Irfan, Citra, Gita` at `:60`, `:64`, `:69`, `:73`, `:82`, `:86`), and the three files share no name with each other.

**A correction to the spec's badminton name list.** The spec proposed `Dimas, Sari, Rangga, Putri, Bayu, Ayu, Fikri, Nadia, Yoga, Intan`, but `Dimas`, `Rangga`, `Bayu`, `Fikri`, and `Yoga` are all in the futsal list above, so it violates the spec's own acceptance criterion ("no shared names between files") and this task's test fails on it. Verified: `spec-badminton ∩ futsal = [Dimas, Rangga, Bayu, Fikri, Yoga]`, `∩ mlbb = []`, `∩ hero = []`. The corrected list above is disjoint from all three sets, has no internal duplicates, and keeps the alternating `front-court`/`rear-court` preference that gives both courts real coverage.

- [ ] **Step 1: Write the failing test**

Create `src/data/sample-data.validation.test.ts`. This test reads the JSON off disk through the app's own registry, so it fails today on the futsal file and keeps failing until both replacements land.

```ts
import { describe, expect, it } from "vitest";
import futsalRoster from "../../sample-data/futsal-roster.json";
import mlbbRoster from "../../sample-data/mpl-id-roster.json";
import badmintonRoster from "../../sample-data/badminton-roster.json";
import { FUTSAL_DISCIPLINE, MLBB_DISCIPLINE } from "../domain/seed";
import { validatePlayer } from "../domain/validation";
import { buildSettings, fairSplit, poolFromPlayers, suggestTeamCount } from "../solver/solver";
import type { Discipline, Player } from "../domain/types";

/** The badminton definition Task 5 adds to src/domain/seed.ts. Declared locally so
 *  this test's ordering against Task 5 does not matter — the data is the subject. */
const BADMINTON: Discipline = {
  id: "badminton",
  name: "Badminton",
  shortName: "Badminton",
  builtIn: true,
  roles: [
    { id: "front-court", name: "Front court" },
    { id: "rear-court", name: "Rear court" },
  ],
  attributes: [
    { id: "technical", name: "Technical" },
    { id: "fitness", name: "Fitness" },
    { id: "game-iq", name: "Game IQ" },
  ],
  strengthModel: { kind: "mean" },
  team: { minTeamSize: 2, maxTeamSize: 2, rolesRequired: true },
};

const CATALOG: Discipline[] = [FUTSAL_DISCIPLINE, MLBB_DISCIPLINE, BADMINTON];

interface Backup {
  version: number;
  exportedAt: string;
  players: Player[];
  sessions: unknown[];
}

const files: Array<[string, Backup, Discipline]> = [
  ["futsal-roster.json", futsalRoster as Backup, FUTSAL_DISCIPLINE],
  ["mpl-id-roster.json", mlbbRoster as Backup, MLBB_DISCIPLINE],
  ["badminton-roster.json", badmintonRoster as Backup, BADMINTON],
];

describe("shipped sample data", () => {
  it("keeps the v1 backup shape parseBackup accepts", () => {
    for (const [name, data] of files) {
      expect(data.version, name).toBe(1);
      expect(typeof data.exportedAt, name).toBe("string");
      expect(Number.isNaN(Date.parse(data.exportedAt)), name).toBe(false);
      expect(Array.isArray(data.players), name).toBe(true);
      expect(data.sessions, name).toEqual([]);
    }
  });

  it("passes validatePlayer for every player in every file", () => {
    for (const [name, data] of files) {
      const issues = data.players.flatMap((p) =>
        validatePlayer(p, CATALOG).map((issue) => `${name} · ${p.name}: ${issue.message}`),
      );
      expect(issues, `${name} has players the app's own validator rejects`).toEqual([]);
    }
  });

  it("splits to its suggested team count with gap 0, proven, and zero flags", () => {
    for (const [name, data, discipline] of files) {
      const teamCount = suggestTeamCount(data.players.length, discipline);
      const result = fairSplit(
        poolFromPlayers(data.players, discipline),
        discipline,
        buildSettings(discipline, teamCount),
      );
      expect(result.teams.length, name).toBe(teamCount);
      expect(result.gap, `${name} should split evenly`).toBe(0);
      expect(result.solver.optimal, `${name} should be provable`).toBe(true);
      expect(result.flags, `${name} should need no flags`).toEqual([]);
    }
  });

  it("covers every role on every team for the hard-coverage disciplines", () => {
    for (const [, data, discipline] of files) {
      if (!discipline.team.rolesRequired) continue;
      const result = fairSplit(
        poolFromPlayers(data.players, discipline),
        discipline,
        buildSettings(discipline, suggestTeamCount(data.players.length, discipline)),
      );
      const roleIds = discipline.roles.map((r) => r.id);
      for (const team of result.teams) {
        const filled = new Set(team.slots.map((s) => s.roleId));
        for (const roleId of roleIds) expect(filled.has(roleId), `${discipline.id} team ${team.index} · ${roleId}`).toBe(true);
      }
    }
  });

  it("carries no real-league org tags and shares no names between files", () => {
    const raw = JSON.stringify([futsalRoster, mlbbRoster, badmintonRoster]);
    for (const tag of ["ONIC", "RRQ", "EVOS", "Aura Fire", "Alter Ego"]) {
      expect(raw, tag).not.toContain(tag);
    }
    const names = files.map(([name, data]) => [name, new Set(data.players.map((p) => p.name))] as const);
    for (let a = 0; a < names.length; a++) {
      for (let b = a + 1; b < names.length; b++) {
        const shared = [...names[a][1]].filter((n) => names[b][1].has(n));
        expect(shared, `${names[a][0]} and ${names[b][0]} share names`).toEqual([]);
      }
    }
    const hero = new Set(["Budi", "Andi", "Citra", "Dewi", "Eka", "Fajar", "Gita", "Hana", "Irfan", "Joko"]);
    for (const [name, set] of names) {
      expect([...set].filter((n) => hero.has(n)), `${name} collides with the landing hero`).toEqual([]);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/data/sample-data.validation.test.ts`
Expected: FAIL — resolution error for `../../sample-data/badminton-roster.json` (the file does not exist yet), so fix that by moving to Step 3 rather than by commenting the import out. Once the badminton file exists, the validator test fails with 7 futsal issues, which is the defect this task exists to remove.

- [ ] **Step 3: Generate the three files**

Create a throwaway generator at `scripts/generate-sample-rosters.mjs`, run it once, then delete it in Step 7:

```js
// One-shot generator for the shipped sample rosters. Measured with the app's
// own validator and shipped solver before the rules were fixed.
import { writeFileSync } from "node:fs";

const out = (path, obj) => writeFileSync(path, `${JSON.stringify(obj, null, 2)}\n`);

const FUTSAL_ROLES = [
  { id: "goalkeeper", name: "Goalkeeper" },
  { id: "defender", name: "Defender" },
  { id: "winger", name: "Winger" },
  { id: "pivot", name: "Pivot" },
];
const MLBB_ROLES = [
  { id: "tank", name: "Tank" },
  { id: "assassin", name: "Assassin" },
  { id: "mage", name: "Mage" },
  { id: "marksman", name: "Marksman" },
  { id: "fighter", name: "Fighter" },
];
const BADMINTON_ROLES = [
  { id: "front-court", name: "Front court" },
  { id: "rear-court", name: "Rear court" },
];

const FUTSAL_NAMES = ["Rangga", "Bayu", "Dimas", "Yoga", "Fikri", "Adit", "Gilang", "Reza", "Tio", "Bagas", "Nanda", "Ucok", "Wahyu", "Ilham", "Rafi", "Bima", "Sandi", "Arif", "Doni", "Hendra", "Yudi", "Panji", "Aldo", "Bram", "Cakra"];
const MLBB_NAMES = ["Kiww", "Jendral", "Saber", "Lumos", "Renz", "Vandal", "Ozzy", "Kenz", "Ryuu", "Taka", "Nori", "Zeke", "Panca", "Vier", "Monz", "Kuro", "Kaze", "Sora", "Volt", "Refa", "Tora", "Wira", "Yuki", "Zenn", "Ari"];
const BADMINTON_NAMES = ["Rizky", "Sari", "Dwi", "Putri", "Galih", "Ayu", "Arman", "Nadia", "Wisnu", "Intan"];

const exportedAt = "2026-09-17T00:00:00.000Z";

// futsal: five bands of five. Every player can fill any position, so coverage is real;
// the band fixes the preferred role and the rating, which makes the 5-team split exact.
out("sample-data/futsal-roster.json", {
  version: 1,
  exportedAt,
  players: FUTSAL_NAMES.map((name, i) => {
    const band = Math.floor(i / 5) % 4;
    const rating = 2 + band;
    return {
      id: `futsal-${String(i + 1).padStart(2, "0")}`,
      communityId: "community-default",
      name,
      notes: `Sunday League · ${FUTSAL_ROLES[band].name}`,
      capabilities: [{
        disciplineId: "futsal",
        attributeRatings: { technical: rating, fitness: rating, "game-iq": rating },
        eligibleRoles: FUTSAL_ROLES.map((r) => r.id),
        preferredRole: FUTSAL_ROLES[band].id,
      }],
    };
  }),
  sessions: [],
});

// mlbb: five specialists per role, plus a flex role, so every team can cover all five.
out("sample-data/mpl-id-roster.json", {
  version: 1,
  exportedAt,
  players: MLBB_NAMES.map((name, i) => ({
    id: `mlbb-${String(i + 1).padStart(2, "0")}`,
    communityId: "community-default",
    name,
    notes: "Ranked squad",
    capabilities: [{
      disciplineId: "mlbb",
      attributeRatings: {
        mechanics: 2 + ((i + 0) % 4),
        "game-sense": 2 + ((i + 1) % 4),
        "hero-pool": 2 + ((i + 2) % 4),
        teamwork: 2 + ((i + 3) % 4),
      },
      eligibleRoles: [MLBB_ROLES[i % 5].id, MLBB_ROLES[(i + 2) % 5].id],
      preferredRole: MLBB_ROLES[i % 5].id,
    }],
  })),
  sessions: [],
});

// badminton: doubles. Both courts eligible on every player, preference alternating,
// so five pairs each cover front and rear court.
out("sample-data/badminton-roster.json", {
  version: 1,
  exportedAt,
  players: BADMINTON_NAMES.map((name, i) => ({
    id: `badminton-${String(i + 1).padStart(2, "0")}`,
    communityId: "community-default",
    name,
    notes: "Club night",
    capabilities: [{
      disciplineId: "badminton",
      attributeRatings: {
        technical: 3 + ((i + 0) % 3),
        fitness: 3 + ((i + 1) % 3),
        "game-iq": 3 + ((i + 2) % 3),
      },
      eligibleRoles: BADMINTON_ROLES.map((r) => r.id),
      preferredRole: BADMINTON_ROLES[i % 2].id,
    }],
  })),
  sessions: [],
});

console.log("wrote three sample rosters");
```

Run it:

```bash
node scripts/generate-sample-rosters.mjs
```

Expected: `wrote three sample rosters`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/data/sample-data.validation.test.ts`
Expected: PASS — 5 tests. Measured outcome of the generated data, on HEAD's solver:

```
futsal    n=25 invalid=0 teams=5 sizes=[5,5,5,5,5] gap=0  optimal=true  nodes=356,036 flags=0
mlbb      n=25 invalid=0 teams=5 sizes=[5,5,5,5,5] gap=0  optimal=true  nodes=2       flags=0
badminton n=10 invalid=0 teams=5 sizes=[2,2,2,2,2] gap=0  optimal=true  nodes=2       flags=0
```

- [ ] **Step 5: Confirm the JSON is what the app parses**

```bash
node -e "
const fs=require('fs');
for (const f of ['futsal-roster','mpl-id-roster','badminton-roster']) {
  const d=JSON.parse(fs.readFileSync('sample-data/'+f+'.json','utf8'));
  console.log(f, 'version='+d.version, 'players='+d.players.length, 'sessions='+d.sessions.length, 'ids='+d.players[0].id+'..'+d.players[d.players.length-1].id);
}
"
```

Expected:

```
futsal-roster version=1 players=25 sessions=0 ids=futsal-01..futsal-25
mpl-id-roster version=1 players=25 sessions=0 ids=mlbb-01..mlbb-25
badminton-roster version=1 players=10 sessions=0 ids=badminton-01..badminton-10
```

- [ ] **Step 6: Confirm the type-check and build are unaffected**

```bash
npx tsc -b && npx vite build
```

Expected: exit 0; build succeeds. The one pre-existing warning (`src/data/sample-data.ts is dynamically imported by src/App.tsx but also statically imported by src/domain/useDisciplines.ts`) is **unchanged** — it is about the module, not the JSON, and this task does not fix it. `contracts.md` gives that fix to Phase C (it owns `vite.config.ts` and the shell decomposition); the ticket records it rather than silently leaving it. If Phase C declines it, it is a one-line follow-up ticket.

- [ ] **Step 7: Delete the generator and commit**

```bash
rm scripts/generate-sample-rosters.mjs
git add sample-data/futsal-roster.json sample-data/mpl-id-roster.json sample-data/badminton-roster.json src/data/sample-data.validation.test.ts
git commit -m "fix(data): sample rosters that match the stated audience

The shipped futsal sample failed the app's own validatePlayer for 7 of
25 players and made pivot eligible for none of them, so a default split
emitted 8 role-uncovered flags. Both files were the same 25 esports
pros. Replaced with rosters PRODUCT.md actually names, each verified to
split clean at its suggested team count."
```

---

### Task 5: Badminton ships as a real discipline

**Files:**
- Modify: `src/domain/seed.ts:52` (and adds `BADMINTON_DISCIPLINE` above it)
- Modify: `src/data/sample-data.ts:2-7`
- Modify: `src/domain/seed.test.ts:6`
- Modify: `src/storage/indexed-db.test.ts:73,85,97`
- Modify: `src/storage/migration.test.ts:170,176`
- Modify: `src/domain/validation.test.ts:42,44`
- Modify: `src/data/sample-data.test.ts:17-23`

**Interfaces:**
- Consumes: `sample-data/badminton-roster.json` from Task 4 (this task's registry entry imports it).
- Produces:
  - `export const BADMINTON_DISCIPLINE: Discipline;` from `src/domain/seed.ts`
  - `export const SEED_DISCIPLINES: Discipline[]` — now `[FUTSAL_DISCIPLINE, MLBB_DISCIPLINE, BADMINTON_DISCIPLINE]`
  - `hasSampleData("badminton") === true` and `listDisciplinesWithSampleData()` including `"badminton"` from `src/data/sample-data.ts`

**Why this shape, from the solver's rules rather than from taste.** `assignRoles` returns `null` unless `players.length === roleIds.length` (`src/solver/solver.ts:94`), and `consider()` rejects any team where `rolesRequired && !teams.every((t) => roleCoverPossible(t, roleIds))` (`src/solver/solver.ts:515`). `roleCoverPossible` requires `team.length >= roleIds.length` (`:81`). So a two-role discipline with `rolesRequired: true` needs exactly two players per team — which is why the landing card's old `Singles`/`Doubles` pair was incoherent (two formats, not two positions) and why 1v1 is not shippable: `suggestTeamCount` is `floor(pool / minTeamSize)` (`:37`), so a 10-player club with `minTeamSize: 1` is offered **10 teams**. Measured: `teams=10, sizes=[1×10], optimal=true`. Doubles it is.

- [ ] **Step 1: Write the failing test**

Add to `src/domain/seed.test.ts` — first change the existing catalog assertion at `:6-8`:

```ts
  it("seeds exactly Futsal, MLBB and Badminton", () => {
    expect(SEED_DISCIPLINES.map((d) => d.id)).toEqual(["futsal", "mlbb", "badminton"]);
  });
```

Then add, after the MLBB block:

```ts
  it("badminton defines its court roles and attributes", () => {
    expect(BADMINTON_DISCIPLINE.roles.map((r) => r.id)).toEqual(["front-court", "rear-court"]);
    expect(BADMINTON_DISCIPLINE.attributes.map((a) => a.id)).toEqual(["technical", "fitness", "game-iq"]);
  });

  it("badminton: hard role coverage, exactly 2", () => {
    // Two roles with rolesRequired needs exactly two players per team:
    // `roleCoverPossible` requires `team.length >= roleIds.length` and
    // `assignRoles` requires `players.length === roleIds.length`.
    expect(BADMINTON_DISCIPLINE.team).toEqual({ minTeamSize: 2, maxTeamSize: 2, rolesRequired: true });
  });

  it("badminton owns the mean strength model", () => {
    expect(BADMINTON_DISCIPLINE.strengthModel.kind).toBe("mean");
  });
```

And update the import at `:2` to include `BADMINTON_DISCIPLINE`:

```ts
import { BADMINTON_DISCIPLINE, FUTSAL_DISCIPLINE, MLBB_DISCIPLINE, SEED_DISCIPLINES } from "./seed";
```

Add to `src/data/sample-data.test.ts`, inside the first `describe` after the futsal case at `:9-11`:

```ts
  it("has sample data for badminton", () => {
    expect(hasSampleData("badminton")).toBe(true);
  });
```

and change the catalog assertion at `:17-23`:

```ts
  it("lists disciplines with sample data", () => {
    const list = listDisciplinesWithSampleData();
    expect(list).toContain("mlbb");
    expect(list).toContain("futsal");
    expect(list).toContain("badminton");
    expect(list).toHaveLength(3);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/domain/seed.test.ts src/data/sample-data.test.ts`
Expected: FAIL — `BADMINTON_DISCIPLINE` is not exported; `Expected: 3, Received: 2`; `hasSampleData("badminton")` is false.

- [ ] **Step 3: Add the discipline**

In `src/domain/seed.ts`, insert above line 52 and replace that line:

```ts
export const BADMINTON_DISCIPLINE: Discipline = {
  id: "badminton",
  name: "Badminton",
  shortName: "Badminton",
  builtIn: true,
  roles: [
    { id: "front-court", name: "Front court" },
    { id: "rear-court", name: "Rear court" },
  ],
  attributes: [
    { id: "technical", name: "Technical" },
    { id: "fitness", name: "Fitness" },
    { id: "game-iq", name: "Game IQ" },
  ],
  strengthModel: { kind: "mean" },
  team: { minTeamSize: 2, maxTeamSize: 2, rolesRequired: true },
};

export const SEED_DISCIPLINES: Discipline[] = [FUTSAL_DISCIPLINE, MLBB_DISCIPLINE, BADMINTON_DISCIPLINE];
```

Also update the file's header comment above `FUTSAL_DISCIPLINE` to name the third entry, matching its existing one-line-per-discipline style.

**Hard coverage is deliberate.** On a degenerate pool — everyone eligible for front court only — hard coverage returns **zero teams** (measured: `teams=0`), because no pair can cover the rear court. MLBB already makes this tradeoff (`team.rolesRequired: true`), and the split screen already has the actionable state for it (`src/session/SplitScreen.tsx:349-352`: "Solver failed / Couldn't build teams / Not enough eligible players for this game. Adjust the pool or change the discipline."). Soft coverage would avoid the empty state but emit `role-uncovered` flags on a discipline whose whole point is having a player at the front and one at the back.

- [ ] **Step 4: Register the sample roster**

In `src/data/sample-data.ts`, add the import after line 3 and the entry in `SAMPLE_DATA`:

```ts
import badmintonRoster from "../../sample-data/badminton-roster.json";
```

```ts
const SAMPLE_DATA: Record<string, string> = {
  mlbb: JSON.stringify(mplRoster),
  futsal: JSON.stringify(futsalRoster),
  badminton: JSON.stringify(badmintonRoster),
};
```

The `fileName` derived by `getSampleDataInfo` becomes `badminton-roster.json`, which matches the file Task 4 created.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/domain/seed.test.ts src/data/sample-data.test.ts`
Expected: PASS.

- [ ] **Step 6: Fix the fixtures that assumed two seeded disciplines**

Three fixtures use `"badminton"` as a **custom** (non-seeded) id. Once badminton is seeded, those assertions either pass vacuously or read as a lie about a shipped discipline. Rename them to `"padel"` — not shipped, not planned.

`src/storage/indexed-db.test.ts:73` (inside the `indexed-db discipline store (smoke)` describe):

```ts
    id: "padel-x",
```

Then both seeded-catalog assertions — `:85` and `:97`:

```ts
    expect(list.map((d) => d.id).sort()).toEqual(["badminton", "futsal", "mlbb"]);
```

```ts
    expect(after.map((d) => d.id).sort()).toEqual(["badminton", "futsal", "mlbb"]);
```

**Watch the sort order:** `"badminton" < "futsal" < "mlbb"` in code-point order, so badminton comes **first** in the sorted array, not last.

`src/storage/migration.test.ts:170` and `:176`:

```ts
    await seedDatabase("mig-src-4", { disciplines: [customDiscipline("padel")] });
```

```ts
    expect(ids).toContain("padel");
```

`src/domain/validation.test.ts:42` and `:44` — the unknown-discipline probe:

```ts
    const bad: Capability = { ...futsalCap, disciplineId: "padel" };
    const issues = validatePlayer(validPlayer({ capabilities: [bad] }), disciplines);
    expect(issues.some((i) => i.message.includes('Unknown discipline "padel"'))).toBe(true);
```

The `disciplines` fixture in that file is `[FUTSAL_DISCIPLINE, MLBB_DISCIPLINE]` built locally, so the assertion still passes either way — the rename is so the test says what it means.

- [ ] **Step 7: Run the full unit suite**

Run: `npx vitest run`
Expected: PASS. This is the sixth collision class the spec enumerated; every one is now handled.

- [ ] **Step 8: Prove the constraint interaction with a solver test**

Add to `src/solver/solver.test.ts`, after the existing MLBB coverage cases. This is the test the spec requires: the discipline's role rule interacts with `suggestTeamCount`, `roleCoverPossible`, and `assignRoles`, and the interaction must be pinned.

```ts
  it("badminton: 10 players split into five pairs, each covering both courts", () => {
    const roles = ["front-court", "rear-court"];
    const pool = Array.from({ length: 10 }, (_, i) =>
      p(`b${i}`, 3 + (i % 3), roles, roles[i % 2]),
    );
    // floor(10 / 2) = 5 pairs.
    expect(suggestTeamCount(10, BADMINTON_DISCIPLINE)).toBe(5);
    const result = fairSplit(pool, BADMINTON_DISCIPLINE, buildSettings(BADMINTON_DISCIPLINE, 5));

    expect(result.teams).toHaveLength(5);
    expect(result.teams.map((t) => t.slots.length)).toEqual([2, 2, 2, 2, 2]);
    expect(result.flags).toEqual([]);
    expect(result.solver.optimal).toBe(true);
    for (const team of result.teams) {
      expect(new Set(team.slots.map((s) => s.roleId))).toEqual(new Set(roles));
    }
  });

  it("badminton: 1v1 cannot be expressed by a two-role hard-coverage discipline", () => {
    // `roleCoverPossible` requires `team.length >= roleIds.length` (solver.ts:81),
    // so a one-player team can never cover two roles. This is why badminton ships
    // as doubles: `suggestTeamCount` is floor(pool / minTeamSize), and minTeamSize 1
    // would offer a 10-player club ten teams.
    const roles = ["front-court", "rear-court"];
    const singles: Discipline = {
      ...BADMINTON_DISCIPLINE,
      team: { minTeamSize: 1, maxTeamSize: 2, rolesRequired: true },
    };
    const pool = Array.from({ length: 8 }, (_, i) => p(`s${i}`, 4, roles, roles[i % 2]));
    const result = fairSplit(pool, singles, buildSettings(singles, 4));
    // Every team that survives has two members, because one cannot cover two roles.
    for (const team of result.teams) expect(team.slots.length).toBeGreaterThanOrEqual(2);
  });
```

Add `BADMINTON_DISCIPLINE` to that file's seed import at `:8` and `Discipline` to the type import at `:10`:

```ts
import { BADMINTON_DISCIPLINE, FUTSAL_DISCIPLINE, MLBB_DISCIPLINE } from "../domain/seed";
import type { Discipline, Player, SplitResult } from "../domain/types";
```

- [ ] **Step 9: Run the solver test**

Run: `npx vitest run src/solver/solver.test.ts`
Expected: PASS, including the two new cases. Measured on the same shape: `teams=5, sizes=[2,2,2,2,2], gap=0, optimal=true, nodes=2, flags=[]`, every team `front-court+rear-court`.

- [ ] **Step 10: Commit**

```bash
git add src/domain/seed.ts src/data/sample-data.ts src/domain/seed.test.ts src/storage/indexed-db.test.ts src/storage/migration.test.ts src/domain/validation.test.ts src/data/sample-data.test.ts src/solver/solver.test.ts
git commit -m "feat(domain): badminton ships as a real discipline

Doubles with two court roles, grounded in the solver's rules:
assignRoles needs players.length === roleIds.length and
roleCoverPossible needs team.length >= roleIds.length, so a two-role
hard-coverage discipline is exactly pairs. 1v1 would offer a 10-player
club ten teams.

The three fixtures that used 'badminton' as a custom id become 'padel'
so they keep proving what they claim."
```

---

### Task 6: The landing page claims only what ships

**Files:**
- Modify: `index.html:9`
- Modify: `index.html:71-75`
- Modify: `index.html:123`
- Modify: `index.html:145`
- Modify: `index.html:157`
- Modify: `index.html:180-184`
- Modify: `src/landing.tsx:110-116`
- Modify: `e2e/tests/landing/landing.spec.ts:47-66`

**Interfaces:**
- Consumes: Task 5's `BADMINTON_DISCIPLINE` — its `roles` give the card's `roles` strings (`Front court`, `Rear court`) and its `minTeamSize === maxTeamSize === 2` gives `teamSize: "2 v 2"`. `SEED_DISCIPLINES.length` is now 3, which sets the rail fact.
- Produces: no new export. The landing page's claims are true of the build.

**Why the "no spec edited" rule does not apply.** `e2e/tests/landing/landing.spec.ts:57-63` currently asserts the false claims verbatim:

```ts
    const trust = page.locator(".landing-trust li");
    await expect(trust).toHaveCount(3);
    await expect(trust).toContainText([
      "proven minimum",
      "no signal",
      "stays on your device",
    ]);
```

That rule guards Phase C's behaviour-preserving refactors. B14 changes user-visible copy, so the suite would otherwise stay green while the page lies — which is the defect this phase exists to remove. Editing this block is correct and required; do not preserve the old assertions to keep the file byte-stable.

**Every claim, mapped (this task's acceptance surface):**

| Claim (file:line) | Verdict | Action |
|---|---|---|
| `GAP 0.10`, live solver output (`src/landing.tsx:210-217`) | **true today** — verified `optimal: true`, 51 nodes, gap 0.10000000000000009 → `toFixed(2)` = `0.10` | keep unfilled |
| "smallest strength gap" (`index.html:72`, asserted at spec `:47`) | true as a phrase | keep |
| "the smallest strength gap that exists for that pool — exact, not estimated" (`index.html:72-73`) | **overclaim** | reword |
| "you watch the number that proves it" (`index.html:123`) | **overclaim** | reword |
| "the solver just proved fair" (`index.html:145`) | **overclaim** on 3+ teams | reword |
| "Re-rolls ∞" / "re-roll until it says what you want" (`index.html:111`, `:123`) | falsified today (Re-roll is a no-op) | **A03 restores it**; copy unchanged by B14 |
| "3 formats" (`index.html:133-134`) | **true today** (series / single-elim / swiss) | keep |
| "Disciplines 3+" (`index.html:157`) | false as written; now exactly 3 | `3` |
| Badminton card (`src/landing.tsx:110-116`) | false as written | corrected to the shipped doubles definition |
| "proven minimum for your pool, not a heuristic" (`index.html:181`) | **overclaim** | scoped to a two-team split |
| "Works with no signal" (`index.html:182`) | **false** — no SW, no manifest, CDN fonts | **removed by B14, restored by D02** |
| "stays on your device" (`index.html:183`) | **true** (IndexedDB, ADR-0001) | keep verbatim |
| "Free, no account. Runs in your browser." (`index.html:194`) | **true** | keep; promoted into the trust list |
| "Works offline" in the meta (`index.html:9`) | **false** | removed |
| "fair teams for futsal nights, MLBB sessions" (`index.html:200`) | **true** | keep |

- [ ] **Step 1: Write the failing spec assertions**

In `e2e/tests/landing/landing.spec.ts`, replace the trust block at `:57-63` with the corrected strings plus the new copy-pinning assertions:

```ts
    const trust = page.locator(".landing-trust li");
    await expect(trust).toHaveCount(3);
    await expect(trust).toContainText([
      "proven minimum for a two-team split",
      "stays on your device",
      "no account",
    ]);

    // B14: the offline promise is deleted, not softened. D02 restores it with the
    // manifest and service worker; until then the page must not make it at all.
    await expect(page.locator(".landing-trust")).not.toContainText("no signal");
    // The lede claims only what the solver can prove for every pool size.
    await expect(page.locator(".landing-lede")).toContainText("it can prove");
    // And "exact, not estimated" — the phrase that overclaimed — is gone.
    await expect(page.locator(".landing-lede")).not.toContainText("exact, not estimated");
```

In the same test, leave `:47` (`"smallest strength gap"`), `:49-55` (the rail labels), `:46` (the wordmark accessible name), `:65` (the action note) and `:66` (the footer) unchanged.

- [ ] **Step 2: Build and run the spec to verify it fails**

```bash
npx vite build && npx playwright test --config=e2e/playwright.config.ts tests/landing/landing.spec.ts --grep "product's voice"
```

Expected: FAIL — `toContainText` receives `proven minimum` where `proven minimum for a two-team split` was expected, and `not.toContainText("no signal")` fails against the live page.

- [ ] **Step 3: Rewrite the trust list**

Replace `index.html:180-184`:

```html
          <ul class="landing-trust">
            <li>The gap is the proven minimum for a two-team split.</li>
            <li>Your data stays on your device. No account, no server.</li>
            <li>Free, no account. Runs in your browser.</li>
          </ul>
```

Row 1 is the claim made true by scoping it to where it holds (verified: 2-team pools return `optimal: true`, ≤ 443 nodes). Row 2 is true today, kept verbatim. Row 3 replaces the offline claim with the action note that already carried it (`index.html:194`), so the close still has three rows and the layout is unchanged. The offline sentence is **deleted**, not softened.

- [ ] **Step 4: Rewrite the lede**

Replace `index.html:72-74`:

```html
            comp3tive splits your roster into teams with the smallest strength gap it can prove, honoring
            every role along the way. Futsal, MLBB, badminton, then the tournament on those teams.
```

- [ ] **Step 5: Drop the offline half of the meta description**

Replace `index.html:9`:

```html
      content="comp3tive splits your group into balanced teams with the smallest possible strength gap, then runs the tournament. No account, no sign-up."
```

- [ ] **Step 6: Correct the two remaining overclaims**

`index.html:122-123`:

```html
              Swap two players and the meter moves with you. You are never told the teams are fair —
              you watch the number that shows it, and re-roll until it says what you want.
```

`index.html:144-145`:

```html
              Series, single elimination, or Swiss — recorded as you play, on the same teams the
              solver just balanced.
```

- [ ] **Step 7: Correct the discipline count**

Replace `index.html:157`:

```html
                <dd>3</dd>
```

This matches `SEED_DISCIPLINES.length` after Task 5. The `3+` was false even before B19 (two seeds).

- [ ] **Step 8: Correct the badminton card**

Replace `src/landing.tsx:110-116`:

```tsx
  {
    name: "Badminton",
    desc: "Doubles on a badminton court — pairs balanced by strength, one at the front and one at the back.",
    roles: ["Front court", "Rear court"],
    attributes: ["Technical", "Fitness", "Game IQ"],
    teamSize: "2 v 2",
  },
```

The `roles` and `attributes` strings match `BADMINTON_DISCIPLINE.roles[].name` and `.attributes[].name` from Task 5; `teamSize: "2 v 2"` matches `minTeamSize === maxTeamSize === 2`. If Task 5 changed either name, this card is wrong — re-read `src/domain/seed.ts` before editing.

- [ ] **Step 9: Run the spec to verify it passes**

```bash
npx vite build && npx playwright test --config=e2e/playwright.config.ts tests/landing/landing.spec.ts
```

Expected: PASS — 16 passed, 0 failed (11 in the `Landing Page` describe, 5 in `Returning organizer redirect`; the file has no `test.skip`). Specifically still green and untouched: the rail-label assertion `["Split","Edit","Play","Roster","Open"]` (`:49-55`), the wordmark accessible name (`:46`), the CTA href/role assertions, the hero mount assertions, the whole deal-animation suite, the theme assertions (`:238-239` pin `rgb(250, 248, 245)` / `rgb(28, 25, 23)` — Paper & Pencil's numbers, unaffected by copy), and all five returning-organizer redirect specs.

- [ ] **Step 10: Prove no false claim survives on the page**

```bash
npx vite build && npx playwright test --config=e2e/playwright.config.ts tests/landing/landing.spec.ts --grep "product's voice"
```

Expected: PASS. Then confirm the source itself:

```bash
grep -n "Works offline\|no signal\|exact, not estimated\|the number that proves\|just proved fair\|Disciplines" index.html
```

Expected: no match for `Works offline`, `no signal`, `exact, not estimated`, `the number that proves`, or `just proved fair`. `Disciplines` matches once, at the `<dt>` whose `<dd>` now reads `3`.

- [ ] **Step 11: Record the D02 handoff and commit**

Append to `.scratch/debt/issues/14-the-landing-page-claims-only-what-ships.md` under its existing `## Comments`:

```
Landed 2026-09-17. Handoff to D02 stands: when the manifest and service worker
ship, restore the offline claim. `index.html` trust-list row 3 becomes
`Works with no signal. The court has no wifi.`, the meta description regains
`Works offline, `, and this spec's third trust assertion changes from
`"no account"` back to `"no signal"`.
```

```bash
git add index.html src/landing.tsx e2e/tests/landing/landing.spec.ts .scratch/debt/issues/14-the-landing-page-claims-only-what-ships.md
git commit -m "fix(landing): claim only what ships

Scoped the proven-minimum claim to the two-team case where it holds,
deleted the offline promise (D02 restores it with the PWA), corrected
the discipline count to 3, and rewrote the badminton card to the
discipline that now exists. The spec that enforced the false claims is
edited, because B14 changes user-visible copy."
```

---

### Task 7: ADR-0002 is accepted, not proposed

**Files:**
- Modify: `docs/adr/0002-tournament-first-flow.md:5,16`
- Modify: `docs/adr/0004-origin-aware-navigation.md:8`

**Interfaces:**
- Consumes: nothing. `src/domain/types.ts:55-56` (`winnerNext` / `loserNext`) is the fact being documented; `src/domain/types.ts:61-77` is the shipped `Tournament`.
- Produces: no export. Both ADRs state a status.

**Precondition check.** The feature shipped and is a primary hub: `Tournament` carries `format`, `seriesLength`, `teamCount`, `thirdPlace`, `status`, `teams`, `matches` (`src/domain/types.ts:61-77`); the Games hub lists and creates tournaments (`src/tournament/GamesScreen.tsx`); the draft → split → bracket → results flow exists (`src/tournament/TournamentScreen.tsx`); and `docs/adr/0003-saved-squads.md:5` and `docs/adr/0005-dashboard-first.md:20` both build on ADR-0002 as settled. Every sibling reads `**Status**: accepted` (`0001:5`, `0003:5`, `0005:20`, `0006:5`) except `0004`, which has no status line at all.

- [ ] **Step 1: Change the status line**

`docs/adr/0002-tournament-first-flow.md:5`:

```
**Status**: accepted
**Accepted**: 2026-09-17
```

The second line is deliberate: the decision predates its own ratification, and a reader deserves to know it was ratified later rather than on the day it was written.

- [ ] **Step 2: Correct the one wrong consequence**

`docs/adr/0002-tournament-first-flow.md:16` currently reads:

```
- Double elimination was not squeezed into v1 — it needs loser-bracket semantics this model doesn't force; the Match carries a `nextMatchId` with a winner slot now and a loser slot when double elim lands.
```

Replace with:

```
- Double elimination was not squeezed into v1 — it needs loser-bracket semantics this model doesn't force; the Match carries `winnerNext` and `loserNext`, where the winner slot advances the bracket today and the loser slot carries the 3rd-place match. Double elimination remains deferred, and its loser-bracket semantics would be the decision that revisits this.
```

Reality: the Match carries both slots today (`src/domain/types.ts:55-56`), and `loserNext` is in active use for the 3rd-place match, which `docs/spec/0002-tournaments-v1.md` §4 describes as default-on (`thirdPlace: boolean`, `src/domain/types.ts:70`). `nextMatchId` does not exist in the type.

- [ ] **Step 3: Give ADR-0004 the status line its siblings all carry**

`docs/adr/0004-origin-aware-navigation.md:8` is the blank line after the opening paragraph, directly before `We decided to keep the flat View union…`. Insert:

```
**Status**: accepted
```

This matches `0005`'s layout — heading, opening paragraph, then `**Status**: accepted` (`docs/adr/0005-dashboard-first.md:20`).

- [ ] **Step 4: Verify the greps**

```bash
grep -rn "nextMatchId" docs/ src/
```

Expected: no output.

```bash
grep -L "Status" docs/adr/*.md
```

Expected: no output — all six ADRs now state a status.

```bash
grep -n "Status" docs/adr/*.md
```

Expected: six files, `0002` reading `accepted`, `0004` reading `accepted`.

- [ ] **Step 5: Confirm nothing else in either file moved**

```bash
git diff --stat docs/adr/
```

Expected: two files, 2 and 1 insertions respectively (plus the one replaced bullet line in 0002). If 0004 shows more than one insertion, the edit landed outside the intended position — the ADR's body must be untouched.

- [ ] **Step 6: Commit**

```bash
git add docs/adr/0002-tournament-first-flow.md docs/adr/0004-origin-aware-navigation.md
git commit -m "docs(adr): ADR-0002 is accepted, not proposed

The feature shipped and is a primary hub, and 0003 and 0005 already
build on it as settled. Also corrects the one wrong consequence: the
Match carries winnerNext and loserNext today, and loserNext carries the
3rd-place match. ADR-0004 gains the status line its five siblings have."
```

---

### Task 8: Resolve the competing design directions

**Files:**
- Modify: `DESIGN.md:195`
- Delete: `docs/design.md` (owner-confirmed)

**Interfaces:**
- Consumes: nothing.
- Produces: no export. `DESIGN.md` is the single design source of truth.

**Verified before claiming the amber token.** `src/tokens.css:1` states `/* Design system: "Paper & Pencil" (per DESIGN.md). Warm paper, quiet ink, one amber accent for live action. */` and declares `--surface: #faf8f5` (`:10`), `--text: #1c1917` (`:13`), `--accent: #c2410c` (`:15`), `--whistle: #c2410c` (`:17`); the dark block re-declares `--surface: #1c1917` (`:42`) and `--accent: #ea580c` (`:47`). Those are Paper & Pencil's numbers. Against them, `docs/design.md:3` proposes "**Scoreboard.** … a single saturated cobalt accent" with `cobalt #2B6BFF` (`:15`) and a Chakra Petch type stack (`:33`) — and `grep -rn "2B6BFF\|Chakra\|cobalt" src/ index.html app/index.html public/` returns **no matches**. The landing page's own contract comment names the world "Inherited from DESIGN.md, unchanged" and gives `#FAF8F5`, `#1C1917`, `#C2410C` (`index.html:37-38`), and the landing spec pins the shipped tokens by rgb value (`e2e/tests/landing/landing.spec.ts:238-239`). The survivor is `DESIGN.md`.

- [ ] **Step 1: Confirm the amber token before asserting it**

```bash
grep -n "accent\|surface\|text:" src/tokens.css | head -20
```

Expected: `--accent: #c2410c` at `:15`, `--surface: #faf8f5` at `:10`, `--text: #1c1917` at `:13`. Do not proceed if these differ — re-read the file and update `DESIGN.md`'s token table to match the CSS rather than the other way round.

```bash
grep -rn "2B6BFF\|Chakra\|cobalt" src/ index.html app/index.html public/
```

Expected: no output, confirming the losing direction appears nowhere in the build.

- [ ] **Step 2: Move the two live sections into DESIGN.md**

`DESIGN.md:196` begins `## Things that don't change`. Insert the following immediately **before** it, so the two moved sections sit between the Landing Page's token section and the closing list. The text is moved, not paraphrased; the only restatement is the focus ring, retold in Paper & Pencil's terms (`--accent`, the amber at `DESIGN.md:15-24`) because the source named cobalt.

```markdown
## Copy voice

Match-night, plain, active. People and what they do, never the system: "Split the teams," not "Run solver." Same name through a flow: the button that says "Split" produces "Tonight's teams." Referee-voice for flags: "No keeper on pink. Fitri is covering." Errors don't apologize and are never vague: "Not enough players for 2 teams. Add more or lower the team count." Empty screens are invitations to act.

**No em-dashes in visible copy.** Periods and commas carry the pauses. A zero-tolerance rule: the em-dash is the AI tell, so it is banned from UI strings entirely.

## Accessibility & quality floor

Mobile-first and thumb-friendly (bottom bar actions, 44px+ targets) · `min-height:100dvh` (no mobile viewport jumps) · visible `:focus-visible` rings in amber (`--accent`) · text contrast ≥ 4.5:1 on every surface in both themes (`ink` on `paper`, `ink` on bibs, `paper` on `ink-panel`, `slate` labels at full strength) · responsive to desktop (the app column centers on a subtle hairline frame).

```

Both rules are live and would be lost with the loser: the B13 qualifier obeys the em-dash ban, and the 44px figure matches the measured smallest visible button height at 390×844.

- [ ] **Step 3: Confirm the sections landed in the right place**

```bash
grep -n "^## " DESIGN.md
```

Expected, in order: `Why this direction`, `Tokens`, `Layout`, `The signature moment`, `The Landing Page — "The Ledger"`, `Copy voice`, `Accessibility & quality floor`, `Things that don't change`. `Copy voice` and `Accessibility & quality floor` must both precede `Things that don't change`, and nothing else may have moved.

- [ ] **Step 4: Confirm no design work happened**

```bash
git diff --stat src/tokens.css src/index.css src/landing.css
```

Expected: no output. B17 is a documentation decision; no token moves, no CSS change, no component edit.

- [ ] **Step 5: Request the owner's confirmation before deleting**

`docs/design.md` was authored by the repo owner. **Do not run the deletion until the owner confirms.** Post the request and record the answer in the ticket's `## Comments`. The spec's fallback, if the owner prefers to keep a trail: replace `docs/design.md`'s body with this one line, leaving nothing that reads as a competing direction:

```
Superseded by DESIGN.md (Paper & Pencil). See docs/adr/ for decisions.
```

- [ ] **Step 6: Apply the owner's choice**

If confirmed for deletion:

```bash
git rm docs/design.md
```

If the fallback was chosen:

```bash
printf 'Superseded by DESIGN.md (Paper & Pencil). See docs/adr/ for decisions.\n' > docs/design.md
git add docs/design.md
```

- [ ] **Step 7: Verify**

```bash
grep -rn "Scoreboard\|cobalt\|Chakra" DESIGN.md docs/ src/ index.html app/index.html
```

Expected: no output. (If the fallback was chosen, `docs/design.md` no longer contains any of them either.)

```bash
npx vite build && npx playwright test --config=e2e/playwright.config.ts tests/landing/landing.spec.ts --grep "light and dark"
```

Expected: PASS — the shipped Paper & Pencil tokens still resolve to `rgb(250, 248, 245)` and `rgb(28, 25, 23)`.

- [ ] **Step 8: Commit**

```bash
git add DESIGN.md docs/design.md
git commit -m "docs(design): one direction survives

docs/design.md proposed Scoreboard with a cobalt accent; the shipped CSS
(src/tokens.css) is Paper & Pencil with amber #c2410c, and no cobalt
value or Chakra Petch reference exists anywhere in the build. DESIGN.md
survives and absorbs the two rules only the loser carried: the em-dash
ban and the accessibility floor."
```

---

### Task 9: Reconcile docs/FLOW.md

**Files:**
- Modify: `docs/FLOW.md:1`, `:10`, `:26-34`, `:72`, `:74`, `:174-175`

**Interfaces:**
- Consumes: nothing. `NAV_ITEMS` at `src/App.tsx:62-68` and `src/nav.tsx:10` are the facts being documented.
- Produces: no export.

**The four verified contradictions.** The title says "(as-to-be)" while `:4` says "Accepted — this document is the contract"; `:26` says "Four bottom-nav hubs" against five with Home centred; `:10` and `:74` say breadcrumbs are links while no screen renders `src/nav.tsx`'s `Breadcrumb` (zero consumers) and `src/session/SplitScreen.tsx:294` is a dead `<a href="#" onClick={…preventDefault}>`; and `:174-175` repeats the breadcrumb claim.

- [ ] **Step 1: Retitle**

`docs/FLOW.md:1`:

```
# comp3tive · Page Flow
```

The doc's own `:4` already declares it accepted. The "(as-to-be)" title contradicted that.

- [ ] **Step 2: Correct the hub count and table**

`docs/FLOW.md:26`:

```
Five bottom-nav hubs. A hub is a top-level home with no back control and no breadcrumb.
```

Replace the table at `:28-34` with the corrected rows **in nav order**, which is `src/App.tsx:62-68`'s order — `[Home, Roster, Games, History, Squads]` with Home centred per ADR-0005, and the tournaments hub labelled **Games**:

```markdown
| # | Tab | Owns |
|---|-----|------|
| 1 | **Roster** | players + capabilities; add/import/export; **Disciplines**; the ad-hoc **"Split match"** entry |
| 2 | **Games** | tournaments: list, create, draft, bracket, results |
| 3 | **Home** | the Dashboard: active-community state and next actions (ADR-0005) |
| 4 | **History** | past ad-hoc splits (Sessions): view, re-roll, save as squad, delete |
| 5 | **Squads** | saved squads: view, re-split, delete, feed a tournament |
```

Add the source line beneath it:

```markdown
Source of truth: `NAV_ITEMS` at `src/App.tsx:62-68`; the centre slot is Home (ADR-0005).
```

- [ ] **Step 3: Keep P1's rule as it is**

**Do not change `docs/FLOW.md:10`.** It reads `- **P1** Every non-hub screen shows its path (breadcrumb of active links)`. The only wrong word is "active", and the correct fix is the one C28's ticket already commits to: **the rule stays normative and the code is brought up to it**. C28 exists to make every navigable crumb a real link. Leave P1's line exactly as written.

- [ ] **Step 4: Keep §3's heading and intro as they are**

**Do not change `docs/FLOW.md:72` or `:74`.**

This is a deliberate departure from the spec, and the reason is measured. The spec proposed writing "Breadcrumbs are labels, not links". That statement is **false in the opposite direction**: of the three screens that render a breadcrumb today, two already navigate and only one is dead.

| Site | Current markup | Navigates? |
|---|---|---|
| `src/session/MatchScreen.tsx:41-45` | `<a href="#" onClick={…props.onBack()}>Roster</a>` | **yes** |
| `src/tournament/TournamentScreen.tsx:263-269` | `<a href="#" onClick={…onBack()}>Games</a>` | **yes** |
| `src/session/SplitScreen.tsx:293-297` | `<a href="#" onClick={…preventDefault}>Match setup</a>` | **no** — the handler only calls `preventDefault` |

So `docs/FLOW.md:74`'s original sentence ("Breadcrumbs are links — every crumb above the current screen navigates there") describes two of three sites correctly, and the defect is one screen, not the rule. Writing "labels, not links" would replace one false claim about the app with a different false claim, in the same phase whose whole purpose is to make claims true.

The rule also already has an owner: ticket 28 (`ready-for-agent`) makes the contract true by fixing the code. Its acceptance criteria include `grep -rn 'href="#"' src/session/SplitScreen.tsx` returning nothing and every `<a href="#">` in `src/` having a handler that navigates — and its own ticket text says landing it first "makes the documentation true instead of codifying the gap: the contract is right and the code was wrong". It explicitly leaves `docs/FLOW.md` to B.

Leave both lines untouched. C28 needs no follow-up edit to either one.

- [ ] **Step 5: Add a forward note naming the one dead site, and state what is actually rendered**

Append to the paragraph that follows `docs/FLOW.md:74`'s sentence (the intro to the §3 table):

```
Not yet universally true: `src/session/SplitScreen.tsx:293-297`'s first crumb is a dead link (its handler only calls `preventDefault`), because a `session` or `squad` split has no match-setup screen beneath it. Ticket 28 replaces all three hand-rolled crumb blocks with the shared `src/nav.tsx` `Breadcrumb`, which renders a plain `<span>` when a crumb has no destination, and fixes this screen. Until then, treat this paragraph as the rule and the split screen as the exception.
```

Then append this accuracy sentence at the foot of the same table, because the table's chains are longer than anything the app renders and a reader would otherwise take them as literal crumb content:

```
The chains above are the **path taken**, which is what P1 is about. Every screen renders the last two segments of it and no more: measured, each of the three crumb sites emits exactly one separator (`src/session/MatchScreen.tsx:44`, `src/session/SplitScreen.tsx:295`, `src/tournament/TournamentScreen.tsx:265`), so a tournament split shows `Games / Split result`, not the four-segment chain listed here. Ticket 28 keeps the rendered depth at two; expanding the crumbs to match the full chain would be a visible redesign no ticket asks for.
```

- [ ] **Step 6: Reconcile §3's hub name with the shipped nav label**

This goes beyond the spec's ten-claim list, and it is the same correction `:26` already makes: the hub is **Games**, not Tournaments (`src/App.tsx:65`, `{ mode: "games", label: "Games", icon: "▣" }`; the screen's own h1 is `Games`, `src/tournament/GamesScreen.tsx:123`). Leaving `:26` saying Games while §3 and the edge tables say Tournaments makes the file contradict itself, and §3 is the table ticket 28's acceptance criteria check the crumbs against ("Every crumb's destination matches `docs/FLOW.md` §3's table"). Replace the hub name `Tournaments` with `Games` at all eleven occurrences:

| Line | Context | Change |
|---|---|---|
| `:31` | hub table row | `**Tournaments**` → `**Games**` (already covered by Step 2; listed for completeness) |
| `:43` | leaf table, Tournament detail row | `opened from Tournaments` → `opened from Games`; `` `Tournaments / {name}` `` → `` `Games / {name}` ``; `Back goes to` column `Tournaments` → `Games` |
| `:78` | §3 chain | `Tournaments / {name} / Match setup` → `Games / {name} / Match setup` |
| `:80` | §3 chain | `Tournaments / {name} / Match setup / Split result` → `Games / {name} / Match setup / Split result` |
| `:83` | §3 chain | `Tournaments / {name}` → `Games / {name}` |
| `:120` | edge-table heading | `### Tournaments (hub)` → `### Games (hub)` |
| `:137` | edge table | `**Tournaments** (auto redirect)` → `**Games** (auto redirect)` |
| `:138` | edge table | `\| Back / breadcrumb \| Tournaments \|` → `\| Back / breadcrumb \| Games \|` |
| `:153` | edge table | `**Tournaments** with the create modal open` → `**Games** with the create modal open` |
| `:167` | empty-state list | `- **Tournaments**, none:` → `- **Games**, none:` |
| `:179` | §6 closing | `Squads → Tournaments (prefilled create)` → `Squads → Games (prefilled create)` |

Leave the lowercase noun "tournament" alone everywhere: a **Tournament** is the competition container (`CONTEXT.md`) and is correct in all 30-odd places it appears. The label in §3 pins `Squad detail` as the `squad`-source crumb, which is what `src/session/SplitScreen.tsx:375` already renders.

- [ ] **Step 7: Correct §6's closing claim**

`docs/FLOW.md:174-175`:

```
- No URL routing, no browser back/forward: a local-first single-user tool; in-app Back
  covers navigation, and breadcrumbs name the path (ADR-0004).
```

- [ ] **Step 8: Leave the already-correct section alone**

`docs/FLOW.md:20-23` (Entry) is correct post-ADR-0006 and stays exactly as written.

- [ ] **Step 9: Verify**

```bash
grep -n "as-to-be\|Four bottom-nav" docs/FLOW.md
```

Expected: no output — the title is retitled and the hub count is corrected.

```bash
grep -n "Five bottom-nav hubs\|Page Flow$" docs/FLOW.md
```

Expected: `:1` reads `# comp3tive · Page Flow` and `:26` reads `Five bottom-nav hubs. A hub is a top-level home with no back control and no breadcrumb.`

```bash
grep -n "Breadcrumbs are links\|breadcrumb of active links" docs/FLOW.md
```

Expected: **two** matches at `:10` and `:74` — deliberately preserved. Only `:10`'s word "active" is wrong, and C28's ticket owns making the rule true rather than rewriting it. Confirm `:74` still reads `Breadcrumbs are links — every crumb above the current screen navigates there`, and that the forward note naming `src/session/SplitScreen.tsx:293-297` and the "path taken, two segments rendered" sentence were both added around §3.

```bash
grep -n "Tournaments" docs/FLOW.md
```

Expected: **no output.** The hub is named Games everywhere the nav label is meant: `:31`, `:43`, `:78`, `:80`, `:83`, `:120`, `:137`, `:138`, `:153`, `:167`, `:179`. The lowercase noun "tournament" is untouched and will appear ~30 times; that is correct and expected.

```bash
grep -c "tournament" docs/FLOW.md
```

Expected: a non-zero count, confirming the container noun survived the hub rename intact.

- [ ] **Step 10: Commit**

```bash
git add docs/FLOW.md
git commit -m "docs(flow): the contract describes the shipped app

Five hubs with Home centred, the tournaments hub named Games as its own
nav label and h1 do, and the title stops calling a built app
'as-to-be'.

P1 and the breadcrumb rule stay normative, not rewritten: two of the
three crumb sites (MatchScreen, TournamentScreen) already navigate, so
'breadcrumbs are links' describes the app correctly and the defect is
one dead link in SplitScreen. Ticket 28 fixes the code and closes the
gap; the note records that site without contradicting the rule.

Recorded what is actually rendered: each screen emits one separator, so
a tournament split shows 'Games / Split result', not the section 3 chain.
"
```

---

### Task 10: Reconcile the spec documents

**Files:**
- Modify: `docs/spec/0002-tournaments-v1.md:4`, `:31`, `:46`, `:48`, `:52`, `:54`, `:63`
- Modify: `docs/spec/0001-team-builder-v1.md:94`
- Modify: `docs/superpowers/plans/2026-09-10-paper-pencil-redesign.md:9`

**Interfaces:**
- Consumes: nothing. `src/domain/types.ts` is the authority the Data Model must match; `src/storage/indexed-db.ts:18` and `src/data/transfer.ts:9` are the version facts.
- Produces: no export.

**The verified drift.** `DB_VERSION = 6` (`src/storage/indexed-db.ts:18`), backup `version: 4` (`src/data/transfer.ts:9`); `TournamentTeam.players: Id[]` (`src/domain/types.ts:36`); `seriesLength` is tournament-level (`:67`), not per-match; routing uses `winnerNext`/`loserNext` (`:55-56`), not `nextMatchId`; `thirdPlace: boolean` exists at tournament level (`:70`).

- [ ] **Step 1: Add a status line**

Insert under `docs/spec/0002-tournaments-v1.md`'s `# Tournaments v1 — Play the Split` title (before `## Problem Statement`):

```
**Status**: shipped (DB v6, backup v4)
```

- [ ] **Step 2: Correct the Games-tab parenthetical**

`docs/spec/0002-tournaments-v1.md:31` — the phrase `(bottom nav, between History and Disciplines)` is stale. The five slots are Roster, Games, Home, History, Squads (`src/App.tsx:62-68`), and Disciplines is reached from the Games hub's own button (`src/tournament/GamesScreen.tsx:134`, `onManageDisciplines`). Replace the parenthetical with:

```
1. **Games tab** (bottom nav, between Home and History): the community's tournaments, newest first, each row showing name, discipline, format, series length, team count, status (Draft / In progress / Complete). Empty state: "No games yet. Create a tournament and split your teams." Disciplines are reached from this hub's own **Disciplines** button, not from the nav.
```

- [ ] **Step 3: Correct the Data Model**

Replace `docs/spec/0002-tournaments-v1.md:40-59` (the fenced `Tournament { … }` block) with the block that matches `src/domain/types.ts`:

```
Tournament {
  id, communityId, disciplineId,
  name, format: "series" | "single-elim" | "swiss",
  seriesLength: 1 | 3 | 5,          // tournament-level; a Match inherits it
  teamCount, createdAt, status: "draft" | "active" | "complete",
  thirdPlace: boolean,             // single elimination only; plays a 3rd-place match (default true)
  teams: [{ id, bibIndex, name, players: Id[], strength }],  // snapshot from the split
  matches: [{
    id, round, position,
    teamAId, teamBId,              // null until assigned (byes / future rounds)
    games: [{ index, winnerTeamId, scoreA?, scoreB? }],
    winnerTeamId?,                 // decided once a majority exists
    winnerNext: { matchId, slot: "A" | "B" } | null,  // winner slot: advances the bracket
    loserNext: { matchId, slot: "A" | "B" } | null,   // loser slot: carries the 3rd-place match
    isThirdPlace?,
  }],
}
```

Three concrete corrections inside it: `players: Id[]` with the comment `// player ids at submission; roles are not snapshotted` (roles are re-derived, not stored); `seriesLength` deleted from the match object; `nextMatchId?` replaced by the two real fields.

- [ ] **Step 4: Correct the persistence line**

`docs/spec/0002-tournaments-v1.md:63`:

```
- Persistence: one document per tournament in IndexedDB (new `tournaments` store, DB v6), community-scoped. Backup v4 adds `tournaments[]` and `savedSquads[]`; v1–v3 imports migrate with empty lists.
```

- [ ] **Step 5: Correct the v1 discipline claim**

`docs/spec/0001-team-builder-v1.md:94`, which the spec's sweep and Task 5 both point at:

```
- Disciplines beyond the three seeded — the catalog is extensible, and Futsal, MLBB, and Badminton ship in v1.
```

- [ ] **Step 6: Drop the Tailwind claim**

`docs/superpowers/plans/2026-09-10-paper-pencil-redesign.md:9`:

```
**Tech Stack:** TypeScript, React, Vite, Vitest, hand-written CSS custom properties — no new dependencies required.
```

- [ ] **Step 7: Verify the closed set of ten claims**

```bash
grep -rn "as-to-be\|Four bottom-nav\|DB v5\|Backup v3\|nextMatchId\|only Futsal and MLBB ship\|Tailwind CSS" docs/ *.md
```

Expected: no output.

- [ ] **Step 8: Verify docs/agents is untouched**

```bash
git diff --stat docs/agents/
```

Expected: no output. `docs/agents/domain.md` points at `CONTEXT.md` and `docs/adr/`, both of which survive; it names `CONTEXT-MAP.md` and `src/<context>/docs/adr/` as optional and instructs the reader to proceed silently when absent, which is the case here. It needs no edit.

- [ ] **Step 9: Commit**

```bash
git add docs/spec/0002-tournaments-v1.md docs/spec/0001-team-builder-v1.md docs/superpowers/plans/2026-09-10-paper-pencil-redesign.md
git commit -m "docs(spec): match the shipped storage and model

DB v6 and backup v4, players as Id[] rather than a role snapshot,
tournament-level seriesLength, winnerNext/loserNext rather than a
nextMatchId that does not exist, and the Games tab's real neighbours.
Also drops the Tailwind claim: there is no Tailwind in the repo."
```

---

### Task 11: Archive the two shipped-work root documents

**Files:**
- Move: `DOMAIN_MODEL.md` → `docs/archive/DOMAIN_MODEL.md`
- Move: `IMPLEMENTATION_PLAN.md` → `docs/archive/IMPLEMENTATION_PLAN.md`

**Interfaces:**
- Consumes: nothing.
- Produces: no export.

**Dispositions (the spec's 7-document table).** `DOMAIN_MODEL.md` (289 lines) and `IMPLEMENTATION_PLAN.md` (234 lines) move with a superseded banner; `COMP3TIVE_COMPREHENSIVE_ANALYSIS.md` (1,463 lines) stays in the root unchanged because it is dated and self-describing ("Generated: 2026-09-11") and is the provenance for the app-health tickets; `DESIGN.md` (202) stays as Task 8's survivor; `docs/design.md` (98) is Task 8's; `CONTEXT.md` (91) stays unmodified as the live vocabulary; `PRODUCT.md` stays unmodified as the current brief.

- [ ] **Step 1: Request the owner's confirmation**

Both files were authored by the repo owner. **Do not run the moves until the owner confirms.** Post the request naming both files and the reason, then record the answer in the ticket's `## Comments`. `COMP3TIVE_COMPREHENSIVE_ANALYSIS.md` is not part of this request — it stays.

- [ ] **Step 2: Create the archive directory and move the files**

Once confirmed:

```bash
mkdir -p docs/archive
git mv DOMAIN_MODEL.md docs/archive/DOMAIN_MODEL.md
git mv IMPLEMENTATION_PLAN.md docs/archive/IMPLEMENTATION_PLAN.md
```

- [ ] **Step 3: Add the superseded banner to each**

Directly under each file's `# ` title (`# comp3tive Domain Model` and `# comp3tive Tournament Implementation Plan`), insert the same two-line banner:

```
> **Superseded 2026-09-17.** This document describes work that has shipped. The live
> vocabulary is `CONTEXT.md`; the current flow contract is `docs/FLOW.md`. Kept for history.
```

- [ ] **Step 4: Verify the moves and the banners**

```bash
ls DOMAIN_MODEL.md IMPLEMENTATION_PLAN.md 2>&1
```

Expected: `No such file or directory` for both.

```bash
grep -c "Superseded 2026-09-17" docs/archive/DOMAIN_MODEL.md docs/archive/IMPLEMENTATION_PLAN.md
```

Expected: `1` for each.

```bash
wc -l docs/archive/DOMAIN_MODEL.md docs/archive/IMPLEMENTATION_PLAN.md
```

Expected: 289+2 and 234+2 lines — the original counts plus the two-line banner each, proving no content was lost in the move.

- [ ] **Step 5: Confirm the surviving root documents are untouched**

```bash
git diff --stat COMP3TIVE_COMPREHENSIVE_ANALYSIS.md CONTEXT.md PRODUCT.md DESIGN.md
```

Expected: no output.

- [ ] **Step 6: Confirm no live document points at the old paths**

```bash
grep -rn "DOMAIN_MODEL.md\|IMPLEMENTATION_PLAN.md" docs/ *.md | grep -v "docs/archive/"
```

Expected: no output under `docs/` or the root. `COMP3TIVE_COMPREHENSIVE_ANALYSIS.md:1455` lists `DOMAIN_MODEL.md` as a design-token source; that line is inside the kept snapshot and is deliberately not edited, because the file is dated evidence rather than a claim about current state. Record that decision in the ticket.

- [ ] **Step 7: Commit**

```bash
git add docs/archive .scratch/debt/issues/16-reconcile-the-documents-that-contradict-the-code.md
git commit -m "docs: archive the two root documents that describe shipped work

DOMAIN_MODEL.md duplicates CONTEXT.md, which is the live glossary the
agent docs point at, and IMPLEMENTATION_PLAN.md's critical gaps are all
closed. Both move to docs/archive/ with a superseded banner. The
comprehensive analysis stays in place: it is dated and is the provenance
for the app-health tickets."
```

---

## Self-Review

**Spec coverage.** Every in-scope item maps to a task: B13 → 1+2; B14 → 6; B15 → 3; B16 → 9, 10, 11; B17 → 8; B18 → 7; B19 → 5; B20 → 4. Out-of-scope items are honoured: no task touches `NODE_BUDGET`, the pruning bound, the search order, or any file under `src/solver/` except the two new test cases in Task 5, which add coverage without changing behaviour; no task adds a manifest, service worker, or self-hosted font; the landing page's composition, rail, deal animation, bracket preview, and theme tokens are untouched.

**Placeholder scan.** No "TBD", "TODO", "implement later", "fill in details", "handle edge cases", "add appropriate error handling", "write tests for the above", or "similar to Task N". Every code step carries the real code or the exact replacement string. Every verification step names a command and an expected result, and every measured figure quoted in a test comment was reproduced against HEAD's shipped solver during planning.

**Type consistency.** `gapQualifier(result: SplitResult): string | null` is defined in Task 1 and consumed unchanged at two sites in Task 2. `gapKind(result: SplitResult): GapKind` is exported by Task 1 and used by its own tests plus Phase D. Task 5's `BADMINTON_DISCIPLINE` uses the same `roles` / `attributes` ids in `src/domain/seed.ts`, in Task 4's local test fixture, in the Task 4 JSON generator, and in the Task 6 landing card strings — one definition, four consistent uses. `SEED_DISCIPLINES` keeps its existing type and gains one element.

 **Cross-phase consistency.** Task 2's spec seeds its own capabilities and states why: A01's shared `seedScript` normalises every player to one uniform all-rounder, which measures `gap=0, optimal=true, nodes=2` at every team count and can never exercise the best-found path. Tasks 4 and 5 are ordered per ticket 19's `Blocked by: 20`; Tasks 5 and 6 per ticket 14's `Blocked by: 19`. Task 6 records the D02 handoff in ticket 14's `## Comments`. `contracts.md` D1 (`proven ⟺ result.solver.optimal`) is honoured literally: Task 1's implementation comment names both traps, and Task 2 asserts the re-roll path's qualifier by reading the field rather than by asserting a re-roll is never proven.

**Handoffs to sibling phases, stated in the owning task.** Three, each verified rather than assumed:

- **To Phase C26** (Task 3): two of B15's five strings move from `src/App.tsx` to `src/shell/RosterScreen.tsx`. C must carry the strings, not re-derive them — `contracts.md` D2 already forbids independent renaming. Task 3's note names the two strings and the target file.
- **To Phase C** (Task 4): the `sample-data.ts` dynamic-import warning is recorded, not fixed. It is a bundling change in C's territory (C owns `vite.config.ts`), and fixing it means moving the static import out of `src/domain/useDisciplines.ts:3` — architectural, not a data edit. If C declines it, it is a one-line follow-up ticket rather than silent debt.
- **To Phase D02** (Task 6): the exact restore payload for the offline claim is written into ticket 14's `## Comments` — trust-list row 3, the meta description, and the spec assertion that flips back from `"no account"` to `"no signal"`.

**Known discrepancies between the spec and the source, and which this plan follows.** Listed with the plan's own verified anchors:

| Spec / ticket claim | Verified in the source | This plan follows |
|---|---|---|
| `consider()` rejects on `rolesRequired && !teams.every(roleCoverPossible)` at `src/solver/solver.ts:532-534` | **`:515`** (`:532-534` is inside the `better` comparison) | the source's `:515` |
| B19's landing-rail citations `index.html:80,105,127,152,171` | **`:80, :108, :130, :153, :177`** | the source's lines |
| The 3+ stack readout at `SplitScreen.tsx:334` | `:334` is the opening `<div className="readout">`; the `Gap` text is **`:339`**, the block runs `:334-345` | the block `:334-345` |
| B13 acceptance: a 5-team split of the shipped MLBB sample reads `Gap 0.4. Team A leads. Best gap found.` | the sample measures `gap=0.34999999999999964`, so `toFixed(1)` is **`0.3`**, not `0.4`; and **B20 replaces that sample entirely**, so it cannot anchor a B13 test | a self-seeded 25-player futsal pool in Task 2, measured `optimal=false`, `nodes=4,000,001`, reading `Gap 0.1. Team C leads. Best gap found.` |
| B13 acceptance: the landing hero's 2-team split reads `Gap 0.1. Team A leads.` | measured leader is **Team B** (`avg 3.70` vs `3.60`) | `Gap 0.1. Team B leads.` |
| `docs/FLOW.md:74` cited as the breadcrumb rule; `docs/FLOW.md` §3 heading at `:72` | confirmed `:74` and `:72` | the source's lines |
| `contracts.md` D1: "a re-rolled split is **never** proven minimal" | the fallback at `solver.ts:409` was observed returning `optimal: true` by probe (a degenerate pool with zero teams) | the spec's more careful statement — "proven **iff** `optimal`" — because the fallback path is real and reachable |
 | B16's spec and ticket 16 both correct `docs/FLOW.md:26`'s "Four bottom-nav hubs" table to five rows, but leave the hub named **Tournaments** in §3 and every edge table | the hub's shipped label is **Games** everywhere: `src/App.tsx:65` (`{ mode: "games", label: "Games", icon: "▣" }`) and the screen's own h1 (`src/tournament/GamesScreen.tsx:123`, `title="Games"`). §3 is the table ticket 28's acceptance criteria check the rendered crumbs against, and the hand-rolled tournament crumb already reads `Games` (`src/tournament/TournamentScreen.tsx:265`) | Task 9 Step 6 renames the hub at all eleven occurrences (`:31`, `:43`, `:78`, `:80`, `:83`, `:120`, `:137`, `:138`, `:153`, `:167`, `:179`) and leaves the lowercase container noun "tournament" untouched. Reported by PlanC; verified against `NAV_ITEMS` and the rendered crumb. |
| B16's spec says §3's breadcrumb table "keeps its values" | every crumb site emits exactly **one** separator (`src/session/MatchScreen.tsx:44`, `src/session/SplitScreen.tsx:295`, `src/tournament/TournamentScreen.tsx:265`), so the app renders two segments while §3's table lists up to four. Ticket 28 does not expand the crumbs | Task 9 Step 5 keeps the values (they are the path taken, which is what P1 is about) and appends the rendered-depth sentence so a reader cannot mistake the chain for literal crumb content |
| B16's spec and ticket 16 both replace `docs/FLOW.md:74` with "Breadcrumbs are labels, not links" | **two of the three crumb sites already navigate**: `src/session/MatchScreen.tsx:41-45` (`onClick={…props.onBack()}`) and `src/tournament/TournamentScreen.tsx:263-269` (`onClick={…onBack()}`); only `src/session/SplitScreen.tsx:293-297` is dead, and ticket 28 exists to fix it and says landing it first "makes the documentation true instead of codifying the gap" | **neither the spec's rewrite nor the original** — Task 9 leaves `:10` and `:74` normative and appends a note naming the one dead site and ticket 28. Writing "labels, not links" would replace one false claim with another, in the phase whose purpose is to make claims true. Raised by PlanC and verified against all three sites. |

**One risk carried, not hidden.** Between Task 4 and Phase A05, A05's new strict `parseBackup` rejects the *old* `sample-data/futsal-roster.json`. That window is real and expected; Task 4 is what closes it, and Task 4's first test asserts the exact invariant A05 depends on ("every `sample-data/*.json` player passes `validatePlayer`"). A05 and B20 are in different phases and different phases' files, so neither blocks the other; the ordering was agreed with Phase A directly.
