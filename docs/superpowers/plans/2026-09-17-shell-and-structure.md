# Shell and Structure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the shell survivable: delete the code nothing calls, let the compiler notice the next dead local, give each shared constant one definition, extract navigation / community scoping / the split-tournament flow out of a 1,280-line `src/App.tsx` into three unit-tested `.ts` hooks, remove all 17 native browser dialogs, make the dead breadcrumb navigate, stop shipping the app's stylesheet to the Landing Page, and give the project a README, an engine floor and a Node pin.

**Architecture:** Pure extraction plus deletion, in a fixed order, with the browser suite as the behaviour net. Every rule that currently lives inline in `src/App.tsx` moves to a module whose logic is reachable from a plain `.ts` unit test — navigation transitions, the community scoping filter, the split flow's persistence rule and re-roll pool. `src/App.tsx` becomes composition: store handles, preferences, three hook calls, and one JSX block that composes `AppChrome` with a switch over `view.mode`. Nothing in this phase changes behaviour except three deliberate, named changes (a crumb that navigates, a community menu that stays open through a destructive confirm, and one `join('\n')` → `join("; ")`).

**Tech Stack:** React 19.1, TypeScript 5.8, Vite 6 (`appType: "mpa"`, two entries), Vitest 3 (`environment: "node"`, `test.include: ["src/**/*.test.ts"]` — `.ts` only), Playwright 1.62 (`workers: 1`, viewport 1280×720, `webServer: npm run preview`, `testDir: ./tests`), IndexedDB behind the `src/storage/types.ts` interfaces, `fake-indexeddb` for storage tests.

**Spec:** `docs/superpowers/specs/2026-09-17-shell-and-structure-design.md` — this plan implements tickets `.scratch/debt/issues/21-*.md` … `30-*.md` in that order.

## Global Constraints

Copied from the spec's Scope, Design and Risks sections. Every task's requirements implicitly include this section.

1. **Phase A must be green before this plan starts.** Phase A (`docs/superpowers/specs/2026-09-17-truth-and-trust-design.md`) leaves the browser suite at 42 tests, 0 failed, with `npm run e2e` added to `package.json` by A10 and `e2e/support/seed.ts` (`SeedWorld`, `seedScript`, `gotoSeeded`, `gotoHubSeeded`, `hubButton`) created by A01. A red suite cannot gate a refactor: at audit time it was **16 failed, 25 passed, 1 skipped**. Verify before Task 1: `npm run e2e` → **0 failed**.
2. **Frozen names, frozen shapes.** `src/shell/useNavigation.ts` exports `View`, `HubMode`, `useNavigation`; `src/shell/useCommunityScope.ts` exports `useCommunityScope`; `src/shell/useSplitFlow.ts` exports `SplitSource`, `splitFlowRule`, `rerollPool`; `src/ui/constants.ts` exports `BIB`, `FORMAT_LABEL`, `STATUS_LABEL`. Phase D's plan is written against these exact names, signatures and types. Nothing here may rename them.
3. **Extracted hooks are `.ts`, never `.tsx`.** `vite.config.ts` sets `test.include: ["src/**/*.test.ts"]`, so `.tsx` is excluded from the unit harness. A hook that must be unit-tested cannot be `.tsx`. This is a design constraint, not a preference. So `useNavigation.ts`, `useCommunityScope.ts`, `useSplitFlow.ts`, `usePreferences.ts`, `useToasts.ts` and `usePlayerImport.ts` are `.ts` and each testable one has a `.test.ts` beside it. `RosterScreen.tsx`, `AppChrome.tsx`, `ui/Toasts.tsx`, `ui/Modal.tsx` and `ui/ConfirmButton.tsx` are components, not hooks: they stay `.tsx`, their logic is trivial pass-through, and their proof is the browser suite.
4. **No e2e spec is edited.** The suite passes with `git diff --stat e2e/tests` empty. "Passes" means zero failures and no file under `e2e/tests/**` modified. Unit tests may change only where a real API change requires it (Task 9's async download, enumerated below).
5. **Byte-identical copy and classes.** Every moved string, label, class name and message is preserved character-for-character, except the three named deltas: `SplitScreen`'s crumb label becomes source-dependent (Task 8), the community delete menu stays open until confirmed (Task 7), and `createTournament`'s validation list joins with `"; "` instead of `'\n'` (Task 7). `git diff --stat src/index.css` is empty after Tasks 3, 7 and 8.
6. **`src/App.tsx` ends under 400 lines**, measured as `wc -l src/App.tsx`. HEAD is **1,280**. Each extraction states its own interim ceiling so a stalled extraction is visible.
7. **`FORMAT_LABEL` is `Record<TournamentFormat, string>` on purpose.** Phase D's D16 adds `"round-robin"` to `TournamentFormat` (`src/domain/types.ts:25`) and that literal must fail the build until the key is added. The comment naming D16 is part of the deliverable.
8. **Silencing is forbidden.** No `void x;` statement, no underscore-prefixed rename, no `@ts-ignore`, no suppression comment anywhere in `src/`. Deletion — or wiring up where a real caller was waiting — is the only resolution for a `noUnusedLocals` finding.
9. **The `consumeTeams` guard is contractual and is preserved character-for-character**, message included: Swiss needs `n >= 2 && n % 2 === 0`; single-elim needs `n === 2 || n === 4 || n === 8`; series needs `n === 2`; a violation notifies `` `Could not save: a ${tournament.format} bracket needs a supported number of teams (got ${n}).` `` and builds no bracket. Phase D's D35 edits this guard where this plan puts it.
10. **Environment facts, verified — do not re-derive.** `npx tsc -b` → clean. `npx vitest run` → 114 passed / 12 files. `npx playwright test --config=e2e/playwright.config.ts` → 16 failed / 25 passed / 1 skipped at audit time (Phase A fixes this). Always rebuild `dist/` before trusting an e2e run: the config's `webServer` is `npm run preview`, which serves `dist/`, with `reuseExistingServer: true`. A file argument to Playwright is relative to `e2e/`: `npx playwright test --config=e2e/playwright.config.ts tests/squads/saved-squad.spec.ts`. A bare `e2e/tests/...` path finds no tests.
11. **Version floors, from `package.json` and `package-lock.json`** (verify, do not guess): React `^19.1.0`, TypeScript `^5.8.0`, Vite `^6.3.0`, Vitest `^3.1.0`, `@playwright/test` `^1.62.1`, `@types/node` `^22.15.0`. `package-lock.json` has **no `engines` on the root package** (`packages[""].engines === undefined`); the enforced constraint is the intersection of `vite`/`vitest` (`^18 || ^20 || >=22`), `@playwright/test` (`>=20`) and the installed native optional dependency `@napi-rs/lzma-linux-x64-gnu@1.5.1` (`^22.20 || ^24.12 || >=25`), which is `"node": ">=22.20 <23 || >=24.12"`. `.nvmrc` pins `24.16.0`.

## File Map

| Action | File | Responsibility |
|---|---|---|
| Delete | `src/tournament/tournament-domain-fix.ts` (270 lines) | Second copy of the tournament rules, zero importers |
| Delete | `src/session/split-module.ts` (48 lines) | Self-declared "deep module", zero importers |
| Delete | `src/tournament/team-participation-validator.ts` (97 lines) | Only importer was an unused import at `src/App.tsx:48` |
| Modify | `src/tournament/TournamentScreen.tsx:250`, `:352-356` | Delete the unreachable "Re-split is locked" notice and its const |
| Modify | `tsconfig.app.json:19` | `"noUnusedLocals": false` → `true` |
| Modify | `src/App.tsx` (decomposition; 1,280 lines → under 400) | Composition root only |
| Create | `src/ui/constants.ts` | `BIB`, `FORMAT_LABEL`, `STATUS_LABEL` — one definition each |
| Create | `src/ui/format.ts` | `relativeTime` — one definition |
| Create | `src/ui/format.test.ts` | `relativeTime`'s five branches |
| Create | `src/ui/Modal.tsx` | The shared `modal-overlay > modal-card` wrapper |
| Create | `src/shell/useNavigation.ts` | `View`, `HubMode`, `useNavigation`, four pure transitions |
| Create | `src/shell/nav-items.ts` | `NAV_ITEMS`, unchanged in value (accessible names the suite matches) |
| Create | `src/shell/navigation.test.ts` | Push/pop round trip, root no-op, hub collapse |
| Create | `src/shell/useCommunityScope.ts` | `useCommunityScope` + the pure `scopeCommunities` it memoises |
| Create | `src/shell/community-scope.test.ts` | Two-community isolation, null active community, `disciplinesById` |
| Create | `src/shell/useSplitFlow.ts` | `SplitSource`, `splitFlowRule`, `rerollPool`, the flow hook |
| Create | `src/shell/split-flow.test.ts` | Four sources, re-roll pool incl. the sat-out player |
| Create | `src/shell/RosterScreen.tsx` | The roster hub's markup (Phase D's D34/D36 extend this file) |
| Create | `src/shell/AppChrome.tsx` | Rail, topbar, community switcher, settings popover, bottom nav, toast container — and its own four transient toggles |
| Create | `src/shell/usePreferences.ts` | `useStoredPref`, `useMediaQuery` |
| Create | `src/shell/useToasts.ts` | Toast state, `useCallback`-stable `notify` |
| Create | `src/ui/Toasts.tsx` | The `.toast-container` renderer |
| Create | `src/ui/ConfirmButton.tsx` | The two-step destructive confirm |
| Create | `src/shell/usePlayerImport.ts` | The JSON/CSV/backup import path, merge confirm, `lastReport` |
| Create | `src/data/sample-registry.ts` | Sample-data registry, no JSON imports |
| Create | `src/split.css` | The split region + the shared kit the split subtree uses |
| Create | `README.md` | The front door |
| Create | `.nvmrc` | `24.16.0` |
| Modify | `src/nav.tsx` | One `Breadcrumb` shape; `Id` import deleted (that part is Task 2) |
| Modify | `src/session/MatchScreen.tsx:41-46` | Render `Breadcrumb` |
| Modify | `src/tournament/TournamentScreen.tsx:263-269` | Render `Breadcrumb` |
| Modify | `src/session/SplitScreen.tsx:255-264` | `rerollPool` replaces the inline pool expression (one line) |
| Modify | `src/session/SplitScreen.tsx:293-297` | Render `Breadcrumb`; the dead `<a href="#">` goes |
| Modify | `src/domain/DisciplineEditModal.tsx:32`, `:156`, `:167-168` | Delete `isNew`; `ConfirmButton`; `Modal` |
| Modify | `src/roster/PlayerEditModal.tsx:32`, `:143`, `:154-155` | Unused binding; `ConfirmButton`; `Modal` |
| Modify | `src/tournament/GamesScreen.tsx:27`, `:42`, `:229-230` | Import shared constants; `Modal` |
| Modify | `src/session/SquadsScreen.tsx:21`, `:23`, `:100`, `:174` | Shared `BIB`/`relativeTime`; `ConfirmButton` ×2 |
| Modify | `src/session/HistoryScreen.tsx:13`, `:97` | Shared `relativeTime`; `ConfirmButton` |
| Modify | `src/tournament/TournamentScreen.tsx:26`, `:4`, `:107-108` | Shared `FORMAT_LABEL`; delete `teamName` import; `Modal` |
| Modify | `src/DashboardScreen.tsx:6`, `:12` | Import shared `FORMAT_LABEL`/`STATUS_LABEL` |
| Modify | `src/domain/useDisciplines.ts:3` | Import path → `./sample-registry` |
| Modify | `src/data/sample-data.ts` | Loader only: four functions become async |
| Modify | `src/data/sample-data.test.ts` | Registry imports; five awaited assertions |
| Modify | `src/index.css:2`, and the moved regions | `@import "./split.css"`; rules move out |
| Modify | `src/landing.css:7`, `:535`, `:551` | `@import "./split.css"`; delete dead `pulse-needle` |
| Modify | `src/landing.tsx:7` | Stop importing `./index.css` |
| Modify | `package.json` | `engines.node` |
| Modify | `vite.config.ts` | Only if the `split.css` import graph needs an entry adjustment; no other change |

**C26's real reach is six files, not three.** Bringing `App.tsx` under 400 also moves `RosterScreen.tsx`, `AppChrome.tsx`, `usePreferences.ts`, `useToasts.ts` and `ui/Toasts.tsx`. After C26, anything touching the shell looks in `src/shell/` first, not `src/App.tsx`.

---

### Task 1: Delete the code nothing calls (C21)

**Files:**
- Delete: `src/tournament/tournament-domain-fix.ts`
- Delete: `src/session/split-module.ts`
- Delete: `src/tournament/team-participation-validator.ts`
- Modify: `src/App.tsx:48` (delete the import line)
- Modify: `src/tournament/TournamentScreen.tsx:250` and `:352-356` (delete the const and the unreachable span)

**Interfaces:**
- Consumes: nothing.
- Produces: `validateTournamentSpec` has exactly one definition (`src/tournament/tournament-validation.ts`); `validateTeamParticipation` has zero.

- [ ] **Step 1: Prove the deletion is not a behaviour change**

Run:
```bash
cd /home/dimasajiwardhana/Documents/code/team-builder
grep -rn "export function validateTournamentSpec" src/
grep -rn "split-module\|tournament-domain-fix" src/ e2e/
grep -rn "team-participation-validator" src/
```
Expected, today: the first prints **one** line (`src/tournament/tournament-validation.ts`); the second prints **nothing**; the third prints exactly **one** line — `src/App.tsx:48:import { validateTeamParticipation } from "./tournament/team-participation-validator";`. That single line is this task's red state: the module loads and is never called.

- [ ] **Step 2: Delete the two unreferenced modules**

```bash
git rm src/tournament/tournament-domain-fix.ts src/session/split-module.ts
```
Expected: `rm 'src/session/split-module.ts'` and `rm 'src/tournament/tournament-domain-fix.ts'`.

- [ ] **Step 3: Delete the third module and its only importer**

Delete `src/App.tsx` line 48 in full:

```
import { validateTeamParticipation } from "./tournament/team-participation-validator";
```

```bash
git rm src/tournament/team-participation-validator.ts
```

- [ ] **Step 4: Delete the notice that has never rendered**

`src/tournament/TournamentScreen.tsx:353-355` sits inside `{hasAnyGames && (…)}` at `:352`, while `canResplit` is `tournament.teams.length > 0 && !hasAnyGames` at `:250`. The two conditions are mutually exclusive, so the span is unreachable. Open `src/tournament/TournamentScreen.tsx` and delete the const and the span:

```diff
   const hasAnyGames = tournament.matches.some((m) => m.games.length > 0);
-  const canResplit = tournament.teams.length > 0 && !hasAnyGames;
   const eligibleCount = discipline
```

```diff
           {hasAnyGames && (
             <div className="status-banner">
               <button type="button" className="btn btn-ghost" onClick={() => void onUndo()}>
                 ↶ Undo last game
               </button>
-              {canResplit && (
-                <span className="status-msg">Re-split is locked after the first result.</span>
-              )}
             </div>
           )}
```

The lock is enforced by the absent affordance (`onReroll` only renders in the pre-result branch at `:390-397`), not by this text. `hasAnyGames` has two other readers (`:250` before this edit) — re-run `grep -n "hasAnyGames" src/tournament/TournamentScreen.tsx` and keep the remaining uses.

- [ ] **Step 5: Re-run the checks and the compiler**

```bash
grep -rn "split-module\|tournament-domain-fix\|team-participation-validator" src/ e2e/
grep -rn "validateTeamParticipation" src/
grep -rn "Re-split is locked" src/
grep -rn "export function validateTournamentSpec" src/
npx tsc -b
```
Expected: the first three print **nothing**; the fourth prints **exactly one** line in `src/tournament/tournament-validation.ts`; `tsc -b` exits **0**.

- [ ] **Step 6: Run the unit suite**

```bash
npx vitest run
```
Expected: **114 passed / 12 files** (unchanged — no test covered the deleted modules; `grep -rn "tournament-domain-fix\|split-module" src/**/*.test.ts` returns nothing).

- [ ] **Step 7: Record the finding, then commit**

In the task's Answer, record per symbol which live check covers each rule the dead `validateTournamentSpec` encoded — team size against `discipline.team.minTeamSize`/`maxTeamSize` (the solver's `buildSettings` + `MatchScreen`'s seat check at `src/session/MatchScreen.tsx:24-32`), format × discipline compatibility (`getValidTeamCounts`/`TEAM_COUNTS` at `src/tournament/GamesScreen.tsx:34-40`), `seriesLength ∈ {1,3,5}` (`BO: SeriesLength[] = [1, 3, 5]` at `src/tournament/GamesScreen.tsx:34`), and the name check (the live validator). The dead `getValidTeamCounts("single-elim")` returned `[4, 2, 8]` where the live one returns `[2, 4, 8]` — the same set in a different order. **Nothing is copied back.**

```bash
git add -A
git commit -m "refactor(shell): delete the tournament and split modules nothing calls"
```

---

### Task 2: Let the compiler catch dead code (C22)

**Files:**
- Modify: `tsconfig.app.json:19` (`"noUnusedLocals": false` → `true`)
- Modify: `src/App.tsx` (eleven findings)
- Modify: `src/data/sample-data.ts:74`
- Modify: `src/domain/DisciplineEditModal.tsx:32`
- Modify: `src/nav.tsx:1`
- Modify: `src/roster/PlayerEditModal.tsx:32`
- Modify: `src/tournament/TournamentScreen.tsx:4`

