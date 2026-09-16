# Phase A — Truth and Trust — 2026-09-17

**Status:** accepted (design; tickets 01–12 written to `.scratch/debt/issues/`)

## Problem Statement

Phase A exists because nothing else is safe until the proof that the product works turns
green. Measured on HEAD `d87ac7b` (audit findings, 2026-09-17):

| Command | Result |
|---|---|
| `npx tsc -b` | exit 0, clean |
| `npx vite build` | succeeds, 1 warning |
| `npx vitest run` | **114 passed / 12 files**, 783 ms |
| `npx playwright test --config=e2e/playwright.config.ts` | **16 failed, 25 passed, 1 skipped**, 7.1 min |

Fourteen of those sixteen failures share one root cause. `src/index.css:1675-1679`, inside
`@media (min-width: 1024px)`:

```css
.bottom-nav { display: none; }
```

`e2e/playwright.config.ts:14` runs every spec at `viewport: { width: 1280, height: 720 }`,
and 14 spec files navigate through `page.locator(".bottom-nav .nav-link")` (10 of them by a
positional `.nth(n)`). At 1280 px
that locator **resolves but is not visible**, so `.click()` retries until the 30 s test
timeout:

> `locator resolved to <button type="button" class="nav-link ">…</button>` →
> `element is not visible`

The committing history shows the omission: `681051d feat(shell): desktop rail layout,
unified breakpoints, sticky nav` touched **no spec file**.

Once the click is worked around, the specs fail a second time on **stale positional
indices**. `NAV_ITEMS` (`src/App.tsx:62-68`) is now
`[Home, Roster, Games, History, Squads]` (Home first — `1702342`), while the specs still
use `nth(1)` for Games, `nth(3)` for History and `nth(4)` for Squads.

The remaining two failures are each a single assertion that encodes markup that no longer
exists:

- `e2e/tests/dashboard/dashboard.spec.ts:143` — `toHaveAttribute("aria-label", "Roster")`.
  The nav buttons have **no `aria-label`** (`src/App.tsx:1264-1276`); the assertion's own
  comment says it checks aria-labels "instead of rendered text", but nothing ever added
  them. The app is right, the assertion is wrong.
- `e2e/tests/panel/no-overlap.spec.ts:35` — `.app` `padding-bottom >= 64px` to clear a
  **fixed** bottom bar. `grep -n "padding-bottom" src/index.css` finds no `.app` rule at
  all; the bar became `position: sticky` (`src/index.css:687`). Received `0`, expected `>= 64`.

This is the phase's real subject: **the suite is pinned to a layout that no longer exists,
so it cannot gate anything.** Everything else in the phase is work that was being hidden
behind the red suite:

- **Re-roll is a no-op.** Reproduced live: 10 players, 2 teams, two clicks on Re-roll,
  `identical` output both times, badge advanced to `Roll #3`. `SplitScreen.reroll`
  (`src/session/SplitScreen.tsx:255-264`) passes no `variety`, and `freshSplit`
  (`src/session/edit.ts:110-118`) falls through to the deterministic `fairSplit`.
  `varietySplit` (`src/solver/solver.ts:359`) has zero call sites outside `edit.ts`.
- **Deletes do not update the screen.** Reproduced live: deleted Player 1, got 10 rows
  before and 10 rows after, while IndexedDB showed `p1` gone. Three handlers call the
  **store** while the hook that owns the list sits unused one line away
  (`src/App.tsx:482-485`, `:762-765`, `:1209`).
- **A bad import is quiet, not loud.** `parseBackup` (`src/data/transfer.ts:83-122`)
  checks shape only; the JSON/CSV branches of `handlePlayerImport`
  (`src/App.tsx:522-567`, `:569-608`) copy `capabilities` verbatim; the CSV parser is
  positional, so `"Smith, John", futsal, 4` imports a player called `Smith`, and an
  unmatched discipline silently produces a player with `capabilities: []`.
  `src/domain/strength.ts:26-31` throws by design on a missing rating, and
  `grep -rn "ErrorBoundary" src/` finds nothing, so a throw is a blank page.
- **Import re-homes records.** `src/App.tsx:456-461` overrides `communityId` for players
  and squads with `importCommunityId`, splitting a v4 restore down the middle while
  sessions and tournaments keep their own community.
- **Swiss repeats pairings.** `pairRound` (`src/tournament/bracket.ts:162-185`) takes the
  first legal opponent via `findIndex` and can strand a rematch: fuzzed over every legal
  outcome pattern, **6 teams: 2,048 of 4,096 patterns** produce a round-3 rematch, **8
  teams: 1,024 of 4,096**. (Those counts come from the original ticket's own fuzzing
  harness; the ticket below specifies its own enumeration rather than re-deriving them.)
  `standings` (`:302-313`) then breaks a shared record on
  `team.strength`, the *pre-tournament seed*.
- **Nothing verifies anything.** No `.github/`, no `lint`/`type-check`/`e2e` script in
  `package.json`, and `playwright-report/index.html` (517,543 bytes) plus
  `test-results/.last-run.json` are tracked in git; `.gitignore` holds four lines.
- **Five specs cannot fail.** `inspect.spec.ts` (41 lines, 2 assertions, both
  `.app` visible), `inspect2.spec.ts` (39/2), `inspect3.spec.ts` (67/3, and it fabricates
  state by hand), `review.spec.ts` (13 lines, `test.skip`) and `journey.spec.ts` (41/4,
  screenshots to `/tmp`, asserts a modal opened). Only **1 of 20** spec files seeds its
  world — `dashboard.spec.ts`; the other 19 click their fixtures into existence.

## Scope

**In scope — 12 tickets, one phase, one implementation plan.**

1. Re-anchor the whole browser suite to the shipped layout through a shared, name-based
   navigation helper, and put the suite's world under a single seeded helper (01, 11).
2. Fix the two remaining assertions that encode dead markup (02).
3. Make three broken user operations work: re-roll (03), deletes (04), imports (05, 06, 08).
4. Make Swiss pairing legal and crown by play (07).
5. Delete the specs that assert nothing, untrack the build reports (09).
6. Make CI run typecheck, unit tests, build and the browser suite (10).
7. Close the ticket sets that shipped months ago (12).

**Out of scope, explicitly:**

- **The solver.** D1 is honest-now. `src/solver/**` is untouched by Phase A. Re-roll uses
  the *existing* `varietySplit`; it does not extend the proof reach. 4-team/20-player
  provability stays the Phase B stretch bet (baseline to beat: `optimal: false`,
  4,000,000 nodes, ~3.1 s).
- **The gap copy.** `SplitScreen.tsx:135` and `:339` belong to B13, which keys the
  qualifier on `result.solver.optimal`. A03 changes `reroll` only and asserts no
  optimality anywhere.
- **`alert()`/`confirm()` removal in general.** C27 owns that. A05/A08/A04 route their own
  new messages through the existing unused `notify` toast (`src/App.tsx:163-171`,
  `:1257`) because a red suite is what hid these defects; the remaining call sites stay.
