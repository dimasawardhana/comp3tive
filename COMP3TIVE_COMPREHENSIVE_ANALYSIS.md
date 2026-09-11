# Comprehensive Technical Analysis: comp3tive

> Generated: 2026-09-11 | Analyzed directory: `/home/dimasajiwardhana/Documents/code/team-builder`
> Project name derived from `package.json` (`"name": "comp3tive"`); the directory name
> (`team-builder`) is the app's pre-rename identity, preserved in the IndexedDB migration path
> (`src/storage/indexed-db.ts:17`).

## Executive Summary

comp3tive is a single-user, local-first web application that helps a casual sports organizer
split a group of players into fair teams and then run a small tournament on those teams. It is
a React 19 + Vite + TypeScript SPA with no backend, no authentication, and no network I/O at
runtime: all persistent state lives in one IndexedDB database (`comp3tive`, six object stores)
with `localStorage` used only for UI preferences and the active-community pin. The entire
runtime dependency surface is `react` and `react-dom` (`package.json`); there is no router, no
state library, no UI kit, and no CSS framework — navigation is a hand-rolled view stack in
`src/App.tsx`, and the roughly 3,000 lines of styling are hand-written CSS custom properties in
`src/index.css`.

The engineering center of gravity is unusually well placed for a project of this size. Two
pure, deterministic, dependency-free modules carry the domain: `src/solver/solver.ts` (687
lines) is a branch-and-bound exact solver over canonical set partitions that minimizes the
strength gap between teams while honoring role coverage and size constraints, and
`src/tournament/bracket.ts` (327 lines) is a single-elimination/Swiss/Series state machine
(`buildBracket`, `applyResult`, `undoLastGame`, `standings`, `champion`) that validates frontier
recording and re-settles downstream participants on every edit. Both are exhaustively
unit-tested — 1,600+ lines of Vitest across 12 spec files, including *brute-force ground-truth*
comparisons that prove the solver's gap is genuinely minimal for small pools
(`src/solver/solver.test.ts:117-133`). The spec documents explicitly chose this as the single
test seam (`docs/spec/0001-team-builder-v1.md`, "Testing Decisions"), and the implementation
honors that decision.

The weaknesses are concentrated in the shell and the boundary layers, not in the core. `src/App.tsx`
is 1,280 lines holding fifteen `useState` hooks, all navigation, all persistence orchestration,
and all rendering; three delete handlers bypass their data hooks and call the store directly
(`src/App.tsx:482`, `:762`, `:1209`), which leaves the in-memory list stale so a deleted row
remains visible until reload. Three modules are entirely dead — `src/tournament/tournament-domain-fix.ts`
(270 lines, a duplicate `validateTournamentSpec`/`validateTeamParticipation` pair never imported),
`src/session/split-module.ts` (48 lines, a documented "deep module" seam nothing calls), and
`src/data/samplePlayers.ts` (73 lines, referenced only by a test) — and `playwright-report/`,
`test-results/`, and `.scratch/` (28 tracked files) are committed despite being build/report
artifacts. The e2e suite is a mixed bag: 1,452 lines across 19 specs, of which three
`inspect*.spec.ts` files (147 lines) log HTML and assert nothing, one spec is `test.skip`, and
several are layout assertions on CSS computed styles rather than behavior.

Top three recommendations, in impact order: (1) decompose `App.tsx` — extract the view-stack
navigation and the split/tournament handlers into hooks, and route every mutation through its
data hook so the three stale-list deletes disappear; (2) delete the three dead modules and
untrack the report/scratch directories, which removes ~390 lines and 28 files of noise at zero
risk; (3) harden the import path — `parseBackup` validates only top-level record shapes
(`src/data/transfer.ts:52-100`), so a shaped-but-invalid capability can reach the store and then
throw inside `computeStrength` during render, and the import merge re-homes *players* to the
active community while leaving sessions and tournaments on their original community
(`src/App.tsx:455-460`), which can orphan records across communities.

## 1. Project Overview

### 1.1 Purpose & Scope

The product brief (`PRODUCT.md`) defines the user as the *organizer*, not the player: someone
running a futsal night, an MLBB ranked session, or a mini-tournament. The workflow is: create a
Community → build a roster of Players with per-Discipline Capabilities → pick who is present →
split them into N teams → optionally run a Tournament on those teams → revisit History. Success
is stated as "the organizer runs a session in under a minute from 'we have 10 people' to
'balanced teams on the court'" and "the split is defensible — every player can see *why* the
teams are fair."

Explicitly out of scope for v1 (`PRODUCT.md`, `docs/spec/0001-team-builder-v1.md`): auth,
multi-user sync, mobile apps, external roster import from contact lists or chat apps,
real-time scoreboard, cross-tournament statistics, role-complete single-team mode, and double
elimination. The spec is honest that the consequence of the client-only decision is that "local
data must be migrated when a backend lands" and that JSON export/import *is* that migration path
(`docs/adr/0001-client-only-first.md`).

Two shipped features have moved past their original spec: Saved Squads (a curated, named split
artifact, `docs/adr/0003-saved-squads.md`, not in spec 0001) and the Dashboard-first landing hub
(`docs/adr/0005-dashboard-first.md`, which also fixed a cross-community leak in History/Games).
`IMPLEMENTATION_PLAN.md` and `DOMAIN_MODEL.md` sit in the repo root as generated planning
artifacts; both describe work that has since shipped and both drift from the code (see §4.5).

### 1.2 Repository Structure

```
team-builder/
├── src/                        9,339 lines of TS/TSX (see Appendix A)
│   ├── App.tsx                 1,280  application shell: view stack, all state, all orchestration
│   ├── DashboardScreen.tsx       273  Home hub: stat cards, teasers, primary CTA
│   ├── dashboardTeasers.ts        29  pure teaser selection (recent players / active tournaments)
│   ├── nav.tsx                    32  Breadcrumb component (largely bypassed — see §5.1)
│   ├── solver/solver.ts          687  ★ exact fair-split solver (the spec's single test seam)
│   ├── tournament/
│   │   ├── bracket.ts            327  ★ bracket/Swiss/Series state machine
│   │   ├── TournamentScreen.tsx  537  tournament detail: draft / review / bracket / results
│   │   ├── GamesScreen.tsx       398  tournament list + create modal
│   │   ├── tournament-validation.ts 68  spec validation (team count per format)
│   │   ├── tournament-domain-fix.ts 270 DEAD — never imported
│   │   ├── team-participation-validator.ts 97 used only for community checking
│   │   └── useTournaments.ts      51  store-backed hook
│   ├── session/
│   │   ├── SplitScreen.tsx       419  split result: cards, gap meter, swap, re-roll, save
│   │   ├── MatchScreen.tsx       195  pool selection, discipline, team-count stepper
│   │   ├── HistoryScreen.tsx     110  session log
│   │   ├── SquadsScreen.tsx      195  saved squad list + detail
│   │   ├── edit.ts               117  swapPlayers / recomputeResult / freshSplit (pure)
│   │   ├── flow.ts                61  capabilityFor / strengthOf / teamName / describeFlags
│   │   └── split-module.ts        48  DEAD — documented seam nothing calls
│   ├── storage/
│   │   ├── indexed-db.ts         337  one DB, six stores, legacy rename migration
│   │   ├── types.ts               47  six store interfaces (the ADR-0001 seam)
│   │   └── memory.ts              75  in-memory stores for tests
│   ├── domain/
│   │   ├── types.ts              195  all domain types
│   │   ├── validation.ts          71  player/capability invariants
│   │   ├── strength.ts            36  the "mean" strength model + dispatcher
│   │   ├── seed.ts                52  Futsal + MLBB seed disciplines
│   │   ├── community-removal.ts   79  community cascade delete
│   │   └── useCommunities.ts     115  community hook (captures 5 stores)
│   ├── data/
│   │   ├── transfer.ts           156  backup serialize/parse (v1→v4)
│   │   ├── sample-data.ts        121  sample roster registry + generator
│   │   └── samplePlayers.ts       73  test-only fixture
│   ├── roster/                   389  roster hook + player edit modal
│   └── ui/                        43  Screen + PageHeader primitives
├── e2e/                        1,452 lines of Playwright specs (19 files) + 2 page objects
├── docs/                       spec/ (2), adr/ (5), design.md, FLOW.md, agents/, superpowers/
├── sample-data/                futsal-roster.json, mpl-id-roster.json (25 players each)
├── prototype/index.html        superseded visual prototype (kept as history)
├── .scratch/team-builder/      issue tickets + spec.md (tracked in git)
├── playwright-report/          committed HTML report (507 KB) + data/
├── test-results/               committed Playwright run state
├── CONTEXT.md                  the domain glossary (the vocabulary contract)
├── DOMAIN_MODEL.md             planning artifact, drifts from the code
├── IMPLEMENTATION_PLAN.md      planning artifact, describes shipped work
├── DESIGN.md / docs/design.md  "Paper & Pencil" design tokens + rationale
├── PRODUCT.md, FLOW.md         product brief and the navigation contract (FLOW.md is normative)
└── index.html, vite.config.ts, tsconfig*.json, package.json, package-lock.json
```

### 1.3 Technology Stack

| Layer | Choice | Version | Notes |
|---|---|---|---|
| UI | React + ReactDOM | ^19.1.0 | `StrictMode` enabled (`src/main.tsx`); no router, no state lib |
| Language | TypeScript | ^5.8.0 | `strict`, `noUnusedParameters`, `verbatimModuleSyntax`, `noFallthroughCasesInSwitch` (tsconfig.app.json) |
| Build | Vite | ^6.3.0 | `@vitejs/plugin-react`; `build` = `tsc -b && vite build` |
| Unit tests | Vitest | ^3.1.0 | `environment: "node"`, `include: ["src/**/*.test.ts"]` (`vite.config.ts`) |
| Storage faking | fake-indexeddb | ^6.2.5 | `import "fake-indexeddb/auto"` in storage specs |
| E2E | Playwright | ^1.62.1 | `testDir: ./tests`, `workers: 1`, `webServer` = `npm run preview` on :4173 |
| Persistence | IndexedDB (native) | DB v6 | one database, six object stores, no ORM |
| Preferences | localStorage | — | `tb-community`, `tb-theme`, `tb-layout`, `tb-rail` |
| Fonts | Google Fonts CDN | — | Outfit + Familjen Grotesk, loaded in `index.html` (a network dependency; see §8) |
| Lint/format | none | — | No ESLint, Prettier, or editor config present |

Notably absent: any CI configuration. There is no `.github/` directory, no `Jenkinsfile`, no
`Makefile`, and no test/coverage config beyond the Vitest block in `vite.config.ts`. Verification
is manual (`npm test`, `npm run build`, `npx playwright test`).

## 2. Architecture

### 2.1 High-Level Architecture

comp3tive is a **single-page, client-only monolith with a layered core**: pure domain modules
at the bottom, store adapters in the middle, React components on top, and one shell component
that owns navigation and orchestration. The layering is enforced by convention and by the
storage interface (`src/storage/types.ts`), which is the ADR-0001 seam that would let a backend
replace IndexedDB without touching callers.

