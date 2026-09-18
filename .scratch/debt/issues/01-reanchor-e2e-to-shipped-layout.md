# 01: Re-anchor the e2e suite to the shipped layout (rail)

**Status:** ready-for-agent

**What to build:** Every spec navigates by a hub's accessible name through one shared helper, so the browser suite passes at the shipped layout — the desktop rail at 1280×720 — and a future layout change can no longer break a spec by position.

**Evidence.** Fourteen of the audit's sixteen e2e failures share one root cause. `src/index.css:1675-1679`, inside `@media (min-width: 1024px)`, sets `.bottom-nav { display: none; }` ("The rail replaces the tab bar, so the bar is removed from the layout entirely"), while `e2e/playwright.config.ts:14` runs every spec at `viewport: { width: 1280, height: 720 }`. Fourteen spec files navigate with `page.locator(".bottom-nav .nav-link").nth(n)`, so the locator resolves but is not visible and `.click()` retries to the 30 s timeout:

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('.bottom-nav .nav-link').nth(1)
    - locator resolved to <button type="button" class="nav-link ">…</button>
      - attempting click action
        2 × waiting for element to be visible, enabled and stable
          - element is not visible
```

`git log` confirms the omission: `681051d feat(shell): desktop rail layout, unified breakpoints, sticky nav` touched **no** `e2e/spec` file. Past the click, the specs fail a second time on **stale indices** — `NAV_ITEMS` (`src/App.tsx:62-68`) is now `[Home, Roster, Games, History, Squads]` (Home first, from `1702342`), while the specs still use `nth(1)` for Games, `nth(3)` for History and `nth(4)` for Squads.

Measured during this design, at both widths, for each of the five hub names: exactly **one** matching button. Both navs render the same `NAV_ITEMS` (`src/App.tsx:790`, `:1264-1276`) with the icon span marked `aria-hidden="true"`, so the accessible name is the label (`"Home"`, not `"⌂Home"`); the inactive layout is `display: none` at that width and therefore absent from the accessibility tree.

```
PROBE 390x844  exact-name count: Home 1, Roster 1, Games 1, History 1, Squads 1
PROBE 1280x720 exact-name count: Home 1, Roster 1, Games 1, History 1, Squads 1
```

Second stale-locator class, same defect: **`.tournament-header h1` no longer exists** in the app — `TournamentScreen` renders `PageHeader` (`src/tournament/TournamentScreen.tsx:261-274`), which emits `.page-header h1`; the only `.tournament-header` rules left are orphaned CSS (`src/index.css:2560`, `:2567`). A scan of every `locator("…")` class in `e2e/**` against `src/**/*.tsx` + `index.html` + `app/index.html` finds exactly two classes with no counterpart in markup: `tournament-header` and `tabbar`.

**Acceptance criteria:**
- [ ] `e2e/support/seed.ts` exports `SeedWorld`, `seedScript`, `gotoSeeded`, `gotoHubSeeded` and `hubButton` with exactly the signatures frozen in the contracts file, recovering the working `SeedWorld`/`seedScript`/`gotoSeeded` implementation from `e2e/tests/dashboard/dashboard.spec.ts:1-107` (IndexedDB `"comp3tive"` at version 6, six object stores, `localStorage["tb-community"]` pinned)
- [ ] `hubButton(page, name)` is `page.getByRole("button", { name, exact: true })` with `name` typed as the five-literal hub union — it matches either layout by accessible name and no spec uses a positional nav index anywhere
- [ ] Nine of the ten surviving specs that reference `.bottom-nav` are re-anchored onto `hubButton` (create:14, draft:14, split-tourney:23, discipline:8, saved-squad:67 & 83, history:14, split-flow/split:20, no-overlap:42, settings-panel/viewport:15); the tenth is `dashboard.spec.ts`, handled on the next line
- [ ] `dashboard.spec.ts` deletes its local seed block and its local `hub` helper (`:1-110`; the helper is at `:110` with a `bottom-nav` comment at `:109`) and imports the shared one; all 14 `hub(page, …)` call sites become `hubButton(page, …)` (`:149`, `:163`, `:165`, `:167`, `:265`, `:301`, `:307`, `:381`, `:386`, `:398`, `:400`, `:404`, `:489`, `:534`)
- [ ] `dashboard.spec.ts:155-161`'s `hubs` table is corrected: the Squads row becomes `["Squads", "Saved squads"]` — `Squads` is the nav label `hubButton` resolves, `Saved squads` is the `.screen h1` the loop asserts — and the comment at `:155` claiming the slot "carries the accessible label `Saved squads`" is deleted, because it does not. This is the second rejection inside the failing test at `:152`, after the rail-invisibility one
- [ ] `page.locator(".tournament-header h1")` is replaced by `page.locator(".screen h1")` at `dashboard.spec.ts:505`, `saved-squad.spec.ts:97` and `split-tourney.spec.ts:31`
- [ ] New `e2e/tsconfig.json` is referenced from root `tsconfig.json`, so `npx tsc -b` typechecks every spec and a renamed hub is a compile error. Verified during design with a throwaway three-project configuration: a referenced project with `noEmit: true` and no `composite` builds cleanly, and an injected type error inside a referenced project's spec file fails `tsc -b` with exit code 2. The e2e project needs `types: ["node"]`, `noUnusedLocals: false` (the specs keep unused locals; Phase C turns that flag on for `src` only) and `skipLibCheck: true`
- [ ] New `e2e/tests/shell/nav-layout.spec.ts` asserts, at 1280×720 and 390×844, that each of the five hub names resolves to exactly one visible control and that clicking Games from Home lands on Games
- [ ] The suite's default viewport stays 1280×720; only `panel/no-overlap.spec.ts` and `settings-panel/viewport.spec.ts` pin 390×844, because the bottom bar is their subject
- [ ] `npx playwright test --config=e2e/playwright.config.ts` reports 0 failures from the rail root cause

**Blocked by:** —