- **Decomposing `src/App.tsx`.** C does that, after A lands, preserving A's handler
  behaviour exactly.
- **`src/session/edit.ts` behaviour, the discipline catalog, the CSV template UI, the
  PWA, round robin, docs/`FLOW.md` reconciliation.** B, C and D own those.
- **Raising `workers` above 1.** A11 records what shared state prevents it if it still does.

**In scope but owned elsewhere, untouched here:** `src/navigation` (Phase C).

## Design

Phase A's single durable artefact is `e2e/support/seed.ts`. Every ticket below either
creates it, uses it, or is proven by a test that uses it.

### A01 — Re-anchor the e2e suite to the shipped layout (rail)

**The helper.** `e2e/support/seed.ts` exports exactly the interfaces frozen in
`contracts.md`:

```ts
export interface SeedWorld {
  communities: { id: string; name: string; createdAt: number }[];
  players: Array<Record<string, unknown>>;
  sessions: Array<Record<string, unknown>>;
  tournaments: Array<Record<string, unknown>>;
  squads: Array<Record<string, unknown>>;
  activeCommunityId: string;
}
export function seedScript(world: SeedWorld): string;
export async function gotoSeeded(page: Page, world: SeedWorld): Promise<void>;
export async function gotoHubSeeded(
  page: Page, world: SeedWorld, hub: "Home" | "Roster" | "Games" | "History" | "Squads",
): Promise<void>;
export function hubButton(
  page: Page, name: "Home" | "Roster" | "Games" | "History" | "Squads",
): Locator;
```

`seedScript` / `gotoSeeded` are **recovered verbatim from
`e2e/tests/dashboard/dashboard.spec.ts:44-107`**, where they already work: the init script
opens `"comp3tive"` at version 6, creates the six object stores on upgrade, `put`s each row
in `[communities, players, sessions, tournaments, saved-squads]`, closes the connection,
and pins `localStorage["tb-community"] = world.activeCommunityId`
(`src/domain/useCommunities.ts:6` is the key). The discipline catalog is deliberately left
empty — `useDisciplines` (`src/domain/useDisciplines.ts:16-20`) restores `SEED_DISCIPLINES`
when the catalog is empty, which is why the existing spec works. A01 also recovers the
`mlbbCap` / `teamOf` / `splitOf` / `statCard` / `statValue` fixtures from the same file,
moving them into the helper module so A11 can extend them instead of minting a second
convention.

`hubButton` is the whole of the fix:

```ts
export function hubButton(page: Page, name: HubName): Locator {
  return page.getByRole("button", { name, exact: true });
}
```

It matches **either** `.rail-link` (desktop) **or** `.bottom-nav .nav-link` (mobile)
because both render the same `NAV_ITEMS` (`src/App.tsx:62-68`, `:790`, `:1264-1276`) and
both hide their icon span behind `aria-hidden="true"`, so the accessible name is exactly
the label — `"Home"`, not `"⌂Home"`. Measured at both widths:

```
PROBE 390x844  exact-name count: Home 1, Roster 1, Games 1, History 1, Squads 1
PROBE 1280x720 exact-name count: Home 1, Roster 1, Games 1, History 1, Squads 1
```

Exactly one control per name at each width, because the inactive layout is `display: none`
at that width and therefore absent from the accessibility tree. The helper needs no
media-query awareness and no per-spec viewport logic.

**ViewportStrategy — decided, stated once, for the whole phase.**

- **Suite default: unchanged at 1280×720** (`e2e/playwright.config.ts:14`). The rail is the
  layout that regressed and the layout that must be guarded; a suite that silently moved to
  mobile width would have left the regression uncovered a second time.
- **Two specs pin 390×844** with a file-level `test.use({ viewport: { width: 390, height: 844 } })`:
  `e2e/tests/panel/no-overlap.spec.ts` and `e2e/tests/settings-panel/viewport.spec.ts`.
  Their subject *is* the bottom bar's geometry, and the bar only exists below 1024 px.
- **`hubButton`'s accessible-name match is the only reason one helper is correct at both
  widths.** No spec pins a viewport in order to navigate; a spec that pins one does so only
  because it is asserting on that layout. `e2e/tests/shell/nav-layout.spec.ts` asserts this
  invariant directly, at both widths, in one test.

**The mechanical edit.** Fourteen spec files reference `.bottom-nav`; four of them
(`inspect`, `inspect2`, `inspect3`, `journey`) are deleted by A09, leaving **10 spec files**
to re-anchor:

| Spec | Sites | Edit |
|---|---|---|
| `tournament/create.spec.ts:14` | 1 | `nth(1)` → `hubButton(page, "Games")` |
| `tournament/draft.spec.ts:14` | 1 | `nth(1)` → `"Games"` |
| `tournament/split-tourney.spec.ts:23` | 1 | `nth(1)` → `"Games"` |
| `discipline/discipline.spec.ts:8` | 1 | `nth(1)` → `"Games"` |
| `squads/saved-squad.spec.ts:67,83` | 2 | `nth(4)` → `"Squads"`, `nth(1)` → `"Games"` |
| `history/history.spec.ts:14` | 1 | `nth(3)` → `"History"` |
| `split-flow/split.spec.ts:20` | 1 | `.bottom-nav` visible → `expect(hubButton(page, "Games")).toBeVisible()` |
| `panel/no-overlap.spec.ts:42` | 1 | `.bottom-nav` at 390 px (see A02) |
| `settings-panel/viewport.spec.ts:15` | 1 | `.bottom-nav` at 390 px (see A02) |
| `dashboard/dashboard.spec.ts` | 15 | delete the local `SeedWorld`/`seedScript`/`gotoSeeded`/`hub` block (`:1-110`) and import the shared one; all 14 `hub(page, …)` calls → `hubButton(page, …)`; the `hubs` table at `:155-161` gains `["Squads", "Saved squads"]` — the nav label is `Squads`, the h1 is `Saved squads`, and the comment claiming otherwise goes |

Two further mechanical corrections, both the same defect class (a locator anchored to
markup that changed): **`.tournament-header h1` no longer exists anywhere in the app** —
`TournamentScreen` renders `PageHeader` (`src/tournament/TournamentScreen.tsx:261-274`),
which emits `.page-header h1`; the only `.tournament-header` rules left are orphaned CSS
(`src/index.css:2560`, `:2567`). Verified by scanning every `locator("…")` class in
`e2e/**` against `src/**/*.tsx` + both HTML documents: the only two classes with no
counterpart in markup are `tournament-header` and `tabbar`. Replace
`page.locator(".tournament-header h1")` with `page.locator(".screen h1")` at
`dashboard.spec.ts:505`, `saved-squad.spec.ts:97`, `split-tourney.spec.ts:31`.

**Why this cannot rot again.** Four independent guards:

