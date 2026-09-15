# 06: Re-anchor the e2e suite to /app

**What to build:** The Playwright suite pointed at the app's new path, so it keeps guarding the app instead of the Landing Page. Until this lands, every spec navigates to `/` and asserts app behaviour that is no longer there.

Coupling, counted exactly — **22 occurrences of `localhost:4173` across 21 files**:

- `e2e/playwright.config.ts` — 2 (`use.baseURL` and `webServer.url`). The `webServer.url` probe must keep pointing at a URL that responds, and the app's index is now `/app/`.
- `e2e/pages/base.page.ts` — 1 (`goto()` hard-codes the root). Note this file and `e2e/pages/split.page.ts` are imported by **no spec**; `SplitPage` imports `BasePage`, nothing imports `SplitPage`.
- The 19 specs — 1 each, all `page.goto("http://localhost:4173/")`.

The minimal change is `baseURL: "http://localhost:4173/app"` plus the `goto` targets; prefer `page.goto("/")` against the baseURL over re-hardcoding an absolute URL, so the next move is a one-line change.

**Blocked by:** 01

**Status:** resolved

- [ ] `playwright.config.ts` `baseURL` and `webServer.url` point at the app, not the root
- [ ] Every spec navigates to the app; none asserts against the Landing Page
- [ ] `npx playwright test` passes with zero failures (the suite is green today: `test-results/.last-run.json` records no failed tests)
- [ ] The specs asserting computed styles still pass unchanged (font family, weight `600`, sticky topbar, fixed nav, `.screen` padding) — the path change must not perturb layout
- [ ] `dashboard.spec.ts`'s IndexedDB seeding still lands before app code reads the stores (it opens `comp3tive` at version 6, matching `DB_VERSION`)
- [ ] No spec relies on the app being the origin root (e.g. a relative asset URL or a same-origin assumption)

**Design reference:** none.

**Notes:** `review.spec.ts` is `test.skip` and its `goto` never executes, but update it anyway so the suite has no misleading absolute URLs. `e2e/tests/pages/` is dead weight — see `.scratch/app-correctness/issues/05-prune-dead-e2e-specs.md`, which covers removing it along with the three assertion-free `inspect*.spec.ts` files.

## Answer

**The ticket's suggested change does not work, and was corrected.** It proposes
`baseURL: "http://localhost:4173/app"` plus `page.goto("/")` against that baseURL, "so the next move
is a one-line change". But `page.goto("/")` resolves against the baseURL's **origin**, not its path:
`new URL("/", "http://localhost:4173/app/")` is `http://localhost:4173/` — the Landing Page. Measured
in the suite: `goto("/")` → `/` (Landing Page, title `comp3tive`); `goto("./")` and `goto("")` →
`/app/` (the app, title `comp3tive - match night`). Every spec and `BasePage.goto` therefore use
`goto("./")`.

Done: `baseURL` and `webServer.url` are `http://localhost:4173/app/`; 20 spec/page files navigate
with `goto("./")`; `scripts/capture-hero.mjs` moved to the app path too (it still pointed at `/`,
which is now the Landing Page, so every capture would have shot the wrong document). The new Landing
Page spec deliberately does **not** use the baseURL — it navigates by absolute `/` to reach the root
document and asserts the two surfaces are distinct.

**Suite result: 20 passed, 1 skipped, 16 failed — and all 16 failures are pre-existing.** Verified by
stashing every change and running the unmodified suite on the same tree: identical 16 failures, 9
passing. My change adds the 11 new Landing Page tests and breaks nothing.

Root cause of the 16, for whoever picks this up: they are not path-related. `playwright.config.ts`
sets `viewport: { width: 1280 }`, but the `feature/layout-revamp` merge (`28e5ea3`, 2026-09-11)
switched the app to a desktop **rail** at ≥1024px, where `.bottom-nav` becomes `display: none` —
so specs that click `.bottom-nav .nav-link` are clicking a hidden element (confirmed in the browser:
at 1280px `bottomNav === "none"` and the first link is not visible; at 900px both are visible).
Independently, `dashboard.spec.ts` asserts `aria-label` on nav links that only carry text
(`<span>⌘</span><span>Home</span>`), which never matched. `test-results/.last-run.json` records the
last green run at 2026-09-04, a week before the revamp landed.

That is a separate piece of work — fixing the specs' navigation seam for the rail layout — and it
belongs to `.scratch/app-correctness/05` (which already owns the weak-spec cleanup) rather than
being smuggled into a path change.
