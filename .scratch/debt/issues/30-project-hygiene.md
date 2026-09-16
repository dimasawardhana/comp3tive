# 30: Project hygiene: README, engine floor, node pin

**Status:** ready-for-agent

**What to build:** A newcomer — human or agent — can open the repo root and learn what the
product is, how to run everything, and which Node version it needs, without reading
`package.json` and guessing.

**Evidence.** Verified at the repo root: **no `README.md`**, **no `.nvmrc`**, and no `engines`
field in `package.json` (29 lines, scripts `dev`/`build`/`preview`/`test`/`test:watch`/
`capture:hero`, plus `e2e` added by Phase A's A10). The Node floor is therefore implicit and
undiscoverable, and the two facts a reader most needs — that the app and the Landing Page are
two documents at two paths, and that the browser suite's config lives in `e2e/` so a bare
`npx playwright test` finds nothing — exist only in `docs/` and in the audit.

**1. `README.md`**, covering, in this order:

- **What it is and who for.** comp3tive splits a roster into balanced teams for a recurring
  game night and runs the tournament. Local-first, single-user, no account, no server
  (ADR-0001). The domain vocabulary lives in `CONTEXT.md`, which is authoritative.
- **Two documents, two paths** (ADR-0006): `/` is the Landing Page (a plain static document);
  `/app` is the app. `appType: "mpa"` in `vite.config.ts` — no SPA fallback. Static assets are
  served by a Cloudflare static-assets Worker (`wrangler.jsonc`), where
  `not_found_handling` **must not** be `single-page-application` or the Landing Page would be
  served under `/app/`.
- **Requirements.** Node per `engines`/`.nvmrc` below; nothing else.
- **Commands**, each one verified to exist in `package.json` scripts: `npm install`,
  `npm run dev`, `npm run build`, `npm run preview`, `npm test`, `npm run test:watch`,
  `npm run e2e`, `npm run capture:hero`.
- **Running the browser suite**: `npm run e2e` (the script added by A10); the config is
  `e2e/playwright.config.ts`, so a bare `npx playwright test` finds nothing. The suite needs a
  fresh `dist/` — rebuild before trusting a run — and its `webServer` is
  `npm run preview` on port 4173 with `reuseExistingServer: true`, so a stale preview can serve
  old assets.
- **Where the repo's knowledge lives**: `CONTEXT.md` (glossary, authoritative), `docs/adr/`
  (six decisions, numbered), `docs/FLOW.md` (the navigation contract), `docs/agents/` (the
  issue-tracker and triage conventions), `.scratch/` (tickets, committed on purpose).
- **What this README does not claim.** No service worker, no offline support, no accounts, no
  backend — those are Phase D's work and this README describes this HEAD.

**2. `package.json` gains an `engines` floor derived from the lockfile, not guessed:**

| Package | Declared engine | Installed |
|---|---|---|
| `vite` | `^18.0.0 \|\| ^20.0.0 \|\| >=22.0.0` | 6.4.3 |
| `vitest` | `^18.0.0 \|\| ^20.0.0 \|\| >=22.0.0` | 3.2.7 |
| `@playwright/test` | `>=20` | 1.62.1 |
| `@napi-rs/lzma-linux-x64-gnu` (rollup optional dependency, installed) | `^22.20 \|\| ^24.12 \|\| >=25` | 1.5.1 |
| `@types/node` | none (types only) | 22.20.1 |

The intersection of the constraints actually enforced at install time is `>=22.20 <23 || >=24.12`:

```jsonc
"engines": { "node": ">=22.20 <23 || >=24.12" }
```

This excludes the 23.x and 24.0–24.11 ranges the installed native optional dependency refuses,
while admitting the 22.20+ line and current 24.x. `npm` is deliberately **not** pinned: no
script calls it beyond the documented `npm run …` aliases.

**3. `.nvmrc`** pins `24.16.0`, the version this repo was last verified green on
(`node -v` → `v24.16.0`).

Developer floors, for the README's requirements line: React 19.1, TypeScript 5.8, Vite 6,
Vitest 3, Playwright 1.62 and `@types/node` 22.15 as declared in `package.json`.

**Acceptance criteria:**
- [ ] `test -f README.md` and `test -f .nvmrc` both succeed; `.nvmrc` contains `24.16.0`
- [ ] `jq -r '.engines.node' package.json` prints `>=22.20 <23 || >=24.12`
- [ ] Every command the README names appears as a key in `package.json`'s `scripts` — checked by extracting the backticked `npm run …` names and diffing them against `jq -r '.scripts | keys[]' package.json`
- [ ] Every path the README names exists — checked by extracting the backticked paths and testing each with `test -e`
- [ ] The README makes no offline, install, account or backend claim: `grep -niE "service worker|offline|installable|manifest|account|server|sync" README.md` returns only lines that explicitly deny the claim
- [ ] The README states that the browser suite's config is `e2e/playwright.config.ts` and that a bare `npx playwright test` finds nothing
- [ ] `npx tsc -b` stays green after the `package.json` edit (the file is not type-checked, but nothing else in it changes)

**Blocked by:** 29 — it is the last ticket, and the README describes the file layout the previous
nine produce (`src/shell/**`, `src/ui/constants.ts`, `src/split.css`).