1. No spec addresses a hub by index or by a layout-specific selector ever again; the only
   navigation locator in the suite is `hubButton`.
2. `hubButton`'s `name` parameter is a five-literal union, and A01 adds `e2e/tsconfig.json`
   plus a reference from root `tsconfig.json`, so `npx tsc -b` now **typechecks every spec**.
   A renamed or misspelled hub is a compile error, not a 30 s timeout. Verified during
   design with a throwaway three-project configuration mirroring this repo: a referenced
   project with `noEmit: true` and no `composite` builds cleanly under `tsc -b`, and an
   injected type error in a referenced project's spec file fails the build with exit code 2.
   `e2e/tsconfig.json` needs `types: ["node"]`, `skipLibCheck: true` and its own
   `tsBuildInfoFile` so it does not collide with `tsconfig.app.json`'s, which points at
   `./node_modules/.tmp/`; Phase C turns `noUnusedLocals` on for `src` only, where dead code
   actually accumulates. The specs already typecheck clean today: compiling `e2e/**/*.ts`
   under `strict` in an isolated project reports zero diagnostics.
3. `e2e/tests/shell/nav-layout.spec.ts` asserts the invariant itself: at 1280×720 and at
   390×844, each of the five names resolves to exactly **one** visible control, and clicking
   Games from Home lands on Games. If a future breakpoint change leaves both navs in the
   accessibility tree, that spec fails loudly with a strict-mode violation in one place
   instead of timing out in fourteen.
4. `.screen h1` is emitted by every hub through `PageHeader`/`Screen`, so a heading
   assertion no longer depends on a hand-rolled class.

### A02 — Resolve the remaining failing assertions

**`dashboard.spec.ts:132-149`.** Three stale things in nine lines: the `aria-label`
assertions (`:143-147`), the old nav order, and the title's claim of a *centered* Home tab.
Decided:

- **Do not add `aria-label` to the nav buttons.** They already carry correct accessible
  names through their visible text (`src/App.tsx:1264-1276`). Adding a redundant attribute
  to satisfy a wrong test is the exact failure mode this phase exists to remove.
- Replace the five position-indexed attribute assertions with accessible-name assertions
  driven by `hubButton`: each of the five names resolves and is visible; `Home` carries
  `aria-current="page"` on a fresh load.
- Correct the title to "fresh load lands on the Dashboard with the five hub tabs" and drop
  the centering claim: `1702342` moved Home to the **front** of `NAV_ITEMS` in both navs.
- `:161` `hub(page, "Saved squads")` becomes `hubButton(page, "Squads")` — the nav label is
  `Squads`; `Saved squads` is the screen's `h1`.

**`panel/no-overlap.spec.ts:35`.** Decided: **delete the `.app` padding assertion, replace
it with the assertion that still matters.** The padding exists to clear a fixed bar; the
bar is `position: sticky` (`src/index.css:687`) and there is no `.app` padding rule at all,
so the assertion is testing a mechanism that was removed. The replacement is behavioural:

```ts
const lastRow = page.locator(".roster .row").last();
await lastRow.scrollIntoViewIfNeeded();
const rowBox = await lastRow.boundingBox();
const navBox = await page.locator(".bottom-nav").boundingBox();
expect(rowBox!.y + rowBox!.height).toBeLessThanOrEqual(navBox!.y + 1);
```

