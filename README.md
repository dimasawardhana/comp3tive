# comp3tive

Split a roster of rated players into balanced teams, then run a tournament on teams you can hand it
— either the ones the solver just made, or a Saved Squad you kept.

- **Disciplines.** Three ship seeded — futsal, MLBB, badminton (`src/domain/seed.ts`) — and the
  Disciplines screen adds more (`src/domain/DisciplinesScreen.tsx`).
- **Balance.** The solver reads each player's rating *and* their roles, and reports the gap between
  the teams. Not every player reaches a team: when the requested team sizes leave nobody on the
  bench, the surplus comes back in `SplitResult.unassigned` and the split screen names each one —
  *"<name> sits out tonight."* (`src/domain/types.ts`, `src/solver/solver.ts`,
  `src/session/flow.ts`)
- **The gap, honestly.** When the search stops short of a minimum, the screen says **"Best gap
  found."** When it does not, the screen says nothing — and that silence is not always a proof. A
  manual swap is not a search: the edited result carries `solver.optimal: true` with zero nodes
  explored, so after you swap two players by hand the qualifier is suppressed and you get a bare
  `Gap 0.3` for an arrangement nobody proved minimal. `src/session/gapProvenance.ts` documents the
  case in its own header: *"no search ran, not this arrangement is minimal."*
- **Formats.** Series, single elimination, or Swiss (`TournamentFormat` in `src/domain/types.ts`).
- **Your data.** Rosters, Saved Squads, Sessions and Tournaments live in this browser's IndexedDB
  (`src/storage/indexed-db.ts`). Two smaller things live in `localStorage`: which Community is
  active (`src/domain/useCommunities.ts`, which "drives every roster/session filter in the app")
  and theme/layout preferences (`src/shell/usePreferences.ts`). Neither leaves the device.
- **No account, no server** in this build, and the Landing Page's trust row says the same. The
  optional backend and Accounts are decided in `docs/adr/0007-optional-backend.md` and
  `docs/adr/0008-account-identity.md` and tracked in `.scratch/backend/` — none of it is built.

`CONTEXT.md` is the authoritative vocabulary — Organizer, Community, Player, Discipline, Team,
Tournament, Saved Squad, and the rest. This README uses those words and does not redefine them.

## Two documents, two paths

The site is two plain static documents in one Vite build, not a router
(`docs/adr/0006-landing-page-and-app-paths.md`):

- `/` — the Landing Page, a static document that explains the product (`index.html`).
- `/app/` — the app (`app/index.html`).

`vite.config.ts` sets `appType: "mpa"` and gives the build two `rollupOptions.input` entries, so
there is no SPA fallback and no deep link below `/app/` — `/app/roster` 404s by design. In
production the static assets are served by a Cloudflare static-assets Worker (`wrangler.jsonc`),
whose `not_found_handling` must never be `single-page-application`: that value would serve the
Landing Page under every unmatched path, including under `/app/`. It is `404-page`.

## Requirements

Node, and nothing else. The floor lives in `package.json`'s `engines.node`; `.nvmrc` pins
`24.16.0`, which is inside it.

**The floor is advisory — nothing enforces it.** This repo sets no `engine-strict`, so `npm ci` and
`npm install` on an unsupported Node print an `EBADENGINE` warning and install anyway. The floor
records the range this tree has been checked against, not a gate: a Node below it can install, and
if something is genuinely broken there, the failure surfaces as a bad build or a missing native
binding rather than a refused install. Tracked in
[`.scratch/app-health/issues/16-the-engine-floor-is-advisory.md`](.scratch/app-health/issues/16-the-engine-floor-is-advisory.md).

The floor is the intersection of every `engines.node` in `package-lock.json`, and exactly one
package binds it: `@napi-rs/lzma-linux-x64-gnu`, the native binding `rollup` pulls in **on
linux-x64 only**. It is an *optional* dependency, so on macOS or Windows npm never installs it and
its range constrains nothing — which is why a Mac on Node 23 is outside the floor for a package
that would not have been fetched there.