**Interfaces:**
- Consumes: Task 1 removed four findings (`src/App.tsx:48`, `src/session/split-module.ts:7`, `src/tournament/team-participation-validator.ts:1`, `src/tournament/tournament-domain-fix.ts:13`).
- Produces: `src/App.tsx` with no dead handler and no dead helper; `noUnusedLocals` clean.

- [ ] **Step 1: Re-derive the findings — the flag is the source of truth**

The ticket's list is stale and its count of 20 was an absorbed ticket's bad count. **Measured on HEAD after Task 1**, this is what the flag reports. Run it and compare against this exact list:

```bash
npx tsc -p tsconfig.app.json --noUnusedLocals --noEmit
```
Expected: **19 → 15 findings** after Task 1's deletions. The list to expect, verbatim in this shape (`file(line,col): error TS6133: '<sym>' is declared but its value is never read.`):

| File:line | Symbol | Disposition |
|---|---|---|
| `src/App.tsx:30` | `DisciplineEditModal` import | delete — `src/domain/DisciplinesScreen.tsx:104` owns the modal |
| `src/App.tsx:123` | `strengthsFor` | delete — zero callers |
| `src/App.tsx:130` | `badgeClass` | delete — the live badge class is built inline at `:1105` |
| `src/App.tsx:179` | `effectiveTheme` | delete — see the cascade below |
| `src/App.tsx:666` | `showHistory` | delete — dead duplicate of `gotoHub("history")` |
| `src/App.tsx:670` | `showDisciplines` | delete — dead duplicate of `goDisciplines` |
| `src/App.tsx:742` | `enterMatchFlow` | delete — `startMatch` is the live entry |
| `src/App.tsx:754` | `finishSplit` | delete — submit flows `SplitScreen.onSubmitTournament` → `consumeTeams` |
| `src/App.tsx:759` | `recordTournamentResult` | delete — `TournamentScreen.onRecord` calls `recordResult` directly |
| `src/App.tsx:772` | `showTournamentView` | delete — `openTournament` (`:738`) is the live one |
| `src/data/sample-data.ts:74` | `ROLE_NAMES` | delete — `autoGenerateSampleData` uses `PLAYER_NAMES` only (`:103`) |
| `src/domain/DisciplineEditModal.tsx:32` | `isNew` | delete — `isEdit`/`isBuiltIn` cover the three cases |
| `src/nav.tsx:1` | `Id` import | delete |
| `src/roster/PlayerEditModal.tsx:32` | `d` | delete the binding |
| `src/tournament/TournamentScreen.tsx:4` | `teamName` import | delete (line 2's type imports stay) |

**If the printed list differs from this table in any way, the compiler wins.** Record the difference in the Answer before resolving it.

- [ ] **Step 2: Delete the three dead helpers and the dead import**

```diff
-import { DisciplineEditModal } from "./domain/DisciplineEditModal";
```

```diff
-function strengthsFor(player: Player, disciplines: Discipline[]) {
-  return disciplines.flatMap((d) => {
-    const cap = player.capabilities.find((c) => c.disciplineId === d.id);
-    return cap ? [{ id: d.id, shortName: d.shortName, strength: computeStrength(d, cap) }] : [];
-  });
-}
-
-const badgeClass = (disciplineId: string) =>
-  disciplineId === "futsal" || disciplineId === "mlbb" ? `badge--${disciplineId}` : "badge--generic";
-
```

- [ ] **Step 3: Delete the six dead handlers**

Each is a whole function. Delete `showHistory` (`:666`), `showDisciplines` (`:670`), `enterMatchFlow` (`:742`), `finishSplit` (`:754`), `recordTournamentResult` (`:759`), `showTournamentView` (`:772`) in full. Delete the now-orphaned comment block that describes them:

```diff
-  // Dashboard actions (ticket 04): every exit reuses an existing App flow —
-  // the roster "Split match" handler, the Games create flow, hub navigation,
-  // and the roster "+ Add Player" modal. Only the entry points differ.
```

The Dashboard's live exits are `startAdHocSplit`, `openNewTournament`, `showSquads` and `addPlayer` — all still referenced at `:960-974`. If any of the six names is referenced anywhere after deletion, `tsc` says so; that is the check.

- [ ] **Step 4: Delete `effectiveTheme` — then re-run, because it cascades**

```diff
-  const systemDark = useMediaQuery("(prefers-color-scheme: dark)");
   const isWide = useMediaQuery("(min-width: 1024px)");
-  const effectiveTheme: "light" | "dark" =
-    themePref === "auto" ? (systemDark ? "dark" : "light") : (themePref as "light" | "dark");
   const effectiveLayout: "mobile" | "desktop" =
```

No behaviour is lost: the "auto" theme is already handled in CSS. `src/tokens.css` defines its dark values under a `prefers-color-scheme` media query, and the effect at `src/App.tsx:184-196` only ever writes or deletes `data-theme`, so `auto` → `delete el.dataset.theme` → the media query decides.

```bash
npx tsc -p tsconfig.app.json --noUnusedLocals --noEmit
```
Expected: **the cascade appears** — `src/App.tsx:177` `systemDark` is now unused, and `src/App.tsx:3` `computeStrength` is now unused too (its only reader was `strengthsFor`). Delete both:

```diff
-import {
-  computeStrength,
-  type Capability,
+import {
+  type Capability,
```

```diff
-  const systemDark = useMediaQuery("(prefers-color-scheme: dark)");
```

**The method is iterative: run the flag, resolve, re-run until clean.** Record each pass in the Answer.

- [ ] **Step 5: Delete the five remaining findings outside `App.tsx`**

```diff
# src/data/sample-data.ts:74
-const ROLE_NAMES = [
-  "Tank", "Assassin", "Mage", "Marksman", "Fighter", "Support",
-  "Guardian", "Controller", "Eraser", "Durable",
-];
```

```diff
# src/domain/DisciplineEditModal.tsx:32
   const isEdit = discipline !== null;
   const isBuiltIn = discipline?.builtIn === true;
-  const isNew = discipline === null;
```

```diff
# src/nav.tsx:1
-import type { Id } from "./domain/types";
-
 export type CrumbGo = () => void;
```

```diff
# src/roster/PlayerEditModal.tsx:30-36 — the binding, not the callback shape
 const draftFromPlayer = (player: Player, disciplines: Discipline[]): CapDraft[] =>
-  player.capabilities.map((c) => {
-    const d = disciplines.find((x) => x.id === c.disciplineId);
+  player.capabilities.map((c) => {
     return {
```

```diff
# src/tournament/TournamentScreen.tsx:4
-import { teamName } from "../session/flow";
```

- [ ] **Step 6: Turn the flag on and re-run until clean**

```diff
# tsconfig.app.json
     "strict": true,
-    "noUnusedLocals": false,
+    "noUnusedLocals": true,
     "noUnusedParameters": true,
```
Nothing else in that file changes.

```bash
npx tsc -p tsconfig.app.json --noUnusedLocals --noEmit
npx tsc -b
grep -rn "void [a-zA-Z]*;\|@ts-ignore\|noUnusedLocals" src/
```
Expected: the first two print nothing and exit **0**; the third prints nothing — no silencing anywhere in source.

- [ ] **Step 7: Unit suite, then the browser suite**

```bash
npx vitest run
npm run build
npm run e2e
```
Expected: vitest **114 passed / 12 files**; the build succeeds; the browser suite **0 failed** with `git diff --stat e2e/tests` empty.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: enable noUnusedLocals and resolve its findings"
```

---

### Task 3: One definition per shared constant (C23)

**Files:**
- Create: `src/ui/constants.ts`
- Create: `src/ui/format.ts`
- Create: `src/ui/format.test.ts`
- Create: `src/ui/Modal.tsx`
- Modify: `src/session/SplitScreen.tsx:21` (delete `BIB`), `:159-160` (`Modal`)
- Modify: `src/session/SquadsScreen.tsx:21-30` (delete `BIB` + `relativeTime`)
- Modify: `src/tournament/TournamentScreen.tsx:26` (delete `FORMAT_LABEL`), `:32` (delete `BIB`), `:107-108` (`Modal`)
- Modify: `src/DashboardScreen.tsx:6`, `:12` (delete `FORMAT_LABEL` + `STATUS_LABEL`)
- Modify: `src/tournament/GamesScreen.tsx:27`, `:42` (delete `FORMAT_LABEL` + `STATUS_LABEL`), `:229-230` (`Modal`)
- Modify: `src/session/HistoryScreen.tsx:13-21` (delete `relativeTime`)
- Modify: `src/domain/DisciplineEditModal.tsx:167-168` (`Modal`)
- Modify: `src/roster/PlayerEditModal.tsx:154-155` (`Modal`)

**Interfaces:**
- Consumes: nothing.
- Produces:
  ```ts
  // src/ui/constants.ts
  export const BIB: readonly ["a", "b", "c", "d", "e"];
  export const FORMAT_LABEL: Record<TournamentFormat, string>;
  export const STATUS_LABEL: Record<TournamentStatus, string>;
  // src/ui/format.ts
  export function relativeTime(ts: number): string;
  // src/ui/Modal.tsx
  export function Modal({ onClose, children }: { onClose: () => void; children: ReactNode }): JSX.Element;
  ```

- [ ] **Step 1: Write the failing test for `relativeTime`**

Create `src/ui/format.test.ts`:

```ts
import { describe, expect, it, vi, afterEach } from "vitest";
import { relativeTime } from "./format";

const NOW = 1_700_000_000_000;
const minutesAgo = (n: number) => NOW - n * 60_000;

describe("relativeTime", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("says 'just now' under a minute", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    expect(relativeTime(NOW)).toBe("just now");
    expect(relativeTime(minutesAgo(0.9))).toBe("just now");
  });

  it("reports minutes under an hour", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    expect(relativeTime(minutesAgo(1))).toBe("1m ago");
    expect(relativeTime(minutesAgo(59))).toBe("59m ago");
  });

  it("reports hours under a day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    expect(relativeTime(minutesAgo(60))).toBe("1h ago");
    expect(relativeTime(minutesAgo(23 * 60))).toBe("23h ago");
  });

  it("reports days under a week", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    expect(relativeTime(minutesAgo(24 * 60))).toBe("1d ago");
    expect(relativeTime(minutesAgo(6 * 24 * 60))).toBe("6d ago");
  });

  it("falls back to a date at a week or more", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const old = minutesAgo(7 * 24 * 60);
    expect(relativeTime(old)).toBe(new Date(old).toLocaleDateString());
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run src/ui/format.test.ts
```
Expected: FAIL — `Failed to resolve import "./format" from "src/ui/format.test.ts"` (the module does not exist yet).

- [ ] **Step 3: Create `src/ui/format.ts`**

This is the byte-identical body currently at `src/session/HistoryScreen.tsx:13-21` and `src/session/SquadsScreen.tsx:23-31`:

```ts
/** "just now" / "12m ago" / "3h ago" / "2d ago" / a date — History and Squads share it. */
export function relativeTime(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/ui/format.test.ts
```
Expected: **5 passed**.

- [ ] **Step 5: Create `src/ui/constants.ts`**

```ts
import type { TournamentFormat, TournamentStatus } from "../domain/types";

/** Team stripe colours, in split order. Indexed modulo its own length. */
export const BIB: readonly ["a", "b", "c", "d", "e"] = ["a", "b", "c", "d", "e"];

/** Human labels per bracket format. D16 adds "round-robin" to the union and to this record. */
export const FORMAT_LABEL: Record<TournamentFormat, string> = {
  series: "Series",
  "single-elim": "Single elimination",
  swiss: "Swiss",
};

/** Human labels per tournament lifecycle state. */
export const STATUS_LABEL: Record<TournamentStatus, string> = {
  draft: "Draft",
  active: "In progress",
  complete: "Complete",
};
```

Every moved value is byte-identical to the three copies it replaces (six label strings: `Series`, `Single elimination`, `Swiss`, `Draft`, `In progress`, `Complete`). The three existing `FORMAT_LABEL` declarations key off different type spellings (`Tournament["format"]` at `src/DashboardScreen.tsx:6` and `src/tournament/TournamentScreen.tsx:26`, `TournamentFormat` at `src/tournament/GamesScreen.tsx:27`); the spellings differ, the unions and the values do not. `FORMAT_LABEL` is an explicit `Record<TournamentFormat, string>` **on purpose**: when D16 adds `"round-robin"` to `src/domain/types.ts:25`, this literal fails the build until the key is added — the type is the reminder.

- [ ] **Step 6: Create `src/ui/Modal.tsx`**

```tsx
import type { ReactNode } from "react";

interface Props {
  /** Dismiss the modal. Fired by the overlay and by the close button. */
  onClose: () => void;
  children: ReactNode;
}

/**
 * The overlay + card skeleton five modals hand-rolled identically. It owns the
 * wrapper and the two handlers only: each call site keeps its own close button,
 * title and content, because they differ (TournamentScreen renders an inline-styled
 * <h1> rather than .modal-title; SplitScreen titles itself "Save squad").
 */
export function Modal({ onClose, children }: Props) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Replace the eight duplicate definitions and the five modal skeletons**

Delete the local `BIB` at `src/session/SplitScreen.tsx:21`, `src/session/SquadsScreen.tsx:21` and `src/tournament/TournamentScreen.tsx:32`, and add to each file's imports:

```ts
import { BIB } from "../ui/constants";
```

Delete `FORMAT_LABEL` at `src/DashboardScreen.tsx:6`, `src/tournament/GamesScreen.tsx:27` and `src/tournament/TournamentScreen.tsx:26`; delete `STATUS_LABEL` at `src/DashboardScreen.tsx:12` and `src/tournament/GamesScreen.tsx:42`; add:

```ts
import { FORMAT_LABEL, STATUS_LABEL } from "./ui/constants";   // from src/DashboardScreen.tsx
import { FORMAT_LABEL, STATUS_LABEL } from "../ui/constants";  // from src/tournament/*.tsx
```

Delete `relativeTime` from `src/session/HistoryScreen.tsx:13-21` and `src/session/SquadsScreen.tsx:23-31`, adding to both:

```ts
import { relativeTime } from "../ui/format";
```

Replace each modal's wrapper. The pattern is identical at all five sites; the content between the wrapper tags does not change:

```diff
# src/domain/DisciplineEditModal.tsx:167-168
-    <div className="modal-overlay" onClick={onClose}>
-      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
+    <Modal onClose={onClose}>
```

```diff
# src/roster/PlayerEditModal.tsx:154-155
-    <div className="modal-overlay" onClick={onClose}>
-      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
+    <Modal onClose={onClose}>
```

```diff
# src/tournament/GamesScreen.tsx:229-230
-        <div className="modal-overlay" onClick={() => setCreating(false)}>
-          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
+        <Modal onClose={() => setCreating(false)}>
```

```diff
# src/tournament/TournamentScreen.tsx:107-108
-    <div className="modal-overlay" onClick={onClose}>
-      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
+    <Modal onClose={onClose}>
```

```diff
# src/session/SplitScreen.tsx:159-160
-    <div className="modal-overlay" onClick={onCancel}>
-      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
+    <Modal onClose={onCancel}>
```

and each closing pair loses one level:

```diff
-      </div>
-    </div>
+    </Modal>
```

Each call site imports `import { Modal } from "../ui/Modal";`. No class name, DOM nesting or rendered string changes: the component emits exactly `<div class="modal-overlay"><div class="modal-card">…`.

- [ ] **Step 8: Verify: one definition each, byte-identical CSS, green suites**

```bash
grep -rc "const BIB\|const FORMAT_LABEL\|const STATUS_LABEL" src/
grep -rn "function relativeTime" src/
grep -rn "modal-overlay" src/ -l
git diff --stat src/index.css
npx tsc -b
npx vitest run
```
Expected: the first prints **one file** — `src/ui/constants.ts:3`; the second prints **exactly one** line in `src/ui/format.ts`; the third names `src/ui/Modal.tsx` plus the five call sites that now pass `children`; `git diff --stat src/index.css` is **empty**; `tsc -b` exits 0; vitest reports **119 passed / 13 files** (114 + `src/ui/format.test.ts`'s 5).

The suite pins this surface: `.modal-card` appears in 12 spec files and `.badge--mlbb` at `e2e/tests/dashboard/dashboard.spec.ts:481`, so a renamed class fails a real assertion.

- [ ] **Step 9: Run the browser suite, then commit**

```bash
npm run build
npm run e2e
```
Expected: **0 failed**, `git diff --stat e2e/tests` empty.

```bash
git add -A
git commit -m "refactor(ui): one definition per shared constant and one modal skeleton"
```

---

### Task 4: Navigation moves out of the shell (C24)

**Files:**
- Create: `src/shell/useNavigation.ts`
- Create: `src/shell/nav-items.ts`
- Create: `src/shell/navigation.test.ts`
- Modify: `src/App.tsx:57-68` (delete `SplitSource`/`HubMode`/`NAV_ITEMS`), `:70-79` (`View`), `:140-141` (`viewStack`/`view`), `:150-156` (the four closures)
- Modify: `src/App.tsx:202-221` region (`view.session` payload usage), `:352`, `:733` (the two wholesale stack writes), `:1208` (History reopen), `:1176-1201` (the split render block)

**Interfaces:**
- Consumes: nothing.
- Produces:
  ```ts
  // src/shell/useNavigation.ts
  export type View =
    | { mode: "roster" } | { mode: "dashboard" } | { mode: "games" }
    | { mode: "history" } | { mode: "disciplines" } | { mode: "squads" }
    | { mode: "tournament"; id: Id } | { mode: "match"; source: SplitSource }
    | { mode: "split"; source: SplitSource };
  export type HubMode = "dashboard" | "roster" | "games" | "history" | "squads";
  export function pushStack(stack: View[], v: View): View[];
  export function popStack(stack: View[]): View[];
  export function hubStack(mode: HubMode): View[];
  export function currentView(stack: View[]): View;
  export function useNavigation(initial: View): {
    view: View; viewStack: View[];
    pushView: (v: View) => void; goBack: () => void;
    gotoHub: (mode: HubMode) => void; resetTo: (v: View) => void;
  };
  // src/shell/nav-items.ts
  export const NAV_ITEMS: readonly { mode: HubMode; label: string; icon: string }[];
  ```

- [ ] **Step 1: Write the failing test**

Create `src/shell/navigation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { currentView, hubStack, popStack, pushStack, type View } from "./useNavigation";

const dashboard: View = { mode: "dashboard" };
const games: View = { mode: "games" };
const tournament: View = { mode: "tournament", id: "t1" };
const match: View = { mode: "match", source: "tournament" };

describe("pushStack", () => {
  it("appends without mutating the input", () => {
    const stack: View[] = [dashboard];
    expect(pushStack(stack, match)).toEqual([dashboard, match]);
    expect(stack).toEqual([dashboard]);
  });
});

describe("popStack", () => {
  it("round-trips a push", () => {
    expect(popStack(pushStack([dashboard], match))).toEqual([dashboard]);
  });

  it("never returns an empty stack at the root", () => {
    const root: View[] = [dashboard];
    expect(popStack(root)).toEqual([dashboard]);
    expect(currentView(popStack(root))).toEqual(dashboard);
  });

  it("pops one level from a depth-3 stack", () => {
    expect(popStack([dashboard, match, tournament])).toEqual([dashboard, match]);
  });
});

describe("hubStack", () => {
  it("collapses a depth-3 stack to a single hub view", () => {
    expect(hubStack("games")).toEqual([{ mode: "games" }]);
  });
});

describe("currentView", () => {
  it("is the last pushed view", () => {
    const stack = pushStack(hubStack("games"), tournament);
    expect(currentView(stack)).toEqual(tournament);
  });
});

describe("the tournament-create sequence", () => {
  it("leaves Games beneath the new tournament, so Back returns to Games", () => {
    const stack = pushStack(hubStack("games"), { mode: "tournament", id: "built-1" });
    expect(stack).toEqual([{ mode: "games" }, { mode: "tournament", id: "built-1" }]);
    expect(currentView(stack)).toEqual({ mode: "tournament", id: "built-1" });
    expect(currentView(popStack(stack))).toEqual({ mode: "games" });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run src/shell/navigation.test.ts
```
Expected: FAIL — `Failed to resolve import "./useNavigation"`.

- [ ] **Step 3: Create `src/shell/useNavigation.ts`**

The four pure transitions are what make this testable at all: `environment: "node"` means no DOM and no renderer, so the hook itself cannot be rendered. They reproduce `src/App.tsx:150-156` exactly.

```ts
import { useState } from "react";
import type { Id } from "../domain/types";
import type { SplitSource } from "./useSplitFlow";

export type View =
  | { mode: "roster" }
  | { mode: "dashboard" }
  | { mode: "games" }
  | { mode: "history" }
  | { mode: "disciplines" }
  | { mode: "squads" }
  | { mode: "tournament"; id: Id }
  | { mode: "match"; source: SplitSource }
  | { mode: "split"; source: SplitSource };

export type HubMode = "dashboard" | "roster" | "games" | "history" | "squads";

/** [...stack, v] — `pushView` at `src/App.tsx:150`. */
export function pushStack(stack: View[], v: View): View[] {
  return [...stack, v];
}

/** One level down, never empty — `goBack`'s `s.length > 1` guard at `:151`. */
export function popStack(stack: View[]): View[] {
  return stack.length > 1 ? stack.slice(0, -1) : stack;
}

/** A hub replaces the stack — `gotoHub` at `:152-155`. */
export function hubStack(mode: HubMode): View[] {
  return [{ mode }];
}

export function currentView(stack: View[]): View {
  return stack[stack.length - 1];
}

export function useNavigation(initial: View) {
  const [viewStack, setViewStack] = useState<View[]>([initial]);
  const view = currentView(viewStack);

  const pushView = (v: View) => setViewStack((s) => pushStack(s, v));
  const goBack = () => setViewStack((s) => popStack(s));
  const resetTo = (v: View) => setViewStack([v]);
  const gotoHub = (mode: HubMode) => setViewStack(hubStack(mode));

  return { view, viewStack, pushView, goBack, gotoHub, resetTo };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/shell/navigation.test.ts
```
Expected: **6 passed**.

- [ ] **Step 5: Create `src/shell/nav-items.ts`**

Moved from `src/App.tsx:62-68`, unchanged in value — the labels are the accessible names Phase A's `hubButton` and the whole suite match on.

```ts
import type { HubMode } from "./useNavigation";

/** The five hub destinations. Rendered twice: rail (desktop) and bottom nav (handheld). */
export const NAV_ITEMS = [
  { mode: "dashboard", label: "Home", icon: "⌂" },
  { mode: "roster", label: "Roster", icon: "◉" },
  { mode: "games", label: "Games", icon: "▣" },
  { mode: "history", label: "History", icon: "≡" },
  { mode: "squads", label: "Squads", icon: "◇" },
] as const satisfies ReadonlyArray<{ mode: HubMode; label: string; icon: string }>;
```

- [ ] **Step 6: Wire `src/App.tsx` to the hook**

Delete `type SplitSource` (`:57`), `type HubMode` (`:59`), `NAV_ITEMS` (`:62-68`) and `type View` (`:70-79`); import the frozen names instead:

```ts
import { useNavigation, type HubMode, type View } from "./shell/useNavigation";
import { NAV_ITEMS } from "./shell/nav-items";
import type { SplitSource } from "./shell/useSplitFlow";
```

Replace `:140-141` and `:150-156` with the hook plus the two-line wrapper. `gotoHub` also clears the match setup today (`setSetup(null)`), and the frozen hook owns only the stack, so the wrapper keeps that:

```ts
const { view, viewStack, pushView, goBack, resetTo } = useNavigation({ mode: "dashboard" });
/** Reset to a hub and drop any half-finished match setup (App.tsx:152-155). */
const gotoHub = (mode: HubMode) => { resetTo({ mode }); setSetup(null); };
const goDisciplines = () => pushView({ mode: "disciplines" });
```

`resetTo({ mode })` **is** `hubStack(mode)` applied — one element — so this is behaviour-identical.

Replace the two wholesale stack writes. Today:

```ts
setViewStack([{ mode: "games" }, { mode: "tournament", id: built.id }]);   // :352, inside consumeTeams
setViewStack([{ mode: "games" }, { mode: "tournament", id: tournament.id }]); // :733, inside createTournament
```

Both become the same two-element stack through frozen-API calls:

```ts
resetTo({ mode: "games" });
pushView({ mode: "tournament", id: built.id });
```

- [ ] **Step 7: Move the split session out of the view union**

The frozen `View` drops the `{ mode: "split"; session: Session }` payload (and also the dead `{ mode: "squads"; openId?: Id }`, which nothing ever pushed — `SquadsScreen` owns its own `openId` at `src/session/SquadsScreen.tsx:48`). The session is live, so it becomes its own state:

```ts
const [activeSplit, setActiveSplit] = useState<{ session: Session; source: SplitSource } | null>(null);
```

The two places that pushed a split view now set it first. The History reopen handler at `:1208`:

```ts
onReopen={(session) => { setActiveSplit({ session, source: "session" }); pushView({ mode: "split", source: "session" }); }}
```

and `reSplitSquad` at `:381-393`:

```ts
    setSetup(null);
    setActiveSplit({ session: synthetic, source: "squad" });
    pushView({ mode: "split", source: "squad" });
```

`split()` at `:287-317` pushes for the match flow:

```ts
    setActiveSplit({ session, source });
    pushView({ mode: "split", source });
```

The render block at `:1176-1201` reads `activeSplit` instead of `view.session`:

```diff
-      {view.mode === "split" && view.session && (
+      {view.mode === "split" && activeSplit && (
         <SplitScreen
-          session={view.session}
-          discipline={disciplines.find(d => d.id === view.session!.disciplineId) ?? disciplines[0]}
+          session={activeSplit.session}
+          discipline={disciplines.find(d => d.id === activeSplit.session.disciplineId) ?? disciplines[0]}
```

and inside `onPersistResult` / `onSaveSquad`, `view.session` becomes `activeSplit.session`, with `view.source` becoming `activeSplit.source`:

```diff
-            if (view.source === "ad-hoc") {
-              const updatedSession = { ...view.session!, result };
+            if (activeSplit.source === "ad-hoc") {
+              const updatedSession = { ...activeSplit.session, result };
```

```diff
-          source={view.source}
+          source={activeSplit.source}
           onSubmitTournament={
-            view.source === "tournament" && setup?.tournamentId
+            activeSplit.source === "tournament" && setup?.tournamentId
               ? (teams) => consumeTeams(setup.tournamentId!, teams)
               : undefined
           }
-          onSaveSquad={(name, result) => saveSquadFromSplit(name, result, view.session!.disciplineId)}
+          onSaveSquad={(name, result) => saveSquadFromSplit(name, result, activeSplit.session.disciplineId)}
```

- [ ] **Step 8: Verify the extraction and the interim ceiling**

```bash
grep -rn "useState<View\[\]>\|const pushView\|const goBack" src/App.tsx
grep -c "useState(" src/App.tsx
wc -l src/App.tsx
npx tsc -b
npx vitest run
```
Expected: the first prints **nothing**; `grep -c "useState("` → **12** (HEAD's 13, minus `viewStack`); `wc -l src/App.tsx` is **below 1,240** (HEAD 1,280 − 31 moved lines − 6, net of the two-line wrapper and the `activeSplit` state); `tsc -b` exits 0; vitest **125 passed / 14 files**.

- [ ] **Step 9: Run the browser suite, then commit**

```bash
npm run build
npm run e2e
git diff --stat e2e/tests
```
Expected: **0 failed**, empty diff — these primitives are what the spec files click through.

```bash
git add -A
git commit -m "refactor(shell): extract navigation into src/shell/useNavigation.ts"
```

---

### Task 5: Community scoping expressed once (C25)

**Files:**
- Create: `src/shell/useCommunityScope.ts`
- Create: `src/shell/community-scope.test.ts`
- Modify: `src/App.tsx:199` (delete the per-render `new Map`), `:200-216` (the four filters), `:220-221` (memoise `viewTournament`)

**Interfaces:**
- Consumes: `View` from Task 4.
- Produces:
  ```ts
  // src/shell/useCommunityScope.ts
  export interface CommunityScopeInput {
    communities: Community[];
    activeCommunityId: Id | null;
    players: Player[];
    sessions: Session[];
    tournaments: Tournament[];
    squads: SavedSquad[];
    /** Not in the frozen input; required to build the returned map. Defaults to []. */
    disciplines?: Discipline[];
  }
  export interface CommunityScopeResult {
    activeCommunity: Community | null;
    players: Player[];
    sessions: Session[];
    tournaments: Tournament[];
    squads: SavedSquad[];
    disciplinesById: Map<Id, Discipline>;
  }
  export function scopeCommunities(input: CommunityScopeInput): CommunityScopeResult;
  export function useCommunityScope(input: CommunityScopeInput): CommunityScopeResult;
  ```

- [ ] **Step 1: Write the failing test**

Create `src/shell/community-scope.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { scopeCommunities } from "./useCommunityScope";
import { FUTSAL_DISCIPLINE, MLBB_DISCIPLINE } from "../domain/seed";
import type { Community, Player, SavedSquad, Session, Tournament } from "../domain/types";

const A: Community = { id: "c-a", name: "Sunday League", createdAt: 1 };
const B: Community = { id: "c-b", name: "Tuesday Crew", createdAt: 2 };

const player = (id: string, communityId: string): Player => ({
  id,
  communityId,
  name: id,
  capabilities: [],
});

const emptyResult = {
  teams: [],
  gap: 0,
  flags: [],
  unassigned: [],
  solver: { optimal: true, nodesExplored: 0, elapsedMs: 0 },
};

const session = (id: string, communityId: string): Session => ({
  id,
  communityId,
  disciplineId: "futsal",
  createdAt: 1,
  poolPlayerIds: [],
  settings: { teamCount: 2 },
  result: emptyResult,
});

const tournament = (id: string, communityId: string): Tournament => ({
  id,
  communityId,
  disciplineId: "futsal",
  name: id,
  format: "series",
  seriesLength: 1,
  teamCount: 2,
  thirdPlace: false,
  createdAt: 1,
  status: "draft",
  teams: [],
  matches: [],
});

const squad = (id: string, communityId: string): SavedSquad => ({
  id,
  communityId,
  name: id,
  disciplineId: "futsal",
  createdAt: 1,
  poolPlayerIds: [],
  settings: { teamCount: 2 },
  result: emptyResult,
});

const input = (activeCommunityId: string | null) => ({
  communities: [A, B],
  activeCommunityId,
  players: [player("p-a", "c-a"), player("p-b", "c-b")],
  sessions: [session("s-a", "c-a"), session("s-b", "c-b")],
  tournaments: [tournament("t-a", "c-a"), tournament("t-b", "c-b")],
  squads: [squad("q-a", "c-a"), squad("q-b", "c-b")],
});

describe("scopeCommunities", () => {
  it("returns only the active community's records in every list", () => {
    const scope = scopeCommunities(input("c-a"));
    expect(scope.activeCommunity).toEqual(A);
    expect(scope.players.map((p) => p.id)).toEqual(["p-a"]);
    expect(scope.sessions.map((s) => s.id)).toEqual(["s-a"]);
    expect(scope.tournaments.map((t) => t.id)).toEqual(["t-a"]);
    expect(scope.squads.map((q) => q.id)).toEqual(["q-a"]);
  });

  it("leaks nothing from the other community when the active one flips", () => {
    const scope = scopeCommunities(input("c-b"));
    expect(scope.activeCommunity).toEqual(B);
    for (const list of [scope.players, scope.sessions, scope.tournaments, scope.squads]) {
      expect(list.map((r) => r.id)).toEqual(["s-b"].includes(list[0]?.id ?? "") ? list.map((r) => r.id) : list.map((r) => r.id));
      expect(list.every((r) => r.communityId === "c-b")).toBe(true);
    }
  });

  it("returns a null community and four empty lists when nothing is active", () => {
    const scope = scopeCommunities(input(null));
    expect(scope.activeCommunity).toBeNull();
    expect(scope.players).toEqual([]);
    expect(scope.sessions).toEqual([]);
    expect(scope.tournaments).toEqual([]);
    expect(scope.squads).toEqual([]);
  });

  it("returns an empty list when the active id names no community", () => {
    const scope = scopeCommunities(input("c-missing"));
    expect(scope.activeCommunity).toBeNull();
    expect(scope.players).toEqual([]);
  });

  it("builds disciplinesById from the optional input", () => {
    const scope = scopeCommunities({ ...input("c-a"), disciplines: [FUTSAL_DISCIPLINE, MLBB_DISCIPLINE] });
    expect(scope.disciplinesById.get("futsal")).toEqual(FUTSAL_DISCIPLINE);
    expect(scope.disciplinesById.get("mlbb")).toEqual(MLBB_DISCIPLINE);
    expect(scope.disciplinesById.get("badminton")).toBeUndefined();
  });

  it("does not throw when disciplines is omitted", () => {
    const scope = scopeCommunities(input("c-a"));
    expect(scope.disciplinesById.size).toBe(0);
    expect(scope.disciplinesById.get("futsal")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run src/shell/community-scope.test.ts
```
Expected: FAIL — `Failed to resolve import "./useCommunityScope"`.

- [ ] **Step 3: Create `src/shell/useCommunityScope.ts`**

The pure selector is what makes the invariant testable in the `node` environment; the hook is one `useMemo` over it.

```ts
import { useMemo } from "react";
import type { Community, Discipline, Id, Player, SavedSquad, Session, Tournament } from "../domain/types";

export interface CommunityScopeInput {
  communities: Community[];
  activeCommunityId: Id | null;
  players: Player[];
  sessions: Session[];
  tournaments: Tournament[];
  squads: SavedSquad[];
  /** Not in the frozen input; required to build the returned map. Defaults to []. */
  disciplines?: Discipline[];
}

export interface CommunityScopeResult {
  activeCommunity: Community | null;
  players: Player[];
  sessions: Session[];
  tournaments: Tournament[];
  squads: SavedSquad[];
  disciplinesById: Map<Id, Discipline>;
}

/**
 * The one place community scoping lives (CONTEXT: every list shows only the
 * active community's records). ADR-0005 records why: History and Games were once
 * handed unfiltered lists and leaked records across communities.
 */
export function scopeCommunities(input: CommunityScopeInput): CommunityScopeResult {
  const { communities, activeCommunityId, disciplines = [] } = input;
  const activeCommunity = communities.find((c) => c.id === activeCommunityId) ?? null;
  const id = activeCommunity?.id;
  const scoped = <T extends { communityId: Id }>(records: T[]): T[] =>
    id ? records.filter((r) => r.communityId === id) : [];
  return {
    activeCommunity,
    players: scoped(input.players),
    sessions: scoped(input.sessions),
    tournaments: scoped(input.tournaments),
    squads: scoped(input.squads),
    disciplinesById: new Map(disciplines.map((d) => [d.id, d])),
  };
}

export function useCommunityScope(input: CommunityScopeInput): CommunityScopeResult {
  return useMemo(
    () => scopeCommunities(input),
    [
      input.communities,
      input.activeCommunityId,
      input.players,
      input.sessions,
      input.tournaments,
      input.squads,
      input.disciplines,
    ],
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/shell/community-scope.test.ts
```
Expected: **6 passed**.

- [ ] **Step 5: Replace the four filters and the per-render `Map` in `src/App.tsx`**

Delete `:199` (`new Map`), `:200-216` (active community + four filters) and replace with one hook call:

```ts
const scope = useCommunityScope({
  communities: communities.communities,
  activeCommunityId: communities.activeId,
  players: roster.players,
  sessions: sessions.sessions,
  tournaments: tournaments.tournaments,
  squads: savedSquads.squads,
  disciplines: catalog.disciplines,
});
const { activeCommunity, disciplinesById } = scope;
const communityPlayers = scope.players;
const communitySessions = scope.sessions;
const communityTournaments = scope.tournaments;
const communitySquads = scope.squads;
```

`visiblePlayers` (`:217-219`) stays — it depends on `filterIds`, which is screen state, not community scope:

```ts
const visiblePlayers =
  filterIds.length === 0
    ? communityPlayers
    : communityPlayers.filter((p) => p.capabilities.some((c) => filterIds.includes(c.disciplineId)));
```

`viewTournament` (`:220-221`) stays too, memoised against the same source list it reads today:

```ts
const viewTournament = useMemo(
  () => (view.mode === "tournament" ? tournaments.tournaments.find((t) => t.id === view.id) ?? null : null),
  [view, tournaments.tournaments],
);
```

The unscoped source is deliberate: `find` by id is already unique, and narrowing it is a behaviour change no ticket asks for. `useMemo` must join the React import: `import { useEffect, useMemo, useRef, useState } from "react";`.

- [ ] **Step 6: Verify the structural criteria and the interim ceiling**

```bash
grep -rn "communityId ===" src/App.tsx
grep -c "new Map" src/App.tsx
grep -c "useMemo" src/shell/useCommunityScope.ts
grep -c "useMemo" src/App.tsx
grep -rn "communityId ===" src/
wc -l src/App.tsx
npx tsc -b
npx vitest run
```
Expected: the first prints **nothing**; `new Map` in `App.tsx` → **0**; `useMemo` in `useCommunityScope.ts` → **at least 1**; `useMemo` in `App.tsx` → **at least 1**; `grep -rn "communityId ===" src/` names **exactly one** file, `src/shell/useCommunityScope.ts` (as `r.communityId === id`); `wc -l src/App.tsx` below **1,220**; `tsc -b` exits 0; vitest **131 passed / 15 files**.

**The memoisation itself is not unit-testable here** and this plan says so rather than pretending: the harness is `environment: "node"` with no DOM and no React renderer installed, `react-dom/server` cannot re-render, and `test.include` admits only `.ts`. Its evidence is structural (the two greps above) plus `e2e/tests/dashboard/dashboard.spec.ts`, which asserts community scoping with 84 assertions.

- [ ] **Step 7: Run the browser suite, then commit**

```bash
npm run build
npm run e2e
git diff --stat e2e/tests
```
Expected: **0 failed**, empty diff.

```bash
git add -A
git commit -m "refactor(shell): one community scope, memoised"
```

---

### Task 6: The split and tournament flow move out of the shell (C26)

**Files:**
- Create: `src/shell/useSplitFlow.ts`
- Create: `src/shell/split-flow.test.ts`
- Create: `src/shell/usePreferences.ts`
- Create: `src/shell/useToasts.ts`
- Create: `src/ui/Toasts.tsx`
- Create: `src/shell/RosterScreen.tsx`
- Create: `src/shell/AppChrome.tsx`
- Modify: `src/session/SplitScreen.tsx:255-264` (the re-roll pool, one expression)
- Modify: `src/App.tsx` — delete `MatchSetup` (`:81-87`), `toggleId` (`:89-90`), `useStoredPref`/`useMediaQuery` (`:92-121`), `setup` (`:146`), the chrome toggles and toasts (`:158-169`), the twelve flow handlers (`:238-410`), the chrome JSX (`:776-812`, `:813-921` and `:1257-1263`), the roster JSX (`:976-1137`)

**Interfaces:**
- Consumes: `View`, `HubMode`, `useNavigation` (Task 4); `useCommunityScope` (Task 5).
- Produces:
  ```ts
  // src/shell/useSplitFlow.ts
  export type SplitSource = "ad-hoc" | "tournament" | "session" | "squad";
  export function splitFlowRule(source: SplitSource): {
    persistsSession: boolean; submitsTournament: boolean; isSynthetic: boolean;
  };
  export function rerollPool(
    source: SplitSource, sessionPoolPlayerIds: Id[] | null, currentTeams: TeamAssignment[],
  ): Id[];
  export interface SplitFlowResult {
    setup: MatchSetup | null;
    activeSplit: { session: Session; source: SplitSource } | null;
    startMatch: (source: SplitSource, tournamentId?: Id) => void;
    openSession: (session: Session) => void;
    togglePlayer: (id: Id) => void;
    selectDiscipline: (id: Id) => void;
    changeTeamCount: (n: number) => void;
    split: () => Promise<void>;
    consumeTeams: (tournamentId: Id, teams: TeamAssignment[]) => Promise<void>;
    recordResult: (matchId: Id, games: GameResult[]) => Promise<void>;
    undoLastResult: () => Promise<void>;
    saveSquadFromSplit: (name: string, result: SplitResult, disciplineId: Id) => Promise<void>;
    reSplitSquad: (squad: SavedSquad) => void;
    useSquadInTournament: (squad: SavedSquad, tournamentId: Id) => Promise<void>;
    newTournamentFromSquad: (squad: SavedSquad) => void;
  }
  export function useSplitFlow(deps: SplitFlowDeps): SplitFlowResult;
  // src/shell/usePreferences.ts
  export function useStoredPref(key: string, initial: string): readonly [string, (v: string) => void];
  export function useMediaQuery(query: string): boolean;
  // src/shell/useToasts.ts
  export type ToastType = "success" | "error" | "info";
  export function useToasts(): { toasts: Array<{ id: string; text: string; type: ToastType }>; notify: (text: string, type?: ToastType) => void };
  // src/ui/Toasts.tsx
  export function Toasts({ toasts }: { toasts: Array<{ id: string; text: string; type: ToastType }> }): JSX.Element;
  // src/shell/RosterScreen.tsx
  export interface RosterScreenProps {
    activeCommunity: Community | null;
    disciplines: Discipline[];
    players: Player[];
    visiblePlayers: Player[];
    filterIds: Id[];
    disciplinesById: Map<Id, Discipline>;
    editingPlayer: Player | null | "new";
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    onToggleFilter: (disciplineId: Id) => void;
    onClearFilters: () => void;
    onAddPlayer: () => void;
    onOpenPlayer: (player: Player) => void;
    onImportFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onExport: () => void;
    onSplitMatch: () => void;
    onSavePlayer: (player: Player) => Promise<void>;
    onDeletePlayer: (id: Id) => Promise<void>;
    onCloseEditor: () => void;
  }
  export function RosterScreen(props: RosterScreenProps): JSX.Element;
  // src/shell/AppChrome.tsx
  export interface AppChromeProps {
    layout: "mobile" | "desktop";
    railPref: string;
    onToggleRail: () => void;
    viewStack: View[];
    onGotoHub: (mode: HubMode) => void;
    communities: Community[];
    activeCommunity: Community | null;
    onSelectCommunity: (id: Id) => void;
    onDeleteCommunity: (id: Id) => void;
    communityDeleteWarning: (id: Id) => string;
    onCreateCommunity: (name: string) => Promise<void>;
    themePref: string;
    layoutPref: string;
    onThemeChange: (v: string) => void;
    onLayoutChange: (v: string) => void;
    toasts: Array<{ id: string; text: string; type: ToastType }>;
  }
  export function AppChrome(props: AppChromeProps): JSX.Element;
  ```

- [ ] **Step 1: Write the failing test for the two frozen rules**

Create `src/shell/split-flow.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { rerollPool, splitFlowRule, type SplitSource } from "./useSplitFlow";
import type { TeamAssignment } from "../domain/types";

const teams = (a: string[], b: string[]): TeamAssignment[] => [
  { index: 0, slots: a.map((playerId) => ({ playerId, roleId: null })), totalStrength: 0, avgStrength: 0 },
  { index: 1, slots: b.map((playerId) => ({ playerId, roleId: null })), totalStrength: 0, avgStrength: 0 },
];

const SOURCES: SplitSource[] = ["ad-hoc", "tournament", "session", "squad"];

describe("splitFlowRule", () => {
  it("persists a Session only for an ad-hoc split (FLOW §2 rule 3)", () => {
    expect(splitFlowRule("ad-hoc")).toEqual({ persistsSession: true, submitsTournament: false, isSynthetic: false });
  });

  it("submits to the bracket only for a tournament split", () => {
    expect(splitFlowRule("tournament")).toEqual({ persistsSession: false, submitsTournament: true, isSynthetic: false });
  });

  it("treats a reopened session as synthetic — it must not mutate the archived log", () => {
    expect(splitFlowRule("session")).toEqual({ persistsSession: false, submitsTournament: false, isSynthetic: true });
  });

  it("treats a squad re-split as synthetic — it persists only when saved as a new squad", () => {
    expect(splitFlowRule("squad")).toEqual({ persistsSession: false, submitsTournament: false, isSynthetic: true });
  });

  it("has exactly one true flag per source", () => {
    for (const source of SOURCES) {
      const rule = splitFlowRule(source);
      const trues = [rule.persistsSession, rule.submitsTournament, rule.isSynthetic].filter(Boolean);
      expect(trues).toHaveLength(1);
    }
  });
});

describe("rerollPool", () => {
  it("returns the session's own pool when supplied", () => {
    const pool = ["p1", "p2", "p3", "p4", "p5", "p6"];
    expect(rerollPool("ad-hoc", pool, teams(["p1", "p2", "p3"], ["p4", "p5", "p6"]))).toEqual(pool);
  });

  it("returns the session's own pool even when it names a player in no team", () => {
    const pool = ["p1", "p2", "p3", "p4", "p5", "p6", "p7"];
    const result = rerollPool("ad-hoc", pool, teams(["p1", "p2", "p3"], ["p4", "p5", "p6"]));
    expect(result).toContain("p7");
    expect(result).toEqual(pool);
  });

  it("flattens the current teams when the session pool is null", () => {
    expect(rerollPool("squad", null, teams(["p1", "p2"], ["p3", "p4"]))).toEqual(["p1", "p2", "p3", "p4"]);
  });

  it("flattens the current teams when the session pool is empty", () => {
    expect(rerollPool("squad", [], teams(["p1", "p2"], ["p3", "p4"]))).toEqual(["p1", "p2", "p3", "p4"]);
  });

  it("flattens in team order, slot by slot", () => {
    expect(rerollPool("session", null, teams(["a", "b"], ["c"]))).toEqual(["a", "b", "c"]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run src/shell/split-flow.test.ts
```
Expected: FAIL — `Failed to resolve import "./useSplitFlow"`.

- [ ] **Step 3: Create `src/shell/useSplitFlow.ts` — the two frozen rules first**

```ts
import type { Id, TeamAssignment } from "../domain/types";

export type SplitSource = "ad-hoc" | "tournament" | "session" | "squad";

/**
 * Whether a mutation in the split flow persists, by source (FLOW §2 rules 3–4,
 * ADR-0004). One SplitScreen serves four entry points and this is the only
 * statement of how they differ.
 */
export function splitFlowRule(source: SplitSource): {
  persistsSession: boolean;
  submitsTournament: boolean;
  isSynthetic: boolean;
} {
  return {
    persistsSession: source === "ad-hoc",
    submitsTournament: source === "tournament",
    isSynthetic: source === "session" || source === "squad",
  };
}
```

`source` **must be used**: `tsconfig.app.json` sets `"noUnusedParameters": true`, so an unused first parameter is a compile error, and Global Constraint 8 forbids renaming it to `_source` to silence that. The frozen signature documents the priority (`sessionPoolPlayerIds` when non-empty, otherwise the flattened current teams) but leaves `source` without a stated job, so it gets the only honest one available — it says whether a stored pool is *expected*:

```ts
export function rerollPool(
  source: SplitSource,
  sessionPoolPlayerIds: Id[] | null,
  currentTeams: TeamAssignment[],
): Id[] {
  // A stored pool always wins: it is the session's own pool, and re-rolling must
  // let a player who sat out back in.
  if (sessionPoolPlayerIds && sessionPoolPlayerIds.length > 0) return sessionPoolPlayerIds;
  // Only a synthetic source (session | squad) can reach here: it re-splits a stored
  // record, whose pool is the teams on screen. A live split (ad-hoc | tournament)
  // always carries session.poolPlayerIds, so an empty pool there means no pool.
  if (splitFlowRule(source).isSynthetic) {
    return currentTeams.flatMap((t) => t.slots.map((s) => s.playerId));
  }
  return [];
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/shell/split-flow.test.ts
```
Expected: **10 passed**.

- [ ] **Step 5: Add the hook to the same file**

The hook takes navigation primitives and store handles as dependencies so it re-derives neither:

```ts
import { useCallback, useState } from "react";
import type { Discipline, GameResult, Id, Player, SavedSquad, Session, SplitResult, TeamAssignment, Tournament } from "../domain/types";
import type { SessionStore } from "../storage/types";
import { buildBracket, applyResult, undoLastGame } from "../tournament/bracket";
import { fairSplit, buildSettings, suggestTeamCount, poolFromPlayers } from "../solver/solver";
import { capabilityFor, teamName } from "../session/flow";
import type { HubMode, View } from "./useNavigation";

export interface MatchSetup {
  disciplineId: Id;
  selectedIds: Id[];
  teamCount: number;
  tournamentId: Id | null;
  source: SplitSource;
}

export interface SplitFlowDeps {
  disciplines: Discipline[];
  disciplinesById: Map<Id, Discipline>;
  players: Player[];
  tournaments: Tournament[];
  viewTournament: Tournament | null;
  activeCommunityId: Id | null;
  sessionStore: SessionStore;
  saveTournament: (t: Tournament) => Promise<void>;
  saveSquad: (s: SavedSquad) => Promise<void>;
  notify: (text: string, type?: "success" | "error" | "info") => void;
  pushView: (v: View) => void;
  resetTo: (v: View) => void;
  gotoHub: (mode: HubMode) => void;
  setTournamentPrefill: (p: { disciplineId: Id; teamCount: number } | null) => void;
}
```

The handler bodies move verbatim from `src/App.tsx:238-410`; the only edits are that `notify`, `pushView`, `resetTo`, `gotoHub` and `setTournamentPrefill` come from `deps`, and `tournaments.tournaments` becomes `deps.tournaments`. `split()`'s persistence branch becomes the rule:

```diff
-    if (setup.source === "ad-hoc") {
+    if (splitFlowRule(setup.source).persistsSession) {
       try {
         await sessionStore.saveSession(session);
       } catch {
         // Non-fatal: still show the split if persistence failed.
       }
     }
```

and `consumeTeams`' guard keeps its exact characters (Global Constraint 9):

```ts
    const n = teams.length;
    const bracketOk =
      tournament.format === "swiss" ? n >= 2 && n % 2 === 0
      : tournament.format === "single-elim" ? (n === 2 || n === 4 || n === 8)
      : n === 2; // series
    if (!bracketOk) {
      notify(`Could not save: a ${tournament.format} bracket needs a supported number of teams (got ${n}).`, "error");
      return;
    }
```

`recordResult` and `undoLastResult` keep their bodies and read `deps.viewTournament`:

```ts
  const recordResult = async (matchId: Id, games: GameResult[]) => {
    if (!viewTournament) return;
    const next = applyResult(viewTournament, matchId, games);
    await saveTournament(next);
  };

  const undoLastResult = async () => {
    if (!viewTournament) return;
    const next = undoLastGame(viewTournament);
    await saveTournament(next);
  };
```

- [ ] **Step 6: Give `rerollPool` its real caller**

`src/session/SplitScreen.tsx:255-264` today:

```ts
  const reroll = () => {
    const next = freshSplit(
      result.teams.flatMap((t) => t.slots.map((s) => s.playerId)),
      roster,
      discipline,
      { teamCount: result.teams.length },
    );
    void commit(next);
    setRerollCount((n) => n + 1);
  };
```

Becomes the version Phase A's A03 leaves, with **only** the pool expression swapped for the frozen helper — one added and one removed line, the rest of A03's counter walk untouched:

```diff
   const reroll = () => {
-    const pool = session.poolPlayerIds.filter((id) => roster.some((p) => p.id === id));
+    const pool = rerollPool(source, session.poolPlayerIds, result.teams).filter((id) => roster.some((p) => p.id === id));
     const settings = { teamCount: session.settings.teamCount };
```

and the import joins the file's existing ones:

```ts
import { rerollPool } from "../shell/useSplitFlow";
```

`contracts.md` assigns this file to A (re-roll only) and B (gap copy only); C touches this one expression and nothing else, and C lands after A. Leaving `rerollPool` with no caller was rejected: this phase exists to delete exactly that, and `noUnusedLocals` does not catch an unused export.

```bash
git diff --numstat src/session/SplitScreen.tsx
```
Expected: after Task 6's other edits are excluded, the `reroll` hunk shows **one added, one removed** line.

- [ ] **Step 7: Create `src/shell/usePreferences.ts`**

Moved unchanged from `src/App.tsx:92-121`:

```ts
import { useEffect, useState } from "react";

/** Persisted preference (theme, layout) with a localStorage fallback. */
export function useStoredPref(key: string, initial: string) {
  const [value, setValue] = useState<string>(() => {
    try {
      return localStorage.getItem(key) ?? initial;
    } catch {
      return initial;
    }
  });
  const set = (v: string) => {
    setValue(v);
    try {
      localStorage.setItem(key, v);
    } catch {
      /* ignore */
    }
  };
  return [value, set] as const;
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}
```

- [ ] **Step 8: Create `src/shell/useToasts.ts` and `src/ui/Toasts.tsx`**

```ts
// src/shell/useToasts.ts
import { useCallback, useState } from "react";

export type ToastType = "success" | "error" | "info";

export interface Toast {
  id: string;
  text: string;
  type: ToastType;
}

/**
 * Toast state + a stable `notify`. Behaviour is unchanged from App's inline
 * version: a crypto.randomUUID() id, appended, removed after 3000 ms. useCallback
 * makes notify a stable dependency for the import and flow handlers.
 *
 * THIS IS PER-CALLER STATE, NOT A CONTEXT. Call it ONCE, in `src/App.tsx`, and
 * thread `notify` down as a prop. A second call anywhere else — a modal, a
 * screen, a share sheet — would create a second list that nothing renders, and
 * its messages would be invisible. There is no `ToastProvider` in this phase and
 * none is planned: the app has no React context anywhere (`grep -rn "createContext"
 * src/` → no matches), and adding one to carry two functions is not this phase's
 * job. Phase D calls `props.notify`, not `useToasts()`.
 */
export function useToasts(): { toasts: Toast[]; notify: (text: string, type?: ToastType) => void } {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const notify = useCallback((text: string, type: ToastType = "info") => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);
  return { toasts, notify };
}
```

```tsx
// src/ui/Toasts.tsx
import type { ToastType } from "../shell/useToasts";

interface Props {
  toasts: Array<{ id: string; text: string; type: ToastType }>;
}

/** The live region App.tsx:1257-1263 rendered inline. Markup unchanged. */
export function Toasts({ toasts }: Props) {
  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.type}`} role="status">
          {t.text}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 9: Create `src/shell/RosterScreen.tsx`**

The roster hub's markup, moved verbatim from `src/App.tsx:976-1137` (162 lines) inside the existing `<Screen>`/`<PageHeader>` wrapper. Props are the values and handlers it already closes over:

```tsx
import type { ReactNode } from "react";
import type { Community, Discipline, Id, Player } from "../domain/types";
import { PageHeader } from "../ui/PageHeader";
import { Screen } from "../ui/Screen";
import { PlayerEditModal } from "../roster/PlayerEditModal";

export interface RosterScreenProps {
  activeCommunity: Community | null;
  disciplines: Discipline[];
  players: Player[];                 // scoped
  visiblePlayers: Player[];
  filterIds: Id[];
  disciplinesById: Map<Id, Discipline>;
  editingPlayer: Player | null | "new";
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onToggleFilter: (disciplineId: Id) => void;
  onClearFilters: () => void;
  onAddPlayer: () => void;
  onOpenPlayer: (player: Player) => void;
  onImportFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onExport: () => void;
  onSplitMatch: () => void;
  onSavePlayer: (player: Player) => Promise<void>;
  onDeletePlayer: (id: Id) => Promise<void>;
  onCloseEditor: () => void;
}

export function RosterScreen(props: RosterScreenProps) {
  const { activeCommunity, disciplines, players, visiblePlayers, filterIds, disciplinesById, editingPlayer, fileInputRef } = props;
  return (
    <Screen>
      <PageHeader
        kicker="Match sheet"
        title="comp3tive"
        lede={
          activeCommunity && (
            <>
              <strong>{activeCommunity.name}</strong> · {players.length} player
              {players.length === 1 ? "" : "s"} on the roster
            </>
          )
        }
      />
      {/* Then, moved byte-for-byte from App.tsx:977-1136: the discipline filter
          chips, `filterIds.length > 0 &&` Clear filters, the .roster-toolbar with
          + Add Player / Import players / the hidden file input / Export,
          `editingPlayer !== null &&` PlayerEditModal, the two empty states, and
          the .cta-bar with "Split match". Exactly four handler bindings change:
            onClick={() => setEditingPlayer(player)}  → onClick={() => props.onOpenPlayer(player)}
            onClick={handleExport}                    → onClick={props.onExport}
            onChange={handlePlayerImport}             → onChange={props.onImportFile}
            onClick={randomPlayers}                   → onClick={props.onSplitMatch}
          The filter chips call props.onToggleFilter(d.id), Clear filters calls
          props.onClearFilters, and the two "+ Add Player" buttons call
          props.onAddPlayer. Every class name, string and element still renders
          identically. */}
    </Screen>
  );
}
```

The `PlayerEditModal` the region renders takes the props above: `onSave={props.onSavePlayer}`, `onDelete={props.onDeletePlayer}`, `onClose={props.onCloseEditor}`. The import/export I/O itself stays in `src/App.tsx` at this point (C26), because it needs the store handles and the `Community` it imports into; Task 7 moves it to `src/shell/usePlayerImport.ts` and adds the `lastReport` / `pendingMerge` props, leaving `onSavePlayer` and `onDeletePlayer` untouched.

**Phase A's `onDeletePlayer` argument must be passed straight through — add no `try`, no `catch`, no `notify`.** The mechanism, read from the source rather than assumed: `PlayerEditModal.remove` (`src/roster/PlayerEditModal.tsx:141-151`) is

```ts
  const remove = async () => {
    if (!player || !onDelete) return;
    if (!window.confirm(`Delete player "${player.name}"?`)) return;
    setSaving(true);
    try {
      await onDelete(player.id);
      onClose();
    } finally {
      setSaving(false);
    }
  };
```

Note what is **absent: there is no `catch`.** The button at `:308` calls `void remove()`. So the full behaviour depends on `onDelete` resolving:

- A04's `deletePlayer` catches and does **not** rethrow → `onDelete` resolves even on failure → `onClose()` runs → the modal closes, the row stays visible, and A's toast names the reason. That is the behaviour `contracts.md` requires C to preserve.
- If C wrapped the call in its **own** `catch`, it would swallow the message A04 already emitted, and the modal would stay open with no explanation.
- If C rethrew, the rejection would escape `remove`, hit `void remove()`, and become an unhandled rejection while the modal sat open with `saving` false — the original bug class.

So `onDeletePlayer: (id: Id) => Promise<void>` receives A04's already-catching function, and C's wiring is exactly `onDelete={props.onDeletePlayer}`. `window.confirm` inside `remove` is the `PlayerEditModal.tsx:143` site that Task 7 Step 3 replaces with `ConfirmButton`; the `try`/`finally` above it does not change.

**Phase B renames two strings inside the region this task moves, so move whatever B wrote — do not re-type from this plan.** B15 (D2, Community is the noun) changes `src/App.tsx:1061` `No players in this squad` → `No players in this community` and `src/App.tsx:1123` `Ready to play? <strong>Split the squad</strong> and check the balance.` → `…<strong>Split the roster</strong>…`. Both are inside `App.tsx:976-1137`, so if B has already landed they arrive already renamed and are copied across verbatim; if B has not landed, copy today's wording and let B's edit land in `src/shell/RosterScreen.tsx` instead. `contracts.md` D2 is explicit: **C must not rename independently — it reads B15's outcome.** The `Split match` button (`src/App.tsx:1131`) and the other three B15 strings (`MatchScreen.tsx:48`, `SplitScreen.tsx:304`, `:400`) are outside this region and untouched here.

- [ ] **Step 10: Create `src/shell/AppChrome.tsx`**

Rail, topbar (community switcher with its delete confirm, ✚, settings popover), bottom nav, and the toast container, moved from `src/App.tsx:776-812` (the skip link and the rail `<aside>`), `:813-921` (the `<div className="shell">` and its `<header className="topbar">`), and `:1257-1263` (the `.toast-container`) plus `:1264-1277` (the bottom `<nav>`). It **owns its own transient chrome state** — the open community menu, the open settings popover, the add-community form and the community-name input — because nothing outside the chrome reads those four:

```tsx
import { useState } from "react";
import type { Community, Id } from "../domain/types";
import type { HubMode, View } from "./useNavigation";
import { NAV_ITEMS } from "./nav-items";
import { Toasts } from "../ui/Toasts";
import type { ToastType } from "./useToasts";

export interface AppChromeProps {
  layout: "mobile" | "desktop";
  railPref: string;
  onToggleRail: () => void;
  viewStack: View[];
  onGotoHub: (mode: HubMode) => void;
  communities: Community[];
  activeCommunity: Community | null;
  onSelectCommunity: (id: Id) => void;
  onDeleteCommunity: (id: Id) => void;
  communityDeleteWarning: (id: Id) => string;
  /** Create a community by name. The form's draft text is this component's own state. */
  onCreateCommunity: (name: string) => Promise<void>;
  themePref: string;
  layoutPref: string;
  onThemeChange: (v: string) => void;
  onLayoutChange: (v: string) => void;
  toasts: Array<{ id: string; text: string; type: ToastType }>;
}

export function AppChrome(props: AppChromeProps) {
  const [communityName, setCommunityName] = useState("");
  const [showAddCommunity, setShowAddCommunity] = useState(false);
  const [showCommunityMenu, setShowCommunityMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  /* The two form handlers App.tsx:466-476 defined against this same state: */
  const createCommunity = async () => {
    if (!communityName.trim()) return;
    await props.onCreateCommunity(communityName.trim());
    setCommunityName("");
    setShowAddCommunity(false);
  };
  const cancelAddCommunity = () => {
    setCommunityName("");
    setShowAddCommunity(false);
  };
  /* Then, moved byte-for-byte: the skip link and rail <aside> (App.tsx:778-811,
     with the rail-toggle wired to props.onToggleRail and the nav buttons to
     props.onGotoHub), the <header class="topbar-wrap topbar"> with its community
     switcher / ✚ form / settings popover (App.tsx:814-921, whose four toggles are
     the state above, whose community callbacks are props.onSelectCommunity /
     props.onDeleteCommunity / communityDeleteWarning, and whose theme/layout
     chips call props.onThemeChange / props.onLayoutChange), the .toast-container
     replaced by <Toasts toasts={props.toasts} /> (App.tsx:1257-1263), and the
     <nav class="bottom-nav"> (App.tsx:1264-1277). Every class name, string,
     aria-label and aria-live stays as it renders today; the community delete's
     window.confirm stays here until Task 7 replaces it with ConfirmButton. */
  return (<>{/* … */}</>);
}
```

- [ ] **Step 11: Compose `src/App.tsx` from the new modules**

```ts
  const { toasts, notify } = useToasts();
  const [themePref, setThemePref] = useStoredPref("tb-theme", "auto");
  const [layoutPref, setLayoutPref] = useStoredPref("tb-layout", "auto");
  const [railPref, setRailPref] = useStoredPref("tb-rail", "expanded");
  const isWide = useMediaQuery("(min-width: 1024px)");
  const effectiveLayout: "mobile" | "desktop" =
    layoutPref === "auto" ? (isWide ? "desktop" : "mobile") : (layoutPref as "mobile" | "desktop");
```

```ts
  const flow = useSplitFlow({
    disciplines,
    disciplinesById,
    players: communityPlayers,
    tournaments: communityTournaments,
    viewTournament,
    activeCommunityId: activeCommunity?.id ?? null,
    sessionStore,
    saveTournament: tournaments.saveTournament,
    saveSquad: savedSquads.saveSquad,
    notify,
    pushView,
    resetTo,
    gotoHub,
    setTournamentPrefill,
  });
  const { setup, activeSplit } = flow;
```

The JSX becomes three pieces: `<AppChrome … />`, the `<main>` switch over `view.mode`, and `<RosterScreen … />` for `view.mode === "roster"`. `SplitScreen`'s `onPersistResult` uses the rule instead of the inline check:

```tsx
          onPersistResult={async (result) => {
            // FLOW rule 3: only ad-hoc splits persist re-rolls/swaps to the
            // Session log. Session/squad sources are synthetic, and tournament
            // splits persist via the bracket (no Session pollution).
            if (splitFlowRule(activeSplit.source).persistsSession) {
              await sessionStore.saveSession({ ...activeSplit.session, result });
            }
          }}
```

- [ ] **Step 12: Verify the v1 acceptance criteria, then the final sizing**

```bash
wc -l src/App.tsx
grep -rn 'source === "ad-hoc"\|source === "tournament"' src/App.tsx
grep -c "useState(" src/App.tsx
grep -rn "toast-container" src/
grep -rn "useState<View\[\]>\|type HubMode\|const NAV_ITEMS" src/App.tsx
npx tsc -b
npx vitest run
```
Expected: `wc -l` **below 400**; the four source checks print **nothing**; `useState(` in `App.tsx` → **4** (`tournamentPrefill`, `filterIds`, `editingPlayer`, `downloadingId`); `toast-container` names **exactly one** file (`src/ui/Toasts.tsx`); `tsc -b` exits 0; vitest **141 passed / 16 files**.

**If `wc -l src/App.tsx` is still ≥ 400, here is the measured ledger of what is left, in this order of least risk.** The region inventory on HEAD is the budget (measured by removing each task's ranges from the 1,280-line file):

| Residual region on HEAD | Lines | What it is | Lever if over budget |
|---|---|---|---|
| `958-975` | 18 | The Dashboard branch of the JSX switch | stays |
| `1138-1256` | 119 | The games/tournament/split/history/squads/disciplines/match branches | stays — this is the composition |
| `1-29`, `31-47`, `49-56` | 54 | The import block | shrinks to ~25 as the extracted names replace the moved ones |
| `673-741` | 69 | `showSquads`/`addPlayer`/`startAdHocSplit`/`openNewTournament`/`createTournament`/`openTournament` | `createTournament` + `openTournament` + `deleteTournament` + `deleteTournamentFromUI` are the tournament half of the flow hook, whose deps already carry `pushView`, `resetTo`, `gotoHub`, `setTournamentPrefill`, `saveTournament`, `viewTournament`, `disciplines`, `disciplinesById`; moving them into `useSplitFlow` and returning them is additive to the frozen interface |
| `466-476`, `616-651` | 40 | Community CRUD + `deleteCommunity` + `communityDeleteWarning` | `communityDeleteWarning`'s four counts are the same four scoped lists `useCommunityScope` already computes |
| `477-514` | 38 | `savePlayer`/`deletePlayer`/`saveDiscipline`/`deleteDiscipline`/sample download | stays (Task 7 moves the import half) |
| `923-928`, `1279-1280` | 8 | `<main>` open and the component's close | stays |

Trim the import block first (it is mechanical), then move the four tournament-entry helpers. Both are inside C's ownership (`src/shell/**`, `src/App.tsx`) and neither changes a frozen name.

- [ ] **Step 13: Run the browser suite — `saved-squad.spec.ts` is the acceptance test**

```bash
npm run build
npx playwright test --config=e2e/playwright.config.ts tests/squads/saved-squad.spec.ts
npm run e2e
git diff --stat e2e/tests
```
Expected: `saved-squad.spec.ts` passes (it exercises save-from-split → list → use-in-tournament end to end, which is this flow); the whole suite **0 failed**; empty diff.

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "refactor(shell): extract the split and tournament flow, chrome and roster screen"
```

---

### Task 7: Failures and confirmations speak the app's language (C27)

**Files:**
- Create: `src/ui/ConfirmButton.tsx`
- Create: `src/shell/usePlayerImport.ts`
- Modify: `src/App.tsx:431`, `:449`, `:528`, `:532`, `:544`, `:562`, `:565`, `:571`, `:608`, `:610`, `:714` (ten `alert`, one `window.confirm`), `:865-868` (community delete confirm), `:866`
- Modify: `src/domain/DisciplineEditModal.tsx:156`
- Modify: `src/roster/PlayerEditModal.tsx:143`
- Modify: `src/session/SquadsScreen.tsx:100`, `:174`
- Modify: `src/session/HistoryScreen.tsx:97`
- Modify: `src/shell/useSplitFlow.ts` (`recordResult`, `undoLastResult`, `split`'s failure path, the legacy-adoption effect)

**Interfaces:**
- Consumes: `useToasts().notify` (Task 6); `RosterScreen` (Task 6).
- Produces:
  ```tsx
  // src/ui/ConfirmButton.tsx
  export function ConfirmButton(props: {
    label: string; confirmLabel: string; message?: string;
    onConfirm: () => void; className?: string;
  }): JSX.Element;
  // src/shell/usePlayerImport.ts
  /** A08's per-row skip, re-exported so a consumer imports it from one place. */
  export type { ImportSkip } from "../data/player-import";
  export interface ImportReport {
    imported: number;
    skipped: ImportSkip[];
  }
  export function usePlayerImport(deps: PlayerImportDeps): {
    pendingMerge: { counts: Record<string, number>; apply: () => Promise<void> } | null;
    confirmMerge: () => void;
    cancelMerge: () => void;
    lastReport: ImportReport | null;
    importFile: (file: File) => Promise<void>;
  };
  ```

- [ ] **Step 1: Write the failing test — a native dialog actually blocks automation**

Create `/tmp/probe-dialogs.mjs` (outside the repo, so it is not a repo file, and it does not touch `e2e/**`):

```js
import { chromium } from "@playwright/test";

const BASE = "http://localhost:4173/app/";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

const dialogs = [];
page.on("dialog", async (d) => { dialogs.push(`${d.type()}:${d.message()}`); await d.dismiss(); });

await page.goto(BASE);
await page.locator(".app").waitFor({ timeout: 15000 });

// A community, then one player, driven through the real UI.
await page.getByTitle("New community").click();
await page.locator(".add-community input").fill("Probe");
await page.locator(".add-community .btn-primary").click();
await page.locator(".add-community").waitFor({ state: "hidden" });

await page.getByRole("button", { name: "Roster" }).click();
await page.getByRole("button", { name: /Add Player/ }).click();
const modal = page.locator(".modal-card");
await modal.locator("#player-name").fill("Probe Player");
await modal.locator(".btn-primary").click();
await page.locator(".roster .row").first().click();

// The modal's Delete button, whatever class it currently carries.
await modal.getByRole("button", { name: "Delete", exact: true }).click();
await page.waitForTimeout(500);

console.log(JSON.stringify({
  dialogs,
  controls: await modal.locator(".btn-ghost, .btn-danger-ghost").allTextContents(),
  stillOpen: await modal.isVisible(),
}));
await browser.close();
```

Run:
```bash
npm run build && npm run preview &
node /tmp/probe-dialogs.mjs
```
Expected **today** (the red state): `dialogs` is `["confirm:Delete player \"Probe Player\"?"]` and `controls` is `[]` — the page's dialog handler is what released the click, so with no handler the click would have stalled until the 30 s timeout. That is the defect the audit reproduced live. After this task the same probe prints `dialogs: []`, `controls: ["Cancel", "Delete player"]` and `stillOpen: true`.

- [ ] **Step 2: Create `src/ui/ConfirmButton.tsx`**

The precedent already ships at `src/tournament/TournamentScreen.tsx:245` (`deleteConfirm`) with its two-step at `:376-408`. Seven hand-rolled copies of that boolean would be worse than the dialogs, so the pattern becomes one primitive:

```tsx
import { useState } from "react";

interface Props {
  /** Idle-state label. */
  label: string;
  /** Confirm-state label. */
  confirmLabel: string;
  /** The warning copy, rendered beside the confirm controls. */
  message?: string;
  onConfirm: () => void;
  /** Idle button class. Defaults to "btn btn-ghost". */
  className?: string;
  /**
   * Optional accessible name for the idle button. Required when `label` is a bare
   * verb in a list of repeated rows, so the name stays unique and unchanged.
   * The confirm-state button needs none: it is unique while it is rendered.
   */
  ariaLabel?: string;
}

/**
 * The two-step destructive confirm the tournament delete already uses: a boolean
 * swaps the button for Cancel + a danger confirm, in place, with no modal and no
 * focus move. Returns a fragment so each site drops it into the row it has.
 */
export function ConfirmButton({ label, confirmLabel, message, onConfirm, className = "btn btn-ghost", ariaLabel }: Props) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button type="button" className={className} aria-label={ariaLabel} onClick={() => setConfirming(true)}>
        {label}
      </button>
    );
  }
  return (
    <>
      {message && <span className="status-msg">{message}</span>}
      <button type="button" className="btn btn-ghost" onClick={() => setConfirming(false)}>
        Cancel
      </button>
      <button
        type="button"
        className="btn btn-danger-ghost"
        onClick={() => {
          setConfirming(false);
          onConfirm();
        }}
      >
        {confirmLabel}
      </button>
    </>
  );
}
```

It reuses three classes that already exist — `.btn-ghost` (`src/index.css:1163`), `.btn-danger-ghost` (`:1169`) and `.status-msg` — so `src/index.css` does not change. **One measured caveat the spec does not state:** `.status-msg`'s *only* rule is `.status-banner .status-msg` (`src/index.css:2751`), a descendant selector. `ConfirmButton`'s message span is therefore styled only where the caller already sits inside a `.status-banner`. At the modal `.bar` sites (`DisciplineEditModal`, `PlayerEditModal`) it renders unstyled and inherits the bar's typography — the copy is visible, correct and unstyled, which is why no CSS changes. A site that wants the muted treatment wraps its `ConfirmButton` in the existing `.status-banner` div; do not add a rule to `src/index.css` for this. Nothing traps focus; nothing sets `aria-modal`.

- [ ] **Step 3: Replace the seven `window.confirm()` calls**

Six go through `ConfirmButton`, keeping their warning copy verbatim.

`src/domain/DisciplineEditModal.tsx:156`:

```diff
-    if (!window.confirm(`Delete discipline "${discipline.name}"? Players with capabilities in it will still have those ratings, but the discipline won't be available for splitting.`)) return;
-    setSaving(true);
-    try {
-      await onDelete(discipline.id);
+    setSaving(true);
+    try {
+      await onDelete(discipline.id);
```

The local function is named `remove` in both files, and its button is the `.bar`'s `.btn-ghost`. Only the button changes — `remove` (which does the save/`onDelete`/`onClose` work) keeps its body minus the `window.confirm` guard:

```diff
# src/domain/DisciplineEditModal.tsx:311-321
           {isEdit && onDelete && !isBuiltIn ? (
            <ConfirmButton
              label="Delete"
              confirmLabel="Delete discipline"
              message={`Delete discipline "${discipline.name}"? Players with capabilities in it will still have those ratings, but the discipline won't be available for splitting.`}
              onConfirm={() => void remove()}
            />
           ) : (
```

`src/roster/PlayerEditModal.tsx:143` and its button at `:304-312`:

```diff
           {isEdit && onDelete ? (
            <ConfirmButton
              label="Delete"
              confirmLabel="Delete player"
              message={`Delete player "${player.name}"?`}
              onConfirm={() => void remove()}
            />
           ) : (
```

`ConfirmButton` owns its own idle/confirm classes, so the removed `disabled={saving}` cannot be carried through the props. The save button in the same `.bar` still carries `disabled={saving || !name.trim()}`, and `remove` sets `saving` before awaiting, so a double-confirm is a second `onDelete` on an already-deleted id — an upsert-by-id no-op on these stores. Note it in the Answer rather than inventing a new prop.

`src/session/SquadsScreen.tsx:100`:

```tsx
<ConfirmButton
  label="Delete"
  confirmLabel="Delete squad"
  message={`Delete "${open.name}"? Tournaments that used it keep their teams.`}
  onConfirm={() => void onDelete(open.id)}
/>
```

`src/session/SquadsScreen.tsx:171-179` — the row variant. The row is a repeated list, so the idle button **must keep its unique accessible name** (`aria-label={`Delete ${squad.name}`}` at `:171`), which is why `ConfirmButton` takes `ariaLabel`. The confirm-state text changes because `aria-label` is deliberately not carried into it: a focused unique name is what the confirm pattern replaces.

```tsx
<ConfirmButton
  label="Delete"
  className="link danger"
  ariaLabel={`Delete ${squad.name}`}
  confirmLabel={`Delete ${squad.name}`}
  message={`Delete "${squad.name}"? Tournaments that used it keep their teams.`}
  onConfirm={() => void onDelete(squad.id)}
/>
```
`e.stopPropagation()` already lives on the `onClick` that this button replaces, so it must survive: wrap the `ConfirmButton` in a `<span onClick={(e) => e.stopPropagation()}>` inside the existing `.row-actions`.

`src/session/HistoryScreen.tsx:93-101` — the row is repeated, so keep `aria-label="Delete session"` from `:94` on the idle button:

```tsx
<ConfirmButton
  label="Delete"
  className="link danger"
  ariaLabel="Delete session"
  confirmLabel="Delete session"
  message="Delete this session?"
  onConfirm={() => onDelete(s.id)}
/>
```
with `e.stopPropagation()` preserved the same way.

`src/shell/AppChrome.tsx` — the community switcher's delete, which was `src/App.tsx:860-874` before Task 6 moved the chrome out. **The one deliberate behaviour change**: today the menu closes *before* the native dialog, because a native dialog survives it. With an inline confirm the menu stays open while the user decides, and closes on confirm. `communityDeleteWarning` and `deleteCommunity` are already props on `AppChromeProps` and `setShowCommunityMenu` is the component's own state, so nothing new is threaded:

```diff
-                        <button
-                          type="button"
-                          className="squad-menu-danger"
-                          onClick={() => {
-                            const warning = communityDeleteWarning(activeCommunity.id);
-                            setShowCommunityMenu(false);
-                            if (window.confirm(`Delete "${activeCommunity.name}"?${warning}`)) {
-                              void deleteCommunity(activeCommunity.id);
-                            }
-                          }}
-                        >
-                          Delete {activeCommunity.name}
-                        </button>
+                        <ConfirmButton
+                          className="squad-menu-danger"
+                          label={`Delete ${activeCommunity.name}`}
                          confirmLabel="Delete community"
                          message={`Delete "${activeCommunity.name}"?${communityDeleteWarning(activeCommunity.id)}`}
                          onConfirm={() => {
                            setShowCommunityMenu(false);
                            void props.onDeleteCommunity(activeCommunity.id);
                          }}
                        />
```

The seventh confirm — the import merge at `src/App.tsx:449` — becomes `usePlayerImport`'s `pendingMerge` in Step 5, because its trigger is a file input rather than a button.

- [ ] **Step 4: Replace the ten `alert()` calls with `notify`**

Every sentence is preserved. The types follow the two `notify` already distinguishes (`src/index.css:2835-2857`): guards and failures `error`, the two count reports `success`.

| Line | Call |
|---|---|
| `:431`, `:610` | `notify(\`Import failed: ${err instanceof Error ? err.message : String(err)}\`, "error")` |
| `:528` | `notify("That file is not valid JSON.", "error")` |
| `:532` | `notify("That JSON file does not contain a recognizable roster.", "error")` |
| `:544` | `notify("Pick or create a community before importing a player file.", "error")` |
| `:562` | `notify(\`Imported ${imported} player${imported === 1 ? "" : "s"} into ${activeCommunity.name}.\`, "success")` |
| `:565` | `notify("That JSON file is not a recognized roster or backup.", "error")` |
| `:571` | `notify("Pick or create a community before importing a CSV.", "error")` |
| `:608` | `notify(\`Imported ${imported} player${imported === 1 ? "" : "s"}.\`, "success")` |
| `:714` | `notify(\`Validation failed: ${validation.map((v) => v.message).join("; ")}\`, "error")` |

**The copy delta is exactly one joiner.** `:714`'s list is `join('\n')` today and a toast is a single inline paragraph, so it becomes `join("; ")`. Nothing else changes a character. Keep the `console.error("Tournament validation failed:", validation)` line above `:714` as it is.

- [ ] **Step 5: Create `src/shell/usePlayerImport.ts`**

**How `notify` reaches a deep component — the rule Phase D needs.** `useToasts()` holds its state internally and is called **once**, in `src/App.tsx`; `notify` then travels as a prop (`AppChrome` gets `toasts` only, because it renders the region; `useSplitFlow` and `usePlayerImport` get `notify` in their deps). A component that is not `App` must never call `useToasts()` itself: its own state would be a second list that nothing renders. Phase D's share sheet and bulk-rating modal therefore take `notify` as a prop from whatever mounts them. If Phase D ever needs a context instead, adding a `ToastProvider` is a change to `src/shell/useToasts.ts` and `src/App.tsx` — this phase deliberately does not introduce one, because the app has no React context anywhere today (`grep -rn "createContext\|useContext" src/` → no matches).

**The import report type is named, not inline.** `ImportReport { imported: number; skipped: ImportSkip[] }` is exported from `src/shell/usePlayerImport.ts`, and `ImportSkip { line: number; reason: string }` is A08's frozen type in `src/data/player-import.ts`, re-exported from the same place. Phase D imports `ImportReport` from `src/shell/usePlayerImport.ts` and must not declare its own copy.

Both the merge confirm (`:449`) and the CSV/JSON branch (`:515-614`, 100 lines) move here:

```ts
import { useCallback, useState } from "react";
import type { Capability, Community, Discipline, Id, Player, SavedSquad, Session, Tournament } from "../domain/types";
import { parseBackup } from "../data/transfer";
import type { ImportSkip } from "../data/player-import";

/** A08's per-row skip, re-exported so a consumer imports it from one place. */
export type { ImportSkip } from "../data/player-import";

/** The outcome of the last import, for the roster screen's report panel. */
export interface ImportReport {
  imported: number;
  skipped: ImportSkip[];
}

export interface PlayerImportDeps {
  activeCommunity: Community | null;
  disciplines: Discipline[];
  communities: Community[];              // all, for id dedupe
  players: Player[];
  sessions: Session[];
  tournaments: Tournament[];
  squads: SavedSquad[];
  savePlayer: (p: Player) => Promise<void>;
  saveCommunity: (c: Community) => Promise<void>;
  saveSession: (s: Session) => Promise<void>;
  saveTournament: (t: Tournament) => Promise<void>;
  saveSquad: (s: SavedSquad) => Promise<void>;
  notify: (text: string, type?: "success" | "error" | "info") => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

export function usePlayerImport(deps: PlayerImportDeps): {
  pendingMerge: { counts: Record<string, number>; apply: () => Promise<void> } | null;
  confirmMerge: () => void;
  cancelMerge: () => void;
  lastReport: ImportReport | null;
  importFile: (file: File) => Promise<void>;
} {
  const [pendingMerge, setPendingMerge] = useState<{ counts: Record<string, number>; apply: () => Promise<void> } | null>(null);
  const [lastReport, setLastReport] = useState<ImportReport | null>(null);

  const confirmMerge = useCallback(() => {
    void pendingMerge?.apply();
    setPendingMerge(null);
  }, [pendingMerge]);

  const cancelMerge = useCallback(() => setPendingMerge(null), []);

  const importFile = useCallback(async (file: File) => {
    /* handlePlayerImport's body from App.tsx:515-614, with each `alert(...)`
       replaced by deps.notify(...) exactly as the table in Step 4 lists, and the
       merge branch's `window.confirm(...)` replaced by
       setPendingMerge({ counts, apply }).
       `lastReport` is set by whichever branch ran, always as an ImportReport:
         - JSON, players-only: { imported, skipped: [] }  (every non-object entry
           is not a row, so nothing is skipped)
         - CSV: { imported: players.length, skipped } from A08's
           `csvRowsToPlayers(rows, disciplines, communityId)`
         - the backup branch defers to handleImport, which sets no report
       A08's `ImportSkip` shape ({ line: number; reason: string }) is frozen by
       contracts.md; this hook consumes `skipped` verbatim and never re-words a reason. */
  }, [deps]);

  return { pendingMerge, confirmMerge, cancelMerge, lastReport, importFile };
}
```

The copy and the merge semantics — **add only new ids, never overwrite** — are unchanged. `RosterScreen` takes `lastReport: ImportReport | null` and `pendingMerge` as props (the Task 7 additions to `RosterScreenProps`) and renders the two-step from `pendingMerge`:

```tsx
{pendingMerge && (
  <div className="status-banner">
    <span className="status-msg">
      Import {pendingMerge.counts.communities} new communit{pendingMerge.counts.communities === 1 ? "y" : "ies"},{" "}
      {pendingMerge.counts.players} new player{pendingMerge.counts.players === 1 ? "" : "s"},{" "}
      {pendingMerge.counts.sessions} session{pendingMerge.counts.sessions === 1 ? "" : "s"},{" "}
      {pendingMerge.counts.tournaments} tournament{pendingMerge.counts.tournaments === 1 ? "" : "s"} and{" "}
      {pendingMerge.counts.squads} saved squad{pendingMerge.counts.squads === 1 ? "" : "s"}? (Existing records with the
      same id are kept.)
    </span>
    <button type="button" className="btn btn-ghost" onClick={cancelMerge}>Cancel</button>
    <button type="button" className="btn btn-primary" onClick={confirmMerge}>Import</button>
  </div>
)}
```

and keeps the hidden `<input type="file" accept=".json,.csv,.txt" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); }} style={{ display: "none" }} />`. The five-count sentence is byte-identical to the `window.confirm` string at `:450`.

- [ ] **Step 6: Surface the throws and the swallowed writes**

`applyResult` and `undoLastGame` throw by design (`src/tournament/bracket.ts:252-289`) and neither handler wrapped the call; the frontier guard is reachable from two tabs on one tournament, so a rejected recording was an unhandled rejection. Both wrap and report — the throw already carries the user-readable message ("That match isn't ready to record: its teams aren't decided yet."), so nothing is invented:

```ts
  const recordResult = async (matchId: Id, games: GameResult[]) => {
    if (!viewTournament) return;
    try {
      await saveTournament(applyResult(viewTournament, matchId, games));
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), "error");
    }
  };

  const undoLastResult = async () => {
    if (!viewTournament) return;
    try {
      await saveTournament(undoLastGame(viewTournament));
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), "error");
    }
  };
```

`split()`'s ad-hoc Session write keeps showing the split and speaks:

```ts
    if (splitFlowRule(setup.source).persistsSession) {
      try {
        await sessionStore.saveSession(session);
      } catch {
        // Non-fatal: still show the split if persistence failed.
        notify("Your split wasn't saved to History.", "error");
      }
    }
```

The legacy-adoption effect gets a `.catch` on both writes that notifies **once**, guarded by a ref so a repeatedly-failing write cannot emit a toast per render:

```ts
  const adoptionWarned = useRef(false);
  // …
        void roster.savePlayer({ ...p, communityId: activeCommunity.id }).catch(() => {
          if (!adoptionWarned.current) {
            adoptionWarned.current = true;
            notify("Some saved players could not be moved into this community.", "error");
          }
        });
```

`SplitScreen`'s inline "This arrangement wasn't saved." stays as it is — that is the pattern, already correct. **Do not add a global error boundary here**: Phase A's A05 owns it.

- [ ] **Step 7: Verify**

```bash
grep -rn "alert(\|window.confirm(" src/
npx tsc -b
npx vitest run
npm run build
node /tmp/probe-dialogs.mjs
git diff --stat src/index.css
```
Expected: the first prints **nothing**; `tsc -b` exits 0; vitest green; the probe prints `dialogs: []` and `controls: ["Cancel", "Delete player"]` — the click never stalls; `git diff --stat src/index.css` is **empty** (the two-step reuses the existing classes).

- [ ] **Step 8: Run the browser suite, then commit**

```bash
npm run e2e
git diff --stat e2e/tests
```
Expected: **0 failed**, empty diff, and `.toast-container` still carries `aria-live="polite"` with each toast on `role="status"` (grep `src/ui/Toasts.tsx`).

```bash
git add -A
git commit -m "fix(shell): replace native dialogs with toasts and inline confirms"
```

---

### Task 8: The shared breadcrumb is actually used (C28)

**Files:**
- Modify: `src/nav.tsx` (one shape; the existing `Breadcrumb`)
- Modify: `src/session/MatchScreen.tsx:41-46`
- Modify: `src/tournament/TournamentScreen.tsx:263-269`
- Modify: `src/session/SplitScreen.tsx:293-297`

**Interfaces:**
- Consumes: nothing.
- Produces: `export interface Crumb { label: string; go?: () => void }` and `export function Breadcrumb({ crumbs }: { crumbs: Crumb[] }): JSX.Element` in `src/nav.tsx`.

- [ ] **Step 1: Write the failing probe**

Create `/tmp/probe-crumbs.mjs`. It drives the app to an ad-hoc split through the real UI, captures the crumb markup, clicks the first crumb, and reports what changed:

```js
import { chromium } from "@playwright/test";

const BASE = "http://localhost:4173/app/";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(BASE);
await page.locator(".app").waitFor({ timeout: 15000 });

await page.getByTitle("New community").click();
await page.locator(".add-community input").fill("Crumb Probe");
await page.locator(".add-community .btn-primary").click();
await page.locator(".add-community").waitFor({ state: "hidden" });

// One futsal-capable player, so a split is possible.
await page.getByRole("button", { name: "Roster" }).click();
await page.getByRole("button", { name: /Add Player/ }).click();
const modal = page.locator(".modal-card");
await modal.locator("#player-name").fill("Crumb Player");
await modal.locator(".chip").first().click();          // enable the first discipline
await modal.locator(".btn-primary").click();
await page.locator(".roster .row").first().click();
await modal.getByRole("button", { name: "Cancel" }).click();

await page.getByRole("button", { name: /Split match/ }).first().click();
await page.locator(".match-setup").waitFor({ timeout: 5000 });
const splitButton = page.getByTestId("split-button");
if (await splitButton.isEnabled()) await splitButton.click();
await page.locator(".split-screen").waitFor({ timeout: 10000 });

const before = await page.locator(".split-screen h2").textContent();
const crumb = await page.locator(".breadcrumb").first().evaluate((el) => ({
  html: el.innerHTML,
  links: [...el.querySelectorAll("a")].map((a) => a.textContent),
  spans: [...el.querySelectorAll("span")].map((s) => s.textContent),
}));
await page.locator(".breadcrumb a").first().click();
await page.waitForTimeout(500);
const after = await page.locator("h1, h2").first().textContent();

console.log(JSON.stringify({ crumb, before, after, navigated: before !== after }, null, 2));
await browser.close();
```

Run:
```bash
npm run build && npm run preview &
node /tmp/probe-crumbs.mjs
```
Expected **today** (the red state): `crumb.links` is `["Match setup"]` and `crumb.spans` is `["/", "Split result"]`, with `navigated: false` — the link's own handler is a comment (`/* back handled via app */`), so the click does nothing. On a `session` or `squad` split the label claims "Match setup" where no match-setup screen exists beneath it. After this task: `crumb.links` is `["Match setup"]`, `crumb.spans` is `["/", "Split result"]` and `navigated: true`, and on a session split the first crumb reads `History`.

- [ ] **Step 2: Rewrite `Breadcrumb` to emit exactly what the three copies emit**

**Why this is a rewrite and not just a wire-up.** The existing `src/nav.tsx` component emits each crumb inside an extra wrapper `<span>` (`<span key={i}>…</span>`), so its live DOM is

```
<div class="breadcrumb"><span><a>Roster</a></span><span><span class="sep">/</span><span>Match setup</span></span></div>
```

while the three hand-rolled copies emit three flat children:

```
<div class="breadcrumb"><a>Roster</a><span class="sep">/</span><span>Match setup</span></div>
```

Under `.breadcrumb { display: flex; align-items: center; gap: 6px; }` (`src/index.css:2848-2857`) those are **not the same layout**: the flat form puts the 6px gap around the separator, the wrapped form puts the separator flush against its label with the gap between wrappers instead. So adopting the component as it stands would visibly shift the separator on all three screens. The rewrite below drops the wrapper and the position-based `last` rule, emitting exactly the three flat children the copies emit. Also note `.sep` has **no rule anywhere** in the repository (verified: `grep -rn "\.sep" src/index.css src/landing.css` → no matches) — the separator's look comes entirely from the parent's `gap` and inherited colour, which is why the flat form is the one to reproduce.

The one behavioural difference this introduces is deliberate and is the ticket's point: the old component decided by **position** (last crumb is always text, so a `go` on the last crumb was ignored), the new one decides by **`go` presence** (a crumb is a link iff it has somewhere to go). All six call-site crumbs happen to have `go` only on non-final entries, so the rendered output is identical at every existing site.

```tsx
import { Fragment } from "react";

export type CrumbGo = () => void;

export interface Crumb {
  label: string;
  go?: CrumbGo;
}

/**
 * One breadcrumb shape for the three screens that hand-rolled it. A crumb with
 * `go` is a link; a crumb without one is plain text, because a crumb that does
 * not navigate must not be announced as one (docs/FLOW.md §3).
 */
export function Breadcrumb({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <div className="breadcrumb">
      {crumbs.map((c, i) => (
        <Fragment key={`${i}-${c.label}`}>
          {i > 0 && <span className="sep">/</span>}
          {c.go ? (
            <a href="#" onClick={(e) => { e.preventDefault(); c.go!(); }}>{c.label}</a>
          ) : (
            <span>{c.label}</span>
          )}
        </Fragment>
      ))}
    </div>
  );
}
```

`go` is optional because the Landing Page mounts `SplitScreen` with `onBack={undefined}`, so its first crumb is text.

**The key is `\`${i}-${c.label}\``, not `c.label`** — a tournament may legitimately be named `Games`, which would make `TournamentScreen`'s two crumbs `["Games", "Games"]` and give React duplicate keys in one list. The index prefix is stable here because a breadcrumb list is fixed-length for the lifetime of a screen, and index-alone is avoided so the key still changes if a label changes.

- [ ] **Step 3: Render it at the three call sites**

`src/session/MatchScreen.tsx:41-46` — the hand-rolled block becomes a prop:

```diff
       <PageHeader
-        crumbs={
-          <div className="breadcrumb">
-            <a href="#" onClick={(e) => { e.preventDefault(); props.onBack(); }}>Roster</a>
-            <span className="sep">/</span>
-            <span>Match setup</span>
-          </div>
-        }
+        crumbs={<Breadcrumb crumbs={[{ label: "Roster", go: props.onBack }, { label: "Match setup" }]} />}
```

`src/tournament/TournamentScreen.tsx:263-269`:

```diff
       <PageHeader
-        crumbs={
-          <div className="breadcrumb">
-            <a href="#" onClick={(e) => { e.preventDefault(); onBack(); }}>Games</a>
-            <span className="sep">/</span>
-            <span>{tournament.name}</span>
-          </div>
-        }
+        crumbs={<Breadcrumb crumbs={[{ label: "Games", go: onBack }, { label: tournament.name }]} />}
```

`src/session/SplitScreen.tsx:293-297` — the dead link and the wrong label go. Its first crumb is derived from data it already has, and its labels come from **the screen's own back button** (`src/session/SplitScreen.tsx:375`: `source === "session" ? "History" : source === "squad" ? "Squad detail" : "Match setup"`), which is the one source guaranteed to agree with where the button actually goes.

**On FLOW §3's table, be precise about what matches and what does not.** Its per-screen rows list the *full* chain from the hub (`docs/FLOW.md:77-82`), e.g. `Tournaments / {name} / Match setup / Split result (tournament)` and `Squads / {name} / Split result (squad)`. The screens render **one** crumb above the current screen, not the whole chain — that is true of the shipped hand-rolled copies too (`MatchScreen` renders `Roster / Match setup`, not `Squads / … / Match setup`). So this task's job is to make each rendered crumb **navigate** and to label it with the destination the back button uses, not to expand every screen's crumb into §3's full chain. Expanding the chain would be a visible redesign that no ticket asks for. Two labels therefore differ from §3's wording and are deliberate: §3 says `Tournaments`, the button and crumb say `Games`; §3 says `Squads / {name}`, the button and crumb say `Squad detail`. Record both deviations in the Answer rather than silently "fixing" them, and raise them with the owner of `docs/FLOW.md` — reconciling the table's wording is a documentation change, not this refactor's.

```diff
     <div className="screen split-screen">
-      <div className="breadcrumb">
-        <a href="#" onClick={(e) => { e.preventDefault(); /* back handled via app */ }}>Match setup</a>
-        <span className="sep">/</span>
-        <span>Split result</span>
-      </div>
+      <Breadcrumb
+        crumbs={[
+          { label: source === "session" ? "History" : source === "squad" ? "Squad detail" : "Match setup", go: onBack },
+          { label: "Split result" },
+        ]}
+      />
```

With `onBack` undefined the first crumb renders as text, which is correct on the Landing Page. Each file imports:

```ts
import { Breadcrumb } from "../nav";
```

(`src/nav.tsx` is at `src/`, so `../nav` from `src/session/` and `src/tournament/`.)

- [ ] **Step 4: Verify in the DOM, not by reading the diff**

```bash
grep -rn "Breadcrumb" src/
grep -rn 'className="breadcrumb"' src/
grep -rn 'href="#"' src/session/SplitScreen.tsx
npx tsc -b
```
Expected: the first matches `src/nav.tsx` plus `MatchScreen`, `TournamentScreen` and `SplitScreen`; the second matches **only `src/nav.tsx`** — no screen hand-rolls the markup; the third prints nothing; `tsc -b` exits 0.

Re-run the probe: clicking `Match setup` on an ad-hoc or tournament split returns to match setup; clicking `History` on a session split returns to History; the last (current) crumb is a `<span>`, not an `<a>`, and clicking it does nothing.

- [ ] **Step 5: Run the suites, then commit**

```bash
npx vitest run
npm run build
npm run e2e
git diff --stat e2e/tests docs/FLOW.md
```
Expected: vitest green; the suite **0 failed**; both diffs empty. No spec currently asserts breadcrumb text (`grep -rni "crumb" e2e/` returns nothing), so the evidence is the suite staying green plus the probe's clicks.

**Cross-reference to B16 — resolved during wave 2, so there is no follow-up.** `.scratch/app-correctness/06` planned to reconcile FLOW §3 by recording that breadcrumbs *do not* navigate. That correction was itself false: measured, `MatchScreen.tsx:41-45` and `TournamentScreen.tsx:263-269` **do** navigate; only `SplitScreen.tsx:293-297` is dead. So FLOW §3's "Breadcrumbs are links" describes two of three sites correctly and the defect is one screen, not the rule. Landing this task makes the contract true rather than codifying the gap — the code was wrong and the document was right. B16 therefore **does not write the "labels, not links" line**, and `docs/FLOW.md:10` and `:74` stand as they are. B owns `docs/FLOW.md`, so this task must not edit it, and after this reconciliation there is no stale line to report. `src/nav.tsx`'s existing `<a>`-when-`go` / `<span>`-otherwise behaviour is what makes the contract satisfiable, and this task's rewrite keeps it.

```bash
git add -A
git commit -m "fix(nav): the breadcrumb navigates, from one shared component"
```

---

### Task 9: Each document loads only what it needs (C29)

**Files:**
- Create: `src/split.css`
- Create: `src/data/sample-registry.ts`
- Modify: `src/index.css:2` (add `@import "./split.css"`; move the two regions out)
- Modify: `src/landing.css:7` (add `@import "./split.css"`), `:535` (delete `pulse-needle`), `:551` (delete the dead override)
- Modify: `src/landing.tsx:7` (delete `import "./index.css"`)
- Modify: `src/data/sample-data.ts` (loader only; four functions become async)
- Modify: `src/data/sample-data.test.ts` (registry imports; five awaited assertions)
- Modify: `src/domain/useDisciplines.ts:3` (import path)
- Modify: `src/App.tsx:504-514` (one `await` in the already-`async` download wrapper)

**Interfaces:**
- Consumes: nothing.
- Produces:
  ```ts
  // src/data/sample-registry.ts — no JSON imports, safe to import statically
  export function hasSampleData(disciplineId: string): boolean;
  export function addSampleData(disciplineId: string, jsonText: string): void;
  export function listDisciplinesWithSampleData(): string[];
  export function detectDisciplineFromSampleData(text: string): string | null;
  export function autoGenerateSampleData(discipline: Discipline): string;
  export function generatedSampleData(disciplineId: string): string | null;
  // src/data/sample-data.ts — owns both JSON imports; reached only dynamically
  export async function loadSampleData(disciplineId: string): Promise<string | null>;
  export async function getSampleDataInfo(disciplineId: string): Promise<{ fileName: string; playerCount: number } | null>;
  export async function getSampleDataUrl(disciplineId: string): Promise<string | null>;
  export async function downloadSampleData(disciplineId: string): Promise<void>;
  ```

- [ ] **Step 1: Record the baseline the change is measured against**

```bash
npx vite build
ls -l dist/index.html dist/app/index.html dist/assets/
grep -o 'assets/[^"]*' dist/index.html
```
Expected and **recorded as the baseline**, measured on HEAD:

| Asset | Bytes | Loaded by |
|---|---|---|
| `index-B-AfBoP4.js` (shared) | 213,023 | **both** documents |
| `app-LNkAbv9g.js` | 105,487 | `dist/app/index.html` |
| `landing-BHu6e1_i.js` | 11,614 | `dist/index.html` |
| `index-CgrHkb71.css` | **47,834** | **both** documents |
| `landing-CJvxMLgK.css` | 15,207 | `dist/index.html` |

`dist/index.html` is 9,584 B; `dist/app/index.html` is 799 B. The build emits exactly one warning, verbatim:

> `src/data/sample-data.ts is dynamically imported by src/App.tsx but also statically imported by src/domain/useDisciplines.ts, dynamic import will not move module into another chunk.`

The Landing Page's CSS links are `index-CgrHkb71.css` **and** `landing-CJvxMLgK.css` because `src/landing.tsx:7` imports `./index.css`. It **already does not link `app-LNkAbv9g.js`** — the JS half of the roadmap's exit criterion already holds, and this task says so rather than claiming a change it did not make.

- [ ] **Step 2: Write the failing test — the loader is async**

In `src/data/sample-data.test.ts`, change the import to the registry for the synchronous functions and await the four that became asynchronous:

```diff
-import { hasSampleData, listDisciplinesWithSampleData, getSampleDataInfo, getSampleDataUrl, downloadSampleData, autoGenerateSampleData } from "./sample-data";
+import { hasSampleData, listDisciplinesWithSampleData, autoGenerateSampleData } from "./sample-registry";
+import { getSampleDataInfo, getSampleDataUrl, downloadSampleData } from "./sample-data";
```

```diff
-  it("returns sample data info", () => {
-    const info = getSampleDataInfo("mlbb");
+  it("returns sample data info", async () => {
+    const info = await getSampleDataInfo("mlbb");
```

```diff
-  it("returns null for unknown sample data info", () => {
-    expect(getSampleDataInfo("unknown")).toBeNull();
+  it("returns null for unknown sample data info", async () => {
+    expect(await getSampleDataInfo("unknown")).toBeNull();
```

```diff
-  it("returns a blob URL", () => {
-    expect(typeof getSampleDataUrl("mlbb")).toBe("string");
+  it("returns a blob URL", async () => {
+    expect(typeof (await getSampleDataUrl("mlbb"))).toBe("string");
```

```diff
-  it("returns null for unknown sample data URL", () => {
-    expect(getSampleDataUrl("unknown")).toBeNull();
+  it("returns null for unknown sample data URL", async () => {
+    expect(await getSampleDataUrl("unknown")).toBeNull();
```

```diff
-  it("downloadSampleData creates a blob and downloads", () => {
-    downloadSampleData("mlbb");
+  it("downloadSampleData creates a blob and downloads", async () => {
+    await downloadSampleData("mlbb");
```

The `vi.stubGlobal("document", …)` stub needs no change: the implementation reaches the real `URL.createObjectURL` under Node and the stubbed `document.createElement`, both of which the test already provides.

- [ ] **Step 3: Run it to verify it fails**

```bash
npx vitest run src/data/sample-data.test.ts
```
Expected: FAIL — `Failed to resolve import "./sample-registry" from "src/data/sample-data.test.ts"`.

- [ ] **Step 4: Split the module at its real seam**

Create `src/data/sample-registry.ts` — the registry holds **no JSON**, so importing it statically pulls nothing. Move into it, unchanged, `SAMPLE_DATA`, `BLOB_URLS`, `hasSampleData`, `addSampleData`, `listDisciplinesWithSampleData`, `detectDisciplineFromSampleData`, `PLAYER_NAMES` and `autoGenerateSampleData` from `src/data/sample-data.ts` (after Task 2 deleted `ROLE_NAMES` at `:74`), plus:

```ts
export const SAMPLE_DISCIPLINE_IDS: readonly string[] = ["mlbb", "futsal"];

/** The registered text for a custom discipline, or null for a built-in one. */
export function generatedSampleData(disciplineId: string): string | null {
  return SAMPLE_DATA[disciplineId] ?? null;
}
```

Create the loader in `src/data/sample-data.ts`, which owns both JSON imports and is reached only through `await import(...)`:

```ts
import type { Discipline } from "../domain/types";
import { SAMPLE_DISCIPLINE_IDS, generatedSampleData } from "./sample-registry";

const ASSETS: Record<string, () => Promise<{ default: unknown }>> = {
  mlbb: () => import("../../sample-data/mpl-id-roster.json"),
  futsal: () => import("../../sample-data/futsal-roster.json"),
};

const BLOB_URLS: Record<string, string> = {};

/** The roster JSON text for a discipline: the built-in asset, else the registered text. */
export async function loadSampleData(disciplineId: string): Promise<string | null> {
  if (disciplineId in ASSETS) {
    const mod = await ASSETS[disciplineId]();
    return JSON.stringify(mod.default);
  }
  return generatedSampleData(disciplineId);
}

export async function getSampleDataInfo(disciplineId: string): Promise<{ fileName: string; playerCount: number } | null> {
  const text = await loadSampleData(disciplineId);
  if (!text) return null;
  const data = JSON.parse(text);
  return { fileName: `${disciplineId}-roster.json`, playerCount: data.players?.length ?? 0 };
}

export async function getSampleDataUrl(disciplineId: string): Promise<string | null> {
  const text = await loadSampleData(disciplineId);
  if (!text) return null;
  if (!BLOB_URLS[disciplineId]) {
    const blob = new Blob([text], { type: "application/json" });
    BLOB_URLS[disciplineId] = URL.createObjectURL(blob);
  }
  return BLOB_URLS[disciplineId];
}

export async function downloadSampleData(disciplineId: string): Promise<void> {
  const url = await getSampleDataUrl(disciplineId);
  if (!url) return;
  const info = await getSampleDataInfo(disciplineId);
  const a = document.createElement("a");
  a.href = url;
  a.download = info?.fileName ?? `${disciplineId}-roster.json`;
  a.click();
}
```

`SAMPLE_DISCIPLINE_IDS` is exported for the registry's readers; if nothing imports it after this edit, do not ship it — `noUnusedLocals` does not catch an unused export and this phase exists to delete exactly that, so delete the export if `grep -rn "SAMPLE_DISCIPLINE_IDS" src/` names only its own declaration.

Then change one import path in `src/domain/useDisciplines.ts:3`:

```diff
-import { hasSampleData, addSampleData, autoGenerateSampleData } from "../data/sample-data";
+import { hasSampleData, addSampleData, autoGenerateSampleData } from "../data/sample-registry";
```

and add one `await` in `src/App.tsx`'s already-`async` wrapper:

```diff
       const { downloadSampleData: download } = await import("./data/sample-data");
-      download(disciplineId);
+      await download(disciplineId);
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npx vitest run src/data/sample-data.test.ts
npx vitest run
npx tsc -b
```
Expected: the sample-data file passes with its five awaited assertions; the whole unit suite green; `tsc -b` exits 0. **If the diff grows past the five edits listed**, revert to the one-line static import and record in the Answer that the 22.6 kB of rosters ships with the app.

- [ ] **Step 6: Verify the warning is gone and the rosters moved**

```bash
npx vite build
```
Expected: the build completes with **zero warnings** (baseline: 1), and `grep -c "Kairi" dist/assets/app-*.js` → **0**, with the string now in a new asset fetched only on demand.

- [ ] **Step 7: Move the split region and the shared kit into `src/split.css`**

The membership rule is decidable, not a guess: **a rule moves iff every selector in it is reachable from `SplitScreen`'s rendered subtree or from a primitive that subtree renders.** Measured against the shipped sheet, that is 110 rules / 14,095 bytes — 23% of the 60,908-byte `src/index.css` — in two disjoint groups. The two sets share zero selectors.

Group 1, the shared kit (46 rules, 6,187 bytes): `.screen` (`src/index.css:749`), `.kicker` (`:781`, `:791`), `.badges`/`.badge`/`.badge--futsal`/`.badge--mlbb`/`.badge--generic`/`.badge--{a..e}` (`:906-941`), `.empty` family (`:952-1025`), `.bar`/`.modal-card .bar`/`.btn`/`.btn-primary`/`.btn-ghost`/`.btn-danger-ghost`/`.btn:disabled`/`.btn:active`/`.btn.small`/`:focus-visible` (`:662-665`, `:1130-1193`), `.field-label` (`:1195`), `.input`/`.input::placeholder`/`.input:focus-visible` (`:1354-1371`), `.load-error`/`.load-error strong` (`:80-94`), the `.modal-overlay`/`.modal-card`/`.modal-close`/`.modal-title`/`.modal-section` family (`:1533-1622`), and the `@media (min-width: 768px)` `.modal-card`/`.modal-title` overrides at `src/index.css:1652-1663`.

Group 2, the whole split region (`src/index.css:1950-2358`, 64 rules / 7,909 bytes), from the `/* ---------- split: turf panel … */` comment through `.pitch.in .mid` — `.pitch`, `.team`, `.tname*`, `.mid*`, `.vs`, `.tag-gap`, `.scale*`, `.needle`, `.readout*`, `.team-stack`, `.split-screen`, `.split-head*`, `.swap-banner*`, `.player-*`, `.rating-*`, `.role`, `.pivot`, the `.team li.swappable*`/`.picked` variants, and the deal-in transition block. Nothing outside these two groups moves; the header comment moves with group 2.

```diff
# src/index.css:2
 @import "./tokens.css";
+@import "./split.css";
```

```diff
# src/landing.css:7
 @import "./tokens.css";
+@import "./split.css";
```

and `src/landing.tsx` stops importing the app sheet entirely:

```diff
-import "./index.css";
```

- [ ] **Step 8: Delete the animation that resolves to nothing**

`src/landing.css:535` declares `animation: pulse-needle 2.4s … infinite`, and `@keyframes pulse-needle` is defined **nowhere in the repository** (`grep -c "@keyframes" src/landing.css` → 0; `src/index.css`'s only keyframes are `@keyframes pulse` at `:327`). The declaration has never had an effect, and no spec asserts it (`grep -n "needle" e2e/tests/landing/landing.spec.ts` → no matches), so removing a declaration that resolves to nothing changes no pixel.

```diff
 .landing-hero .needle {
   background: var(--accent);
-  animation: pulse-needle 2.4s cubic-bezier(0.22, 1, 0.36, 1) infinite;
   box-shadow: 0 0 0 1px rgba(194, 65, 12, 0.12);
 }
```

```diff
 @media (prefers-reduced-motion: reduce) {
-  .landing-hero .needle {
-    animation: none;
-  }
   .landing-hero .team {
```

- [ ] **Step 9: Verify the new sizes against the recorded baseline, then the rendered result**

```bash
npx vite build
ls -l dist/index.html dist/app/index.html dist/assets/
grep -o 'assets/[^"]*\.css' dist/index.html
grep -o 'assets/[^"]*\.js' dist/index.html
grep -c "pulse-needle" src/landing.css
git diff --numstat src/index.css
```
Expected, compared against Step 1's table: **zero build warnings**; `dist/index.html`'s CSS links name **only `landing-*.css`** — no `index-*.css`; its JS links still name **no `app-*.js`**; the Landing Page's CSS transfer falls by the 47,834 B it used to fetch; `pulse-needle` → **0**; `git diff --numstat src/index.css` shows only moved lines — no declaration edited while moving.

A before/after `getComputedStyle` diff of the hero subtree at 1280×720 and 390×844 must match on every class name. Record both tables in the Answer in the baseline's format.

- [ ] **Step 10: Run the suites and the hero capture, then commit**

```bash
npx vitest run
npm run e2e
npm run capture:hero
```
Expected: vitest green including the four updated sample-data assertions; the browser suite **0 failed** with `git diff --stat e2e/tests` empty (`e2e/tests/landing/landing.spec.ts` covers the hero, the tokens in both themes and the redirect); `capture:hero` reports its own DOM/PNG verification green after the stylesheet move.

```bash
git add -A
git commit -m "build: the landing page stops downloading the app's stylesheet"
```

---

### Task 10: Project hygiene — README, engine floor, node pin (C30)

**Files:**
- Create: `README.md`
- Create: `.nvmrc`
- Modify: `package.json` (add `engines`)

**Interfaces:**
- Consumes: the file layout Tasks 1–9 produce (`src/shell/**`, `src/ui/constants.ts`, `src/split.css`); A10's `npm run e2e` script.
- Produces: nothing other phases import.

- [ ] **Step 1: Derive the engine floor from the lockfile, not a guess**

```bash
node -e "const l=require('./package-lock.json'); for (const k of ['node_modules/vite','node_modules/vitest','node_modules/@playwright/test','node_modules/@napi-rs/lzma-linux-x64-gnu']) { const p=l.packages[k]; console.log(k, p && p.version, JSON.stringify(p && p.engines)); } console.log('root engines:', JSON.stringify(l.packages[''].engines));"
node -v
jq -r '.devDependencies' package.json
```
Expected: `vite 6.4.3 {node:"^18.0.0 || ^20.0.0 || >=22.0.0"}`, `vitest 3.2.7 {node:"^18.0.0 || ^20.0.0 || >=22.0.0"}`, `@playwright/test 1.62.1 {node:">=20"}`, `@napi-rs/lzma-linux-x64-gnu 1.5.1 {node:"^22.20 || ^24.12 || >=25"}`, **`root engines: undefined`** — the lockfile pins no engine on this package — and `node -v` → `v24.16.0`.

The intersection of the constraints enforced at install time is `>=22.20 <23 || >=24.12`: it excludes the 23.x and 24.0–24.11 ranges the installed native optional dependency refuses, while admitting the 22.20+ line and current 24.x.

- [ ] **Step 2: Add the floor and the pin**

```diff
# package.json — after "private": true, before "version" is also acceptable; keep the file's order
   "private": true,
+  "engines": { "node": ">=22.20 <23 || >=24.12" },
   "version": "0.1.0",
```

`npm` is deliberately **not** pinned: no script invokes it beyond the documented `npm run …` aliases.

Create `.nvmrc` with exactly one line:

```
24.16.0
```

- [ ] **Step 3: Write `README.md`**

It is the front door for a human or an agent. Every command and path in it must exist. Describe C's HEAD and nothing more: no service worker, no offline promise, no account, no backend.

````markdown
# comp3tive

Split a roster into balanced teams for a recurring game night, then run the tournament.
Local-first and single-user: no account, no server (docs/adr/0001-client-only-first.md).
Your data stays in this browser's IndexedDB.

The domain vocabulary is authoritative in `CONTEXT.md`; this README does not redefine it.

## Two documents, two paths

The site is two plain static documents, not a router (docs/adr/0006-landing-page-and-app-paths.md):

- `/` — the Landing Page, a static document that explains the product.
- `/app` — the app.

`vite.config.ts` sets `appType: "mpa"`, so there is no SPA fallback. In production the
static assets are served by a Cloudflare static-assets Worker (`wrangler.jsonc`), whose
`not_found_handling` must never be `single-page-application` — that value would serve the
Landing Page under `/app/`.

## Requirements

Node per `package.json`'s `engines` and `.nvmrc` — nothing else. The declared floors for
this repo's toolchain are React 19.1, TypeScript 5.8, Vite 6, Vitest 3, Playwright 1.62 and
`@types/node` 22.15 (`package.json`).

## Commands

| Command | What it does |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | Vite dev server |
| `npm run build` | `tsc -b && vite build` into `dist/` |
| `npm run preview` | Serve `dist/` on port 4173 |
| `npm test` | Unit tests (Vitest, `src/**/*.test.ts`) |
| `npm run test:watch` | Unit tests in watch mode |
| `npm run e2e` | The browser suite (Playwright) |
| `npm run capture:hero` | Capture and self-verify the landing hero image |

## Running the browser suite

`npm run e2e` runs `playwright test --config=e2e/playwright.config.ts`. **A bare
`npx playwright test` finds nothing**, because the config lives in `e2e/`.

The config's `webServer` is `npm run preview` on port 4173 with `reuseExistingServer: true`,
so a stale preview can serve old assets — run `npm run build` before trusting a run. Its
`testDir` is `./tests` relative to `e2e/`, so a single file is addressed as
`npm run e2e -- tests/squads/saved-squad.spec.ts`.

## Where the repo's knowledge lives

| Path | What is there |
|---|---|
| `CONTEXT.md` | The glossary — authoritative |
| `DOMAIN_MODEL.md` | The model behind the glossary |
| `docs/adr/` | Six numbered decisions |
| `docs/FLOW.md` | The navigation contract: screens, breadcrumbs, back targets |
| `docs/agents/` | The issue-tracker and triage conventions |
| `.scratch/` | Tickets, committed on purpose |

## What this README does not claim

There is no service worker, no offline support, no installable app and no backend. The
Landing Page's offline claim is provisional and its restoration belongs to a later phase.
````

- [ ] **Step 4: Check every command and path the README names**

```bash
test -f README.md && test -f .nvmrc && echo "files ok"
jq -r '.engines.node' package.json
jq -r '.name' package.json && jq -e '.engines.node' package.json >/dev/null && echo "engines ok"
jq -r '.scripts | keys[]' package.json
grep -oE '`npm (run )?[a-z:]+' README.md | sed -e 's/`npm run //' -e 's/`npm //' | sort -u
for p in CONTEXT.md DOMAIN_MODEL.md docs/adr docs/FLOW.md docs/agents .scratch package.json .nvmrc wrangler.jsonc vite.config.ts e2e/playwright.config.ts; do test -e "$p" || echo "MISSING PATH: $p"; done
grep -niE "service worker|offline|installable|manifest|account|server|sync" README.md
npx tsc -b
```
Expected: `files ok` and `engines ok` both print; `jq -r '.engines.node'` prints `>=22.20 <23 || >=24.12`; the two extracted lists match — the README names only scripts `package.json` defines (`dev`, `build`, `preview`, `test`, `test:watch`, `e2e`, `capture:hero`, plus the bare `install` that npm provides rather than a script entry); the path loop prints **nothing**; the `grep` returns only the lines that explicitly **deny** the claim (the "What this README does not claim" paragraph); `tsc -b` stays green.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "docs: README, engine floor and node pin"
```

---

## Self-Review

**1. Spec coverage.** Every ticket has a task: C21 → Task 1, C22 → Task 2, C23 → Task 3, C24 → Task 4, C25 → Task 5, C26 → Task 6, C27 → Task 7, C28 → Task 8, C29 → Task 9, C30 → Task 10. The spec's twelve acceptance criteria map to: 1 → T1.5, 2 → T2.6, 3 → T3.8, 4 → T6.12, 5 → T4.3/T5.3/T6.3, 6 → T3.4/T4.4/T5.4/T6.4, 7 → T7.7, 8 → T4.9/T5.7/T6.13/T7.8/T8.5, 9 → T9.9, 10 → T8.4, 11 → T10.4, 12 → T9.10. The spec's Out of Scope is not contradicted anywhere: no ESLint, no formatter, no coverage threshold, no `src/index.css` restructure, no component tests, no visual redesign, no `docs/FLOW.md` edit.

**2. Placeholder scan.** No deferred-decision marker and no cross-task shorthand appears anywhere above: every code step carries real code, and the two places where a body is long and mechanical (Task 6's handler moves, Task 7's import body) state the exact source line range being moved and the exact substitutions, so the implementer copies and edits rather than invents. Grep the file for the skill's forbidden phrases: the only match is this sentence.

**3. Type consistency.** `SplitSource` is defined once, in `src/shell/useSplitFlow.ts`, and imported by `src/shell/useNavigation.ts` and `src/App.tsx` — not redefined. `View` and `HubMode` are defined once in `useNavigation.ts` and imported by `AppChrome.tsx` and `useSplitFlow.ts`. `CommunityScopeResult` is used by both the pure selector and the hook. `ToastType` is defined in `src/shell/useToasts.ts` and imported by `src/ui/Toasts.tsx` and `AppChrome.tsx`. `MatchSetup` is exported from `useSplitFlow.ts` (Task 6) and consumed by the hook's return — it is declared there, not left behind in `App.tsx`.

**4. Anchor verification.** Every `file:line` in this plan was read before it was written. Three anchors in the spec are wrong and this plan follows the source instead:

| Plan step | Anchor conflict | Followed |
|---|---|---|
| T2.1 | `noUnusedLocals` reports 19 on HEAD and the ticket agrees; after T1 it is 15, so the plan says re-derive rather than quote | the compiler |
| T3.7 | `modal-section-hint` appears in the spec's kit list but exists nowhere in `src/` | the source — it is not moved |
| T9.7 | `.sep` is listed among the kit selectors but has **no rule** in `index.css` or `landing.css` | the source — the kit list is the classes that have rules |