plus `expect(navPos).toBe("sticky")` for the bar and the existing sticky-topbar assertion.
This is a real mechanism: focusable rows carry `scroll-margin-bottom: 96px`
(`src/index.css:753-757`), which is what keeps the last row clear of the sticky bar. The
spec pins 390×844 (A01's strategy) because the bar is its subject, and its title/comment
change from "fixed nav" to "sticky nav".

### A03 — Re-roll produces a different fair split

`reroll` (`src/session/SplitScreen.tsx:255-264`) becomes:

```ts
const reroll = () => {
  // The pool is the session's own pool, not the teams on screen: a player who
  // sat out (an MLBB leftover, a futsal sub past capacity) is eligible again.
  const pool = session.poolPlayerIds.filter((id) => roster.some((p) => p.id === id));
  const settings = { teamCount: session.settings.teamCount };
  const before = signature(result);
  let next = result;
  for (let n = rerollCount; n < rerollCount + 8; n++) {
    const candidate = freshSplit(pool, roster, discipline, settings, { variety: n });
    if (signature(candidate) !== before) { next = candidate; break; }
    if (n === rerollCount) next = candidate; // no other arrangement exists
  }
  void commit(next);
  if (signature(next) !== before) setRerollCount((n) => n + 1);
};
```

with a module-local `signature(result)` (sorted team signatures joined by `|`, the same
shape `src/solver/solver.test.ts:67-71` already uses). Three properties follow:

- **Fair.** `freshSplit` routes `{ variety }` to `varietySplit`
  (`src/session/edit.ts:113-116`), which only ever returns a candidate within
  `VARIETY_TOLERANCE = 0.1` of the best gap it found (`src/solver/solver.ts:24`, `:414`).
  A re-roll never trades fairness for novelty.
- **Different.** The bounded counter walk skips a variety index that reproduces the current
  teams, so a click that can change the teams changes them. On the equal-strength 10-player
  futsal pool of `edit.test.ts` the candidate list holds up to six distinct partitions
  (`solver.ts:400-412`), so consecutive counters differ.
- **Honest.** `rerollCount` increments **only** when the assignment actually changed, so
  `Roll #N` (`SplitScreen.tsx:305`) never reports a roll that did nothing. When the pool has
  exactly one fair arrangement the badge stays and the screen does not claim a roll.

**Provenance (D1).** A03 writes no `solver` field and asserts no optimality.
`varietySplit` returns `optimal: false` (`src/solver/solver.ts:414-421`), except on its
`fairSplit` fallback (`:396`), which can legitimately return `optimal: true`. The honest
rule is therefore **"proven iff `result.solver.optimal`"** — not "a re-roll is never
proven". Phase B13 owns that copy and keys it on the field; A03's job is to keep it true by
never fabricating the field. The two tickets agree on this; it is recorded in both.

**Tests.** `src/session/edit.test.ts` (unclaimed by any phase, and the seam this change
calls) gains a case: for the `tenPlayers()` futsal pool, `freshSplit(pool, roster, FUTSAL,
{teamCount: 2}, {variety: 0})` and `{variety: 1}` produce different signatures, both place
all 10 players, and both are within `VARIETY_TOLERANCE` of `fairSplit`'s gap.
`e2e/tests/split/reroll.spec.ts` (new, seeded, 1 test): seed 10 equal-strength MLBB players
and a session, open the split screen, click Re-roll twice, assert the rendered team
membership differs each time and the badge reads `Roll #2` then `Roll #3`.

### A04 — Deletes remove the row from the screen

Three one-line call swaps plus error surfacing, all inside handlers Phase A owns
(`src/App.tsx`):

```ts
const deletePlayer = async (id: Id) => {
  try {
    await roster.deletePlayer(id);              // was rosterStore.deletePlayer(id)
  } catch (err) {
    notify(`Could not delete the player: ${formatError(err)}`, "error");
  }
};
```

- `src/App.tsx:482-485` → `roster.deletePlayer` (`src/roster/useRoster.ts:42-47`).
- `src/App.tsx:762-765` → `tournaments.deleteTournament` (`src/tournament/useTournaments.ts:42-47`).
  `deleteTournamentFromUI` (`:766-771`) keeps calling `deleteTournament`, so the
  open-tournament redirect and the `GamesScreen onDelete` prop both keep working.
- `src/App.tsx:1209` → `sessions.deleteSession` (`src/session/useSessions.ts:41-47`).
  (The Squads row two lines down already calls `savedSquads.deleteSquad` — the correct
  pattern was always adjacent.)

**Failure handling, decided.** Each handler catches, emits a `notify(…, "error")` toast, and
does **not** rethrow. `PlayerEditModal.remove` (`src/roster/PlayerEditModal.tsx:141-151`) is
not owned by Phase A and calls `void remove()`, so a rejection would be unhandled and
unreported; catching is what turns a failed delete into a message. The modal closes and the
row stays visible, which is the truthful outcome: the toast says why, and the list still
shows the record.

**Tests.** `e2e/tests/roster/delete-row.spec.ts` (new, seeded, 1 test) — the class of bug
the current suite cannot see, because a spec that reloads between steps passes today:
seed 3 players, open Player 1, register `page.once("dialog", (d) => d.accept())` (Playwright
dismisses native dialogs by default; the audit confirms the confirm blocked automation),
click Delete, assert the row count went 3 → 2 **without a reload**; reload and assert it is
still 2; then delete a tournament from Games and assert its row disappears without a reload.

### A05 — Validate players where data enters; add an error boundary

**The stale half, corrected.** `.scratch/app-correctness/issues/03` claims "No production
code path calls them" of `validatePlayer`/`validateCapability`. That is no longer true:
`src/roster/PlayerEditModal.tsx:126` calls `validatePlayer(draft, disciplines)` and returns
the issues inline. The modal is **not** part of this ticket.

**The remaining gap, in two places.** `parseBackup` (`src/data/transfer.ts:83-122`) checks
shape only — `isPlayer` (`:52-57`) requires a string `id`, a string `name` and an array
`capabilities`; `attributeRatings`, `eligibleRoles` and `preferredRole` are never inspected.
And the import branches in `src/App.tsx` copy whatever arrives.

- `parseBackup(text, disciplines?)` gains an optional second parameter. When supplied, every
  player is run through `validatePlayer` (`src/domain/validation.ts:13`) and the first
  problem throws in the module's existing voice:
  `Backup player "Player 3" is invalid: Missing rating for attribute "Technical".`
  Signature stays backward compatible, so the eleven existing `transfer.test.ts` cases
  (`:43-166`) are unchanged.
- `handleImport` (`src/App.tsx:426`) passes `disciplines` at `:429`.
- The JSON players-only branch (`src/App.tsx:542-566`) validates each candidate before
  saving; invalid rows are skipped and reported by name and reason through
  `notify(…, "error")`, e.g.
  `Skipped 2 players. First: "Player 3" — Missing rating for attribute "Technical".`
  Valid players import exactly as before, so `sample-data/*.json` stays clean.

**The error boundary.** New `src/ErrorBoundary.tsx`, exactly the shape frozen in
`contracts.md`:

```tsx
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { console.error("comp3tive render error", error); }
  render() { /* .screen + .load-error message + a Reload button */ }
}
```

It renders inside the existing vocabulary — `.screen`, `.load-error` (`src/index.css:81`),
`.bar`, `.btn.btn-primary` — states that the data is safe, and reloads via
`window.location.reload()`. `src/main.tsx` wraps `<App />`:

```tsx
<StrictMode>
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
</StrictMode>
```

The wrapper sits **outside** `<App />`, so Phase D02 can register the service worker
alongside it without touching it (`contracts.md`, "Shared interfaces created by Phase A").

**`computeStrength` keeps throwing.** `src/domain/strength.ts:26-31` is the last line of
defence; this ticket prevents reaching it, and does not weaken it.

**Evidence note — the render-throw path is latent, not live.** The audit states that
`computeStrength` is called during render "from `strengthsFor` (`src/App.tsx:123-129`)".
Verified during this design: `grep -rn "strengthsFor"` returns the declaration and nothing
else, so that helper has **zero callers** and no longer sits on a render path. A malformed
persisted capability therefore does not blank the app *today* through that route. It does
throw on a real render path that remains: `describeFlags` (`src/session/flow.ts:24-38`)
resolves covering players with `strengthOf` → `computeStrength`, and `describeFlags` runs
during `SplitScreen` render (`src/session/SplitScreen.tsx:223`). The boundary is required
regardless — the roadmap and the frozen contract both call for it, `App.tsx` is 1,280 lines
with no protection anywhere, and any future consumer of a persisted bad record lands in the
same hole. The E2E below proves it by using that live path rather than the dead one.

**Tests.** `src/data/transfer.test.ts` gains a `describe("parseBackup: player validation")`
block (missing rating, rating out of `min..max`, unknown role, empty eligibility list, and a
valid file still parsing). `e2e/tests/shell/error-boundary.spec.ts` (new, seeded, 1 test):
seed a role-uncovered session whose covering player has a capability missing one attribute
rating, open it from History, and assert `[data-testid="error-boundary"]` shows the message
and a Reload action — the boundary catches a genuine render throw instead of the app going
white.

### A06 — Import merge keeps each record's community

Drop the override in `handleImport` (`src/App.tsx:456-461`): delete
`importCommunityId` at `:456` and stop spreading it over players (`:458`) and squads
(`:461`). Sessions (`:459`) and tournaments (`:460`) already keep their own community; after
this, so does everything else, and `parseBackup`'s adoption (`src/data/transfer.ts:128-140`)
is the single place that re-homes a record with a missing or unknown `communityId`. The
deleted comment justified the override for **v1** backups, and `parseBackup` already handles
that case itself (with tests at `src/data/transfer.test.ts:94-116`), so the override was
both over-broad and redundant.

**Tests.** `src/data/transfer.test.ts` gains a two-community round trip
(`serializeBackup` → `parseBackup`) asserting each record keeps its own `communityId` and no
record references a community that does not exist. `e2e/tests/roster/import-community.spec.ts`
(new, seeded, 1 test): seed one active community, import a v4 backup carrying two other
communities each with its own players, accept the merge confirm, then switch community and
assert each community's roster shows its own players and the initially-active community does
not receive them.

### A07 — Swiss pairs without rematches and crowns by play

**Pairing.** `pairRound` (`src/tournament/bracket.ts:162-185`) keeps its seeding and match-id
conventions and its record-band rule (`|Δwins| <= 1`), but stops taking first-fit. Design:

- Extract `selectPairing(field, recs, played): [a, b][] | null` — a deterministic
  backtracking search over the seed-sorted field: take the first unpaired team, try
  candidates in a fixed order (fewest-wins-difference first, then stronger seed first), and
  backtrack when a choice strands the remainder. It returns `null` **only** when no
  rematch-free legal assignment exists, which at n ≤ 8 is decided exhaustively.
- `pairRound` calls it, and the fallback to a rematch lives in an explicit `if (legal === null)`
  branch with its own comment, so the last-resort path is distinguishable in code from the
  normal path. The existing `if (ai === -1)` first-fit fallback disappears.

**Crown.** `standings` (`src/tournament/bracket.ts:302-313`) currently sorts
`wins || team.strength || gameWins || id`, and `team.strength` is the pre-tournament seed
(`records()` at `:131-152` copies `team` straight through) — so a tie is broken by how
strong a team was *before* play. New order, decided and recorded here:

| Order | Key | Rationale |
|---|---|---|
| 1 | `wins` desc | series wins |
| 2 | head-to-head winner, **only when exactly two teams are tied on wins** | Swiss guarantees at most one prior meeting per pair, so it is well defined exactly there; the winner of the head-to-head is placed above a team it beat |
| 3 | game difference (`gameWins − gameLosses`) desc | strength of play, not strength of seed |
| 4 | `gameWins` desc | existing third key, retained |
| 5 | `team.id` asc | determinism |

This deliberately **removes `team.strength`** from the crowning sort. Seeding and crowning
were two different questions and are now two different answers; `team.strength` remains the
seed order used to build the bracket, which is what it is for.

Both existing standings tests pass **unchanged** under this order, which is what makes the
change safe to land: in `bracket.test.ts:254-266` t2 and t3 never met, are tied on wins (1),
game difference (2−2 for both) and game wins (2), so the id key puts t2 first, as before; in
`bracket.test.ts:268-281` c and d are tied on wins (1) and **did** meet — c beat d — so
head-to-head puts c before d, exactly the recorded expectation.

**Tests.** `src/tournament/bracket.test.ts` gains an exhaustive block: for
`n ∈ {4, 6, 8}` and for **every** legal pattern of round-1 and round-2 outcomes
  (2^2 · 2^2 = 16 patterns at n = 4, 2^3 · 2^3 = 64 at n = 6, 2^4 · 2^4 = 256 at n = 8), the generated
round-3 pairing contains no repeated pair **whenever** a rematch-free assignment exists, and
an independent brute-force oracle (permutation check over ≤ 8 teams) decides "exists" so the
assertion cannot agree with a buggy implementation. Plus: every round seats all n teams, round
count is unchanged, a round-3 rematch is produced **only** when every legal pairing is a
rematch, and a 3-way tie at 2 wins is ordered by game difference rather than by seed. Every
pre-existing case in the file passes unchanged.

### A08 — Import survives a bad file

New pure module `src/data/player-import.ts` (Phase A owns `src/data/**`; Phase D36 consumes
this exact interface and wrote it down on its side):

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

- **Quoted fields.** A small state machine replaces `lines[i].split(",").map(strip quotes)`
  (`src/App.tsx:578`): `"` toggles in-quote, `""` inside quotes is a literal quote, a comma
  inside quotes is data. `"Smith, John", futsal, 4` imports the name `Smith, John`. The
  header heuristic (`lines[0].toLowerCase().includes("name")`, `:575`) moves inside the
  parser and applies to the parsed first row, so a quoted header still skips. A row with
  fewer than three fields is skipped with its 1-based line number, never silently defaulted.
  Zero dependencies — ADR-0001's client-only stance and a two-dependency `package.json` are
  load-bearing.
- **Unknown discipline.** `csvRowsToPlayers` resolves each row's discipline against the
  catalog; a row that matches nothing goes to `skipped` with its line number and the
  discipline as typed — never to a player with `capabilities: []` (today's silent outcome,
  `src/App.tsx:586-598`).
- **Size.** `assertImportSize(file.size)` runs at the top of `handlePlayerImport`
  (`src/App.tsx:515-520`), **before** `await file.text()` (`:519`). Over the limit it throws
  `Import refused: this file is 12.4 MB; the limit is 5 MB.` A guard against a
  self-inflicted tab freeze, not a security control.
- **Reporting.** The CSV branch calls the module and reports one summary line through
  `notify(…, "error")`, naming the count and the first skipped line with its reason. The
  seven `alert()` calls in the two import branches are replaced by `notify` here — they are
  import-path messages, which Phase A owns; the rest stay for C27.

**Tests.** New `src/data/player-import.test.ts`: quoted field with and without an embedded
comma, escaped `""`, quoted header skipped, row with too few fields skipped by line number,
unknown discipline reported by name and line, a valid file parsing cleanly, and
`assertImportSize` refusing 6 MB with the limit in the message.

### A09 — Prune the specs that assert nothing; untrack the reports

Delete, with no replacement where the coverage is already elsewhere:

| File | Lines | Why |
|---|---|---|
| `e2e/tests/tournament/inspect.spec.ts` | 41 | 2 assertions, both "`.app` is visible"; only `console.log`s the page HTML |
| `e2e/tests/tournament/inspect2.spec.ts` | 39 | 2 assertions, same shape |
| `e2e/tests/tournament/inspect3.spec.ts` | 67 | 3 assertions, and it mutates IndexedDB by hand to fabricate state |
| `e2e/tests/tournament/journey.spec.ts` | 41 | 4 assertions — a modal opened and closed — plus screenshots to `/tmp`. Does not test the journey it is named for; `saved-squad.spec.ts` already exercises create → split → submit → bracket |
| `e2e/tests/tournament/review.spec.ts` | 13 | `test.skip` whose comment claims the panel is "verified by the build and by manual testing" |
| `e2e/pages/base.page.ts`, `e2e/pages/split.page.ts` | — | zero consumers; `grep -rn "base.page\|split.page\|BasePage\|SplitPage" e2e/tests/` finds nothing and `SplitPage` is imported only by itself |

**`review.spec.ts`: decided — delete, not implement.** A skipped placeholder claiming
coverage is worse than a documented gap, and the panel's observable seam *is* covered
indirectly: `saved-squad.spec.ts:97` asserts that consuming a saved squad builds a bracket
(`.bracket-match` containing Team A and Team B), which is the same
`tournaments.teams.length > 0 && every match unplayed` state `reviewing` keys on
(`src/tournament/TournamentScreen.tsx:246`). `ReviewPanel` itself stays in the product; only
the file goes. This is the phase's one documented coverage gap and it is named here rather
than hidden behind a `test.skip`.

Also in this ticket: delete `e2e/tests/landing/landing.spec.ts:34`'s
`expect(page.locator(".tabbar")).toHaveCount(0)` — `.tabbar` has no counterpart in any
markup (same scan as A01), so the line passes trivially and misleads; `#root` and `.app`
count-0 assertions on the two lines above already prove the landing page is not the app.

**Untrack and ignore.** `git rm --cached playwright-report/index.html test-results/.last-run.json`
(517,543 B and 45 B, both still on disk), and extend `.gitignore` from its current four lines
(`node_modules/`, `dist/`, `*.tsbuildinfo`, `.DS_Store`) with:

```
# Playwright output — regenerate locally, never commit
playwright-report/
test-results/
```

### A10 — CI runs the checks

`package.json` gains exactly the script frozen in `contracts.md`:

```jsonc
"e2e": "playwright test --config=e2e/playwright.config.ts"
```

No `type-check`/`lint` alias is added (the workflow calls `npx` directly), so Phase C30's
`package.json` edits for `engines`/`.nvmrc` do not collide with this line.

New `.github/workflows/ci.yml`, one job on `ubuntu-latest`, `node-version: 22`, `npm` cache,
triggered on `push` and `pull_request`, with **no `continue-on-error` and no `|| true`**
anywhere — a red step fails the job:

| # | Step | Command | Why this order |
|---|---|---|---|
| 1 | checkout | — | |
| 2 | setup-node | `node-version: 22`, `cache: npm` | no `.nvmrc` yet; C30 adds the engine floor and this line follows it |
| 3 | install | `npm ci` | lockfile is committed (`package-lock.json`) |
| 4 | typecheck | `npx tsc -b` | covers `src`, `vite.config.ts` **and `e2e/**` once A01's tsconfig reference lands** |
| 5 | unit tests | `npx vitest run` | |
| 6 | build | `npx vite build` | **must precede e2e**: `e2e/playwright.config.ts:20-24` starts `npm run preview`, and `vite preview` serves `dist/`. Building here means the server can never serve a stale bundle |
| 7 | browsers | `npx playwright install --with-deps chromium` | only chromium is used by this suite |
| 8 | e2e | `npm run e2e` | `reuseExistingServer: true` finds no server on a fresh runner, so Playwright starts one against the `dist/` built at step 6 |
| 9 | upload report on failure | `actions/upload-artifact` with `if: failure()`, path `playwright-report/` | the report is untracked by A09, so this is how a red run is inspected |

`workers: 1` in `e2e/playwright.config.ts:7` is **not** changed here. The suite shares state
today (several specs operate on the Default community), and A11 records precisely what
prevents raising it, if anything still does. Retries stay at `0`: a suite that needs retries
to go green is hiding the class of debt this phase removes.

Branch protection ("require the CI check to pass before merging") is a repository setting,
not a file; the ticket names it as a one-line maintainer action, not as agent work.

### A11 — e2e specs start from a seeded world

`e2e/support/seed.ts` is extended, not duplicated:

- **`DB_VERSION` is derived, not copied.** `src/storage/indexed-db.ts:18` exports
  `const DB_VERSION = 6` today and the recovered helper hard-codes `open("comp3tive", 6)`.
  The module exports the constant, and the helper imports it and embeds it in the generated
  init script. A future bump then changes one number in `src/` and the helper follows;
  a hard-coded copy in test support is the same staleness the phase exists to remove.
- **Capabilities pass through.** `dashboard.spec.ts:62-66` currently *overwrites* every
  player's capabilities with one canned `mlbbCap`, which is why seeding a futsal-capable or
  deliberately malformed player is impossible today. The helper writes each `players` row as
  given and defaults to `mlbbCap` only when the row carries no `capabilities`, so
  `dashboard.spec.ts`'s behaviour is preserved and A05/A03/A06/A07 can seed what they need.
- **`gotoHubSeeded(page, world, hub)`** = `gotoSeeded` + `hubButton(page, hub).click()` +
  `await expect(page.locator(".screen h1")).toBeVisible()`.

**Migration.** 13 spec files click "New community"; two of them
(`community/community.spec.ts`, `community/cancel-dropdown.spec.ts`) exist to test that form,
so they keep clicking — seeding is for preconditions, not for the setup path being tested.
The other 11 — `discipline`, `history`, `match-setup`, `panel/no-overlap`,
`settings-panel/viewport`, `split-flow/split`, `squads/saved-squad`, the three tournament
specs, plus the specs A03/A04/A05/A06 add — call `gotoSeeded`/`gotoHubSeeded` instead of
clicking a community and adding players through the modal one at a time
(`match-setup/setup.spec.ts:19-31` and `panel/no-overlap.spec.ts:18-30` are the worst
offenders, at 4 and 15 modal round-trips per spec). No assertion is weakened, dropped or
reordered while moving: this ticket changes how the world is built and nothing that is
asserted about it. `localStorage["tb-community"]` is pinned by the helper, so no spec
switches community by clicking except the ones asserting that switching works.

**Measurement, stated honestly.** The 7.1 min figure is a broken baseline. Fourteen tests
waiting out a 30 s click timeout is 14 × 30 s = **7.0 min** on its own, which would leave
almost nothing for the 25 tests that passed — so the reported wall clock is dominated by
retry timers and says nothing usable about how long the suite takes when it works. The
comparison must be made **after** A01/A02 are green: A11's ticket records the green
pre-seeding baseline and the green post-seeding run, and only those two numbers are compared.

**Workers.** After seeding, the remaining shared state (if any) is recorded precisely in the
ticket: either `workers` can be raised without flakiness, or the ticket names the exact
shared record that prevents it. Guessing is not acceptable; `workers: 1` stays the default.

### A12 — Ticket hygiene

Nothing in this ticket changes product code. It edits ticket files:

- `.scratch/team-builder/dashboard/issues/01..07` — all seven were delivered; every
  deliverable exists (`src/DashboardScreen.tsx`, `src/dashboardTeasers.ts`,
  `e2e/tests/dashboard/dashboard.spec.ts`, `src/roster/useRoster.ts` scoping). Set
  `Status: resolved` and append a `## Comments` line naming the delivering commit:
  01 `73f6646`, 02 `f0e2b23`, 03 `a87c705` (order later changed by `1702342`), 04 `3728887`,
  05 `42c17c7`, 06 `94a5757`, 07 `b05bbb9`. Do **not** delete the files.
  Two corrections are recorded rather than papered over: ticket 03's acceptance says Home is
  *centered*, and `1702342` shipped Home *first* in `NAV_ITEMS` — the ticket is resolved with
  that note. Ticket 05's acceptance says the full suite passes; it has not passed since
  `681051d`, which is what this phase's tickets 01 and 02 fix.
- `.scratch/app-correctness/issues/03` — **corrected, not closed.** Its claim that "No
  production code path calls them" is stale: `src/roster/PlayerEditModal.tsx:126` calls
  `validatePlayer`. The remaining gap (`parseBackup`, the JSON/CSV import branches) is real,
  so the file keeps an open status and gains a `## Comments` line pointing at
  `.scratch/debt/issues/05-*.md`.
- The eight absorbed originals — `app-correctness/01,02,04,05` and `app-health/04,08,11,15` —
  each gain a `## Comments` line pointing at its successor in `.scratch/debt/issues/`, with
  status left unchanged (a ninth file, `app-correctness/03`, is corrected rather than
  cross-referenced, because its work is not finished). Without this, a future agent picks up
  a ticket whose work is already claimed by this phase, which is the double-tracking A12
  exists to stop.

## Acceptance criteria

Run from the repository root, in this order. All four must be green on the final tree, and
the browser suite must be run against a build produced by the same revision.

| # | Command | Expected result |
|---|---|---|
| 1 | `npx tsc -b` | exit 0, no diagnostics, now covering `src/`, `vite.config.ts` and `e2e/**/*.ts` |
| 2 | `npx vitest run` | **0 failed, 0 skipped, ≥114 passed.** Today's 114 pass unchanged; Phase A adds cases to `src/session/edit.test.ts` (A03), `src/data/transfer.test.ts` (A05, A06), `src/tournament/bracket.test.ts` (A07) and the new `src/data/player-import.test.ts` (A08) |
| 3 | `npx vite build` | succeeds. The one pre-existing warning (`src/data/sample-data.ts` dynamic/static import) is **not** in scope — Phase C29 owns it |
| 4 | `npm run e2e` | **42 tests, 0 failed, 0 skipped, 0 flaky.** Arithmetic: today 42 (25 passed / 16 failed / 1 skipped) − 5 deleted by A09 (`inspect`, `inspect2`, `inspect3`, `journey`, `review`) = 37, + 1 `e2e/tests/shell/nav-layout.spec.ts` (A01), + 1 `e2e/tests/split/reroll.spec.ts` (A03), + 1 `e2e/tests/roster/delete-row.spec.ts` (A04), + 1 `e2e/tests/shell/error-boundary.spec.ts` (A05), + 1 `e2e/tests/roster/import-community.spec.ts` (A06) = **42**. The one skipped test in the audit's run is gone: A09 deleted it, and the gap it pretended to cover is named in that ticket |

Per-ticket, the observable proof of "done" is:

| Ticket | Observation that proves it |
|---|---|
| 01 | The 14 rail-anchored failures are gone and `npx tsc -b` typechecks `e2e/**`; `nav-layout.spec.ts` passes at both 1280×720 and 390×844 |
| 02 | `dashboard.spec.ts` passes with no `aria-label` attribute in the app and no `padding-bottom` assertion in the suite |
| 03 | Two Re-roll clicks render different teams and the badge reads `Roll #2` then `Roll #3`; the seeded MLBB leftover is placed on a later roll |
| 04 | Deleting a player changes the row count 3 → 2 with no reload, and 2 after a reload |
| 05 | A backup with a missing attribute rating is rejected by name; the boundary shows its message on a real render throw; `computeStrength` still throws |
| 06 | Importing a two-community v4 backup leaves each record in its own community; no record points at a missing community |
| 07 | The exhaustive pattern block finds no legal-but-unused rematch-free pairing; the 3-way tie is ordered by game difference, not seed |
| 08 | `"Smith, John", futsal, 4` imports one player named `Smith, John`; a 6 MB file is refused with the limit in the message before `file.text()` |
| 09 | Five spec files and `e2e/pages/` are gone; `git ls-files` shows no `playwright-report/` or `test-results/`; the suite is shorter and still green |
| 10 | `npm run e2e` exists; the workflow file runs typecheck → unit → build → browsers → e2e with no `continue-on-error`; the run is red if any step fails |
| 11 | `grep -rn "New community" e2e/tests/` matches only the two community specs; the helper's init script embeds the exported `DB_VERSION`; the green run is measurably shorter |
| 12 | `.scratch/team-builder/dashboard/issues/01..07` read `Status: resolved` with a `## Comments` commit hash; `app-correctness/03`'s stale claim is corrected and points at `.scratch/debt/issues/05` |

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| The re-anchor is scoped as 14 hand-edits and one is missed | The suite stays partly red; every later phase loses its gate | The deliverable is the helper, not the edits. `nav-layout.spec.ts` asserts the invariant at both widths, and `npx tsc -b` now typechecks `e2e/**`, so a missed or misspelled hub is a compile error. Verify with the **full** suite, never a subset |
| `hubButton` resolves to two controls at a width where both navs are in the accessibility tree | Strict-mode violation, and a confusing failure instead of a clear one | `nav-layout.spec.ts` asserts exactly one visible control per name at both configured widths; the failure names the invariant rather than timing out |
| A02 "fixes" the app by adding `aria-label` to satisfy the broken assertion | The suite gets green by shipping redundant markup, and the next wrong assertion gets an equally wrong fix | Decided and recorded: the app has no `aria-label` on nav buttons, and the assertion is changed to assert the accessible name |
| Deleting `review.spec.ts` loses coverage of the pre-bracket panel | A regression in `ReviewPanel` is caught late | Stated as a named gap, not a hidden one; `saved-squad.spec.ts:97` asserts the submit → bracket outcome that consumes the same state |
| `varietySplit` legitimately returns the same teams for a small pool | A re-roll that reports a roll it did not perform — the original defect | The counter walk skips a variety index that reproduces the current teams, and the badge increments only on an actual change. A03 asserts no optimality anywhere, so it stays compatible with B13's "proven iff `solver.optimal`" |
| Removing `team.strength` from `standings` breaks existing bracket tests | Shared bracket behaviour is pinned by all three formats | Verified case by case against `bracket.test.ts:254-281`: both existing standings cases produce the same order under the new rule (head-to-head decides c/d; the id key decides t2/t3). A07 requires them to pass unchanged |
| The exhaustive Swiss test is slow or flaky | A red CI on timing rather than correctness | The enumeration is pure integer work over ≤ 8 teams with no I/O and no randomness; it runs in the unit suite, not the browser suite |
| The CI e2e job serves a stale `dist/` | Green CI on an old bundle, or a phantom failure | Build (step 6) precedes e2e (step 8) in the same job on a fresh runner; the audit's environment note (`reuseExistingServer: true` on a day-old preview) is why this ordering is stated explicitly |
| A05/A08 both edit `handlePlayerImport` | Two agents editing one function | Disjoint, named ranges: A05 owns the JSON branch `:522-567`; A08 owns the top-of-handler size guard `:515-520` and the CSV branch `:569-608` |
| A05/A06 both edit `src/data/transfer.test.ts` | Concurrent same-file edits silently clobber | A06 is `Blocked by: 05`; the tickets state the file conflict as the reason |
| The e2e suite still needs `workers: 1` after seeding | Slower CI | A11 either raises it or records the exact shared record that prevents it. No guessing |

## Files

| Action | Path |
|---|---|
| Create | `docs/superpowers/specs/2026-09-17-truth-and-trust-design.md` (this file) |
| Create | `.scratch/debt/issues/01-reanchor-e2e-to-shipped-layout.md` … `12-ticket-hygiene.md` |
| Create | `e2e/support/seed.ts` (A01, extended by A11) |
| Create | `e2e/tests/shell/nav-layout.spec.ts` (A01) |
| Create | `e2e/tsconfig.json` (A01) |
| Create | `e2e/tests/split/reroll.spec.ts` (A03) |
| Create | `e2e/tests/roster/delete-row.spec.ts` (A04) |
| Create | `e2e/tests/shell/error-boundary.spec.ts` (A05) |
| Create | `e2e/tests/roster/import-community.spec.ts` (A06) |
| Create | `src/ErrorBoundary.tsx` (A05) |
| Create | `src/data/player-import.ts` (A08) |
| Create | `src/data/player-import.test.ts` (A08) |
| Create | `.github/workflows/ci.yml` (A10) |
| Modify | `tsconfig.json` (A01 — add the `e2e` project reference) |
| No change | `e2e/playwright.config.ts` — the default viewport stays 1280×720, `workers` stays 1, `retries` stays 0; the two specs that need 390×844 set it themselves with `test.use` |
| Modify | 10 spec files: `dashboard/dashboard`, `discipline/discipline`, `history/history`, `panel/no-overlap`, `settings-panel/viewport`, `split-flow/split`, `squads/saved-squad`, `tournament/create`, `tournament/draft`, `tournament/split-tourney` (A01, A02, A11) |
| Modify | `e2e/tests/landing/landing.spec.ts` (A09 — delete the `.tabbar` assertion at `:34`) |
| Modify | `src/session/SplitScreen.tsx` (A03 — `reroll` only) |
| Modify | `src/session/edit.test.ts` (A03) |
| Modify | `src/App.tsx` (A04 delete handlers; A05 `handleImport` JSON branch; A06 import merge; A08 CSV branch and size guard) |
| No change | `src/roster/useRoster.ts`, `src/tournament/useTournaments.ts`, `src/session/useSessions.ts` — A04 verified their `delete*` already write the store **and** update their own list (`useRoster.ts:42-47`, `useTournaments.ts:42-47`, `useSessions.ts:41-47`); the failure path is handled at the handler, which is where the toast lives |
| Modify | `src/data/transfer.ts` (A05 `parseBackup(text, disciplines?)`) |
| Modify | `src/data/transfer.test.ts` (A05, A06) |
| Modify | `src/main.tsx` (A05 — wrap `<App />`) |
| Modify | `src/tournament/bracket.ts` (A07 — `pairRound`, `standings`) |
| Modify | `src/tournament/bracket.test.ts` (A07) |
| Modify | `src/storage/indexed-db.ts` (A11 — `export const DB_VERSION = 6`, currently module-private at `:18`) |
| Modify | `package.json` (A10 — the `e2e` script only) |
| Modify | `.gitignore` (A09) |
| Delete | `e2e/tests/tournament/inspect.spec.ts`, `inspect2.spec.ts`, `inspect3.spec.ts`, `journey.spec.ts`, `review.spec.ts`, `e2e/pages/base.page.ts`, `e2e/pages/split.page.ts` (A09) |
| Untrack | `playwright-report/index.html`, `test-results/.last-run.json` (A09 — `git rm --cached`) |
| Modify | `.scratch/team-builder/dashboard/issues/01..07`, `.scratch/app-correctness/issues/01..05`, `.scratch/app-health/issues/04,08,11,15` (A12 — ticket files only) |

Not touched by Phase A: `src/solver/**`, `src/domain/**` (except its tests), `src/index.css`,
`index.html`, `src/landing.tsx`, `docs/**` other than this spec.

## Spec Self-Review

- **Placeholders:** none. Every ticket names exact files, exact symbols, exact commands and
  exact expected output; every measured number comes from the audit findings or from a probe
  run during this design. No "TBD", no "handle edge cases", no "similar to ticket N".
- **Internal consistency:** the ticket set matches the roadmap's Phase A table exactly
  (01–12, same titles, same absorptions). Ticket numbers and the file-ownership table match
  `contracts.md`. The frozen interfaces are quoted verbatim: `SeedWorld`/`seedScript`/
  `gotoSeeded`/`gotoHubSeeded`/`hubButton` (A01, A11), the `e2e` script string (A10), the
  `ErrorBoundary` class shape (A05). The overlap rules are respected: A03 changes `reroll`
  only and leaves gap copy to B13; A05's `main.tsx` edit is additive and outside the boundary;
  A10 adds one script and does not touch `engines`/`.nvmrc` (C30). The e2e arithmetic is
  stated so it can be checked against the run.
- **Scope check:** 12 tickets, one implementation plan. The two largest items (A01's
  re-anchor and A11's sweep) are explicitly the same helper at two stages, and A11 is
  blocked by A01 so a single context window can carry each. No ticket requires simultaneous
  edits to a file another ticket owns; the two same-file pairs (A05/A06 on
  `transfer.test.ts`; A05/A08 on `handlePlayerImport`) have their line ranges named and the
  first is sequenced.
- **Ambiguity check:** "the suite is green" means 42 tests, 0 failed, 0 skipped, on a build
  from the same revision. "Re-anchored" means no spec addresses a hub by index or by a
  layout-specific selector, and the hub names are a typed union. The viewport strategy is
  stated once, including why the helper makes either width work. The two judgement calls
  the audit left open (`review.spec.ts`, `panel/no-overlap`'s padding assertion) are decided
  with reasons, not deferred.
- **Disagreements with the audit, recorded rather than swallowed:**
  1. The audit says `computeStrength` is reachable during render "from `strengthsFor`
     (`src/App.tsx:123-129`)". `strengthsFor` has **zero callers** today, so that specific
     route is dead; the live render route is `SplitScreen` → `describeFlags` →
     `strengthOf`. A05 designs its E2E against the live route and keeps the boundary.
  2. The audit's root-cause section names 14 spec files referencing `.bottom-nav`; four of
     them (`inspect`, `inspect2`, `inspect3`, `journey`) are deleted by A09, so A01 rewrites
     10 — one of which is `dashboard.spec.ts`, the only spec that already seeded. (A09 also
     deletes `review.spec.ts`, which never referenced the nav at all: it is a `test.skip`
     whose body only navigates to `./` and asserts `.app` is visible, which is one more
     reason it was safe to delete.) Both numbers appear above with their derivation.
  3. `.scratch/app-health/issues/15` says "of 19 specs"; the audit counts 20 spec files
     (`e2e/tests/**/*.spec.ts`). The audit is followed.
  4. `.scratch/app-health/issues/04` asks CI to pin Playwright to 2 workers; A10 does not,
     because A11 owns that measurement and the suite is `workers: 1` for a stated shared-state
     reason. The reasons are in both tickets.