`npm` itself is deliberately not pinned: no `package.json` script invokes it. The only npm calls
anywhere in the tree are the `npm run …` aliases below, the Playwright `webServer` command
(`npm run preview`), and CI's `npm ci`.

The declared toolchain floors, all in `package.json`: React 19.1, TypeScript 5.8, Vite 6, Vitest 3,
Playwright 1.62, `@types/node` 22.15.

## Commands

| Command | What it does |
|---|---|
| `npm ci` | Install exactly the tree in `package-lock.json` (what CI runs) |
| `npm install` | Install dependencies |
| `npm run dev` | Vite dev server |
| `npm run build` | `tsc -b && vite build` into `dist/` |
| `npm run preview` | Serve `dist/` on port 4173 |
| `npm test` | Unit tests — Vitest, `src/**/*.test.ts` |
| `npm run test:watch` | Unit tests in watch mode |
| `npm run e2e` | The browser suite — Playwright |
| `npm run capture:hero` | Drive a real split in Chromium and self-check the screenshots it takes |

`npm test` and `npm run test:watch` are unit tests only. The `.tsx` screens have no component tests
by design; anything that needs a real browser goes through `npm run e2e`.

## Running the browser suite

`npm run e2e` runs `playwright test --config=e2e/playwright.config.ts`. **A bare `npx playwright
test` finds nothing**, because the config lives in `e2e/` — there is no `playwright.config.ts` at
the repository root. The 22 specs are in `e2e/tests/`, and `testDir` is `./tests` relative to the
config, so one file is addressed as:

```bash
npm run e2e -- tests/squads/saved-squad.spec.ts
```

The config's `webServer` is `npm run preview` with `cwd: ".."` and `reuseExistingServer: true`, so
a preview server that is already up will be reused — and a stale one serves old assets. Run
`npm run build` before trusting a run.

`npm run capture:hero` has the same prerequisite by hand: it drives a real Chromium against
`http://localhost:4173/app/`, so `npm run build && npm run preview` must already be serving. It
seeds a fictional roster, captures the split screen at two viewports (390×1100 and 1280×800), and
checks both the rendered DOM and the image pixels, so a blank or broken shot fails instead of
shipping. The `hero-split-*.png` and `hero-full-*.png` it writes to `public/` are **referenced by
nothing** — the Landing Page's hero is a live React component mounted into `#landing-hero`
(`src/landing.tsx`), not an image, and `index.html` contains no `<img>`. The script is a
capture-and-verify tool; treat its output as a diagnostic, not an asset.

## Where the repo's knowledge lives

| Path | What is there |
|---|---|
| `CONTEXT.md` | The glossary — authoritative |
| `PRODUCT.md` | The product brief |
| `DESIGN.md` | The design direction ("Paper & Pencil") |
| `CLAUDE.md` | What an agent should read first |
| `contracts.md` | The cross-phase contract: phase order and file ownership |
| `docs/adr/` | Eight numbered decisions |
| `docs/FLOW.md` | The navigation contract: screens, breadcrumbs, back targets |
| `docs/archive/DOMAIN_MODEL.md` | The shipped domain model, archived under a superseded banner — `CONTEXT.md` is the live glossary |
| `docs/agents/` | The issue-tracker and triage conventions |
| `.scratch/` | Tickets, committed on purpose |
| `sample-data/` | Three sample rosters, one per seeded discipline |

## What this README does not claim

There is no service worker, no web-app manifest and no installable app, so nothing here is cached
for offline use by the browser. Both documents load their two typefaces from a CDN, so a first
visit with no signal renders in whatever fallback the browser picks — the app still functions, and
that font gap is tracked in
[`.scratch/app-health/issues/13-the-offline-promise-fonts.md`](.scratch/app-health/issues/13-the-offline-promise-fonts.md).

There is no backend and no account in this build, as above. The "no account, no server" line on
the Landing Page describes what ships today, not what is planned.
