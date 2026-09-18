# Shell and Structure — 2026-09-17

**Status:** ready-for-agent

Phase C of the four-phase debt repayment roadmap (`docs/superpowers/specs/2026-09-17-debt-repayment-roadmap-design.md`).
Tickets `.scratch/debt/issues/21-*.md` … `30-*.md`. Runs after Phase A; may run in parallel
with Phase B; must land before Phase D.

## Problem Statement

Everything the product does now flows through one component that has become the place with
no seam, and the tree carries code that no longer participates in the product. Measured on
HEAD `d87ac7b`, 2026-09-17, per the audit findings:

- **`src/App.tsx` is 1,280 lines** (`wc -l`) and contains **0 `useMemo`**. It holds **13
  `useState` call sites** (`grep -c "useState(" src/App.tsx`); the audit and the roadmap both
  say 14, and 13 is the measured number — the count is re-derived in the budget table below.
  Nine view modes render inline in one JSX block (`:958`–`:1253`), navigation state is a
  local `useState<View[]>` (`:140`), and the community-scoping rule is restated four times
  at `:202`, `:208`, `:211`, `:214` as
  `records.filter((r) => r.communityId === activeCommunity.id)`.
- **`disciplinesById` builds a `new Map` on every render** (`:199`), as does `viewTournament`
  (`find`, `:220`) — because the file contains no `useMemo` at all.
- **318 lines of dead modules with a second copy of the tournament rules**
  (`src/tournament/tournament-domain-fix.ts`, 270 lines; `src/session/split-module.ts`, 48).
  `grep -rn "split-module\|tournament-domain-fix" src/ e2e/` returns **nothing**. The dead
  file declares its own `validateTournamentSpec` (line 35) and `validateTeamParticipation`
  (line 95) beside the live ones. A third module,
  `src/tournament/team-participation-validator.ts` (97 lines), has exactly one importer —
  an unused import at `src/App.tsx:48`.
- **The compiler cannot see any of it**: `tsconfig.app.json` sets
  `"noUnusedLocals": false, "noUnusedParameters": true`. Running
  `npx tsc -p tsconfig.app.json --noUnusedLocals --noEmit` reports **19 findings** today,
  including six dead handlers in `src/App.tsx` (`showHistory` `:666`, `showDisciplines`
  `:670`, `enterMatchFlow` `:742`, `finishSplit` `:754`, `recordTournamentResult` `:759`,
  `showTournamentView` `:772`) and three dead helpers (`strengthsFor` `:123`, `badgeClass`
  `:130`, `effectiveTheme` `:179`).
- **Eight duplicate constant definitions**: `BIB = ["a","b","c","d","e"]` ×3
  (`SplitScreen.tsx:21`, `SquadsScreen.tsx:21`, `TournamentScreen.tsx:32`), `FORMAT_LABEL` ×3
  (`DashboardScreen.tsx:6`, `GamesScreen.tsx:27`, `TournamentScreen.tsx:26`), `STATUS_LABEL` ×2
  (`DashboardScreen.tsx:12`, `GamesScreen.tsx:42`), `relativeTime` ×2
  (`HistoryScreen.tsx:13`, `SquadsScreen.tsx:23` — byte-identical, 10 lines each), and the
  `modal-overlay > modal-card > modal-close` skeleton ×5.
- **17 native dialogs block the thread**: 10 `alert()` and 7 `window.confirm()` calls. The
  audit confirmed a `confirm()` **blocked browser automation** until an external dialog
  handler was installed — a real defect, not a style preference. A toast system already
  exists and these paths ignore it (`notify` at `src/App.tsx:163`, the
  `.toast-container` with `aria-live="polite"` at `:1257`).
- **Dead navigation affordances**: `src/nav.tsx`'s `Breadcrumb` has **zero consumers** while
  three screens hand-roll the same markup, and `SplitScreen.tsx:294` renders
  `<a href="#" onClick={(e) => { e.preventDefault(); /* back handled via app */ }}>Match setup</a>`
  — announced as a link, does nothing. `docs/FLOW.md` §3 declares the opposite as normative:
  "Breadcrumbs are links — every crumb above the current screen navigates there."
- **The Landing Page pays for the app**: `dist/index.html` links `index-CgrHkb71.css`
  (**47,834 B**) — the app's stylesheet — because `src/landing.tsx:7` imports `./index.css`,
  on top of its own `landing-CJvxMLgK.css` (15,207 B). `src/landing.tsx:2-6` also pulls
  `SplitScreen`, `SplitDeal`, `freshSplit` and `MLBB_DISCIPLINE` into the shared chunk
  `index-B-AfBoP4.js` (213,023 B), which both documents load. `npx vite build` warns:

  > `src/data/sample-data.ts is dynamically imported by src/App.tsx but also statically
  > imported by src/domain/useDisciplines.ts, dynamic import will not move module into
  > another chunk.`

  The laziness the dynamic import was written for never happened: `sample-data/*.json`
  (11,122 B + 11,444 B) resolve into `app-LNkAbv9g.js` — the roster name "Kairi" appears
  there once and nowhere else.
- **No project hygiene**: no `README.md`, no `.nvmrc`, no `engines` field (`package.json` is
  29 lines), so the Node floor is implicit and undiscoverable.

The cost is not aesthetic. Nine view modes and four copies of one rule mean Phase D's five
new features would each deepen the same file; a handler nobody calls survives review; and
every consumer of the Landing Page downloads 47.8 kB of CSS for screens it never renders.

## Scope

Ten tickets, executed in the fixed order below. Each lands green.

| # | Ticket | Absorbs |
|---|---|---|
| 21 | Delete the code nothing calls | app-health/01 |
| 22 | Let the compiler catch dead code | app-health/02 |
| 23 | One definition per shared constant | app-health/03 |
| 24 | Navigation moves out of the shell | app-health/05 |
| 25 | Community scoping expressed once | app-health/06 |
| 26 | The split and tournament flow move out of the shell | app-health/07 |
| 27 | Failures and confirmations speak the app's language | app-health/10 |
| 28 | The shared breadcrumb and page header are actually used | app-health/14 |
| 29 | Each document loads only what it needs | new |
| 30 | Project hygiene: README, engine floor, node pin | new |

