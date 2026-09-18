# 10: CI runs the checks

**Status:** ready-for-agent

**What to build:** Every push and pull request runs typecheck, unit tests, build and the browser suite, and a red run blocks the change. The proof that the split is fair stops depending on someone remembering to run it.

**Evidence (absorbed from `.scratch/app-health/issues/04`, measured 2026-09-17).** There is no CI at all: no `.github/`, no `Jenkinsfile`, no `Makefile`, and **no `e2e` script in `package.json`** — the scripts are `dev`, `build` (`tsc -b && vite build`), `preview`, `test` (`vitest run`), `test:watch`, `capture:hero`. `npx playwright test` with no arguments finds nothing, because the config lives in `e2e/`. The suite is 12 unit test files / 114 tests plus 20 spec files / 42 tests — trusted work that nothing verifies.

**Acceptance criteria:**
- [ ] `package.json` gains exactly the script frozen in the contracts file: `"e2e": "playwright test --config=e2e/playwright.config.ts"` — and nothing else (no `lint`, no `type-check`, no `coverage` alias, so Phase C30's `engines`/`.nvmrc` edits do not collide with this line)
- [ ] New `.github/workflows/ci.yml` runs on `push` and `pull_request` on `ubuntu-latest` with `node-version: 22` and `cache: npm`
- [ ] Steps run in this order: checkout → setup-node → `npm ci` → `npx tsc -b` → `npx vitest run` → `npx vite build` → `npx playwright install --with-deps chromium` → `npm run e2e`
- [ ] **`npx vite build` precedes the e2e step in the same job**, because `e2e/playwright.config.ts:20-24` starts `npm run preview` and `vite preview` serves `dist/`; on a fresh runner `reuseExistingServer: true` finds no server, so Playwright starts one against the bundle just built. This is the mitigation for the audit's environment note about a day-old preview server
- [ ] The job fails on any red step — no `continue-on-error`, no `|| true`, no `if: always()` on the check steps
- [ ] On failure, `playwright-report/` is uploaded via `actions/upload-artifact` with `if: failure()` (the report is untracked by ticket 09, so this is how a red run is inspected)
- [ ] `npx tsc -b` in CI covers `e2e/**` as well as `src/`, via ticket 01's `e2e/tsconfig.json` project reference
- [ ] `workers: 1` in `e2e/playwright.config.ts:7` is **not** changed here, and `retries` stays `0` — ticket 11 owns the workers measurement, and a suite that needs retries hides the class of debt this phase removes
- [ ] **No coverage step and no threshold gate** — the original ticket's coverage ask is dropped: it would gate a number nobody has chosen a threshold for, and this phase's exit criterion is a green suite, not a coverage figure. If a coverage number is wanted, it is a separate ticket with a measured baseline
- [ ] **No deploy step and no ESLint** — the Cloudflare configuration is Phase D's business, and a fresh ESLint config against 9,300 lines is a large first-run diff that needs its own pass
**The job's shape**, so the plan does not have to re-derive it:

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

Every `run` step is bare — no `|| true`, no `continue-on-error`. The upload is the only step
allowed to be conditional, and it is conditional on **failure**, so it can never mask one.

**Why the order is not arbitrary.** `e2e/playwright.config.ts:20-24` declares
`webServer: { command: "npm run preview", url: "http://localhost:4173/app/",
reuseExistingServer: true }`. `vite preview` serves `dist/`, so an e2e run against a tree
whose `dist/` is older than `src/` tests the wrong code. On a clean runner there is no
server to reuse, but the build step must still precede the run in the same job — otherwise
`npm run preview` serves whatever `dist/` a previous step happened to leave. The audit hit
exactly this hazard locally: the dev server on port 4173 was a `vite preview` with
**uptime over one day**, and it was only after confirming the served assets matched a fresh
build (`index-CgrHkb71.css`) that the 16 failures were accepted as real rather than stale.

**What CI does not do, and why.** It does not run a coverage gate (no number exists to gate
on; a threshold picked blind is either meaningless or a permanent red build), does not
deploy (Cloudflare config is Phase D's business), does not lint (a fresh config against
9,300 lines is a large first-run diff, per the roadmap's out-of-scope list), and does not
run the unit and browser suites in separate jobs (the browser suite needs the build from the
same revision, and splitting them would duplicate the install).

**Blocked by:** 01, 02, 09 — the workflow must be green on the tree it is added to, and it must not be written against the five specs that ticket 09 deletes