```
                         ┌──────────────────────────────────────────┐
                         │  src/App.tsx  (1,280 lines)              │
                         │  view stack · all state · all handlers   │
                         │  · community-scoping filters             │
                         └───────┬──────────────────────┬───────────┘
              props (≈15 callbacks per screen)          │ store writes
                                 │                      │
   ┌──────────────┬──────────────┼──────────────┬───────┴────────────┐
   ▼              ▼              ▼              ▼                    ▼
Dashboard    TournamentScreen  SplitScreen   MatchScreen     History / Squads /
Screen       GamesScreen       (+ TeamCard,  (pool select,   Disciplines screens
             (+ BracketView,    GapMeter,     stepper)        (pure presentational)
              RecordMatchModal, SaveSquadModal)
              StandingsView)
   │              │                  │
   │              ▼                  ▼
   │      ┌────────────────┐  ┌──────────────┐
   │      │ tournament/    │  │ session/     │
   │      │ bracket.ts     │  │ edit.ts      │  ← pure, deterministic
   │      │ (state machine)│  │ flow.ts      │
   │      └────────────────┘  └──────┬───────┘
   │                                 ▼
   │                        ┌────────────────┐   ┌───────────────────┐
   │                        │ solver/        │   │ domain/           │
   │                        │ solver.ts      │◄──│ strength.ts       │
   │                        │ (exact search) │   │ validation.ts     │
   │                        └────────────────┘   │ types.ts, seed.ts │
   │                                             └───────────────────┘
   ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Six hooks: useRoster, useSessions, useSavedSquads, useTournaments,   │
│            useCommunities, useDisciplines                            │
│  each = { list, loading, error, refresh, save, delete }              │
└───────────────────────────────┬──────────────────────────────────────┘
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│ src/storage/types.ts — CommunityStore, RosterStore, SessionStore,    │
│ DisciplineStore, TournamentStore, SavedSquadStore   (ADR-0001 seam)  │
└───────────────────────────────┬──────────────────────────────────────┘
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│ src/storage/indexed-db.ts — one IndexedDB "comp3tive" (v6), 6 stores │
│ + legacy migration from the pre-rename "team-builder" database       │
└──────────────────────────────────────────────────────────────────────┘
```

Three properties of this shape matter:

1. **The pure core is genuinely isolated.** `solver.ts`, `bracket.ts`, `edit.ts`, `strength.ts`,
   `validation.ts`, `dashboardTeasers.ts`, and `transfer.ts` import nothing from React or from
   storage. That is what makes the 1,600-line unit suite possible without a DOM.
2. **Community scoping happens in the shell, not in the data layer.** Every hook returns *all*
   records; `App` filters by `activeCommunity.id` at render time (`src/App.tsx:202-227`:
   `communityPlayers`, `communitySessions`, `communityTournaments`, `communitySquads`). That is a
   deliberate reversal of an earlier leak (ADR-0005 notes the pre-existing cross-community leak
   in History/Games), but it means the invariant "no screen shows another community's records"
   is enforced by four filter expressions in one function rather than by the store interface.
3. **Persistence semantics differ per split source.** The same `SplitScreen` is reused for four
   entry points (`ad-hoc`, `tournament`, `session`, `squad`), and *whether a mutation persists*
   depends on the source: ad-hoc persists each edit to the Session log; tournament submits to the
   bracket; session and squad are synthetic and persist nothing
   (`src/App.tsx:1182-1210`, contract in `docs/FLOW.md` §2 rules 3–4). This is documented
   explicitly in `docs/FLOW.md` and `docs/adr/0004-origin-aware-navigation.md`, and is the single
   most subtle rule in the codebase.

### 2.2 Component Breakdown

#### 2.2.1 `src/solver/solver.ts` — the fair-split solver (deep module)

*Responsibility*: given a `PoolPlayer[]`, a `Discipline`, and `SolverSettings`, produce a
`SplitResult` — teams, the strength gap, solver flags, and unassigned players — minimizing
`max(team avg) - min(team avg)` subject to role coverage and team-size rules.

*Key exports*: `fairSplit(pool, discipline, settings, options?)`,
`varietySplit(pool, discipline, settings, seed)`, `assignTeamRoles`, `poolFromPlayers`,
`buildSettings`, `suggestTeamCount`, and the constants `NODE_BUDGET = 4_000_000`
(`:21`) and `VARIETY_TOLERANCE = 0.1` (`:24`).

*Algorithm*: players are sorted strongest-first; a greedy incumbent establishes an upper bound;
then a DFS enumerates **canonical set partitions** (teams ordered by their smallest member, so
each split is generated exactly once) with branch-and-bound pruning. The bound is the standard
`max(over teams of achievable minAvg) - min(over teams of achievable maxAvg)`, computed in O(1)
per node from prefix sums over the strength-sorted suffix (`src/solver/solver.ts:585-604`).
Validation of a complete candidate goes through `assignRoles`, which is itself a
backtracking search maximizing the number of players who get their preferred role
(`:93`). Role mode (MLBB) uses "exactly `maxTeamSize` per team when the pool allows, else
even best-effort"; sized mode (futsal) uses "sizes differ by at most 1". Leftover players are
placed in `leftover`, emitted as `unassigned`, and flagged.

The result carries its own provenance: `solver: { optimal, nodesExplored, elapsedMs }`, where
`optimal` is `!aborted` — i.e. false only if the node budget was exhausted. `varietySplit` is the
escape hatch for re-rolls on large pools: a seeded LCG shuffle, ten randomized greedy attempts,
local swap improvement, deduplication by team signature, and a variety-indexed pick from the
near-optimal candidates. It falls back to `fairSplit` if no candidate survives validation.

*Design note*: the module carries an explicit "one seam" contract — the spec says every
behavioral test lives at `fairSplit` and "no test touches internals (pruning strategies, data
structures)". The implementation's tests honor this, except that three tests do assert on
`res.solver.optimal`, which is observable output rather than an internal.

#### 2.2.2 `src/tournament/bracket.ts` — the tournament state machine (deep module)

*Responsibility*: own the entire competition lifecycle as pure functions over a `Tournament`
document.

*Key exports*: `buildBracket`, `applyResult`, `undoLastGame`, `standings`, `champion`.

*Conventions* (documented in the file header): teams are stored in seed order (strongest first);
match ids are deterministic (`m-<round>-<position>`); single elimination seeds by bit reversal so
seeds 1 and 2 can only meet in the final; progression is expressed as `winnerNext` /
`loserNext` slot references rather than a `nextMatchId`; Swiss generates round 1 only and
creates each subsequent round on completion.

*The settling loop*: `settle()` (`:211`) is the heart. It walks matches in round/position order,
**re-derives every match's participants from upstream results** (clearing games and winners when
a participant changes), re-resolves series winners, appends the next Swiss round when the current
one is complete, and recomputes status. This single function is why "results are always editable"
works: an edit anywhere propagates forward without special-casing.

*Validation*: `applyResult` (`:249`) rejects unknown match ids, matches whose two participants
are not yet decided (frontier gating), more games than the series length, games won by a
non-participant, and games recorded after the series is already decided. Each throw has a
user-facing message. `undoLastGame` (`:281`) removes the last game from the last match holding
games and re-settles.

#### 2.2.3 `src/App.tsx` — the shell (and its cost)

*Responsibility*: everything that is not a leaf screen. The `View` union has nine modes
(`dashboard`, `roster`, `games`, `tournament`, `match`, `split`, `history`, `disciplines`,
`squads`); `viewStack: View[]` is the navigation state; `pushView` / `goBack` / `gotoHub` are the
three primitives. The split flow's `source` travels on the view itself
(`{ mode: "match"; source: SplitSource }`), which is ADR-0004's answer to hard-coded back targets.

The component holds fifteen `useState` hooks (view stack, match setup, tournament prefill,
discipline filters, community-name form, three modal/menu booleans, toasts, editing player, file
input ref, three persisted prefs, download state) plus two `useMediaQuery` subscriptions, and it
renders every screen inline in one ~600-line JSX tree. All fifteen handlers live here too. The
consequences are itemized in §5.1 and §9.3.

#### 2.2.4 Storage layer

`src/storage/types.ts` declares six narrow interfaces. Two of them — `CommunityStore` and
`DisciplineStore` — lack `replaceAll*`, because communities are never bulk-replaced and
disciplines are seeded config, not user data. `src/storage/indexed-db.ts` implements all six
against one database:

- `openAppDb` creates any missing store in `onupgradeneeded` and seeds `SEED_DISCIPLINES` into the
  `disciplines` store on first creation. It is *defensively idempotent*: it checks
  `objectStoreNames.contains` per store rather than relying on `oldVersion`, which makes the
  upgrade path tolerant of any prior partial creation.
- `createCrud` gives every store `list` / `save` (upsert by `id`) / `remove`; `replaceAll` performs
  a clear-then-put inside a single `readwrite` transaction so a backup restore is atomic per store.
- `openDb` caches one connection promise per database name, and — critically — the default
  database waits on `ensureLegacyMigration()` before opening, so no screen can read an empty
  catalog while the rename copy is in flight. Failed opens are evicted from the cache so the next
  call retries.

The legacy migration (`migrateDatabase`, `:146`) is the most carefully written piece of the
storage layer: it refuses to overwrite a non-empty target (`skipped: "target-has-data"`), copies
store by store, verifies each store's count in the target before deleting the source, and treats
the seeded discipline catalog as *not* making a target "occupied" — otherwise a freshly created
target would block every migration forever. A `blocked` delete leaves the source intact for the
next launch. Six migration tests cover these paths including the resurrection case.

#### 2.2.5 Domain layer