**Why this order, and why C22 is not first.** C21 deletes the modules whose unused imports
and unused types produce four of the nineteen findings `noUnusedLocals` reports; turning the
flag on first would mean editing files that are about to be deleted. C24–C26 rewrite the
regions that produce the other ten (`src/App.tsx`'s dead handlers and helpers), so the flag
belongs *after* the deletions and *before* the extractions: C23–C30 are then written against
a compiler that already refuses a dead local, which is the only mechanism in this repo that
notices a handler nobody calls. C23 precedes C24–C26 because the extracted screens import
constants from one place instead of carrying their own copies. C27 precedes C28 because both
edit `src/ui/**`, and C28 re-verifies C27's outcome. C29 follows C28 because the Landing
Page's hero renders `SplitScreen`, and C28 changes the crumb markup that sits inside that
hero — the CSS split must be measured against final DOM. C30 follows last because the README
describes the file layout the previous nine tickets produce.

**Out of scope for this phase.**

- **ESLint, a formatter, and coverage thresholds.** A first lint run against 9,300 lines is a
  large diff of its own; it needs a dedicated pass, not a ride-along on a refactor.
- **`src/index.css`'s 2,913 lines as a design problem.** C29 moves a subset of rules into a
  second file so the Landing Page stops loading the whole sheet; it does not re-scope,
  rename, or restructure a single declaration.
- **`src/session/SplitScreen.tsx` beyond two named lines.** A owns its re-roll handler and B
  owns its gap copy; C touches the re-roll pool expression (C26) and the crumb block (C28)
  and nothing else.
- **The solver, `src/tournament/bracket.ts`, `src/storage/types.ts`, and the domain model.**
  The pure core is the part of this codebase that works; C22 deletes around it, never into it.
- **Component tests.** `vite.config.ts` sets `test.include: ["src/**/*.test.ts"]`, so `.tsx`
  is excluded; no React renderer or DOM environment is installed (`environment: "node"`,
  no jsdom). Changing that is a harness decision, and this phase needs the opposite: hooks
  whose logic is reachable from plain `.ts` tests.
- **Landing Page visual redesign.** C29 changes which bytes arrive, not what is drawn.
- **`docs/FLOW.md`'s breadcrumb table.** B owns that file. C28 makes the code satisfy §3.

## Design

### Contracts this phase is written against

The extractions below are **frozen** by `contracts.md`; Phase D's plan assumes these exact
names and shapes. C24–C26 produce them verbatim.

```ts
// src/shell/useNavigation.ts
export type View =
  | { mode: "roster" } | { mode: "dashboard" } | { mode: "games" }
  | { mode: "history" } | { mode: "disciplines" } | { mode: "squads" }
  | { mode: "tournament"; id: Id } | { mode: "match"; source: SplitSource }
  | { mode: "split"; source: SplitSource };

export type HubMode = "dashboard" | "roster" | "games" | "history" | "squads";

export function useNavigation(initial: View): {
  view: View;
  viewStack: View[];
  pushView: (v: View) => void;
  goBack: () => void;
  gotoHub: (mode: HubMode) => void;
  resetTo: (v: View) => void;
};

// src/shell/useCommunityScope.ts
export function useCommunityScope(input: {
  communities: Community[];
  activeCommunityId: Id | null;
  players: Player[];
  sessions: Session[];
  tournaments: Tournament[];
  squads: SavedSquad[];
}): {
  activeCommunity: Community | null;
  players: Player[];
  sessions: Session[];
  tournaments: Tournament[];
  squads: SavedSquad[];
  disciplinesById: Map<Id, Discipline>;
};

// src/shell/useSplitFlow.ts
export type SplitSource = "ad-hoc" | "tournament" | "session" | "squad";
export function splitFlowRule(source: SplitSource): {
  persistsSession: boolean; submitsTournament: boolean; isSynthetic: boolean;
};
export function rerollPool(
  source: SplitSource, sessionPoolPlayerIds: Id[] | null, currentTeams: TeamAssignment[],
): Id[];

// src/ui/constants.ts
export const BIB: readonly ["a", "b", "c", "d", "e"];
export const FORMAT_LABEL: Record<TournamentFormat, string>;
export const STATUS_LABEL: Record<TournamentStatus, string>;
```

**Two additions, both additive.** (1) `useCommunityScope`'s frozen input has no
`disciplines` field but its output includes `disciplinesById`, which cannot be built from the
declared inputs; the hook takes an extra optional `disciplines?: Discipline[]` (default `[]`).
The six documented fields still compile. (2) `useNavigation.ts` also exports the pure
transitions (`pushStack`, `popStack`, `hubStack`, `currentView`) so the view stack is
testable in the `node` environment; the hook is a thin `useState` wrapper over them. The
frozen names and shapes are untouched — this is what makes the three unit tests below
possible at all, since there is no DOM in the unit harness.

**Frozen `View` vs. today's `View`.** The frozen union drops two payload fields the live one
carries: `{ mode: "squads"; openId?: Id }` becomes `{ mode: "squads" }`, and
`{ mode: "split"; session: Session; source: SplitSource }` becomes
`{ mode: "split"; source: SplitSource }`. `openId` is dead — `SquadsScreen` owns its own
`openId` state (`src/session/SquadsScreen.tsx:48`) and nothing ever pushes a squads view with
one. The split session is *not* dead; it moves out of the union into the split-flow hook
(C24 puts it in an `activeSplit` state; C26 moves that state into `useSplitFlow`). Both
changes are recorded in tickets 24 and 26.

### C21 — Delete the code nothing calls

Three modules go, 415 lines, verified unreachable before deletion:

| Module | Lines | Verified |
|---|---|---|
| `src/tournament/tournament-domain-fix.ts` | 270 | `grep -rn "tournament-domain-fix" src/ e2e/` → no matches |
| `src/session/split-module.ts` | 48 | `grep -rn "split-module" src/ e2e/` → no matches |
| `src/tournament/team-participation-validator.ts` | 97 | its only importer is the unused `src/App.tsx:48` |

Plus the unconditionally unreachable notice at `src/tournament/TournamentScreen.tsx:353-355`:
`{canResplit && <span className="status-msg">Re-split is locked after the first result.</span>}`
sits inside `{hasAnyGames && (…)}` (`:352`), while `canResplit` is
`tournament.teams.length > 0 && !hasAnyGames` (`:250`). The two conditions are mutually
exclusive, so it has never rendered. The lock is enforced by the absent affordance; deleting
the const and the span removes no behaviour.

**The duplicate's extra rules are a finding, not a porting task.** The dead
`validateTournamentSpec` encodes four checks; the live
`src/tournament/tournament-validation.ts` encodes three of them plus the name check, and the
dead one adds:

- team size against `discipline.team.minTeamSize`/`maxTeamSize` — enforced elsewhere by the
  solver's team sizing (`src/solver/solver.ts`, `buildSettings`) and `MatchScreen`'s seat
  check (`src/session/MatchScreen.tsx:24-32`);
- format × discipline compatibility (`isFormatCompatible`) — expressed by
  `TEAM_COUNTS`/`getValidTeamCounts` in the live validator and consumed by `GamesScreen`;
- `seriesLength ∈ {1,3,5}` — expressed by `GamesScreen`'s `BO: SeriesLength[] = [1, 3, 5]`
  (`src/tournament/GamesScreen.tsx:34`), which is the only producer of that field.

The dead `getValidTeamCounts("single-elim")` returns `[4, 2, 8]` where the live one returns
`[2, 4, 8]` — the same set in a different order, which only changes the message string. So
nothing is lost and nothing is copied back. The ticket records this per symbol.

After C21, `validateTournamentSpec` has exactly one definition and
`validateTeamParticipation` has **zero** — the live one is deleted with its only (unused)
importer, and that is the correct outcome rather than re-wiring a validator no screen asks
for.

### C22 — Let the compiler catch dead code

`tsconfig.app.json`: `"noUnusedLocals": false` → `true`. Nothing else in that file changes;
`noUnusedParameters` is already `true`, and `npm run build` already runs `tsc -b` over it.

The findings are **re-derived by running the flag**, not taken from the ticket —
`.scratch/app-health/issues/02` says 20 and lists a partial set; the flag reports **19**
today:

| File:line | Symbol | Disposition |
|---|---|---|
| `src/App.tsx:30` | `DisciplineEditModal` import | delete — `DisciplinesScreen` owns the modal (`src/domain/DisciplinesScreen.tsx:104`) |
| `src/App.tsx:48` | `validateTeamParticipation` import | already gone via C21 |
| `src/App.tsx:123` | `strengthsFor` | delete — dead helper; no screen renders a strength column from it |
| `src/App.tsx:130` | `badgeClass` | delete — the live badge class is built inline at `:1105` |
| `src/App.tsx:179` | `effectiveTheme` | delete — see the cascade below |
| `src/App.tsx:666` | `showHistory` | delete — dead duplicate of `gotoHub("history")` |
| `src/App.tsx:670` | `showDisciplines` | delete — dead duplicate of `goDisciplines` |
| `src/App.tsx:742` | `enterMatchFlow` | delete — `startMatch` is the live entry |
| `src/App.tsx:754` | `finishSplit` | delete — tournament submit flows through `SplitScreen`'s `onSubmitTournament` → `consumeTeams` |
| `src/App.tsx:759` | `recordTournamentResult` | delete — `TournamentScreen`'s `onRecord` calls `recordResult` directly |
| `src/App.tsx:772` | `showTournamentView` | delete — `openTournament` (`:738`) is the live one |
| `src/data/sample-data.ts:74` | `ROLE_NAMES` | delete — `autoGenerateSampleData` uses `PLAYER_NAMES` only |
| `src/domain/DisciplineEditModal.tsx:32` | `isNew` | delete — `isEdit`/`isBuiltIn` cover the three cases |
| `src/nav.tsx:1` | `Id` import | delete |
| `src/roster/PlayerEditModal.tsx:32` | `d` | delete the binding: `player.capabilities.map((c) => {` |
| `src/tournament/TournamentScreen.tsx:4` | `teamName` import | delete (keep the rest of line 2's type imports) |
| `src/session/split-module.ts:7` | all imports | deleted by C21 |
| `src/tournament/team-participation-validator.ts:1` | `TeamSlot` | deleted by C21 |
| `src/tournament/tournament-domain-fix.ts:13` | `TeamSlot` | deleted by C21 |

**The cascade is expected, and the method is iterative.** Removing `effectiveTheme` (`:179`)
leaves `systemDark` (`:177`) unused, because `effectiveTheme` is its only reader — so the
first pass produces a finding the table above cannot list. `:177` is deleted too, and no
behaviour is lost: the "auto" theme is already handled in CSS. `tokens.css` defines its dark
values under a `prefers-color-scheme` media query, and the effect at `src/App.tsx:184-196`
only ever writes or deletes `data-theme`, so `auto` → `delete el.dataset.theme` → the CSS
media query decides. The ticket's Answer records the second pass.

Deletion is the default for every finding. Nothing here is wired up: a handler that
duplicates an existing section is dead weight, not a plan. No `void x;`, no underscore
prefix, no `@ts-ignore`.

### C23 — One definition per shared constant

New `src/ui/constants.ts`, exported exactly as frozen:

```ts
import type { TournamentFormat, TournamentStatus } from "../domain/types";

/** Team stripe colours, in split order. Indexed modulo its own length. */
export const BIB: readonly ["a", "b", "c", "d", "e"] = ["a", "b", "c", "d", "e"];

/** Human labels for each bracket format. D16 adds "round-robin" to the union and to this record. */
export const FORMAT_LABEL: Record<TournamentFormat, string> = {
  series: "Series",
  "single-elim": "Single elimination",
  swiss: "Swiss",
};

/** Human labels for each tournament lifecycle state. */
export const STATUS_LABEL: Record<TournamentStatus, string> = {
  draft: "Draft",
  active: "In progress",
  complete: "Complete",
};
```

Every moved value is **byte-identical** to the copies it replaces — verified by comparing all
three `FORMAT_LABEL` tables and both `STATUS_LABEL` tables, which carry the same six label
strings. (`app-health/03` reports that "the three `FORMAT_LABEL` tables are keyed off
different type spellings (`Tournament["format"]` vs `TournamentFormat`)"; the spellings
differ, the unions are the same, and no value differs. The ticket records the correction.)

Call sites, eight definitions removed:

| Symbol | Delete from | Import from |
|---|---|---|
| `BIB` | `SplitScreen.tsx:21`, `SquadsScreen.tsx:21`, `TournamentScreen.tsx:32` | `../ui/constants` |
| `FORMAT_LABEL` | `DashboardScreen.tsx:6`, `GamesScreen.tsx:27`, `TournamentScreen.tsx:26` | `./ui/constants` |
| `STATUS_LABEL` | `DashboardScreen.tsx:12`, `GamesScreen.tsx:42` | `./ui/constants` |

`relativeTime` (byte-identical 10-line function at `HistoryScreen.tsx:13` and
`SquadsScreen.tsx:23`) moves to `src/ui/format.ts` and is imported by both screens.

The five modals' shared skeleton collapses into `src/ui/Modal.tsx`:

```tsx
interface Props {
  /** Dismiss the modal. Fired by the overlay and by Escape-less backdrop clicks. */
  onClose: () => void;
  children: ReactNode;
}
export function Modal({ onClose, children }: Props) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}
```

It owns the wrapper and the two handlers only. Each call site keeps its own `modal-close`
button, title and content byte-for-byte, because they differ: `TournamentScreen.tsx:112`
renders an inline-styled `<h1>` rather than `.modal-title`, and `SplitScreen.tsx:164` titles
itself "Save squad". Call sites: `DisciplineEditModal.tsx:167-168`,
`PlayerEditModal.tsx:154-155`, `GamesScreen.tsx:229-230`, `TournamentScreen.tsx:107-108`,
`SplitScreen.tsx:159-160`. No class name, DOM nesting or rendered string changes;
`src/index.css` is not touched. `src/ui/` already holds the two shared primitives
(`Screen.tsx`, `PageHeader.tsx`) and is C's folder. The suite pins this surface: `.modal-card`
appears in 12 spec files and `.badge--mlbb` in
`e2e/tests/dashboard/dashboard.spec.ts:481`, so a class renamed in the move fails a real
assertion rather than passing silently.

### C24 — Navigation moves out of the shell

`src/shell/useNavigation.ts` exports the frozen `View`, `HubMode`, `useNavigation`, plus the
pure transitions. `src/shell/nav-items.ts` exports `NAV_ITEMS` — currently at
`src/App.tsx:62-68`, unchanged in value, because the accessible names it carries
(`Home`, `Roster`, `Games`, `History`, `Squads`) are what Phase A's `hubButton` and the e2e
suite match on.

Transitions, defined as pure functions over a stack so they are testable without a renderer:

```ts
export function pushStack(stack: View[], v: View): View[];        // [...stack, v]
export function popStack(stack: View[]): View[];                  // stack.length > 1 ? slice(0,-1) : stack
export function hubStack(mode: HubMode): View[];                  // [{ mode }]
export function currentView(stack: View[]): View;                 // stack[stack.length - 1]
```

These reproduce `src/App.tsx:150-156` exactly: `pushView` appends; `goBack` is a root no-op
(`s.length > 1` guard); `gotoHub` **replaces** the stack. `popStack` must never return an
empty array — the root-back no-op is the reason, and the unit test asserts it.

`gotoHub` also clears the match setup today (`setSetup(null)`, `:154`). The frozen hook owns
only the stack, so `src/App.tsx` keeps a two-line wrapper:

```ts
const { view, viewStack, pushView, goBack, resetTo } = useNavigation({ mode: "dashboard" });
const gotoHub = (mode: HubMode) => { resetTo({ mode }); setSetup(null); };
```

`resetTo({mode})` **is** `hubStack(mode)` applied — one element — so the wrapper is
behaviour-identical to `:152-155`.

The two replace-style pushes become frozen-API calls, not new API:

```ts
// src/App.tsx:352 and :733 — today setViewStack([{ mode: "games" }, { mode: "tournament", id }])
resetTo({ mode: "games" });
pushView({ mode: "tournament", id: built.id });
```

Same two-element stack, so Back and the Games breadcrumb still return to Games (FLOW P2,
ADR-0004).

Removed from `src/App.tsx`: `type View` (`:70-79`), `type HubMode` (`:59`), `NAV_ITEMS`
(`:62-68`), `viewStack`/`view`/`pushView`/`goBack`/`gotoHub`/`goDisciplines` (`:140-141`,
`:150-156`). `view` is read at ~40 sites and keeps its name via destructuring, so those sites
do not change.

Because the frozen `View` has no `session`, the split session moves to its own state in
`src/App.tsx` (`activeSplit`), set by the same code that pushes `{ mode: "split", source }`
— the History reopen path and `reSplitSquad`. C26 moves that state into `useSplitFlow`; C24
only relocates it out of the union so the frozen type is reachable.

**Guarded by Phase A's e2e suite.** These primitives are what 20 spec files click through;
the acceptance criterion is that the whole suite passes with **no spec edited**. That rule is
only meaningful because A01 re-anchored the suite to the shipped rail layout and A11 made it
seed deterministically — before A, the suite was 16 failed / 25 passed, and a red suite
cannot gate a refactor.

Unit test `src/shell/navigation.test.ts`: push/pop round trip; `popStack` at the root returns
the same stack (no empty stack, no undefined `view`); `hubStack` collapses a depth-3 stack to
one; `currentView` after `resetTo` + `pushView` is the pushed view; the tournament-create
sequence yields `[games, tournament]`.

### C25 — Community scoping expressed once

`src/shell/useCommunityScope.ts` exports the frozen hook plus the pure selector the hook
memoises, so the invariant is testable in the `node` environment:

```ts
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

export function scopeCommunities(input: CommunityScopeInput): CommunityScopeResult;

export function useCommunityScope(input: CommunityScopeInput): CommunityScopeResult {
  return useMemo(() => scopeCommunities(input), [
    input.communities, input.activeCommunityId, input.players,
    input.sessions, input.tournaments, input.squads, input.disciplines,
  ]);
}
```

`scopeCommunities` is the one place the rule lives: `activeCommunity` is a `find` by id, and
each of the four lists is `records.filter((r) => r.communityId === activeCommunity.id)` when
there is an active community and `[]` when there is not. `disciplinesById` is built once, in
the same call. The four copies at `src/App.tsx:202`, `:208`, `:211`, `:214` and the
per-render `new Map` at `:199` are deleted.

`src/App.tsx` after C25:

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

`visiblePlayers` (`:217-219`) stays in `App.tsx`: it depends on `filterIds`, which is
screen state, not community scope. `viewTournament` (`:220-221`) stays too, memoised against
the same source list it reads today:

```ts
const viewTournament = useMemo(
  () => (view.mode === "tournament" ? tournaments.tournaments.find((t) => t.id === view.id) ?? null : null),
  [view, tournaments.tournaments],
);
```

The source is left as the unscoped list on purpose: `find` by id is already unique, and
narrowing it is a behaviour change no ticket asks for. The point is that it runs once per
change instead of once per render — the file has **0** `useMemo` today.

Unit test `src/shell/community-scope.test.ts`: with two communities each holding players,
sessions, tournaments and squads, every scoped list contains only the active community's
records and nothing from the other; with `activeCommunityId: null`, `activeCommunity` is
`null` and all four lists are empty; `disciplinesById.get(id)` resolves a discipline and
returns `undefined` for an unknown id.

**The memoisation itself is not unit-testable here**, and the spec says so rather than
pretending: the unit harness is `environment: "node"` with no DOM and no React renderer
(`react-dom/server` cannot re-render, so it cannot prove reference stability), and
`test.include` admits only `.ts`. Its acceptance criterion is structural — the hook body is
one `useMemo` over the seven inputs and `src/App.tsx` contains no `new Map` and no
`filter((r) => r.communityId ===` — plus the e2e suite, whose `dashboard.spec.ts` asserts
community scoping with 84 assertions and is the strongest spec in the suite (ADR-0005 is the
decision that introduced the invariant).

### C26 — The split and tournament flow move out of the shell

This is the last and largest extraction, and the one that reaches the under-400 target. Six
files are created — the flow hook, the roster screen, the app chrome, the preferences hook, the
toasts hook and the toasts component; `src/App.tsx` is left as composition.

**1. `src/shell/useSplitFlow.ts`** exports the frozen `SplitSource`, `splitFlowRule`,
`rerollPool`, plus the hook that owns the flow's state and handlers.

```ts
export type SplitSource = "ad-hoc" | "tournament" | "session" | "squad";

/** Whether a mutation in the split flow persists, by source (FLOW §2 rules 3–4, ADR-0004). */
export function splitFlowRule(source: SplitSource): {
  persistsSession: boolean;   // true only for "ad-hoc"
  submitsTournament: boolean; // true only for "tournament"
  isSynthetic: boolean;       // true for "session" | "squad"
};

/** The pool a re-roll may draw from: the session's own pool, not the current teams. */
export function rerollPool(
  source: SplitSource, sessionPoolPlayerIds: Id[] | null, currentTeams: TeamAssignment[],
): Id[];   // sessionPoolPlayerIds when non-empty; otherwise flatten currentTeams
```

`splitFlowRule` returns `{ true, false, false }` for `ad-hoc`, `{ false, true, false }` for
`tournament`, and `{ false, false, true }` for both `session` and `squad`. Those four rows
replace the `if (setup.source === "ad-hoc")` persistence check inside `split()` and the
`view.source === "ad-hoc"` check inside `SplitScreen`'s `onPersistResult` call site
(`src/App.tsx:1185-1193`). The two synthetic sources are the ones a regression breaks
silently, so each gets its own test case.

`rerollPool` gives the re-roll pool rule — currently the bug Phase A03 fixes — a name and a
test. Its one caller is `src/session/SplitScreen.tsx`'s `reroll` (`:255-264`), which swaps its
inline pool expression for `rerollPool(source, session.poolPlayerIds, result.teams)`. That is
a single expression inside A03's region: C lands after A, the file is not restructured, and
the ticket states the constraint. Leaving `rerollPool` with no caller was rejected: this
phase exists to delete precisely that, and `noUnusedLocals` would not catch an unused export.

The hook:

```ts
export interface SplitFlowDeps {
  disciplines: Discipline[];
  disciplinesById: Map<Id, Discipline>;
  players: Player[];                 // community-scoped roster
  tournaments: Tournament[];         // community-scoped
  viewTournament: Tournament | null; // navigation-derived; owned by App
  activeCommunityId: Id | null;
  sessionStore: SessionStore;
  saveTournament: (t: Tournament) => Promise<void>;
  saveSquad: (s: SavedSquad) => Promise<void>;
  notify: (text: string, type?: "success" | "error" | "info") => void;
  pushView: (v: View) => void;
  resetTo: (v: View) => void;
  gotoHub: (mode: HubMode) => void;         // App's wrapper: resetTo + clears setup
  setTournamentPrefill: (p: { disciplineId: Id; teamCount: number } | null) => void;
}

export function useSplitFlow(deps: SplitFlowDeps): {
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
};
```

`SplitResult` stays reachable as a plain value: `SplitScreen` already receives
`session.result` and passes it out unaltered (`onPersistResult(result)`,
`onSaveSquad(name, result)`, `onSubmitTournament(result.teams)`). No share or export helper
needs to read hook state — it takes `(result, discipline, roster)` as props.

Regions that move into the hook, exactly: `MatchSetup` (`src/App.tsx:81-87`), `startMatch`
(`:238-267`), `togglePlayer`/`selectDiscipline`/`changeTeamCount` (`:269-285`), `split`
(`:287-317`), `consumeTeams` (`:318-358`), `recordResult` (`:359-363`), `undoLastResult`
(`:404-410`), `saveSquadFromSplit` (`:365-379`), `reSplitSquad` (`:381-393`),
`useSquadInTournament` (`:395-397`), `newTournamentFromSquad` (`:399-402`), plus the
`setup` state (`:145`), the `activeSplit` state C24 introduced, and the History reopen
handler (`:1207`). `toggleId` (`:89-90`) moves with it.

`consumeTeams`' guard is contractual and is preserved character-for-character, including its
message: Swiss needs `n >= 2 && n % 2 === 0`; single-elim needs `n === 2 || n === 4 || n === 8`;
series needs `n === 2`; a violation notifies
`` `Could not save: a ${tournament.format} bracket needs a supported number of teams (got ${n}).` ``
and builds no bracket.

**2. `src/shell/RosterScreen.tsx`** — the roster hub's markup, moved verbatim from
`src/App.tsx:976-1137` (162 lines): filter chips, the `+ Add Player` / `Import players` /
`Export` toolbar, the hidden file input, the player list with its bib stripes, both empty
states, and the "Split match" CTA. Props are the values and handlers it already closes over:
`activeCommunity`, `disciplines`, `players` (scoped), `visiblePlayers`, `filterIds`,
`disciplinesById`, `editingPlayer`, `fileInputRef`, `onToggleFilter`, `onClearFilters`,
`onAddPlayer`, `onOpenPlayer`, `onImportFile`, `onExport`, `onSplitMatch`, and — once C27 lands
— `lastReport` and the `pendingMerge` confirm state. The import/export I/O itself stays in
`src/App.tsx` at this point (C26), because it needs the store handles and the `Community` it
imports into; C27 moves it into `src/shell/usePlayerImport.ts`, which is where `lastReport` and
`pendingMerge` come from.

**3. `src/shell/AppChrome.tsx`** — the rail, topbar, toast container and bottom nav, moved
from `src/App.tsx:777-922` and `:1257-1279`. Carries `NAV_ITEMS`, the community switcher
(including its delete confirm), the ✚/⚙ controls, the settings popover, and the
`.toast-container` with its `aria-live="polite"` region, which does not change.
**It owns its own transient chrome state** — the open community menu, the open settings
popover, the add-community form, and the community-name input — because those toggles have no
reader outside the chrome (`showCommunityMenu` is read at `:840`, `:864`, `:867`;
`showSettings` only in the popover; `communityName` only in the form and `createCommunity`).
That is what keeps `App.tsx`'s hook count honest rather than relocated. Its props are therefore
data and callbacks only: `layout`, `railPref`, `onToggleRail`, `viewStack`, `onGotoHub`,
`communities`, `activeCommunity`, `onSelectCommunity`, `onDeleteCommunity`,
`communityDeleteWarning`, `onCreateCommunity(name)`, `themePref`, `layoutPref`, `onThemeChange`,
`onLayoutChange`, `toasts`.

**4. `src/shell/useToasts.ts` and `src/ui/Toasts.tsx`** — the toast state and its renderer,
lifted verbatim from `src/App.tsx:162-171` and `:1257-1262`:

```ts
export type ToastType = "success" | "error" | "info";
export function useToasts(): {
  toasts: Array<{ id: string; text: string; type: ToastType }>;
  notify: (text: string, type?: ToastType) => void;
};
```

`notify` keeps today's exact behaviour — `crypto.randomUUID()` id, appended, removed after
3000 ms — and `useToasts` memoises it with `useCallback` so it can be a stable dependency for
C27's handlers. `Toasts` renders the existing `.toast-container` / `.toast toast--${type}` /
`role="status"` markup unchanged. This is the shared toast seam Phase D's share sheet should
call, and it is why C26 lands before C27: the two hooks are the same two hooks.

**5. `src/shell/usePreferences.ts`** — `useStoredPref` (`:93-110`) and `useMediaQuery`
(`:112-121`) move out unchanged.

After C26, `src/App.tsx` holds: the six store handles, `loadError`, preferences
(`useStoredPref` ×3, `useMediaQuery` ×2), navigation, the community scope call, the split flow
call, `viewTournament`, and the state that has a reader inside the shell's own JSX —
`tournamentPrefill` (`:147`), `filterIds` (`:148`), `editingPlayer` (`:171`),
`downloadingId` (`:503`) — plus C27's `usePlayerImport` hook for the import path. That is **4 `useState` call sites in
`App.tsx` itself** (the budget below), because the chrome's four toggles moved into `AppChrome`
and the toasts into `useToasts`. It also holds community CRUD, export/import,
discipline save/delete, the sample download, the discipline filter handlers,
`createTournament`/`openTournament`/`deleteTournament`/`deleteTournamentFromUI`, the small
entry-point helpers, and one JSX block that composes `AppChrome` with a switch over `view.mode`.
Estimated 330–390 lines; the target is **under 400, measured as `wc -l src/App.tsx`**, and each
of C24/C25/C26 states its own interim ceiling so a stalled extraction is visible.

The `useState` budget, stated so a stalled extraction is visible rather than discovered.
Measured: `grep -c "useState(" src/App.tsx` → **13 call sites** (2 in the module-level
`useStoredPref`/`useMediaQuery` helpers at `:94` and `:113`; 11 in the component body at `:140`,
`:146`, `:147`, `:148`, `:158`, `:159`, `:160`, `:161`, `:162`, `:171`, `:503`). The audit and
the roadmap both say 14; the count moves with `useStoredPref`'s three call sites, and 13 is the
measured number. The budget is on call sites inside `src/App.tsx`:

| After | Call sites in `App.tsx` | Which |
|---|---|---|
| HEAD | 13 | as listed above |
| C24 | 12 | `viewStack` (`:140`) → `useNavigation`; `activeSplit` replaces the removed `view.session` payload |
| C25 | 12 | scoping adds no state |
| C26 | **4** | both helper hooks (`:94`, `:113`) → `usePreferences`; `setup` (`:146`) + `activeSplit` → `useSplitFlow`; the four chrome toggles (`:159`–`:161`, plus `communityName` at `:158`) → `AppChrome`; `toasts` (`:162`) → `useToasts`. Left: `tournamentPrefill`, `filterIds`, `editingPlayer`, `downloadingId` |
| C27 | **4** | `pendingMerge` is a `useState` inside `usePlayerImport`, not in `App.tsx` |

**Guarded by the e2e suite, no spec edited.** `saved-squad.spec.ts` is the end-to-end spec for
this flow (save from split → list → use in tournament) and is the real acceptance test.

Unit test `src/shell/split-flow.test.ts`: `splitFlowRule` for all four sources; `rerollPool`
returning the session pool when supplied; `rerollPool` returning the current teams when the
session pool is `null` or empty; `rerollPool` including a player who is not in any current
team (the sat-out case).

### C27 — Failures and confirmations speak the app's language

**10 `alert()` → `notify`.** Every one is in the player-import path except the last:

| Line | Text | Toast type |
|---|---|---|
| `src/App.tsx:431` | `` `Import failed: ${…}` `` | `error` |
| `:528` | "That file is not valid JSON." | `error` |
| `:532` | "That JSON file does not contain a recognizable roster." | `error` |
| `:544` | "Pick or create a community before importing a player file." | `error` |
| `:562` | `` `Imported ${n} player… into ${activeCommunity.name}.` `` | `success` |
| `:565` | "That JSON file is not a recognized roster or backup." | `error` |
| `:571` | "Pick or create a community before importing a CSV." | `error` |
| `:608` | `` `Imported ${n} player…` `` | `success` |
| `:610` | `` `Import failed: ${…}` `` | `error` |
| `:714` | `` `Validation failed: ${…}` `` | `error` |

Every sentence is preserved. One joiner changes and only one: `:714`'s message list is
`join('\n')` today, and a toast is a single inline paragraph, so it becomes `join("; ")`.
That is the whole copy delta, and the ticket records it. The two count-reporting calls become
`success`, the guards and failures `error`, which matches the two types `notify` already
distinguishes (`src/index.css:2832-2845`).

**7 `window.confirm()` → an in-app two-step.** The precedent is `TournamentScreen`'s delete:
a `deleteConfirm` boolean swaps the button row to `Cancel` + `Delete tournament`
(`src/tournament/TournamentScreen.tsx:245`, `:376-408`), all inside `.bar`, with no modal and
no focus move. Seven hand-rolled copies of that boolean is worse than the dialogs, so the
pattern becomes one primitive:

```tsx
// src/ui/Modal.tsx's sibling: src/ui/ConfirmButton.tsx
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
}
export function ConfirmButton({ label, confirmLabel, message, onConfirm, className = "btn btn-ghost" }: Props) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return <button type="button" className={className} onClick={() => setConfirming(true)}>{label}</button>;
  }
  return (
    <>
      {message && <span className="status-msg">{message}</span>}
      <button type="button" className="btn btn-ghost" onClick={() => setConfirming(false)}>Cancel</button>
      <button type="button" className="btn btn-danger-ghost" onClick={() => { setConfirming(false); onConfirm(); }}>{confirmLabel}</button>
    </>
  );
}
```

It reuses two classes that already exist — `.status-msg` (`src/index.css:2751`) and the
`btn-danger-ghost` / `btn-ghost` pair the precedent uses — so `src/index.css` does not change.
It is a fragment on purpose: each site drops it into the `.bar` or row it already has, so the
confirm controls appear where the idle button was and keyboard focus stays in the region.
Nothing traps focus, nothing sets `aria-modal`.

Sites, keeping the existing warning copy verbatim:

| Line | Action | Copy kept |
|---|---|---|
| `src/domain/DisciplineEditModal.tsx:156` | delete discipline | `` `Delete discipline "${name}"? Players with capabilities in it will still have those ratings, but the discipline won't be available for splitting.` `` |
| `src/roster/PlayerEditModal.tsx:143` | delete player | `` `Delete player "${name}"?` `` |
| `src/session/SquadsScreen.tsx:100` | delete the open squad | `` `Delete "${open.name}"? Tournaments that used it keep their teams.` `` |
| `src/session/SquadsScreen.tsx:174` | delete a row's squad | same copy, row variant |
| `src/session/HistoryScreen.tsx:97` | delete a session | "Delete this session?" |
| `src/App.tsx:866` | delete the active community | `` `Delete "${name}"?${warning}` `` where `warning` is `communityDeleteWarning` (`:635-647`) |
| `src/App.tsx:449` | confirm the import merge | the five-count sentence, unchanged |

The community case changes one thing deliberately: today the menu closes
(`setShowCommunityMenu(false)`) *before* the native dialog, because a native dialog survives
it. With an inline confirm the menu must stay open while the user decides, so the two-step
lives inside the menu and the menu closes when the delete is confirmed. That is a behaviour
change, it is strictly better, and the ticket says so.

**The import path moves into its own hook.** Both the merge confirm (`:449`) and the whole
CSV/JSON branch (`src/App.tsx:515-614`, 100 lines — the largest block then left in `App.tsx`)
move to `src/shell/usePlayerImport.ts`:

```ts
export function usePlayerImport(deps: PlayerImportDeps): {
  /** The merge confirm's pending state; null when nothing awaits a decision. */
  pendingMerge: { counts: Record<string, number>; apply: () => Promise<void> } | null;
  confirmMerge: () => void;
  cancelMerge: () => void;
  /** The last import's outcome, for the roster screen's panel. Null before the first import. */
  lastReport: { imported: number; skipped: { line: number; reason: string }[] } | null;
  importFile: (file: File) => Promise<void>;
};
```

`RosterScreen` renders the two-step from `pendingMerge` (message + Cancel + "Import") and keeps
the hidden `<input type="file">`. The copy and the merge semantics — add only new ids, never
overwrite — are unchanged. Phase A's A08 supplies the parse internals
(`src/data/player-import.ts`); this hook consumes whatever A08 returns, and `lastReport` is the
field Phase D's D36 renders in the roster panel.

**Throws that reach React.** `applyResult` and `undoLastGame` throw by design
(`src/tournament/bracket.ts:252-289`), and neither `recordResult` nor `undoLastResult` wraps
them; the frontier guard is reachable from two tabs on one tournament, so a rejected
recording is currently an unhandled rejection. Both wrap their call and
`notify(err.message, "error")` — the throw already carries the user-readable message
("That match isn't ready to record: its teams aren't decided yet."), so nothing is invented.

**Silence on write failure.** Two writes are swallowed on purpose and now speak:
`split()`'s ad-hoc Session write (`src/App.tsx:310-314`, "Non-fatal: still show the split if
persistence failed") keeps showing the split and adds
`notify("Your split wasn't saved to History.", "error")`; the legacy-adoption effect
(`:222-236`) adds a `.catch` to both `void` writes that notifies once, guarded by a ref, so
a repeatedly-failing write cannot emit a toast per render. `SplitScreen`'s inline
"This arrangement wasn't saved." stays as it is — that is the pattern, already correct.

### C28 — The shared breadcrumb and page header are actually used

`src/nav.tsx`'s `Breadcrumb` becomes the one shape, and its markup is rewritten to emit
exactly what the three hand-rolled copies emit, so nothing shifts:

```tsx
export interface Crumb { label: string; go?: () => void; }

export function Breadcrumb({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <div className="breadcrumb">
      {crumbs.map((c, i) => (
        <Fragment key={c.label}>
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

The separator is a flex sibling of the labels — the same three children
`.breadcrumb { display: flex; gap: 6px }` (`src/index.css:2847-2865`) is laying out today —
which is why a `go`-less crumb is a plain `<span>` and not a link: a crumb that does not
navigates is not announced as one. `Crumb`'s `go` is optional, so the same component works at the
one call site where there is no previous screen (the Landing Page's hero passes
`onBack={undefined}` to `SplitScreen`).

Replacements, three hand-rolled blocks removed:

| File | Lines | Crumbs |
|---|---|---|
| `src/session/MatchScreen.tsx` | `:41-45` | `Roster` (go: `props.onBack`) / `Match setup` |
| `src/tournament/TournamentScreen.tsx` | `:263-269` | `Games` (go: `onBack`) / `{tournament.name}` |
| `src/session/SplitScreen.tsx` | `:292-297` | source-dependent, below |

`SplitScreen`'s crumb is the dead link and is fixed by the same change. Its first crumb is
derived from data it already has, matching the labels its own back button uses
(`src/session/SplitScreen.tsx:375`) and FLOW §3's destination table:

| `source` | Crumb above the current screen | `go` |
|---|---|---|
| `ad-hoc`, `tournament` | `Match setup` | `onBack` |
| `session` | `History` | `onBack` |
| `squad` | `Squad detail` | `onBack` |

There is no match-setup screen beneath a `session` or `squad` split, so "Match setup" was
wrong for those two sources as well as inert for all four. With `onBack` undefined the crumb
renders as text, which is correct on the Landing Page.

`src/ui/PageHeader.tsx` is rendered by seven screens (`DashboardScreen`, `DisciplinesScreen`,
`HistoryScreen`, `MatchScreen`, `SquadsScreen`, `GamesScreen`, `TournamentScreen`) plus the
roster screen that `App.tsx` renders, and its `crumbs` prop already accepts the shared
component; `MatchScreen` and `TournamentScreen` pass crumbs through it, `SplitScreen` keeps
its own `.breadcrumb` div because it does not use `PageHeader` at all. `src/ui/Screen.tsx` is
rendered by five screens (`DashboardScreen`, `DisciplinesScreen`, `HistoryScreen`,
`MatchScreen`, `SquadsScreen` — twice in the last) plus `App.tsx`. Both are left as they are —
the unused primitive was `Breadcrumb` (`src/nav.tsx`, zero consumers, verified), and wiring it
is the deliverable.

**Cross-reference to B16.** `.scratch/app-correctness/06` planned to reconcile FLOW §3 by
recording that breadcrumbs *do not* navigate. Landing this ticket makes the contract true
instead of codifying the gap — the code was wrong and the document was right. B owns
`docs/FLOW.md`; C28 must not edit it, so if B16 lands first and writes the "do not navigate"
line, C28's ticket records that the line must be removed by whoever owns the file next.

### C29 — Each document loads only what it needs

Baseline to compare against, measured (`dist/`, from the audit findings):

| Asset | Bytes | Loaded by |
|---|---|---|
| `index-B-AfBoP4.js` (shared) | 213,023 | **both** documents |
| `app-LNkAbv9g.js` | 105,487 | `dist/app/index.html` |
| `landing-BHu6e1_i.js` | 11,614 | `dist/index.html` |
| `index-CgrHkb71.css` | **47,834** | **both** documents |
| `landing-CJvxMLgK.css` | 15,207 | `dist/index.html` |

Two distinct problems.

**1. The Landing Page loads the app's stylesheet.** `src/landing.tsx:7` imports `./index.css`,
so `dist/index.html` links both sheets. The fix is a third stylesheet,
`src/split.css`, holding the rules `SplitScreen` and the shared primitives it renders need,
imported by both consumers:

```css
/* src/index.css */
@import "./tokens.css";
@import "./split.css";

/* src/landing.css */
@import "./tokens.css";
@import "./split.css";
```

and `src/landing.tsx` stops importing `./index.css` entirely, so the Landing Page links only
`tokens.css` + `split.css` + `landing.css`, all of which Vite merges into one
`landing-*.css` for that entry.

The membership rule is decidable, not a guess: **a rule moves to `split.css` iff every selector
in it is reachable from `SplitScreen`'s rendered subtree or from a primitive that subtree
renders.** Measured against the shipped sheet, that is **110 rules / 14,095 bytes** — 23 % of
`src/index.css`'s 60,902 bytes — made of two disjoint groups: the 46-rule shared kit and the 64
rules of the split region `src/index.css:1950-2359`. The kit is `.screen`, `.kicker`, `.bar`,
`.btn`, `.btn-primary`,
`.btn-ghost`, `.btn-danger-ghost`, `.badge`, `.badges`, `.badge--{a..e}`,
`.badge--{futsal,mlbb,generic}`, `.num`, `.empty`, `.empty .big`, `.empty p`, `.empty .actions`,
`.load-error`, `.load-error strong`, `.field-label`, `.input` and its `::placeholder`,
`:focus-visible`, `.flags`, `.flag`, `.sep`, `.breadcrumb`, `.breadcrumb a`,
`.modal-overlay`, `.modal-card`, `.modal-card .bar`, `.modal-close`, `.modal-title`,
`.modal-section`, `.modal-section-hint`, and `.btn.small` — all 6,187 bytes. The split region is
64 rules / 7,908 bytes: `.pitch`, `.team`, `.team .tname`,
`.tname`, `.tname-label`, `.tname-avg`, `.team .avg`, `.team li*`, `.mid`, `.mid .tag`,
`.vs`, `.tag-gap`, `.scale`, `.scale .track`, `.scale .tick`, `.scale .pivot`, `.scale .num*`,
`.needle`, `.needle.balanced`, `.readout`, `.readout .fine`, `.team-stack`, `.split-screen`,
`.split-head`, `.split-head-meta`, `.swap-banner`, `.swap-banner-icon`, `.player-head`,
`.player-name`, `.player-overall`, `.player-ratings`, `.player-row`, `.rating-cell`,
`.rating-dots`, `.rating-label`, `.role`, `.pivot`, the `.team li.swappable*` /
`.team li.picked` variants, and the deal-in transition block. The two sets share **zero** selectors, verified by set difference
over the 431 parsed rules. The `.modal-card` / `.modal-title` overrides in the
`@media (min-width: 768px)` block (`src/index.css:1652-1663`) move with the kit.

`src/index.css` keeps the other 321 rules / 46,807 bytes, which is what the Landing Page stops
downloading.

Also deleted while in there: `src/landing.css:535` declares
`animation: pulse-needle 2.4s … infinite` and `@keyframes pulse-needle` is defined **nowhere
in the repository** — not in `landing.css`, not in `index.css`, whose only keyframes are
`@keyframes pulse` (`:327`). The declaration has never had an effect, so it and the
now-dead `animation: none` override at `:551` are removed. No spec asserts the needle's
animation (`grep -n "needle" e2e/tests/landing/landing.spec.ts` → no matches), and removing a
declaration that resolves to nothing changes no pixel.

**2. The solver and the hero are, legitimately, shared.** `src/landing.tsx:2-6` imports
`SplitScreen`, `SplitDeal`, `MLBB_DISCIPLINE` and `freshSplit`, and the hero *renders
`SplitScreen` over real solver output* — `e2e/tests/landing/landing.spec.ts` asserts
`#landing-hero .split-screen` and `.pitch` are visible and that the gap meter reads real
numbers. So the solver cannot leave the Landing Page's graph, and the 213 kB shared chunk is
not an accident: it is React + ReactDOM + the split screen + the solver, all of which both
documents genuinely use. What C29 guarantees is the part that is not legitimate — the
Landing Page loading the app's *stylesheet*. `dist/index.html` already does **not** link
`app-LNkAbv9g.js`; verified from the built output, so the JS half of the roadmap's exit
criterion already holds and the ticket says so rather than claiming a change it did not make.

**3. The `sample-data` warning.** `useDisciplines.ts:3` imports statically what
`App.tsx:507` imports dynamically, so Rollup refuses to split and the two roster JSONs
(11,122 B + 11,444 B) ride in `app-LNkAbv9g.js` — confirmed by finding the roster name
"Kairi" there once and in no other chunk. The module splits at its real seam — "which sample
data exists" versus "fetch the sample data". The registry holds no JSON, so importing it
statically pulls nothing; the loader owns both JSON imports and is reached only through
`await import(...)`.

```ts
// src/data/sample-registry.ts — no JSON imports, safe to import statically
export const SAMPLE_DISCIPLINE_IDS: readonly string[] = ["mlbb", "futsal"];
/** Built-in ids, plus any discipline registered at runtime by addSampleData. */
export function hasSampleData(disciplineId: string): boolean;
export function addSampleData(disciplineId: string, jsonText: string): void;
export function listDisciplinesWithSampleData(): string[];
export function detectDisciplineFromSampleData(text: string): string | null;
export function autoGenerateSampleData(discipline: Discipline): string;
/** The registered text for a custom discipline, or null for a built-in one. */
export function generatedSampleData(disciplineId: string): string | null;
```

```ts
// src/data/sample-data.ts — owns both JSON imports; reached only dynamically
/** The roster JSON for a discipline: the built-in asset, else the registered text. */
export async function loadSampleData(disciplineId: string): Promise<string | null>;
export async function getSampleDataInfo(disciplineId: string): Promise<{ fileName: string; playerCount: number } | null>;
export async function getSampleDataUrl(disciplineId: string): Promise<string | null>;
export async function downloadSampleData(disciplineId: string): Promise<void>;
```

`loadSampleData` resolves a built-in id with
`await import("../../sample-data/mpl-id-roster.json")` from a per-discipline map, and falls
back to `generatedSampleData(id)` for a custom one. `getSampleDataInfo` needs the parsed text,
so it calls `loadSampleData` first — which is why it changes signature too.
`src/domain/useDisciplines.ts` changes one import path to `./sample-registry`; nothing else
in it moves. Each roster JSON becomes its own lazily-fetched asset, the warning disappears
because nothing statically imports `sample-data.ts`, and 22.6 kB of esports roster names stops
shipping to every user.

Four functions become async; the registry's six stay synchronous. The test edits are
enumerated: `src/data/sample-data.test.ts`'s `hasSampleData`, `listDisciplinesWithSampleData`
and `autoGenerateSampleData` blocks only change their import path (they test registry
functions); the `getSampleDataInfo` assertions (`:24-34`) and the two URL assertions
(`:36-42`) become `await`ed; `downloadSampleData` (`:45-49`) becomes awaited, and its
`vi.stubGlobal("document", …)` stub needs no change — the implementation reaches
`URL.createObjectURL` (real, under Node) and the stubbed `document.createElement`, both of
which the test already provides. `App.tsx`'s `downloadSampleData`
wrapper (`:504-514`) gains one `await`, inside a function that is already `async`. If the
diff grows past those five edits, the fallback is the one-line static import plus a recorded
note that the rosters ship with the app.

### C30 — Project hygiene: README, engine floor, node pin

`README.md` (none exists) is the front door for a human or an agent: what the product is and
who it is for, the two documents and the path split (ADR-0006), how to run it
(`npm install`, `npm run dev`, `npm run build`, `npm run preview`, `npm test`), how to run
the browser suite (`npm run e2e`, added by A10, and the config lives in `e2e/` so a bare
`npx playwright test` finds nothing), the deploy target (`wrangler.jsonc`, a static-assets
Worker, chosen because the Cloudflare config is where the SPA fallback would otherwise
serve the Landing Page under `/app/`), and where the repo's own knowledge lives
(`CONTEXT.md` for the glossary, `docs/adr/` for decisions, `docs/agents/` for the tracker
conventions, `.scratch/` for tickets).

**Every command and path in the README must exist**, which is checkable, and it must not
describe D's work: no service worker, no offline promise, no account, no backend. The README
describes C's HEAD.

`package.json` gains an `engines` floor derived from the lockfile, not guessed:

| Package | Declared engine | Installed |
|---|---|---|
| `vite` | `^18.0.0 \|\| ^20.0.0 \|\| >=22.0.0` | 6.4.3 |
| `vitest` | `^18.0.0 \|\| ^20.0.0 \|\| >=22.0.0` | 3.2.7 |
| `@playwright/test` | `>=20` | 1.62.1 |
| `@napi-rs/lzma-linux-x64-gnu` (rollup optional, installed) | `^22.20 \|\| ^24.12 \|\| >=25` | 1.5.1 |
| `@types/node` | none (types only) | 22.20.1 |

The intersection of the constraints that are actually enforced at install time is
`>=22.20 <23 || >=24.12`, so:

```jsonc
"engines": { "node": ">=22.20 <23 || >=24.12" }
```

This excludes the 23.x and 24.0–24.11 ranges that the installed native optional dependency
refuses, while admitting both the 22.20+ line and current 24.x. `npm` is deliberately not
pinned: no script invokes it beyond the documented `npm run …` aliases.

`.nvmrc` pins `24.16.0` — the version this repo was last verified green on (`node -v`).
Developer dependency floors are React 19.1, TypeScript 5.8, Vite 6, Vitest 3, Playwright 1.62
and `@types/node` 22.15 as declared in `package.json`; the README's requirements section
states the Node floor and nothing it cannot verify.

## Acceptance criteria

Every command runs from the repository root. "The suite" is
`npx playwright test --config=e2e/playwright.config.ts`, which A01/A02 leave green.

1. **Dead code is gone.**
   `grep -rn "split-module\|tournament-domain-fix\|team-participation-validator" src/ e2e/`
   → no output.
   `grep -rn "export function validateTournamentSpec" src/` → exactly 1 line.
   `grep -rn "validateTeamParticipation" src/` → no output.
   `grep -rn "Re-split is locked" src/` → no output.
2. **The compiler sees dead code.** `tsconfig.app.json` contains `"noUnusedLocals": true`, and
   both `npx tsc -b` and `npx tsc -p tsconfig.app.json --noUnusedLocals --noEmit` print
   nothing and exit 0 (baseline today: 19 findings).
   `grep -rn "void [a-zA-Z]*;\|@ts-ignore" src/` → no output.
3. **One definition per shared constant.**
   `grep -rc "const BIB\|const FORMAT_LABEL\|const STATUS_LABEL" src/` → exactly one file
   (`src/ui/constants.ts`) with 3.
   `grep -rn "function relativeTime" src/` → exactly 1 line.
   `grep -rn "modal-overlay" src/ -l` → `src/ui/Modal.tsx` plus the five call sites' JSX
   unchanged in class names (verified by `git diff --stat src/index.css` being empty).
4. **`src/App.tsx` is under 400 lines and holds no navigation, scoping, or flow rules.**
   `wc -l src/App.tsx` → **less than 400**.
   `grep -rn "communityId ===" src/App.tsx` → no output.
   `grep -c "new Map" src/App.tsx` → 0.
   `grep -c "useMemo" src/shell/useCommunityScope.ts` → at least 1.
   `grep -rn "useState<View\[\]>\|const pushView\|const goBack" src/App.tsx` → no output.
5. **The three frozen modules exist with the frozen exports.**
   `grep -n "export function useNavigation\|export type View\|export type HubMode" src/shell/useNavigation.ts`
   → 3 lines; likewise `export function useCommunityScope` in `src/shell/useCommunityScope.ts`
   and `export function splitFlowRule\|export function rerollPool\|export type SplitSource` in
   `src/shell/useSplitFlow.ts`.
6. **Every extraction has its own test.** `npx vitest run` passes and includes
   `src/shell/navigation.test.ts`, `src/shell/community-scope.test.ts`,
   `src/shell/split-flow.test.ts` and `src/ui/format.test.ts` (four new files; the `.ts`
   extension is required — `vite.config.ts` sets `test.include: ["src/**/*.test.ts"]`, so
   `.tsx` is excluded from the unit harness and an extracted hook must be `.ts` to be
   testable at all).
7. **No native dialog remains.** `grep -rn "alert(\|window.confirm(" src/` → no output.
   The toast region still reads `<div className="toast-container" aria-live="polite">` and
   each toast still carries `role="status"`.
8. **Everything the suite pinned still holds.** The browser suite passes with
   `git diff --stat e2e/tests` empty — in particular `saved-squad.spec.ts` (the split flow),
   `dashboard.spec.ts` (84 scoping assertions) and `landing.spec.ts` (16 tests, hero and
   tokens).
9. **Each document loads only what it needs.**
   `npm run build` completes with **zero warnings** (baseline: 1, the `sample-data` dynamic
   import).
   `grep -o 'assets/index-[A-Za-z0-9_-]*\.css' dist/index.html` → no output.
   `grep -c "Kairi" dist/assets/app-*.js` → 0, and the string appears in a new asset loaded
   only on demand.
   The Landing Page's CSS transfer drops by the 47,834 B of `index-CgrHkb71.css` it used to
   fetch; `dist/index.html`'s CSS links are `landing-*.css` only.
10. **The breadcrumbs navigate.**
    `grep -rn 'href="#"' src/` → no line whose handler is a comment or empty.
    `grep -rn "Breadcrumb" src/*.tsx src/**/*.tsx` → `src/nav.tsx` plus three consumers
    (`MatchScreen`, `TournamentScreen`, `SplitScreen`).
    Clicking `Match setup` on the split screen returns to match setup; clicking the last crumb
    does nothing because it is not a link.
11. **Hygiene exists and is true.** `test -f README.md`, `test -f .nvmrc`,
    `jq -e '.engines.node' package.json` → prints the range. Every command named in the README
    appears in `package.json` scripts; every path it names exists.
12. **The visual checks that already exist still pass**: `npm run capture:hero` reports its own
    verification green (it checks rendered text, fonts and overflow, and the PNG's
    non-blankness and bib colours) after C29's stylesheet move.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| A three-line crumb change and a one-expression re-roll change touch `src/session/SplitScreen.tsx`, which `contracts.md`'s ownership table lists for A and B only | Two phases writing one file; a merge that silently reverts A03's re-roll fix | Both edits are single, named regions (the crumb block; the re-roll pool expression), C lands after A, no other line of the file changes, and the ticket records the divergence. The e2e suite covers both. |
| The CSS partition moves a rule the hero needs, and only a browser notices | Landing Page renders subtly wrong; the suite may not catch every spacing regression | Membership is a stated rule (`split.css` iff every selector is reachable from `SplitScreen`'s subtree or its primitives), and the verification is behavioural: the 16 landing specs, `npm run capture:hero`'s own DOM/PNG checks, and a recorded before/after `getComputedStyle` diff of the hero subtree. |
| The `sample-data` split changes a sync API to async | Churn in `src/data/sample-data.test.ts` and the download handler | The registry keeps every synchronous function where it is; only `loadSampleData`/`downloadSampleData` become async, and the ticket lists each test edit. If it grows past those, fall back to the one-line static import and record that the 22.6 kB of rosters ships with the app. |
| Extracting the shell regresses a flow the suite is too weak to catch | Silent breakage in navigation | C runs only after A11 seeds the specs deterministically; C24, C25 and C26 each land green in sequence with no spec edited, and each states its own interim line ceiling on `App.tsx` so a stalled extraction is visible. |
| `noUnusedLocals` reports a cascade the ticket cannot pre-list (it already does: `systemDark` follows `effectiveTheme`) | A ticket that looks unfinished, or a rushed `void x;` to silence a finding | The method is stated: run the flag, resolve, re-run until clean. Deletion is the default; silencing is forbidden by an acceptance criterion and the Answer records each pass. |
| D's plan assumes `src/App.tsx` owns the roster entry UI and its import handler, which after C26/C27 live in `src/shell/RosterScreen.tsx` and `src/shell/usePlayerImport.ts` | D34/D36 edit a file they do not own, or name the wrong file | Resolved with Phase D during this wave: the roster entry UI is `src/shell/RosterScreen.tsx`, its import state is `usePlayerImport`'s `lastReport`/`pendingMerge`, and the tournament-submit team-count guard D35 extends is `consumeTeams` in `src/shell/useSplitFlow.ts`. Wave 2 reconciles the ownership table in `contracts.md`. |
| `src/index.css`'s computed-style assertions in e2e are the suite's most brittle surface | A CSS move fails tests for reasons unrelated to behaviour | C29 changes no declaration and keeps every class name; only the file each rule lives in changes, and the checks in acceptance criterion 12 target the rendered result. |
| B16 lands first and records the opposite of FLOW §3 | The document and the code disagree in the other direction | C28's ticket records that FLOW §3 is right and the code now satisfies it; the correction belongs to whichever phase owns `docs/FLOW.md` next. |

## Files

| Action | Path |
|---|---|
| Create | `docs/superpowers/specs/2026-09-17-shell-and-structure-design.md` (this file) |
| Create | `.scratch/debt/issues/21-delete-the-code-nothing-calls.md` |
| Create | `.scratch/debt/issues/22-let-the-compiler-catch-dead-code.md` |
| Create | `.scratch/debt/issues/23-one-definition-per-shared-constant.md` |
| Create | `.scratch/debt/issues/24-navigation-moves-out-of-the-shell.md` |
| Create | `.scratch/debt/issues/25-community-scoping-expressed-once.md` |
| Create | `.scratch/debt/issues/26-the-flow-moves-out-of-the-shell.md` |
| Create | `.scratch/debt/issues/27-failures-and-confirmations-speak-the-apps-language.md` |
| Create | `.scratch/debt/issues/28-the-breadcrumb-and-page-header-are-actually-used.md` |
| Create | `.scratch/debt/issues/29-each-document-loads-only-what-it-needs.md` |
| Create | `.scratch/debt/issues/30-project-hygiene.md` |
| Delete | `src/tournament/tournament-domain-fix.ts` |
| Delete | `src/session/split-module.ts` |
| Delete | `src/tournament/team-participation-validator.ts` |
| Create | `src/shell/useNavigation.ts` |
| Create | `src/shell/nav-items.ts` |
| Create | `src/shell/useCommunityScope.ts` |
| Create | `src/shell/useSplitFlow.ts` |
| Create | `src/shell/RosterScreen.tsx` |
| Create | `src/shell/AppChrome.tsx` |
| Create | `src/shell/usePlayerImport.ts` |
| Create | `src/shell/useToasts.ts` |
| Create | `src/ui/Toasts.tsx` |
| Create | `src/shell/usePreferences.ts` |
| Create | `src/shell/navigation.test.ts` |
| Create | `src/shell/community-scope.test.ts` |
| Create | `src/shell/split-flow.test.ts` |
| Create | `src/ui/constants.ts` |
| Create | `src/ui/format.ts` |
| Create | `src/ui/format.test.ts` |
| Create | `src/ui/Modal.tsx` |
| Create | `src/ui/ConfirmButton.tsx` |
| Create | `src/data/sample-registry.ts` |
| Create | `src/split.css` |
| Create | `README.md` |
| Create | `.nvmrc` |
| Modify | `src/App.tsx` (decomposition; 1,280 lines → under 400) |
| Modify | `src/landing.tsx` (drop `./index.css`) |
| Modify | `src/landing.css` (import `split.css`; delete the dead `pulse-needle` declarations) |
| Modify | `src/index.css` (import `split.css`; move the split and shared-kit rules out) |
| Modify | `src/nav.tsx` (one shared `Breadcrumb` shape) |
| Modify | `src/session/MatchScreen.tsx`, `src/tournament/TournamentScreen.tsx`, `src/session/SplitScreen.tsx` (render `Breadcrumb`; the crumb block and the re-roll pool expression only where C's ownership is narrow) |
| Modify | `src/domain/DisciplineEditModal.tsx`, `src/roster/PlayerEditModal.tsx`, `src/tournament/GamesScreen.tsx` (import shared constants; use `Modal`; two-step confirm) |
| Modify | `src/session/HistoryScreen.tsx`, `src/session/SquadsScreen.tsx` (import `relativeTime`; two-step confirm) |
| Modify | `src/DashboardScreen.tsx` (import shared constants) |
| Modify | `src/domain/useDisciplines.ts` (import `sample-registry`) |
| Modify | `src/data/sample-data.ts` (loader only) |
| Modify | `src/data/sample-data.test.ts` (async download; registry imports) |
| Communicate | `contracts.md`'s Phase D ownership row for `src/App.tsx` is stale after C26/C27 — the roster entry UI is `src/shell/RosterScreen.tsx`. Recorded in ticket 26 and the risk table; wave 2 updates the contract. |
| Modify | `tsconfig.app.json` (`"noUnusedLocals": true`) |
| Modify | `package.json` (`engines`) |
| Modify | `vite.config.ts` (only if the `split.css` import graph needs an entry adjustment; no other change) |

## Spec Self-Review

- **Placeholders.** None. Every ticket names its deliverable, every design paragraph names
  exact files, symbols, classes and line ranges, and every acceptance criterion is a command
  or an observed UI state. There is no "handle edge cases", no "similar to ticket N", no
  deferred decision.
- **Internal consistency.** The order C21→C22→…→C30 is stated once and justified once, and no
  ticket's "Blocked by" contradicts it. The relationships that could contradict each other are
  reconciled explicitly: C22's findings are re-derived *after* C21's deletions (which is why
  four of the nineteen never reach C22, and why a cascade appears); the frozen `View` drops
  `session`, so the session lives in `activeSplit` (C24) and then in `useSplitFlow` (C26); the
  frozen `useCommunityScope` input cannot build its own output, so one optional field is
  added; `rerollPool` is given its one real caller rather than shipping as an export nothing
  calls, which is what C21 exists to remove; the split screen's crumb labels match the back
  button's labels it already renders.
- **Scope check.** Ten tickets, each independently green, each with its own interim ceiling on
  `App.tsx`. The one ticket that grew past its absorbed original — C26, which must also move
  the roster screen, the chrome and the preference hooks to reach the under-400 criterion
  app-health/07 itself sets — says so in its own body and names the four files. Everything the
  phase deliberately does not do is listed under Out of Scope.
- **Ambiguity check.** "No spec edited" is scoped to the e2e suite (`e2e/tests/**`), which is
  where C's behaviour net lives; unit tests may change where a real API change requires it
  (C29's async download), and that ticket lists every such edit. "Green" means the suite
  passes with zero failures and no test file modified. The one intentional copy change (C27's
  `join('\n')` → `join("; ")`) and the one intentional behaviour change (C27's community menu
  staying open through the confirm) are both named rather than smuggled.
- **Fixes made inline during this review.** (1) `useCommunityScope`'s input/output mismatch was
  found while writing the contract block and resolved with an additive optional field, noted in
  the design and reported to Phase D. (2) The undefined `pulse-needle` keyframes were found
  while auditing `landing.css` for the CSS split and folded into C29 as a deletion instead of a
  new animation. (3) C26's reach was found to be larger than the loop it names: to hit the
  under-400 target it must also move the roster screen, the chrome, the preferences hook and the
  toasts, so the ticket says six files rather than three, and the `useState` budget is stated
  per ticket so a stalled extraction is visible. (4) Phase D's three integration questions
  (where the split action bar lives, where the roster import state lives, which file owns the
  bracket-count guard) were answered and written into C26/C27 rather than left to wave 2.
  (5) The absorbed tickets' numbers were corrected where measured: `noUnusedLocals` reports 19
  not 20; `PageHeader`/`Screen` have 7 and 5 consumers, not 4 each; `grep -c "useState("
  src/App.tsx` is 13, not the 14 the audit and the roadmap state; and `app-health/03`'s
  "different type spellings" is cosmetic, since the unions and values are identical.
