# 06: Re-anchor the e2e suite to /app

**What to build:** The Playwright suite pointed at the app's new path, so it keeps guarding the app instead of the Landing Page. Until this lands, every spec navigates to `/` and asserts app behaviour that is no longer there.

Coupling, counted exactly — **22 occurrences of `localhost:4173` across 21 files**:

- `e2e/playwright.config.ts` — 2 (`use.baseURL` and `webServer.url`). The `webServer.url` probe must keep pointing at a URL that responds, and the app's index is now `/app/`.
- `e2e/pages/base.page.ts` — 1 (`goto()` hard-codes the root). Note this file and `e2e/pages/split.page.ts` are imported by **no spec**; `SplitPage` imports `BasePage`, nothing imports `SplitPage`.
- The 19 specs — 1 each, all `page.goto("http://localhost:4173/")`.

The minimal change is `baseURL: "http://localhost:4173/app"` plus the `goto` targets; prefer `page.goto("/")` against the baseURL over re-hardcoding an absolute URL, so the next move is a one-line change.

**Blocked by:** 01

**Status:** open

- [ ] `playwright.config.ts` `baseURL` and `webServer.url` point at the app, not the root
- [ ] Every spec navigates to the app; none asserts against the Landing Page
- [ ] `npx playwright test` passes with zero failures (the suite is green today: `test-results/.last-run.json` records no failed tests)
- [ ] The specs asserting computed styles still pass unchanged (font family, weight `600`, sticky topbar, fixed nav, `.screen` padding) — the path change must not perturb layout
- [ ] `dashboard.spec.ts`'s IndexedDB seeding still lands before app code reads the stores (it opens `comp3tive` at version 6, matching `DB_VERSION`)
- [ ] No spec relies on the app being the origin root (e.g. a relative asset URL or a same-origin assumption)

**Design reference:** none.

**Notes:** `review.spec.ts` is `test.skip` and its `goto` never executes, but update it anyway so the suite has no misleading absolute URLs. `e2e/tests/pages/` is dead weight — see `.scratch/app-correctness/issues/05-prune-dead-e2e-specs.md`, which covers removing it along with the three assertion-free `inspect*.spec.ts` files.