`src/domain/types.ts` (195 lines) is the single source of truth for the data model and is written
as a vocabulary document: nearly every type carries a doc comment quoting `CONTEXT.md` and its
"avoid" list. `strength.ts` implements the pluggable `StrengthModel` with exactly one kind
(`mean`) and a `default:` branch that throws on unknown kinds, so adding a model is a compile-time
reminder plus a runtime error rather than a silent wrong answer. `validation.ts` encodes the
`CONTEXT.md` invariants (at most one capability per discipline, ratings inside
`attribute.min..max`, eligibility inside the discipline's roles, `preferredRole ∈ eligibleRoles`)
and returns `ValidationIssue[]` rather than throwing.

`community-removal.ts` is worth noting as the clearest expression of the community-ownership rule:
it reads all four dependent stores in parallel, deletes every record whose `communityId` matches,
counts what it removed, then deletes the community, and never touches another community's records.

### 2.3 Data Architecture

One IndexedDB database (`comp3tive`, **v6**) with six object stores, all keyed by `id`:

| Store | Record | Scoped by | Notes |
|---|---|---|---|
| `communities` | `Community` | — | the profile; `id: "community-default"` is auto-created on first run with a *fixed* id so StrictMode's double effect upserts one row |
| `players` | `Player` | `communityId` | embeds `capabilities: Capability[]` — no join table |
| `sessions` | `Session` | `communityId` | the automatic log of every ad-hoc split; embeds the full `SplitResult` |
| `disciplines` | `Discipline` | global | seeded config, not user-scoped; `builtIn` entries cannot be deleted |
| `tournaments` | `Tournament` | `communityId` | one document per tournament: teams *and* matches inlined |
| `saved-squads` | `SavedSquad` | `communityId` | a curated split; embeds its own copy of the `SplitResult` |

There is no ORM and no schema versioning *inside* records: `DB_VERSION` governs the IndexedDB
structure, while the *backup* format carries its own version (`BackupData.version: 4`), and
`parseBackup` migrates v1→v4 on import. Two different version numbers therefore coexist, which is
correct (they version different things) but is easy to conflate when reading the code — spec 0002
says "DB v5" and "backup v3" for the tournaments release, while the current code is v6/v4 after
Saved Squads.

**Snapshot semantics** are the load-bearing data decision. `TournamentTeam` stores
`{ id, bibIndex, name, strength, players: Id[] }` — a *copy* of the split's team membership and
average strength, not a reference to the Session. `SavedSquad` likewise embeds a full
`SplitResult`. The consequence, stated in ADR-0002 and ADR-0003: deleting a Session can never
damage a Tournament or a Squad, and re-splitting a Session can never mutate a Squad.

**Data flow for a split** is worth tracing once:

```
Player[] (roster, community-scoped)
   │  poolFromPlayers(players, discipline)        src/solver/solver.ts:31
   ▼  → { playerId, name, strength, eligibleRoles, preferredRole }[]
PoolPlayer[]
   │  computeStrength(discipline, capability)     src/domain/strength.ts:13
   │   = equal-weight mean of the discipline's attributes
   ▼
fairSplit(pool, discipline, buildSettings(discipline, teamCount))
   ▼
SplitResult { teams[], gap, flags[], unassigned[], solver{...} }
   ▼
Session { poolPlayerIds, settings, result }  → sessions store (ad-hoc only)
   ▼  consumeTeams(): sort teams by avgStrength desc, map to TournamentTeam[]
Tournament.teams → buildBracket() → Tournament.matches → tournaments store
```

**Caching** is limited to the module-level connection map in `indexed-db.ts` and the
`BLOB_URLS` object-URL registry in `src/data/sample-data.ts`. There is no query cache, no
memoized selector layer, and no `useMemo` in `App.tsx` even for derived data that allocates
(`disciplinesById`, the four community filters, and `viewTournament` are all recomputed on every
render).

### 2.4 API Surface

There is no network API, no GraphQL, no IPC, and no protocol buffers. The application's only
"API" surfaces are:

1. **The storage interfaces** (`src/storage/types.ts`) — the seam ADR-0001 says a backend will
   replace. Six interfaces, 23 methods, all `Promise`-returning.
2. **The pure domain functions** — `fairSplit`, `varietySplit`, `buildBracket`, `applyResult`,
   `undoLastGame`, `standings`, `champion`, `swapPlayers`, `recomputeResult`, `freshSplit`,
   `computeStrength`, `validatePlayer`, `validateTournamentSpec`, `removeCommunityCascade`,
   `serializeBackup`, `parseBackup`. These are the modules with real test coverage.
3. **The JSON backup format** (`BackupData`, v4) — the only externally-visible contract, and the
   documented migration path off the browser (`docs/adr/0001-client-only-first.md`).
4. **Player import formats** — players-only JSON (`{ players: [...] }`) or CSV
   (`name,disciplineShort,strength`), both parsed in `handlePlayerImport`
   (`src/App.tsx:515-620`). The CSV branch is lenient: a missing third column defaults strength to
   3, and an unmatched discipline name yields a player with *no* capabilities.

Authorization does not exist — there is no authn/authz layer, no multi-user concept, and no
secrets. Isolation between Communities is a product rule implemented as data scoping, not as a
security boundary; anyone with the browser profile can read or export everything.

## 3. Application Flows

### 3.1 Flow 1 — Cold start: migration, seeding, and landing on the Dashboard

**Entry point**: `index.html` → `src/main.tsx` → `App()`.

1. `main.tsx` mounts `<App/>` inside `<StrictMode>`, so every effect in development runs twice.
   The code deliberately accommodates this in two places: the Default community uses a **fixed
   id** (`src/domain/useCommunities.ts:8`, comment: "so concurrent first-run refreshes upsert to
   one row (StrictMode double-effect)"), and legacy adoption is idempotent by construction.
2. `App` calls six hooks (`src/App.tsx:134-141`). Each runs `refresh()` from a `useEffect`, and
   each refresh reads its store.
3. The first read against the default database goes through `openDb("comp3tive")`
   (`src/storage/indexed-db.ts:206-216`), which **awaits `ensureLegacyMigration()` first**. That
   copies the pre-rename `team-builder` database into `comp3tive` if it exists, verifies the copy
   store by store, and only then deletes the source — so no screen can observe a half-migrated
   catalog.
4. `useCommunities.refresh` (`src/domain/useCommunities.ts:40-60`) creates `{ id:
   "community-default", name: "Default" }` when the communities store is empty, then reconciles
   the active id: if the `localStorage` pin (`tb-community`) names a community that no longer
   exists, it falls back to `list[0]` and rewrites the pin.
5. `useDisciplines.refresh` (`src/domain/useDisciplines.ts:16-34`) re-seeds `SEED_DISCIPLINES`
   when the catalog is empty — a second safety net for a rebuilt database, since the store is
   also seeded inside `onupgradeneeded`.
6. `App` then runs the community-scoping effect (`src/App.tsx:229-245`): any player or session
   whose `communityId` is missing or references an unknown community is re-saved into the active
   community. Tournaments and saved squads are **not** adopted by this effect — they are only
   repaired by `parseBackup` at import time.
7. The initial `viewStack` is `[{ mode: "dashboard" }]` (ADR-0005), so the app lands on the Home
   hub. `loadError` aggregates the six hooks' errors into one banner so a failed read is no longer
   indistinguishable from an empty app (`src/App.tsx:144`).

### 3.2 Flow 2 — Ad-hoc split (Roster → Match setup → Split result → History)

**Trigger**: Roster hub → "Split match".

1. `startMatch("ad-hoc")` (`src/App.tsx:238-266`) guards on `disciplines.length` and
   `communityPlayers.length`, then picks the default discipline by *how many present players can
   play it* (`bestCount` loop), preselects **every** community player, and computes the default
   team count with `suggestTeamCount(eligible.length, discipline)` = `max(1, floor(pool /
   minTeamSize))`. It pushes `{ mode: "match", source: "ad-hoc" }`.
2. `MatchScreen` is purely presentational: it renders discipline radio-groups, player chips
   (`aria-pressed`), and a 1–8 stepper. Changing discipline recomputes the team count for the
   re-filtered pool (`src/App.tsx:273-281`); the Split button is disabled when no *capable*
   selected player remains, with a tooltip explaining why.
3. `split()` (`src/App.tsx:287-316`): `poolFromPlayers` drops every selected player who has no
   capability in the discipline (spec user-story 32), `fairSplit` runs, and a `Session` document
   is assembled. Persistence is conditional: **only `source === "ad-hoc"`** writes to the
   sessions store (`:306-312`), inside a `try/catch` whose comment reads "Non-fatal: still show
   the split if persistence failed" — the failure is swallowed with no user-visible signal.
4. `SplitScreen` renders from `session.result` into local `editable` state, shows the two-team
   "pitch" with the gap meter (2 teams) or a vertical team stack (3+), and renders
   `describeFlags(...)` as referee-voice copy.
5. **Swap**: entering swap mode, picking one player on each team calls
   `swapPlayers(result, roster, discipline, a, b)` (`src/session/edit.ts:35-56`), which clones the
   teams, exchanges the two slots, re-derives roles for *both* teams via `assignTeamRoles`
   (hard mode: a backtracking role assignment maximizing preferred-role matches; soft mode:
   preferred-or-first-eligible), recomputes totals/gap/flags, and returns a new `SplitResult`.
6. **Persist**: `commit(next)` calls `onPersistResult`, which the App implements as "rewrite the
   Session document only when `view.source === "ad-hoc"`" (`src/App.tsx:1182-1200`). A failed
   write surfaces as an inline `role="alert"` banner ("This arrangement wasn't saved.") — the one
   place in the app where a persistence failure is honestly reported.
7. **Re-roll**: see §4.4 — the current implementation cannot produce a different split.
8. **Outcome**: the session appears in History (newest-first) and can be reopened, re-rolled, or
   turned into a Saved Squad.

### 3.3 Flow 3 — Tournament: create → split → submit → review

**Trigger**: Dashboard → "New tournament", or Games hub → "+ New tournament".

1. `GamesScreen`'s create modal collects name, discipline, format, series length, team count
   (constrained per format), and the 3rd-place toggle; it runs `validateTournamentSpec` and
   disables submission on issues.
2. `App.createTournament` (`src/App.tsx:699-735`) validates a **second** time, logging to
   `console.error` and using `alert()` for the failure path, then writes a draft
   (`status: "draft"`, `teams: []`, `matches: []`) through `tournaments.saveTournament`, and
   *replaces* the view stack with `[{ games }, { tournament }]` so Back and the breadcrumb both
   return to Games.
3. The draft view (`src/tournament/TournamentScreen.tsx:296-336`) shows the pre-split preview
   ("You'll pick from N eligible players…"), the "Split your teams" CTA, and — when a matching
   saved squad exists — an "Or use a saved squad" list.
4. "Split your teams" → `startMatch("tournament", id)`. The tournament's discipline and team
   count are passed as `lockedDisciplineId`/`lockedTeamCount`, disabling the discipline chips and
   the stepper in `MatchScreen`, exactly as `docs/FLOW.md` §2 rule 2 requires.
5. `SplitScreen` receives `onSubmitTournament` (wired only when `view.source === "tournament" &&
   setup?.tournamentId`) and shows "Save tournament squad →" instead of "Re-roll".
6. `consumeTeams(tournamentId, teams)` (`src/App.tsx:318-357`) is the submission boundary. It
   re-reads the tournament from hook state, verifies the team count is legal for the format
   (`swiss`: even ≥2; `single-elim`: 2/4/8; `series`: 2) and refuses with a clear toast otherwise,
   sorts teams by average strength descending (seed 1 = strongest), maps them to
   `TournamentTeam` snapshots with deterministic ids (`team-1…team-N`), calls `buildBracket`, and
   persists. Any throw from `buildBracket` is caught and surfaced as a toast.
7. `buildBracket` returns the tournament in `active` status with matches populated. Because every
   match still has zero games, `TournamentScreen`'s `reviewing` state initializes to `true` and
   the `ReviewPanel` shows the balance check before the bracket is revealed; "Confirm teams →"
   flips a local boolean and reveals `BracketView`/`StandingsView`.

### 3.4 Flow 4 — Recording a result and re-settling the bracket

**Trigger**: clicking a match card in `BracketView`/`StandingsView`.

1. `RecordMatchModal` starts from the match's existing `games`, offers per-game "A wins / B wins"
   buttons with optional score inputs, and disables rows once a majority exists.
2. `onSave(games)` → `App.recordResult(matchId, games)` (`src/App.tsx:359-363`):
   `applyResult(viewTournament, matchId, games)` then `tournaments.saveTournament(next)`.
3. Inside `applyResult` (`src/tournament/bracket.ts:249-279`) the guards run in order: the match
   must exist; **both participants must be decided** (frontier gating — this is what prevents
   recording a final before the semifinals); there must not be more games than the series length;
   every game's winner must be one of the two participants (no draws, no third party); and no game
   may be recorded after the series is already decided. Each violation throws a specific,
   user-facing message.
4. `settle()` (`:211-241`) then rebuilds the world: for every match in round/position order it
   re-derives participants from upstream `winnerNext`/`loserNext` references, **clears games and
   the winner whenever a participant changed**, re-resolves series winners from stored games,
   appends the next Swiss round when the current one is complete, and recomputes status.
5. `statusOf` marks the tournament `complete` when every *required* match has a winner — the
   final plus the 3rd-place match for single elimination, the last round for Swiss, the single
   match for Series. `champion()` then resolves the winner (top of the final standings for Swiss).
6. **Undo**: `undoLastGame` (`:281-300`) strips the last game from the last match that holds one
   and re-settles. It is offered in the toolbar whenever any game exists.
7. **Gap in this flow**: neither `recordResult` nor `undoLastResult` wraps its call in
   `try/catch`. The domain throws are reachable from the UI (the frontier guard, in particular),
   so a rejected recording becomes an unhandled promise rejection instead of a message. The
   validation that would normally prevent it lives in the modal's disabled state, which keeps the
   common path safe but not the race (for example, a second tab editing the same tournament).

### 3.5 Flow 5 — Saved Squad: save a split, then consume it in a tournament

**Trigger A (save)**: `SplitScreen` → "Save squad".

1. The modal defaults the name to `"{discipline} · {N} teams · {date}"` and saves via
   `onSaveSquad` → `App.saveSquadFromSplit` (`src/App.tsx:366-381`), which builds a
   `SavedSquad` embedding the *current* `SplitResult`. Note that `poolPlayerIds` is derived from
   `result.teams.flatMap(...)` — unassigned players are dropped from the recorded pool.
2. **Trigger B (consume)**: the draft tournament view filters saved squads by *same community,
   same discipline, exact team count* (`src/App.tsx:1158-1163`) and offers "use this squad".
3. `useSquadInTournament` → `consumeTeams(tournamentId, squad.result.teams)` — the identical code
   path a fresh split takes. This is ADR-0003's "submitting a squad is the same code path as
   submitting a fresh split", and it holds in the implementation.
4. Re-splitting a squad (`reSplitSquad`, `src/App.tsx:383-393`) builds a **synthetic** `Session`
   whose id is `squad-<id>` and pushes the split view with `source: "squad"`; nothing is
   persisted unless the user saves a new squad, so the original is never mutated (FLOW rule 4).

### 3.6 Additional Flows Reference

The flows below are notable but were not traced in full; each entry names where to start reading.

| Flow | Description | Entry point |
|---|---|---|
| **Player import (JSON or CSV)** | Two branches keyed on the first non-space character. Full backups (`version` present) route to the merge importer; `{players:[...]}` imports players into the active community; anything else is parsed as CSV `name,disciplineShort,strength`. Uses `alert()` for every outcome. | `src/App.tsx:515-620` (`handlePlayerImport`) |
| **Backup export / import** | Export serializes all five data collections to `BackupData` v4 and downloads a dated file. Import compares ids per collection and inserts only new records behind a `window.confirm()` count summary. | `src/App.tsx:412-424` (export), `:426-462` (import), `src/data/transfer.ts` |
| **Community switch & cascade delete** | Switching writes the pin and re-filters every list. Deleting runs `removeCommunityCascade` (players, sessions, squads, tournaments), then refuses to delete the last community. | `src/domain/useCommunities.ts:63-115`, `src/domain/community-removal.ts:32-79` |
| **Discipline creation & sample data** | Saving a non-built-in discipline auto-generates a 25-player sample roster (min team size × 5) with random ratings *inside each attribute's min/max* and stores it in an in-memory registry that can be downloaded as JSON. | `src/domain/useDisciplines.ts:37-52`, `src/data/sample-data.ts:89-121` |
| **Legacy database migration** | Copy `team-builder` → `comp3tive`, verify per-store counts, delete the source; refuse a non-empty target; treat the seeded catalog as non-data. | `src/storage/indexed-db.ts:146-200`, `:202-216` |
| **Swiss round generation** | Round 1 pairs adjacent seeds; each subsequent round is created inside `settle` by `pairRound`, grouping by series wins (±1), avoiding rematches, and floating when a group is odd. | `src/tournament/bracket.ts:155-190`, `:229-238` |
| **Re-roll variety path** | `varietySplit` explores a seeded region of the partition space for large pools; reachable only by passing `{ variety }` to `freshSplit`. | `src/solver/solver.ts:359-423`, `src/session/edit.ts:110-117` |
| **Sample-roster download** | Dynamically imports `sample-data` on click, creates an object URL, and triggers an `<a download>` click. | `src/App.tsx:498-508` |

## 4. Design Decisions & Trade-offs

### 4.1 Client-only first, storage behind an interface (ADR-0001)

**Chosen**: no backend at all in v1; IndexedDB behind six store interfaces; JSON export/import as
the migration path. **Rationale**: "fastest iteration on the balancing logic and UI."

**Trade-offs**: data is bound to one browser profile on one device — clearing site data destroys
everything, and there is no recovery path the app itself can take. Multi-user coordination is
deferred, which is acceptable for the stated persona (the organizer *owns* the data). The
abstraction is real, not decorative: nothing outside `src/storage/indexed-db.ts` imports
IndexedDB, and the tests use `src/storage/memory.ts` or a separate database name
(`comp3tive-test-*`) through the same interfaces.

**Weak point of the current implementation**: the promise "export/import is the migration path"
is undermined by there being no autosave, no backup reminder, and no `navigator.storage.persist()`
request. A single-user tool whose only durability story is a manual download does not currently
nudge the user to use it.

### 4.2 Tournament-first, one competition model (ADR-0002)

**Chosen**: a Tournament container is created *before* teams exist; a standalone best-of-N game is
the same entity as a 2-team Series; draws do not exist. **Rationale**: if teams came first, "the
tournament would inherit whatever team count the split happened to produce"; format and size
would be afterthoughts.

**Trade-offs**: the draft state is a first-class, visible state (a deliberate feature per the ADR),
which costs an extra screen and an extra navigation leg before any value is delivered — mitigated
by the saved-squad shortcut. Forbidding draws removes a whole class of third outcomes from every
bracket, Swiss-pairing, and completion rule, at the cost of not modelling reality (the ADR's answer
is that the court resolves ties).

**Documentation drift**: ADR-0002's status is still `proposed`, and spec 0002 specifies per-match
`seriesLength` and a `nextMatchId` field while the implementation puts series length on the
Tournament and uses `winnerNext`/`loserNext` objects to route both winners and 3rd-place losers.

### 4.3 Exact solver over heuristic

**Chosen**: exhaustive branch-and-bound over canonical set partitions, minimizing
`max(avg) - min(avg)`. **Rationale** (spec 0001, "Further Notes"): "Solver optimality is the
point: for v1 pool sizes (≤ ~30), exact search is trivially fast and 'fair' has a proof."

**Trade-offs**: the search is exponential in the worst case, so a node budget
(`NODE_BUDGET = 4_000_000`) bounds it and `SplitResult.solver.optimal` honestly reports whether the
budget was hit. The bound is only valid because players are processed strongest-first with prefix
sums; `varietySplit` exists because a deterministic exact solver can never re-roll to a *different*
near-optimal split. The measured cost is recorded in the result (`elapsedMs`, `nodesExplored`) but
**nothing in the UI reads it** — the provenance fields exist for tests and debugging only.

**Residual risk**: optimality is defined purely as average-strength gap. A "fair" split in the
product's sense (defensible to the players) might also want variance, positional matchup balance,
or avoid pairing two very strong players, none of which the objective encodes.

### 4.4 Determinism vs. the Re-roll affordance — an unresolved conflict

This is the sharpest design/implementation conflict in the codebase.

- The solver is **deterministic by contract** and by test: `src/solver/solver.test.ts:94-114`
  asserts identical output for identical input in both sized and role modes. Determinism is what
  makes the "proof" of fairness reproducible and what makes the session log trustworthy.
- Yet the product requires "re-roll the split, so that I can get a fresh assignment when the last
  one feels off" (spec 0001, user story 24), and `.scratch/team-builder/issues/05-editable-results.md`
  states "Re-roll: a fresh split from the session's OWN pool and settings (not the match setup)".
- `varietySplit` and `FairSplitOptions.variety/seed` were built precisely for this — and then the
  UI never passes `variety`.
  `SplitScreen.reroll` (`src/session/SplitScreen.tsx:255-264`) calls
  `freshSplit(playerIds, roster, discipline, { teamCount })` with **no options**, and
  `freshSplit` (`src/session/edit.ts:110-117`) falls through to plain `fairSplit` when
  `options?.variety` is `undefined`.
- Therefore **Re-roll returns the identical teams**. It also increments a "Roll #N" badge, so the
  UI actively claims a new arrangement was produced. The only code that could have supplied a
  variety counter — `src/session/split-module.ts:27` — is dead.
- A second, smaller defect in the same handler: the pool is taken from the *current* teams
  (`result.teams.flatMap(...)`) rather than `session.poolPlayerIds`, so any player who sat out
  (an MLBB leftover, or a futsal sub beyond capacity) is silently excluded from every subsequent
  re-roll and can never be brought back through that action.

**Assessment**: the fix is small (pass an incrementing `variety` counter, and rebuild the pool
from `session.poolPlayerIds`), but it needs a product decision first: should re-roll explore
near-optimal alternatives (tolerance-bounded variety) or should it trade fairness for novelty?
The machinery supports the former; nothing documents the trade-off.

### 4.5 Snapshot teams and self-contained squads

**Chosen**: `TournamentTeam` copies player ids and average strength at submission;
`SavedSquad` embeds a whole `SplitResult`. **Rationale** (ADR-0002, ADR-0003): "the few KB of
duplication buys immunity from Session edits and deletion."

**Trade-offs**: acknowledged and accepted duplication; the cost is that a snapshot can hold
player ids that no longer exist, so rendering a bracket after deleting a player requires tolerant
lookups. The implementation handles this inconsistently: `describeFlags` falls back to `"?"`
(`src/session/flow.ts:27`), and `TournamentScreen`'s review panel resolves names through the
roster prop, but nothing verifies membership at render time. Freezing *lineups* while allowing
*results* to be edited is a coherent split of responsibilities — the ADR's claim that "player
swaps remain allowed" after results begin is, however, inaccurate in the shipped UI: swapping is
only reachable from the split screen, and a tournament's split is submitted once.

### 4.6 View stack instead of a router (ADR-0004)

**Chosen**: a flat `View` union plus a stack; the split flow carries an explicit `source`.
**Rationale**: the previous flat union hard-coded back targets per call site, producing back
buttons that contradicted breadcrumbs and a blank screen after deleting the current tournament.

**Trade-offs**: no shareable URLs, no browser back/forward, no deep links. The ADR explicitly
rejects `react-router` as unjustified for a local single-user tool and says to revisit only if a
shareable URL surface appears. In exchange, page state survives navigation without serialization,
and the destination of every Back control is derived rather than declared.

**Implementation fidelity**: the stack primitives are three lines each and one screen still
hard-codes a target (`SplitScreen`'s breadcrumb renders a `<a href="#">` whose click handler does
nothing, `src/session/SplitScreen.tsx:294`), and `src/nav.tsx`'s `Breadcrumb` component —
built for this ADR — is unused by any screen. The pattern was adopted; the shared component was
not.

### 4.7 Dashboard-first landing (ADR-0005)

**Chosen**: the app opens on a Home hub with stat cards, teasers, and the primary CTA; the bottom
nav becomes five slots with Home centered. **Rationale**: "Roster is a management surface, not a
place to decide what to do next."

**Trade-offs**: an extra tap for a returning organizer who came back to manage the roster, in
exchange for orientation and cross-feature discovery. The ADR is also notable for bundling a
*correctness* fix: History and Games lists had been passed to screens unfiltered, leaking records
across communities; the community filters in `App` were introduced in the same pass.

### 4.8 Hand-written CSS with design tokens, no framework

**Chosen**: one 3,000-line `src/index.css` with CSS custom properties, a two-layer dark mode
(`[data-theme]` attribute *and* `prefers-color-scheme`), and `data-layout`/`data-rail` attributes
driving responsive variants. **Rationale** (`DESIGN.md`): a specific visual direction — "Paper &
Pencil": warm paper, quiet ink, one amber accent, bib colors reserved for team identity.

**Trade-offs**: zero build cost and zero dependency risk; strong token discipline; and a design
that genuinely does not read as a framework default. Against that: no selector scoping, no
linting (a commit in the log, `a1645d4 fix(a11y,css): … repair malformed rules`, confirms
hand-written CSS has already produced syntax errors), no dead-rule detection, and a single file
that every UI change must touch. Computed-style assertions in the e2e suite encode the current
values as the contract, so a redesign breaks tests that are not about behavior.

## 5. Code Quality & Patterns

### 5.1 Code Organization & Conventions

**Conventions are consistent and readable.** Files are named for their export
(`SplitScreen.tsx` → `SplitScreen`); feature folders group screen + hook + pure logic
(`session/`, `tournament/`, `domain/`, `roster/`, `storage/`, `data/`); pure logic and React
components are kept in separate files; hooks follow an identical shape
(`useX(store) → { list, loading, error, refresh, save, delete }`) so the six of them are
interchangeable by inspection. Type-only imports use `import type`, which `verbatimModuleSyntax`
enforces. Comments explain *why* rather than *what* ("Snapshot: `teams`/`leftover` are live buffers
that unwind after the search", `src/solver/solver.ts:531`), and doc comments quote the domain
contract from `CONTEXT.md`.

**The shell is the dominant structural problem.** `src/App.tsx` is 1,280 lines / ~50 KB with
fifteen `useState`s and roughly fifteen handlers, and it renders all nine view modes inline. The
costs are concrete rather than aesthetic:

- **Three mutations bypass their hooks**, so the in-memory list goes stale and the UI lies until
  reload. `deletePlayer` calls `rosterStore.deletePlayer(id)` (`src/App.tsx:482-484`) instead of
  `roster.deletePlayer`; `deleteTournament` calls `tournamentStore.deleteTournament(id)`
  (`:762-764`); the History screen's delete calls `sessionStore.deleteSession(id)` (`:1209`).
  In each case the hook's `delete*` method — which also updates state — exists and is used by
  sibling code paths (`savedSquads.deleteSquad` at `:1222` does it correctly). The user-visible
  effect: delete a player, a tournament, or a session, and the row remains on screen.
- **Four copies of the same filter.** `communityPlayers`, `communitySessions`,
  `communityTournaments`, `communitySquads` (`:202-227`) each restate the scoping rule.
- **Derived data is recomputed every render** with no `useMemo` — `disciplinesById` builds a new
  `Map`, four filters allocate new arrays, and `viewTournament` runs a `find` even for views that
  do not use it (`:228-229`).
- **No error boundary.** The only guard against a render-time throw is that the pure layers throw
  rarely; `computeStrength` throws by design on a missing rating, and it is called during render
  from `strengthsFor` and from the split screen.

**Dead code and duplication.** Verified by reference counting across `src/`:

| Artifact | Size | Status |
|---|---|---|
| `src/tournament/tournament-domain-fix.ts` | 270 lines | Entirely unreferenced. Contains a *second* `validateTournamentSpec`, a second `validateTeamParticipation`, and an unused `checkTournamentReadiness`/`isTournamentReady` pair. |
| `src/session/split-module.ts` | 48 lines | Unreferenced. A self-declared "deep module" (`compute`/`swap`/`recompute`) documenting an interface nothing calls. |
| `src/data/samplePlayers.ts` | 73 lines | Referenced only by `src/data/transfer.test.ts`. |
| `src/nav.tsx` `Breadcrumb` | 32 lines | Unreferenced; every screen inlines its own breadcrumb markup. |
| `BIB` constant | 3 copies | Defined separately in `SplitScreen.tsx`, `TournamentScreen.tsx`, `SquadsScreen.tsx`. |
| `FORMAT_LABEL` / `STATUS_LABEL` | 2 copies each | Duplicated in `GamesScreen.tsx` and `TournamentScreen.tsx`. |
| `relativeTime` | 2 copies | `HistoryScreen.tsx` and `SquadsScreen.tsx` (identical logic). |
| `SaveSquadModal` / modal shell | 5 copies | The `modal-overlay` + `modal-card` + `modal-close` skeleton is retyped in every modal. |

**One genuinely dead conditional.** In `TournamentScreen`'s active branch the toolbar renders the
notice "Re-split is locked after the first result" only when `canResplit` is true
(`src/tournament/TournamentScreen.tsx:353-355`), but that block is already nested inside
`hasAnyGames &&` (`:347`), and `canResplit = teams.length > 0 && !hasAnyGames` (`:250`) — so the
condition can never hold. The message never appears; the lock is enforced only by the absence of a
re-split button in that view.

**Layering nits.** `src/ui/Screen.tsx` and `PageHeader.tsx` are used by some screens and not
others (`SplitScreen` and `MatchScreen` roll their own `.screen` markup), and every screen
inlines `style={{...}}` objects for one-off values (CSS custom properties, grid templates), which
means the "hand-written CSS with tokens" discipline leaks back into TSX.

### 5.2 Type Safety & Validation

**Static typing is strict and mostly clean.** `tsconfig.app.json` enables `strict`,
`noUnusedParameters`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`, `moduleDetection:
force`, and `noUncheckedSideEffectImports`. The domain uses discriminated unions where it matters
(`SolverFlag`, `StrengthModel`, `View`, `TournamentReadinessStatus`) and `switch` statements are
exhaustive by construction (`noFallthroughCasesInSwitch` plus `never` patterns would be the next
step; today `describeFlags` and `computeStrength` both have a `default:`/no-`default` asymmetry).

**Runtime validation exists but is not wired to the boundaries.** This is the biggest quality gap
in the type story:

- `validatePlayer` / `validateCapability` (`src/domain/validation.ts`) encode exactly the
  `CONTEXT.md` invariants and are thoroughly unit-tested (10 cases) — but **no production code
  path calls them**. `PlayerEditModal` constructs a `Player` and saves it
  (`src/roster/PlayerEditModal.tsx:119-140`) without validation, and `handlePlayerImport` accepts
  any object with a truthy `name` and an array `capabilities` (`src/App.tsx:542-566`).
- `parseBackup` (`src/data/transfer.ts:52-125`) checks *shape* only: a player needs a string `id`
  and `name` and an array `capabilities`; a capability's `attributeRatings`, `eligibleRoles`, and
  `preferredRole` are never inspected; sessions/squads are checked only as `isRecord`.
- The consequence is a reachable crash path: a capability missing one of its discipline's
  attribute ratings passes both gates, is persisted, and then makes
  `computeStrength` throw (`src/domain/strength.ts:26-31`) — which happens **during render** in
  `strengthsFor` (`src/App.tsx:123-129`) and again in the split screen. There is no error boundary,
  so the failure mode is a blank app with a console error rather than a validation message.
- `validateTournamentSpec` *is* wired (twice: modal and handler), which shows the intended pattern
  — the player path simply never adopted it.

**Unsafe casts and assertions** (all verified, ordered by risk):

| Location | Expression | Risk |
|---|---|---|
| `App.tsx:339-340` | closure-narrowed `best as Candidate \| null` | Justified; TS cannot narrow a `let` mutated inside a closure. Documented in-file. |
| `TournamentScreen.tsx` (RecordMatchModal submit) | `match.teamAId!` / `teamBId!` | Safe in practice (the modal only opens for frontier matches) but unguarded if that invariant ever changes. |
| `App.tsx:1189, 1196, 1194` | `view.session!`, `setup.tournamentId!` | Narrowed by the enclosing JSX conditions; fragile against refactors. |
| `App.tsx:179-182` | `themePref as "light" \| "dark"`, `layoutPref as "mobile" \| "desktop"` | `useStoredPref` returns `string`, so a hand-edited `localStorage` value silently flows into a data attribute. Harmless (unknown values just match no CSS rule) but it defeats the type. |
| `App.tsx:314` | `view.mode === "match" ? view.source : "ad-hoc" as SplitSource` | Operator precedence makes this read as a bug; the cast binds to `"ad-hoc"`, so it works, but `as` belongs on the whole expression. |
| `App.tsx:550`, `sample-data.ts:30,57` | `raw as Partial<Player>`, `JSON.parse` results | Untyped import surface; no schema library anywhere. |
| `DisciplinesScreen.tsx` | `{ "--stripe": color } as React.CSSProperties` | Idiomatic workaround for CSS custom properties in inline styles. |

**Null/undefined discipline in the data model**: `Discipline.team.maxTeamSize` is
`number | null` where `null` means "unbounded", but the same field is read in the solver as
`Infinity` after a local conversion, in the validator as a branch, and in
`team-participation-validator.ts` as `discipline.team.maxTeamSize || "exact"` — three different
readings of the same sentinel in three modules.

### 5.3 Error Handling

There is no single error strategy; there are four, applied inconsistently:

1. **Hook-level capture** (the best pattern): every hook stores `error: string | null` and the
   shell aggregates them into one banner — `communities.error ?? roster.error ?? sessions.error ??
   catalog.error ?? tournaments.error ?? savedSquads.error` (`src/App.tsx:144`), described
   in-file as fixing "a failed read [looking] identical to an empty app".
2. **Toast notification**: `notify(text, type)` renders `role="status"` toasts that auto-dismiss
   after 3 s (`src/App.tsx:163-169`, `:1257-1263`). Used for cascade-delete counts, bracket
   submission failures, discipline save/delete failures, and the "need at least one community"
   guard.
3. **`alert()` + `console.error`**: the tournament-create validation path (`:711-715`), the whole
   player import path (six `alert()` calls), and the backup import failure. These escape the app's
   own visual language, block the thread, and are not announced politely to assistive tech.
4. **Silence**: the ad-hoc Session write is explicitly swallowed
   (`src/App.tsx:306-312`), the sample-data download failure is reduced to a toast, and the legacy
   adoption effect fires `void roster.savePlayer(...)` / `void sessionStore.saveSession(...)`
   (`:222-236`) with no `.catch`, so a failure there is an unhandled rejection.

**Throws that can reach React**: `applyResult` and `undoLastGame` are documented to throw on
invalid input, and neither `App.recordResult` (`:359-363`) nor `App.undoLastResult` (`:404-408`)
catches them. `computeStrength` throws by design and is called during render. There is no error
boundary anywhere in the tree, so any of these degrades to a blank screen.

**Destructive actions** use native `window.confirm` in five places (player delete, discipline
delete, community delete, session delete, squad delete) while the tournament delete uses a
proper in-app two-step inline confirmation (`TournamentScreen.tsx:386-396`). One component —
`DisciplineEditModal` — renders the same `error` string twice, in two different containers.

### 5.4 Dependency Management

Two runtime dependencies (`react`, `react-dom`), six devDependencies, and a committed
`package-lock.json`. Nothing deprecated, nothing with a large transitive tree, and no
postinstall scripts. The supply-chain surface is essentially minimal.

The gaps are operational: no `npm audit` in any script, no dependency-update tooling, no
`engines` field, and no `.nvmrc`. The runtime surface is not quite closed either — `index.html`
loads Outfit and Familjen Grotesk from `fonts.googleapis.com` with `preconnect` but no
`integrity`. That is a third-party request from a tool whose product brief promises "Must work
offline (futsal court has no signal)"; the app will function (it is only fonts) but the
typography contract in `DESIGN.md` silently degrades, and the only self-contained alternative —
bundling the woff2 files — was not taken.

## 6. Testing

### 6.1 Testing Strategy & Coverage

The strategy is explicit and was set before the code: spec 0001 declares **one seam** for the
split feature ("the Fair Split solver … It is pure and deterministic … Every behavioral test
lives here", with "Storage and UI get only minimal smoke checks, not behavioral suites — they are
thin shells over the solver"), and spec 0002 declares the bracket machine as its analogue. The
implementation follows this closely, which is why the pure core is well covered and the shell is
not:

| Area | Files | Lines | Coverage character |
|---|---|---|---|
| Solver | `src/solver/solver.test.ts` | 259 | Deep: optimality vs. brute force, role coverage, eligibility, preferred roles, leftovers, below-min flags, determinism, variety |
| Bracket | `src/tournament/bracket.test.ts` | 301 | Deep: seeding and routing for 4/8 teams, 3rd-place on/off, majority resolution, series-length rejection, frontier gating, no-draw rejection, Dutch/Swiss progression |
| Split editing | `src/session/edit.test.ts` | 95 | Swap sizes, MLBB role re-derivation, same-team no-op, re-roll pool preservation |
| Storage | `src/storage/indexed-db.test.ts` (133), `migration.test.ts` (196) | 329 | Smoke for CRUD/upsert/replace across simulated reloads; deep for the legacy migration (5 paths incl. non-overwrite, no-source, resurrect) |
| Backup | `src/data/transfer.test.ts` | 168 | Round-trip, v1/v2/v3 migration, malformed-input rejections |
| Domain rules | `validation.test.ts` (83), `seed.test.ts` (32), `strength.test.ts` (41), `community-removal.test.ts` (115) | 271 | Invariant-level, one test per rule; cascade isolation across communities |
| Dashboard helpers | `src/dashboardTeasers.test.ts` | 125 | Ordering, exclusion of drafts/complete, deterministic tie-breaks |
| **Total** | **12 files** | **~1,700** | |

Quality of the assertions is high where it exists. The solver tests compute a brute-force minimum
gap for 6- and 11-player pools and compare (`bruteGap2`), which is a genuine oracle rather than a
snapshot; they explicitly normalize the one non-deterministic field (`elapsedMs`) before deep
equality; and every flag kind has a dedicated test. The bracket tests assert exact match ids,
routing targets, and status transitions. The migration tests use real databases through the real
adapter and assert the refusal/verification semantics, not just the happy path.

### 6.2 Test Patterns & Quality

**Unit harness**: Vitest with `environment: "node"` and `include: ["src/**/*.test.ts"]`
(`vite.config.ts`). Two consequences worth flagging: `.tsx` files are *not* included, so component
tests are structurally impossible without a config change; and because the environment is `node`,
the one test that touches the DOM fakes it (`vi.stubGlobal("document", {...})` in
`src/data/sample-data.test.ts:45-50`). `fake-indexeddb/auto` supplies IndexedDB, and each storage
test uses its own database name (`comp3tive-test-1` … `comp3tive-test-t2`) for isolation — a
pattern that works but leaves a growing set of databases in the fake environment.

**E2E harness**: Playwright, `testDir: ./tests`, `baseURL: http://localhost:4173`,
`webServer: npm run preview` with `reuseExistingServer: true`, `workers: 1`,
`fullyParallel: true`, 30 s test timeout, `trace: on-first-retry`, HTML reporter with
`open: "never"`. One worker is a deliberate (if uncommented) choice: several specs share the
Default community's data, and IndexedDB persists across navigations within a context.

**Isolation strategy is split in two.** Only `e2e/tests/dashboard/dashboard.spec.ts` seeds
deterministically: it builds a `SeedWorld` object, serializes it into an `addInitScript` that
opens `comp3tive` at version 6, matching
`DB_VERSION`, creates the six stores, writes
the rows, and pins `localStorage["tb-community"]` — then every test starts from a known world
(`:65-108`). The remaining 18 specs instead *drive the UI* to construct their fixture: create a
community by clicking, add players one at a time through the modal, then navigate. That is slower,
duplicates setup logic in every file, and makes the suite dependent on the create-community flow
continuing to work.

**E2E quality is uneven:**

- `e2e/tests/tournament/inspect.spec.ts`, `inspect2.spec.ts`, `inspect3.spec.ts` (147 lines
  combined) contain **no assertions at all**: they log `innerHTML` and button lists to the console,
  and `inspect3` mutates IndexedDB by hand to fabricate a state. They are debugging leftovers
  committed as specs.
- `e2e/tests/tournament/review.spec.ts` is `test.skip` with a comment stating the feature "is
  verified by the build and by manual testing" — i.e. documented absence of verification for the
  review panel.
- `e2e/tests/tournament/journey.spec.ts` creates four players *with no capabilities*, then
  acknowledges in a comment that "the split screen will show 'no eligible'", screenshots to `/tmp`,
  and ends. It asserts that the modal opened and closed, nothing about the journey it is named for.
- `e2e/tests/split-flow/split.spec.ts` (22 lines, 2 assertions) creates a community and asserts the
  bottom nav is visible. Its name promises a split flow.
- Several specs genuine-assert layout via computed styles: font family exactly `Familjen Grotesk`,
  weight `600`, `.screen` padding ≥ 12 px, nav `position: fixed`, topbar `sticky`, popover below
  topbar (`community.spec.ts`, `discipline.spec.ts`, `history.spec.ts`, `panel/no-overlap.spec.ts`,
  `settings-panel/*`). These do defend real regressions (a redesign that breaks the sticky nav),
  but they are change-detectors for the *current* design, and one of them — the font-weight
  assertion — will fail the moment the design system moves.
- The strongest specs are `dashboard.spec.ts` (84 assertions, seeded, community-scoping checks),
  `saved-squad.spec.ts` (24 assertions, the full import → split → save → consume journey with real
  player names verified in both teams) and `cancel-dropdown.spec.ts` (18 assertions, including the
  Escape-key path and the cancel-clears-input behavior).
- `test-results/.last-run.json` records `{"status": "passed", "failedTests": []}` — the suite is
  green, so the weak specs are not hiding failures; they simply cannot fail.

### 6.3 Testing Gaps

**Behaviors with no test coverage at all** (verified by searching for call sites and spec names):

1. **Re-roll variety** — the one behavior the product spec calls out twice ("re-roll freely",
   user story 24) has no test asserting that re-roll produces a *different* split. There is a solver
   test for `variety` (`solver.test.ts:66-91`) but nothing covering the UI path, which is why the
   `variety`-never-passed bug survived (§4.4).
2. **Any React component** — no test renders `SplitScreen`, `MatchScreen`, `TournamentScreen`,
   `GamesScreen`, `HistoryScreen`, `SquadsScreen`, `DashboardScreen`, `PlayerEditModal`,
   `DisciplineEditModal`, or the shell. The only component-adjacent artifact is
   `SplitPage` in `e2e/pages/split.page.ts`, which holds two locators and is used by no spec.
3. **Any hook** — `useRoster`, `useSessions`, `useSavedSquads`, `useTournaments`, `useCommunities`,
   `useDisciplines` have zero tests, including their error branches and the first-run default
   community creation.
4. **Shell handlers** — `handleImport`'s merge semantics, `handlePlayerImport`'s CSV/JSON branches,
   `saveSquadFromSplit`, `consumeTeams`'s bracket-count guard, and the export path are untested.
   The import merge in particular has a real correctness question (below) with nothing pinning it.
5. **`describeFlags`** — the referee-voice copy is pure, non-trivial (best-fit covering-player
   selection with a fallback chain) and untested, even though it is the user-facing explanation of
   *why* a split is imperfect.
6. **`team-participation-validator.ts` and `tournament-domain-fix.ts`** — 367 lines between them,
   zero tests, and (for the latter) zero call sites.
7. **In-browser migration** — the migration is well tested against `fake-indexeddb`, but the real
   path through `openDb`'s cached-connection guard and the StrictMode double-invocation is only
   exercised manually.
8. **Accessibility** — no axe/Pa11y integration anywhere; the a11y work (skip link, 44 px targets,
   `aria-pressed`, `:focus-visible`, reduced motion) is unverified by tests, and the gaps noted in
   §8 are therefore invisible to CI.

**Untested behavior with a probable defect** (found by reading, not by a failing test):
`handleImport` re-homes every imported *player* to the active community
(`src/App.tsx:455-460`, `{ ...p, communityId: importCommunityId }`) while writing sessions,
tournaments, and saved squads with their original `communityId`. For a v4 (multi-community)
backup that produces records split across communities — players in the active community, their
sessions in the backup's community — which no screen can reconcile. The comment above the line
scopes the intent to "v1 backups (e.g. mpl-id-roster.json)", so the override looks like an
over-broad fix. No test covers importing a multi-community backup.

**Structural gap**: there is no coverage tooling (`@vitest/coverage-*` is absent from
`package.json`), so "what percentage is tested" cannot be answered, and no CI step would catch a
coverage regression. Given the strict-single-seam strategy, this is defensible for the core — but
it means the shell's untested growth is invisible.

## 7. DevOps & Deployment

### 7.1 Build System

Five scripts in `package.json`:

| Script | Command | Purpose |
|---|---|---|
| `dev` | `vite` | Dev server with HMR; no proxy config needed (no backend) |
| `build` | `tsc -b && vite build` | Type-check the project references, then bundle to `dist/` |
| `preview` | `vite preview` | Serves `dist/` on port 4173 — also the Playwright `webServer` |
| `test` | `vitest run` | One-shot unit run |
| `test:watch` | `vitest` | Watch mode |

Type checking is a real gate, not decoration: `tsc -b` uses project references
(`tsconfig.json` → `tsconfig.app.json` for `src`, `tsconfig.node.json` for `vite.config.ts`), and
`build` fails on any type error. The two projects intentionally differ: the app config sets
`noUnusedLocals: false` while the node config sets it `true`. Both set `noEmit`, so `dist/` comes
solely from Vite (one HTML entry + hashed assets; `dist/` is gitignored).

There is **no lint or format step**: no ESLint, Prettier, or `.editorconfig`. `noUnusedParameters`
is on for the app project, which mechanically removed the unused `format` parameter from
`isFormatCompatible` (prefixed `_format` in `src/tournament/tournament-domain-fix.ts:224`) — but
nothing else guards style, import order, or dead code. A commit in the history
(`a1645d4 fix(a11y,css): tap targets, unified chip states, repair malformed rules`) shows the CSS
file has already shipped malformed rules once.

### 7.2 CI/CD Pipeline

**None.** There is no `.github/workflows/`, no `.gitlab-ci.yml`, no `Jenkinsfile`, no `Makefile`,
no `bin/ci`, and no `turbo.json`/`nx.json`. Nothing runs `tsc`, `vitest`, or Playwright on push.
The project's own verification trail is instead embedded in commit messages and ticket files:
`.scratch/team-builder/issues/05-editable-results.md` records "42 unit tests green, tsc + build
clean", and `test-results/.last-run.json` records the last local Playwright status
(`passed`, no failed tests). Because `test-results/` and `playwright-report/` are committed,
that status travels with the repository — but it is a snapshot of one developer's last local run,
not a gate.

The practical consequence: `e2e/playwright.config.ts` sets `reuseExistingServer: true` and
`workers: 1`, which is convenient locally but would be wrong in parallel CI without a change, and
the 18 UI-driving specs each rebuild their fixture from scratch, so a naive CI run would be slow
but workable.

### 7.3 Deployment Architecture

Static hosting is the intended and only viable target: `vite build` emits a self-contained
`dist/` with no server-side component, no API, and no environment variables. There is no
`Dockerfile`, no `vercel.json`/`netlify.toml`, no Terraform/Pulumi/CDK, no base-path
configuration, and no cache-header policy, and the app never reads `import.meta.env` or any
`.env*` file (there are none in the repo). Any static host — a file server, GitHub Pages, S3 +
CloudFront — will serve it, provided the host does not need SPA-fallback rules (there is no URL
routing, so it does not). Google Fonts is the sole runtime network dependency, fetched from the
host's origin at page load.

### 7.4 Observability & Monitoring

There is no observability stack: no analytics, no error reporting (no Sentry/Rollbar), no metrics,
no tracing, no structured logging. Diagnostics are `console.error` in two places (tournament
validation failure, `src/App.tsx:713`) and unsuppressed `console.log` inside three committed
inspection specs. The one piece of built-in instrumentation — `SplitResult.solver.{optimal,
nodesExplored, elapsedMs}`, produced by both solver paths — is written to storage inside every
Session and Saved Squad but read by **no UI component**, so an operator can neither see that the
node budget was exhausted nor measure solver latency without a debugger. Given the local-first,
single-user design this is a defensible choice; given that fairness is the product's whole value
proposition, surfacing `optimal: false` ("best split found, not proven minimal") would be cheap and
meaningful.

### 7.5 Environment Management

There is no environment concept. Dev and production differ only in Vite mode (HMR vs. `dist/`),
and all persisted state is unprefixed (`tb-community`, `tb-theme`, `tb-layout`, `tb-rail`) in the
browser's storage for whatever origin serves the app. Running the app on two origins (e.g.
`localhost:5173` and a deployed host) therefore yields two independent datasets with identical
storage keys — which is also why the legacy-database migration exists at all: the rename from
`team-builder` to `comp3tive` would otherwise have stranded every existing install
(`src/storage/indexed-db.ts:14-18`).

## 8. Security Considerations

**Threat model.** comp3tive is a single-user, offline-by-design tool with no server, no accounts,
and no secrets. The realistic attack surface is therefore not authentication or authorization but
four things: (1) parsing untrusted files the user is asked to import, (2) rendering strings that
came from those files, (3) third-party resources loaded by the page, and (4) durability of the
data itself.

**No authentication or authorization exists** — and none is needed for the stated persona — but it
is worth stating plainly that the "Community" boundary is a *product* rule implemented as a
`communityId` filter in the shell, not a security boundary. Nothing prevents reading, exporting,
or deleting any record through the UI, and any script running on the origin (or anyone with access
to the browser profile) has full access to the IndexedDB database.

**No network I/O in application code.** Verified across `src/`: no `fetch`, `XMLHttpRequest`,
`WebSocket`, `sendBeacon`, or dynamic remote import. The only remote fetch is the Google Fonts
stylesheet in `index.html`. That is a small but real gap against the product's own offline
constraint, and the link has `preconnect` but **no Subresource Integrity and no CSP locking it
down**; there is no `<meta http-equiv="Content-Security-Policy">` anywhere, so a compromised font
origin would be a code-adjacent third party (CSS can only exfiltrate via selectors, but the
absence of a policy is still an avoidable default).

**XSS is effectively closed by construction.** There is no `dangerouslySetInnerHTML`, no
`innerHTML`, no `eval`, and no `new Function` in `src/`. Imported names, notes, tournament names,
and squad names are rendered as React text children, so React escapes them. The one DOM-writing
path — `document.documentElement.dataset.theme = themePref` (`src/App.tsx:186-196`) — assigns a
property, not markup, and the value comes from the app's own settings chips (a hand-edited
`localStorage` value cannot inject).

**The import path is shape-validated, not value-validated, and that is a reachable crash.** Two
gates exist and both are shallow:

- `parseBackup` (`src/data/transfer.ts:52-125`) requires string `id`/`name` and array
  `capabilities` on players, string ids on sessions/squads, and the right primitive types on
  tournaments — but it never inspects `capability.attributeRatings`, `eligibleRoles`,
  `preferredRole`, `Discipline.roles/attributes`, or the `SplitResult` embedded in sessions and
  squads. A capability with a missing attribute rating passes.
- `handlePlayerImport` (`src/App.tsx:515-620`) accepts any object with a truthy `name` and copies
  `capabilities` verbatim (`Array.isArray(p.capabilities) ? p.capabilities : []`).

The failure lands at render time: `computeStrength` throws on a missing rating
(`src/domain/strength.ts:26-31`), and it is called from `strengthsFor` during the roster render
and again from the split screen. There is no error boundary, so a crafted (or merely stale) file
produces a blank app. The mitigating factor is that the attacker must convince the user to import
a file; the impact is limited to that user's own browser. `validatePlayer`/`validateCapability`
already encode the exact rules and are unit-tested — they are simply never called in production
(§5.2).

**No prototype-pollution vector, but also no schema enforcement.** Records are reconstructed with
object spread (`{ ...p, communityId }`), which copies own enumerable properties without touching
`Object.prototype`, so a `"__proto__"` key in the JSON is inert. Conversely, nothing bounds input
size: a multi-hundred-megabyte JSON file is read fully into memory (`await file.text()`), parsed
synchronously, and then written record by record in a loop — a self-inflicted freeze. The merge
also has a correctness hazard described in §6.3: players are re-homed to the active community
while their sessions, tournaments, and squads keep the backup's community, which can strand
records across communities.

**The CSV importer is naive.** `handlePlayerImport` splits on `,`, strips leading/trailing quotes,
and takes columns positionally (`name`, `disciplineShort`, `strength`); it cannot handle a quoted
field containing a comma, and an unmatched discipline silently yields a player with *no*
capabilities. That is a data-integrity risk, not a security one, but it is the kind of quiet
partial success the rest of the app avoids.

**Data-at-rest and durability.** IndexedDB content is unencrypted and unversioned per record, so
anyone with the profile can read it, and no integrity check exists beyond IndexedDB itself. There
is no `navigator.storage.persist()` call and no autosave/backup reminder, which means the
documented migration path (`docs/adr/0001-client-only-first.md`: "Export/import … will be needed")
depends on the user remembering to use it. Browser eviction under storage pressure would be
indistinguishable from an empty database — the same failure mode the `loadError` banner was added
to address.

**Dependency posture is strong.** Two runtime dependencies and a committed lockfile; nothing with
a history of supply-chain incidents; no postinstall scripts. No `npm audit` or Dependabot is
configured, so that strength is maintained by the small surface rather than by process.

## 9. Assessment

### 9.1 Strengths

1. **The domain core is genuinely deep, pure, and proven.** `src/solver/solver.ts` and
   `src/tournament/bracket.ts` are two of the better modules in a project this size: no React, no
   storage, no clock (except a recorded `elapsedMs`), exhaustive doc headers stating their
   invariants, and an explicit statement of *why* each choice was made ("teams are ordered by
   their first (smallest) member, so each split is generated exactly once"). The bracket's
   `settle()` loop — re-deriving participants and clearing stale games after every edit — is the
   single mechanism that makes "results are always editable" work, and it is ~30 lines.
2. **Tests verify the algorithm rather than describing it.** The optimality tests compute a
   brute-force minimum gap and compare (`src/solver/solver.test.ts:117-133`); determinism is
   asserted by deep equality with the one non-deterministic field normalized; the migration tests
   assert the *refusal* semantics, not just the happy path. This is the difference between a suite
   that catches regressions and one that documents current behavior.
3. **Persistence is behind a real seam.** No file outside `src/storage/indexed-db.ts` imports
   IndexedDB; tests substitute `src/storage/memory.ts` or a scratch database name; ADR-0001's
   backend-replacement story is structurally true today, not aspirational.
4. **The legacy migration is exemplary for a rename.** Copy → verify per store → refuse to
   overwrite a non-empty target → treat seeded config as non-data → delete the source only after
   verification → leave the source intact if the delete is blocked. That is six deliberate
   decisions, each with a test, for what most projects would do with a one-line rename.
5. **Domain vocabulary is treated as an artifact.** `CONTEXT.md` defines each term *and its
   banned synonyms*, `src/domain/types.ts` quotes it inline, and the vocabulary is used
   consistently in identifiers (there is no `lineup`, no `squad`-as-team, no `game`-as-match).
6. **Accessibility was addressed as work, not as an afterthought.** A skip link, `aria-current`
   on navigation, `aria-pressed` on every toggle, `role="radiogroup"` for discipline selection,
   `role="listbox"`/`option` for the community dropdown, `aria-live="polite"` toasts with
   `role="status"`, 44 px minimum touch targets, `:focus-visible` outlines, and a
   `prefers-reduced-motion` block.
7. **Failure honesty where it was deliberately applied.** The `loadError` aggregate exists
   specifically so a failed read does not look like an empty app, and `SplitScreen` reports a
   failed persist with an inline "This arrangement wasn't saved." — both with in-file rationale.
8. **The visual language is specific.** Committing to a documented token system with a single
   accent and *reserving* team colors for team identity is a design decision with a stated
   rationale, and the CSS honors it.

### 9.2 Areas for Improvement

Ordered by impact. Items 1–3 are correctness or data-integrity defects, not polish.

1. **Make Re-roll actually re-roll.** `SplitScreen.reroll` calls `freshSplit` without a `variety`
   counter, so `fairSplit` runs deterministically and returns the same teams while the UI shows
   "Roll #N". Pass an incrementing counter (the machinery in `varietySplit` and
   `FairSplitOptions` already exists and is tested), and rebuild the pool from
   `session.poolPlayerIds` so players who sat out can return. Decide explicitly whether re-roll
   may trade fairness for novelty — `VARIETY_TOLERANCE = 0.1` is a reasonable default.
2. **Route the three bypassing deletes through their hooks.** `deletePlayer`
   (`src/App.tsx:482`), `deleteTournament` (`:762`), and the History screen's delete (`:1209`)
   call the store directly, so the in-memory list keeps the deleted row and the user sees a
   successful delete followed by a row that will not go away. The hook methods that fix this
   already exist and are used elsewhere in the same function body.
3. **Harden the import boundary.** Call `validatePlayer`/`validateCapability` on every imported
   player and every player loaded from storage, and add a `try/catch` around the roster render
   path (or an error boundary). Fix the merge so all imported records keep their own
   `communityId` unless they have none — the current player-only re-homing can orphan records
   across communities.
4. **Delete the dead modules.** `src/tournament/tournament-domain-fix.ts` (270 lines),
   `src/session/split-module.ts` (48), and `src/data/samplePlayers.ts` (73, test-only) are ~390
   lines of unused code, one of which duplicates a validator that *is* in use — an active
   confusion hazard for the next reader and for any agent working from repo context.
5. **Untrack the artifacts and add the missing ignore rules.** `playwright-report/` (a 507 KB
   committed HTML report), `test-results/`, and `.scratch/` are 28 tracked files that will produce
   noisy diffs and stale evidence; `.gitignore` currently covers only `node_modules/`, `dist/`,
   `*.tsbuildinfo`, and `.DS_Store`.
6. **Add an error boundary and catch the domain throws in the shell.** `applyResult`,
   `undoLastGame`, and `computeStrength` throw by design; two of the three call sites do not
   catch. A 20-line boundary converts "blank app" into "something went wrong, your data is safe".
7. **Replace `alert()`/`window.confirm()` with in-app equivalents.** Six `alert()` calls and five
   `window.confirm()` calls in the import/delete paths bypass the toast system, block the thread,
   and break the modal focus context; `TournamentScreen` already demonstrates the better inline
   two-step pattern.
8. **Surface solver provenance.** `optimal: false` (node budget exhausted) currently looks
   identical to a proven-minimal split. A one-line qualifier in the split header would keep the
   product's fairness claim honest under load.
9. **Address the offline claim.** Either self-host the two font families (the only remote
   dependency in an app that promises to work "at the futsal court with no signal") or state in
   the design doc that fallback fonts are acceptable.
10. **Consolidate the duplicated constants and helpers** (`BIB`, `FORMAT_LABEL`/`STATUS_LABEL`,
    `relativeTime`, the five copies of the modal skeleton) into shared modules — mechanical, and a
    precondition for changing any of them safely.

### 9.3 Risks & Technical Debt

**Correctness risks (user-visible):**

| Risk | Evidence | Impact |
|---|---|---|
| Re-roll is a no-op that claims success | `SplitScreen.tsx:255-264` + `edit.ts:110-117` + `solver.test.ts:94-114` | Spec story 24 unmet; user believes teams changed |
| Three deletes leave stale UI | `App.tsx:482`, `:762`, `:1209` | Row reappears after "successful" delete until reload |
| Unhandled domain throws | `App.tsx:359`, `:404` (no `try/catch`); no error boundary | Blank app on a rejected recording or bad imported data |
| Import merge can orphan records across communities | `App.tsx:455-460` writes players with the active id while sessions/tournaments keep theirs | Records invisible to every screen after a multi-community restore |
| Invalid persisted data crashes render | `computeStrength` throws (`strength.ts:26-31`) from `App.tsx:123-129`; validation never called | Blank app after a bad import |
| Swiss with 6 teams has an odd round | `pairRound` floats when a record group is odd (`bracket.ts:155-190`) | A team sits out a round; standings tie-break rules (wins → strength → game wins) may decide the title on strength rather than play |

**Documentation drift (a real risk in this repo, because agent context files point at these docs):**

| Document | Claim | Reality |
|---|---|---|
| `docs/FLOW.md` §1 | "Four bottom-nav hubs" (Roster/Tournaments/History/Squads); declares itself "the contract. The app must conform to it." | Five hubs with Home centered (`src/App.tsx:62-68`); the tournaments hub is labeled "Games" |
| `docs/adr/0004` | "`docs/FLOW.md` is the contract and the edge table there must stay in sync with the code" | FLOW.md predates ADR-0005 and was not updated |
| `docs/spec/0002` | DB v5, backup v3, per-match `seriesLength`, `nextMatchId` | DB v6, backup v4 (Saved Squads, ADR-0003); `seriesLength` is tournament-level; routing uses `winnerNext`/`loserNext` |
| `docs/spec/0002` / `DOMAIN_MODEL.md` | `TournamentTeam.players: [{playerId, roleId}]` (roles captured in the snapshot) | `TournamentTeam.players: Id[]` (`src/domain/types.ts:36-44`) — roles are not snapshotted |
| `docs/adr/0002` | Status `proposed` | The feature shipped and is the app's second hub |
| `DOMAIN_MODEL.md` | Describes a separate Session entity and a 4-week gap-closing plan | Sessions exist and are implemented; the plan's phases shipped long ago |
| `IMPLEMENTATION_PLAN.md` | Week-by-week plan for unbuilt tournament work | All four phases describe shipped behavior |
| `docs/FLOW.md` §3 | Breadcrumbs are links that navigate | No screen renders the shared `Breadcrumb`; `SplitScreen`'s crumb is a dead `<a href="#">` (`SplitScreen.tsx:294`) |

**Structural debt:**

- `src/App.tsx` at 1,280 lines / ~50 KB is the single largest file by 2.4× and the only place
  where navigation, persistence, and rendering interleave. Every feature so far has added to it
  (the git history shows five consecutive UI/shell commits touching it).
- `src/index.css` at 3,000 lines with no scoping, no linting, and computed-style assertions in
  e2e means the styling layer is simultaneously the hardest to change and the one with the
  most brittle tests.
- **No CI** for a project whose value proposition is a *provable* fairness property. The proof is
  in the test suite; nothing runs it on push.
- Committed report artifacts include Playwright traces/screenshots, which can embed application
  state (localStorage values, seeded data) — a small information-hygiene issue on top of the diff
  noise.
- Two conflicting versions of "what the tournament spec looks like" ship in the same repo
  (`tournament-validation.ts` in use, `tournament-domain-fix.ts` dead), which is exactly the kind
  of ambiguity that makes an AI-assisted codebase expensive to navigate.

### 9.4 Recommendations

Prioritized; effort and impact are low/medium/high. Items 1–4 are the ones that change user-visible
correctness or trust.

| # | Recommendation | Effort | Impact |
|---|---|---|---|
| 1 | Fix Re-roll: pass an incrementing `variety`, rebuild the pool from `session.poolPlayerIds`, and add an e2e/unit test asserting two re-rolls can differ | Low | High |
| 2 | Route `deletePlayer`, `deleteTournament`, and the History delete through their hooks (3 one-line changes) | Low | High |
| 3 | Wire `validatePlayer` into `PlayerEditModal` save, `handlePlayerImport`, and every store read; add an error boundary around the app tree | Medium | High |
| 4 | Fix the import merge so records keep their own `communityId` unless absent; add a multi-community import test | Low | High |
| 5 | Delete `tournament-domain-fix.ts`, `split-module.ts`, `samplePlayers.ts` (and the dead `canResplit` notice); untrack `playwright-report/`, `test-results/`, `.scratch/`; extend `.gitignore` | Low | Medium |
| 6 | Add a minimal CI workflow: `npm ci && npm run build && npm test`, then Playwright with `workers: 2` and a fresh server | Low | High |
| 7 | Extract the shell: a `useNavigation` hook for the view stack, a `useSplitFlow` hook for `split`/`consumeTeams`/`recordResult`, and screens rendered from a switch. Target < 400 lines for `App.tsx` | Medium | High |
| 8 | Replace `alert()`/`window.confirm()` with toasts and inline confirmations; funnel every failure through `notify()` | Low | Medium |
| 9 | Surface `SplitResult.solver.optimal` in the split header ("proven minimal" vs "best found") | Low | Medium |
| 10 | Self-host the two font families, or document the fallback as intentional | Low | Low |
| 11 | Consolidate duplicated constants/helpers and adopt the existing `Breadcrumb` + `Screen`/`PageHeader` primitives everywhere | Low | Medium |
| 12 | Prune or regenerate the stale docs (`DOMAIN_MODEL.md`, `IMPLEMENTATION_PLAN.md`, FLOW.md §1/§3, spec 0002's data model, ADR-0002's status) so agent context and human context agree with the code | Low | Medium |
| 13 | Add coverage reporting (`@vitest/coverage-v8`) and an ESLint config; promote `noUnusedLocals` to `true` in the app project | Low | Medium |
| 14 | Rework the weak e2e specs: delete the three `inspect*` files, un-skip or delete `review.spec.ts`, and move deterministic seeding (the `dashboard.spec.ts` `addInitScript` pattern) into a shared fixture used by every spec | Medium | Medium |

## Appendix

### A. File Tree (Top 3 Levels)

```
team-builder/
├── src/
│   ├── App.tsx                    1,280   shell: view stack, state, handlers, rendering
│   ├── DashboardScreen.tsx          273   Home hub
│   ├── dashboardTeasers.ts           29   recent players / active tournaments
│   ├── nav.tsx                       32   Breadcrumb (unused)
│   ├── main.tsx                      10   createRoot + StrictMode
│   ├── index.css                  3,000   tokens, layout, components (hand-written)
│   ├── vite-env.d.ts                  1
│   ├── ui/
│   │   ├── Screen.tsx                16
│   │   └── PageHeader.tsx            27
│   ├── domain/
│   │   ├── types.ts                 195   Community, Player, Discipline, Session, Tournament…
│   │   ├── seed.ts                   52   Futsal + MLBB
│   │   ├── strength.ts               36   "mean" model + dispatcher
│   │   ├── validation.ts             71   player/capability invariants
│   │   ├── community-removal.ts      79   cascade delete
│   │   ├── useCommunities.ts        115   community hook (active pin, default creation)
│   │   ├── useDisciplines.ts         64   catalog hook (+ sample-data generation)
│   │   ├── DisciplinesScreen.tsx    120
│   │   ├── DisciplineEditModal.tsx  344
│   │   ├── index.ts                   4
│   │   ├── validation.test.ts        83
│   │   ├── seed.test.ts              32
│   │   ├── strength.test.ts          41
│   │   └── community-removal.test.ts 115
│   ├── roster/
│   │   ├── useRoster.ts              59
│   │   └── PlayerEditModal.tsx      330
│   ├── session/
│   │   ├── MatchScreen.tsx          195
│   │   ├── SplitScreen.tsx          419
│   │   ├── HistoryScreen.tsx        110
│   │   ├── SquadsScreen.tsx         195
│   │   ├── edit.ts                  117   swapPlayers / recomputeResult / freshSplit
│   │   ├── flow.ts                   61   capabilityFor / strengthOf / describeFlags
│   │   ├── split-module.ts           48   DEAD
│   │   ├── useSessions.ts            50
│   │   ├── useSavedSquads.ts         51
│   │   └── edit.test.ts              95
│   ├── solver/
│   │   ├── solver.ts                687   ★ exact fair-split search
│   │   └── solver.test.ts           259
│   ├── tournament/
│   │   ├── bracket.ts               327   ★ bracket/Swiss/Series state machine
│   │   ├── TournamentScreen.tsx     537
│   │   ├── GamesScreen.tsx          398
│   │   ├── tournament-validation.ts  68   in use
│   │   ├── tournament-domain-fix.ts 270   DEAD
│   │   ├── team-participation-validator.ts 97
│   │   ├── useTournaments.ts         51
│   │   └── bracket.test.ts          301
│   ├── storage/
│   │   ├── indexed-db.ts            337   six stores + legacy migration
│   │   ├── types.ts                  47   the ADR-0001 seam
│   │   ├── memory.ts                 75
│   │   ├── index.ts                   3
│   │   ├── indexed-db.test.ts       133
│   │   └── migration.test.ts        196
│   └── data/
│       ├── transfer.ts              156   backup v4 serialize/parse
│       ├── sample-data.ts           121   sample roster registry + generator
│       ├── samplePlayers.ts          73   test-only fixture
│       ├── transfer.test.ts         168
│       └── sample-data.test.ts      101
├── e2e/
│   ├── playwright.config.ts          23
│   ├── pages/{base.page.ts, split.page.ts}
│   └── tests/
│       ├── dashboard/dashboard.spec.ts      543   seeded, 84 assertions
│       ├── squads/saved-squad.spec.ts       100
│       ├── settings-panel/{settings,viewport}.spec.ts  72 / 39
│       ├── match-setup/setup.spec.ts         70
│       ├── community/{cancel-dropdown,community}.spec.ts 68 / 55
│       ├── panel/no-overlap.spec.ts          66
│       ├── discipline/discipline.spec.ts     47
│       ├── tournament/{create,draft,inspect,inspect2,inspect3,journey,review,split-tourney}.spec.ts
│       │                                     45/42/41/39/67/41/13/43
│       ├── history/history.spec.ts           39
│       └── split-flow/split.spec.ts          22
├── docs/
│   ├── spec/{0001-team-builder-v1.md, 0002-tournaments-v1.md}
│   ├── adr/{0001-client-only-first, 0002-tournament-first-flow, 0003-saved-squads,
│   │         0004-origin-aware-navigation, 0005-dashboard-first}.md
│   ├── agents/{domain.md, issue-tracker.md, triage-labels.md}
│   ├── superpowers/plans/{2 files}, superpowers/specs/{1 file}
│   ├── design.md, FLOW.md, BUSINESS_FLOW_REVIEW.md
├── sample-data/{futsal-roster.json, mpl-id-roster.json}
├── prototype/index.html
├── .scratch/team-builder/{spec.md, issues/…16 tickets, dashboard/…}
├── playwright-report/{index.html, data/}
├── test-results/.last-run.json
├── CONTEXT.md · DESIGN.md · DOMAIN_MODEL.md · IMPLEMENTATION_PLAN.md · PRODUCT.md · CLAUDE.md
├── index.html · vite.config.ts · tsconfig{,.app,.node}.json · package.json · package-lock.json
└── tourney-draft{,-v2,-v3}.png
```

### B. Dependency Catalog

**Runtime (2)** — `package.json` has no other `dependencies`.

| Package | Range | Role |
|---|---|---|
| `react` | ^19.1.0 | UI runtime; `StrictMode` is on in `src/main.tsx` |
| `react-dom` | ^19.1.0 | Renderer (`createRoot`) |

**Development (7)**

| Package | Range | Role |
|---|---|---|
| `typescript` | ^5.8.0 | Type checking only (`noEmit`); `tsc -b` gates `npm run build` |
| `vite` | ^6.3.0 | Dev server + production bundler |
| `@vitejs/plugin-react` | ^4.4.0 | JSX/React fast refresh |
| `vitest` | ^3.1.0 | Unit runner (`environment: "node"`, `src/**/*.test.ts`) |
| `fake-indexeddb` | ^6.2.5 | In-memory IndexedDB for storage/migration tests |
| `@playwright/test` | ^1.62.1 | E2E runner + `webServer` orchestration |
| `@types/react`, `@types/react-dom`, `@types/node` | ^19.1.0 / ^19.1.0 / ^22.15.0 | Type definitions |

**Transitive/runtime network**

| Resource | Where | Notes |
|---|---|---|
| Google Fonts (`Outfit`, `Familjen Grotesk`) | `index.html` | The app's only network request; no SRI, no CSP, contradicts the offline constraint |
| `sample-data/*.json` | bundled at build time via `import ... from "../../sample-data/…"` | 25 players each; used by the sample-data registry and `transfer.test.ts` |

**Absent by design** (each verified): no router, no state manager, no CSS framework or
CSS-in-JS, no schema/validation library (Zod et al.), no date library, no test-coverage package,
no linter/formatter, no error-reporting SDK, no crypto/id library (`crypto.randomUUID` is used
directly).

### C. Key File Reference

| Purpose | File |
|---|---|
| Application shell: navigation, state, all handlers | `src/App.tsx` |
| Domain glossary (the vocabulary contract) | `CONTEXT.md` |
| All domain types | `src/domain/types.ts` |
| Fair-split solver (exact search, variety path) | `src/solver/solver.ts` |
| Solver settings + pool extraction + role assignment | `src/solver/solver.ts` (`buildSettings`, `poolFromPlayers`, `assignTeamRoles`) |
| Tournament state machine | `src/tournament/bracket.ts` |
| Split editing (swap / recompute / fresh split) | `src/session/edit.ts` |
| Strength model + dispatcher | `src/domain/strength.ts` |
| Player/capability invariants (currently unwired) | `src/domain/validation.ts` |
| Seed disciplines (Futsal, MLBB) | `src/domain/seed.ts` |
| Store interfaces (ADR-0001 seam) | `src/storage/types.ts` |
| IndexedDB adapters + legacy migration | `src/storage/indexed-db.ts` |
| In-memory stores (tests) | `src/storage/memory.ts` |
| Backup format v4 (serialize/parse/migrate v1→v4) | `src/data/transfer.ts` |
| Community cascade delete | `src/domain/community-removal.ts` |
| Dashboard teaser selection | `src/dashboardTeasers.ts` |
| Referee-voice flag copy | `src/session/flow.ts` (`describeFlags`) |
| Tournament spec validation (per-format team counts) | `src/tournament/tournament-validation.ts` |
| Split result UI (gap meter, swap, re-roll, save) | `src/session/SplitScreen.tsx` |
| Match setup UI (pool, discipline, stepper) | `src/session/MatchScreen.tsx` |
| Tournament detail UI (draft / review / bracket / results) | `src/tournament/TournamentScreen.tsx` |
| Tournament list + create modal | `src/tournament/GamesScreen.tsx` |
| Design tokens and rationale | `DESIGN.md`, `docs/design.md` |
| Navigation contract (normative, partly stale) | `docs/FLOW.md` |
| Product brief | `PRODUCT.md` |
| Feature specs | `docs/spec/0001-team-builder-v1.md`, `docs/spec/0002-tournaments-v1.md` |
| Architecture decisions | `docs/adr/0001`–`0005` |
| Unit test harness config | `vite.config.ts` (`test` block) |
| E2E harness config | `e2e/playwright.config.ts` |
| Deterministic e2e seeding pattern | `e2e/tests/dashboard/dashboard.spec.ts` (`seedScript`, `gotoSeeded`) |
| Dead code (safe to delete) | `src/tournament/tournament-domain-fix.ts`, `src/session/split-module.ts`, `src/data/samplePlayers.ts` |
