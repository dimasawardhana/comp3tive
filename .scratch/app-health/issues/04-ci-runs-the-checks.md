# 04 — CI runs the checks

**What to build:** Every push and pull request runs typecheck, unit tests, coverage and build, then
the Playwright suite — and a red run blocks the change. The proof that the split is fair stops
depending on someone remembering to run it.

**Evidence.** There is no CI at all: no `.github/`, no `Jenkinsfile`, no `Makefile`, no CI script in
`package.json`. Nothing runs `tsc`, `vitest` or Playwright automatically. The suite is ~1,700 lines
of unit tests across 12 files plus 19 Playwright specs, and it is green today
(`test-results/.last-run.json` records no failed tests) — it is trusted work that nothing verifies.

**Blocked by:** None — can start immediately. Order it after 02, and after
`.scratch/landing-page/06` lands (that ticket changes what the e2e suite points at).

**Status:** resolved

- [ ] A workflow runs, in order: install, typecheck, unit tests, coverage, build, Playwright
- [ ] It fails the job on any red step — no `continue-on-error`, no `|| true`
- [ ] Playwright runs against the built output with a fresh server (the `webServer` config already
      does this; the workflow must not reuse a stale one)
- [ ] Playwright workers are pinned to 2 — the suite is `workers: 1` today because several specs
      share the Default community's data, and raising it must not make the suite flaky
- [ ] Coverage is produced and attached as a build artifact; **no threshold gate yet**
- [ ] The workflow passes on the current tree

**Design reference:** none — infrastructure only.

**Notes:** Coverage exists to make the shell's untested growth *visible*, which is why it ships
before tickets 05–07 rather than after. Setting a gate is a later decision once there is a number to
gate on; a threshold picked blind will be either meaningless or a permanent red build.

Two deliberate exclusions: **no ESLint** (a fresh config against 9,339 lines is a large first-run
diff and needs its own pass), and **no deploy step** (the Cloudflare configuration is
`.scratch/landing-page/05`'s business, and wiring deployment into this workflow is not what this
ticket promises).

## Comments

Resolved by commit `c3d7cb4` ("ci: run typecheck, unit tests, build and the browser suite"), which
adds `.github/workflows/ci.yml` and the `e2e` script to `package.json`. The workflow runs
`npm ci` → `npx tsc -b` → `npx vitest run` → `npx vite build` →
`npx playwright install --with-deps chromium` → `npm run e2e`, every check step bare (no
`continue-on-error`), and uploads `playwright-report/` on failure.

Also absorbed into Phase A of the debt repayment effort as
`.scratch/debt/issues/10-ci-runs-the-checks.md`. Do not start that copy — this ticket's work has
shipped. One deviation from this ticket's acceptance: the coverage step and its artifact were
deliberately dropped, per the successor's acceptance criteria.
