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
  found."** When it does, it stays silent on that point — and the silence is not a bare number:
  the readout always states a result, either `Gap 0.3. <Team> leads.` or, when `balanced` — a gap
  of 0.1 or less (`:231`) — `Dead even. Fair game.` (`src/session/SplitScreen.tsx:141-150`). A manual swap is not a
  search, so an edited result is stamped `solver.optimal: false` (`src/session/edit.ts:72`) and
  gets the qualifier like any other unproven result: `Gap 0.3. <Team> leads. Best gap found.`, or
  `Dead even. Best gap found.` It never claims an arrangement is minimal when nobody searched for
  one. `src/session/gapProvenance.ts` documents the rule in its own header: *"no search ran, not
  this arrangement is minimal."*
- **Formats.** Series, single elimination, Swiss and round robin — all four are chips in the
  create modal (`SELECTABLE_FORMATS` in `src/ui/constants.ts:33-38`, rendered at
  `src/tournament/GamesScreen.tsx:329`), and `TournamentFormat` in `src/domain/types.ts:25` names
  exactly those four.
- **Your data.** Rosters, Saved Squads, Sessions and Tournaments live in this browser's IndexedDB
  (`src/storage/indexed-db.ts`). Smaller things live in `localStorage`: which Community is active
  (`src/domain/useCommunities.ts`, which "drives every roster/session filter in the app"),
  theme/layout preferences (`src/shell/usePreferences.ts`), and the two durability keys —
  when a backup was last exported and when the export nudge was last dismissed
  (`src/shell/useDurability.ts`). None of it leaves the device.
- **Nothing promises your data is safe.** The roster screen says what the browser *reported*
  about persistent storage, *this page load* — never that the data is safe, and never that it is
  at risk — and every version of the sentence ends in the same instruction: keep a backup. A
  non-persistent bucket is evicted under storage pressure, and anyone can clear site data with
  one tap, so a reassurance would be a promise the app cannot keep. Once the roster is worth
  losing, the Dashboard also asks for a backup outright, and closing that prompt snoozes it
  rather than silencing it. Export is the durability story: a file the organizer owns is the one
  copy the browser cannot reach. It is not the only copy the organizer can lose.
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
the repository root. The 32 specs are in `e2e/tests/`, and `testDir` is `./tests` relative to the
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

Three of the four things this section used to deny ship, so they are stated first rather than
removed:

- **A service worker.** `public/sw.js` (12,894 B) — a classic worker, no imports, no workbox —
  scoped to `/`, so one worker covers both documents. It precaches the hashed `/assets/*`, the
  five `/fonts/*.woff2`, the three `/icons/*` and six URLs — `/`, `/index.html`, `/app/`,
  `/app/index.html`, `/404.html`, `/manifest.webmanifest` (`vite.config.ts:22-29,93`) — under
  `comp3tive-<12 hex>`. The hex is a sha256 over those files' paths *and bytes*, so a deploy that
  changes anything precached renames the cache and the old one is deleted on activation.
- **A web-app manifest, and so an installable app.** `public/manifest.webmanifest` (597 B):
  `start_url: "/app/"`, `display: "standalone"`, three icons from `public/icons/`. Both documents
  link it beside a `theme-color` and an `apple-touch-icon` (`index.html:55-58`,
  `app/index.html:33-36`).
- **Self-hosted typefaces.** Five `woff2` files and their two OFL licences in `public/fonts/`,
  declared by five `@font-face` rules (`src/fonts.css:36-75`). `grep -c
  "fonts\.googleapis\|fonts\.gstatic"` over `index.html`, `app/index.html` and `public/404.html`
  returns **0, 0, 0**, and no `preconnect` is left in any of them — so no request leaves the origin
  to render a glyph. The standalone `public/comp3tive.svg` has no cascade to route through, so it
  declares its own face: the local `woff2`, on a relative URL, not a remote one.

**The offline claim, scoped to what is actually proven.** `e2e/tests/pwa/offline.spec.ts` drives a
real Chromium against a real `vite preview` and proves seven things: neither document reaches a
host other than the origin; the app and the Landing Page each open with the network cut; a font and
a module behind an `await import()` are served from the cache; a whole tournament runs; and a new
build activates and purges the old cache. **No production deploy has happened**, so none of that has
been shown against a deployed origin. `{ ignoreVary: true }` (`public/sw.js:171`) is the largest
unverified assumption in the branch — `vite preview` sends `Vary: Origin` on everything it serves,
and a real host may not (`docs/ROADMAP.md`, gates 2 and 3).

Two conditions travel with the claim, and both are the ones the Landing Page's own restored
sentence carries. **Only the app registers the worker** (`src/main.tsx:11`; `src/landing.tsx` never
`register`), so a device that has only ever read the Landing Page has no worker and no cache at
all — which is why `index.html:213` reads *"Once comp3tive has run with a network…"*. And the
worker calls `skipWaiting` without `clients.claim()`, so the visit that installs it is not the
visit it controls.

What is genuinely still absent, read out of the tree rather than assumed:

- **No backend, no account, no server**, as above. `wrangler.jsonc` is an assets-only Worker with no
  Worker script and no `main`; `/api/*` is reserved for the planned backend and claimed by nothing
  here. The "no account, no server" line on the Landing Page (`index.html:211`) describes what
  ships today, not what is planned.
- **No sync, no push, no background work.** `public/sw.js` registers exactly three listeners —
  `install`, `activate`, `fetch` — and there is no `sync` or `periodicsync`. Nothing in `src/` opens
  a network connection at all, so there is no telemetry, no error reporting, and no third-party
  request of any kind at runtime.
- **No install prompt.** The app is installable by manifest, but nothing in the tree listens for
  `beforeinstallprompt` or `appinstalled`; the browser's own affordance is the only one, and the
  app never asks.
- **Nothing is cached before a first online visit.** A cache exists only once `/app/` has run with
  a network — the same condition the offline sentence above is scoped to.
