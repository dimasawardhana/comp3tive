# Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve a public Landing Page at the site root and move the existing app to `/app`, as two HTML documents in one Vite build — no router, no new dependency, no change to the app's navigation or data.

**Architecture:** `index.html` at the project root becomes the Landing Page; a new `app/index.html` is the app shell. One `build.rollupOptions.input` entry covers both, and `base` stays at its default `/` so every document references the shared hashed bundle at `/assets/…`. The design tokens move out of `src/index.css` into `src/tokens.css` so the Landing Page and the app read the same values. Two small asset-directory files (`_headers`, `404.html`) and a committed `wrangler.jsonc` make the Cloudflare deploy reproducible.

**Tech Stack:** TypeScript, React 19, Vite 6, Vitest, Playwright, Cloudflare Workers static assets, hand-written CSS. **No new npm dependencies.**

**Spec:** `.scratch/landing-page/spec.md` · **Decision:** `docs/adr/0006-landing-page-and-app-paths.md` · **Tickets:** `.scratch/landing-page/issues/`

## Global Constraints

- **No new npm dependencies.** No router, no CSS framework, no JS framework on the Landing Page.
- **`base` is not set** — leave it at the default `/`. A relative base (`''`/`'./'`) makes `app/index.html` resolve assets against `/app/`, where none are emitted.
- **Do not set `html_handling`** in `wrangler.jsonc`; the default `auto-trailing-slash` already serves `/app` → `dist/app/index.html`.
- **`not_found_handling` must never be `single-page-application`** — it would serve the Landing Page for unmatched app paths.
- **The token extraction is a pure move.** No token is renamed, added, removed, or revalued.
- **The app's navigation, storage and domain logic are untouched.** IndexedDB and `localStorage` are origin-scoped, so no data migration is needed or wanted.
- **Both light and dark mode must render correctly** on every surface touched.
- **Do not commit** unless asked. Each task ends at a verification checkpoint, not a commit.
- Keep `npm test`, `npx tsc --noEmit`, `npm run build` and `npx playwright test` green at the end of every task that touches code.

**Prepared asset (already in the repo):** `scripts/capture-hero.mjs` captures the split screen deterministically from a fictional roster and **fails** if the team bib colours are missing from the output. `scripts/analyze-png.mjs` renders a PNG as an ASCII luminance map plus colour histograms — useful when verifying a screenshot without a vision model. Hero images are committed at `public/hero/split-desktop.png` (890×625) and `public/hero/split-mobile.png` (350×905).

---

### Task 1: Split the build into two documents

**Files:**
- Create: `app/index.html`
- Modify: `vite.config.ts`
- Keep: `index.html` (becomes the Landing Page — untouched in this task)

**Interfaces:**
- Produces: `dist/index.html` (Landing Page) and `dist/app/index.html` (app), both referencing the same `/assets/…` bundle. Every later task depends on the app being reachable at `/app`.

- [ ] **Step 1: Create `app/index.html`**

Copy the current root `index.html` verbatim to `app/index.html`. Both documents keep the same `<div id="root">`, the same `<script type="module" src="/src/main.tsx">` (Vite resolves `/src/...` from the project root, not from the HTML file's directory), and the same Google Fonts links. Change only the `<title>`: the app's document keeps `comp3tive - match night`.

- [ ] **Step 2: Add the MPA input and `appType` to `vite.config.ts`**

```ts
/// <reference types="vitest/config" />
import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  appType: "mpa",
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        landing: resolve(import.meta.dirname, "index.html"),
        app: resolve(import.meta.dirname, "app/index.html"),
      },
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

`appType: "mpa"` removes the SPA fallback so `vite preview` stops rewriting unmatched paths to `/index.html` — which locally would show the Landing Page at an app URL. `import.meta.dirname` is available on the repo's Node and `@types/node` v22.

- [ ] **Step 3: Build and confirm both documents are emitted**

Run: `npm run build`
Expected: `dist/index.html` **and** `dist/app/index.html` exist. `dist/index.html` is the Landing Page document; `dist/app/index.html` contains the app's root div.

- [ ] **Step 4: Confirm the assets resolve from both**

Run: `grep -o '/assets/[^"]*' dist/index.html dist/app/index.html | sort -u`
Expected: both files reference the same `/assets/…` paths — absolute from the origin root, which is what makes the nested document work.

- [ ] **Step 5: Serve and check both paths**

Run: `npm run preview`
Then verify: `curl -s http://localhost:4173/app/ | head -5` and `curl -s http://localhost:4173/ | head -5`.
Expected: `/app/` returns the app document; `/` returns the Landing Page document. An unmatched path such as `/app/nope` is a 404, **not** the Landing Page.

> Note: `vite preview` binds to `[::1]:4173` on this machine (IPv6-only). Use `localhost`, not `127.0.0.1`.

- [ ] **Step 6: Checkpoint** — type-check, unit tests and build all clean.

```bash
npx tsc --noEmit && npm test && npm run build
```

**Expected state after Task 1:** the app is at `/app`, the Landing Page is a copy of the app document at `/`, and the Playwright suite is red until Task 6.

---

### Task 2: Extract the shared design tokens

**Files:**
- Create: `src/tokens.css`
- Modify: `src/index.css`

**Interfaces:**
- Produces: `src/tokens.css` — every custom property the app defines, including both dark-mode mechanisms. Task 3's `src/landing.css` imports it.

- [ ] **Step 1: Capture a "before" image**

Run: `npm run build && npm run preview` (in another shell) then `node scripts/capture-hero.mjs /tmp/before`
Expected: two captures per viewport and no assertion failure. These are the baseline.

- [ ] **Step 2: Move the token block into `src/tokens.css`**

Cut the `:root { … }` custom-property block, the `[data-theme="dark"] { … }` overrides, and the `@media (prefers-color-scheme: dark)` block from the top of `src/index.css` into `src/tokens.css`. Move them **verbatim** — same order, same values, same comments. `src/tokens.css` contains declarations and mode selectors only; no component rules.

- [ ] **Step 3: Import it from `src/index.css`**

Make `@import "./tokens.css";` the first statement in `src/index.css` (CSS requires `@import` before other rules; Vite inlines it via postcss-import in both dev and build).

- [ ] **Step 4: Prove the move changed no pixel**

Run: `npm run build && node scripts/capture-hero.mjs /tmp/after && cmp /tmp/before/hero-split-desktop.png /tmp/after/hero-split-desktop.png && cmp /tmp/before/hero-split-mobile.png /tmp/after/hero-split-mobile.png`
Expected: both `cmp` calls exit 0 with no output (byte-identical). **If either differs, the move was not pure — revert and redo it.**

- [ ] **Step 5: Confirm both modes still render**

Load the app at `/app`, switch theme to Dark and back to Light via the settings popover, and confirm no visual change from before the move. The e2e suite in Task 6 asserts computed styles and will also catch this.

- [ ] **Step 6: Confirm no token is declared twice**

Run: `grep -c -- '--surface:' src/index.css src/tokens.css`
Expected: `src/index.css` → 0, `src/tokens.css` → the original count.

- [ ] **Step 7: Checkpoint**

```bash
npx tsc --noEmit && npm test && npm run build
```

---

### Task 3: Build the Landing Page

**Files:**
- Modify: `index.html` (replace its body with the Landing Page)
- Create: `src/landing.css`
- Modify: `package.json` (add `"capture:hero": "node scripts/capture-hero.mjs"`)
- Use: `public/hero/split-desktop.png`, `public/hero/split-mobile.png`

**Interfaces:**
- Consumes: `src/tokens.css` (Task 2).
- Produces: the Landing Page at `/` with a real `<a href="/app/">` action; Task 4 adds its redirect script, Task 6 its e2e spec.

- [ ] **Step 1: Write the page's markup in `index.html`**

Keep the existing `<head>` (charset, viewport, fonts) and add `<link rel="stylesheet" href="/src/landing.css" />`. Replace the body with one `<main>`, in this order, using exactly this copy:

- Wordmark: `comp3tive`
- Kicker: `FAIR SPLIT · TOURNAMENTS`
- `<h1>`: `Split the group into fair teams.`
- Lede: `comp3tive builds balanced teams from your roster — futsal, MLBB, badminton — then runs the tournament on those teams.`
- Three items, each a title plus one sentence:
  - **Split.** `Pick who's here. Get teams with the smallest possible strength gap — exact, not guessed.`
  - **Edit.** `Swap anyone. The gap updates live, so you can see whether the change was fair.`
  - **Play.** `Run a series, single elimination, or Swiss. Record results as they happen.`
- Trust list: `The gap is the proven minimum for your pool, not a heuristic.` · `Works with no signal. The court has no wifi.` · `Your data stays on your device. No account, no server.`
- Primary action: `<a class="cta" href="/app/">Open comp3tive</a>`
- Under it: `Free, no account. Runs in your browser.`
- Footer: `comp3tive — fair teams for futsal nights, MLBB sessions, and everything after.`

Hero, placed between the lede and the three items:

```html
<picture>
  <source media="(max-width: 640px)" srcset="/hero/split-mobile.png" />
  <img src="/hero/split-desktop.png" width="890" height="625"
       alt="Two five-player Mobile Legends teams side by side, each showing average strength and role, with a gap meter reading 0.1." />
</picture>
```

The `width`/`height` prevent layout shift. The `alt` describes the product, not the file.

- [ ] **Step 2: Write `src/landing.css`**

Start with `@import "./tokens.css";`. One centered column, ~640px text measure, full-bleed hero. Use **only** tokens for colour — `--surface`, `--text`, `--text-2`, `--accent`, `--hairline`, `--r-lg` — so both modes work by inheritance. Outfit for the wordmark, `<h1>` and the three titles; Familjen Grotesk for body. The CTA is styled as a button but remains a link. Include a `:focus-visible` outline using `--accent`.

- [ ] **Step 3: Add the `capture:hero` script**

Add to `package.json` scripts: `"capture:hero": "node scripts/capture-hero.mjs"`.

- [ ] **Step 4: Verify in the browser, both modes**

Run: `npm run build && npm run preview`, then open `http://localhost:4173/`.
Expected: the Landing Page renders with the hero, the wordmark and one visible action. Toggle the OS or `html[data-theme="dark"]` and confirm the page inverts using tokens. Confirm the CTA navigates to `/app/` and shows the app.

- [ ] **Step 5: Verify accessibility basics**

Tab from the top: focus must reach the CTA with a visible outline. Confirm one `<h1>`, no skipped heading levels, and that the page is fully usable with JavaScript disabled (the CTA is a plain link).

- [ ] **Step 6: Checkpoint**

```bash
npx tsc --noEmit && npm test && npm run build
```

---

### Task 4: Send returning organizers into the app

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: the app's `localStorage["tb-community"]` marker, written by `src/domain/useCommunities.ts`.

- [ ] **Step 1: Add the inline redirect as the first thing in `<head>`**

Place it before the stylesheet link so it runs before first paint (no flash of the Landing Page):

```html
<script>
  // Returning organizer: this key is written by the app's own community hook.
  // `?stay` keeps the Landing Page reachable after the app has been used.
  try {
    if (localStorage.getItem("tb-community") && !location.search.includes("stay")) {
      location.replace("/app/");
    }
  } catch (e) {
    /* storage blocked — show the page */
  }
</script>
```

`location.replace` (not `location.href`) keeps the Landing Page out of the history, so Back from the app leaves the site instead of bouncing.

- [ ] **Step 2: Verify all three cases by hand**

1. Fresh profile (no `tb-community`): `/` shows the Landing Page.
2. Use the app once (creates the key), then open `/`: it lands in the app with no visible flash.
3. With the key present, open `/?stay`: the Landing Page shows.
4. Press Back after a redirect: you leave the site, and `/` does not re-redirect into a loop.

- [ ] **Step 3: Checkpoint** — `npm run build` succeeds and the page still works with JavaScript disabled (it shows the Landing Page).

---

### Task 5: Cloudflare static-assets configuration

**Files:**
- Create: `wrangler.jsonc`
- Create: `public/_headers`
- Create: `public/404.html`

**Interfaces:**
- Consumes: `dist/` containing both documents (Task 1).

- [ ] **Step 1: Add `wrangler.jsonc`**

The `name` must be the existing Worker's name — read it from the Cloudflare dashboard (Workers & Pages → the comp3tive Worker). Do not change it, or the deploy creates a second Worker.

```jsonc
{
  "name": "<existing Worker name>",
  "compatibility_date": "<today, YYYY-MM-DD>",
  "assets": {
    "directory": "./dist",
    "not_found_handling": "404-page"
  }
}
```

No `main` — a static site needs no Worker script. No `html_handling` — the default `auto-trailing-slash` already serves `/app` from `dist/app/index.html`. **Do not set `not_found_handling` to `single-page-application`.**

- [ ] **Step 2: Clear any conflicting dashboard setting**

In the Cloudflare dashboard, confirm the Worker's `not_found_handling` is not `single-page-application` (dashboard settings can override the file). Also confirm the build command is `npm run build` and the asset directory is `./dist`.

- [ ] **Step 3: Add `public/_headers`**

```
/assets/*
  Cache-Control: public, max-age=31536000, immutable

/*.html
  Cache-Control: no-cache

/
  Cache-Control: no-cache
```

Vite copies `public/` to the dist root; Cloudflare serves `_headers` natively from the assets directory. Hashed files are immutable; unhashed HTML must revalidate, otherwise a stale document requests deleted chunks.

- [ ] **Step 4: Add `public/404.html`**

A comp3tive-styled not-found page: same tokens (inline a minimal token block or link the built stylesheet), plain voice, and a link back to `/`. Keep it self-contained — it is served for unmatched paths, including under `/app/`.

- [ ] **Step 5: Verify the files land in `dist/`**

Run: `npm run build && ls dist/_headers dist/404.html dist/hero/`
Expected: all present, alongside `index.html` and `app/index.html`.

- [ ] **Step 6: Verify on the deployed Worker, after pushing**

Expected: `/` → Landing Page; `/app` → app; `/app/nope` → the styled 404 (never the Landing Page); a redeploy after a code change serves new HTML.

- [ ] **Step 7: Checkpoint** — `npm run build` clean; deployed paths verified.

---

### Task 6: Re-anchor the e2e suite and add the Landing Page spec

**Files:**
- Modify: `e2e/playwright.config.ts`
- Modify: `e2e/pages/base.page.ts` (and delete `e2e/pages/` if it stays unused)
- Modify: the 19 specs (one `page.goto` each)
- Create: `e2e/tests/landing/landing.spec.ts`

**Interfaces:**
- Consumes: the app served at `/app` (Task 1) and the Landing Page's redirect (Task 4).

- [ ] **Step 1: Point the config at the app**

In `e2e/playwright.config.ts`: `use.baseURL: "http://localhost:4173/app"` and keep `webServer.url: "http://localhost:4173"` (the probe just needs a responding URL; the root still serves the Landing Page).

- [ ] **Step 2: Re-anchor the specs**

There are **22 occurrences of `localhost:4173` across 21 files**: 2 in the config, 1 in `e2e/pages/base.page.ts`, and 1 in each of the 19 specs. Prefer `page.goto("/")` against the `baseURL` over restating an absolute URL, so the next path change is a one-line edit. Update `review.spec.ts` too even though it is skipped.

- [ ] **Step 3: Add `e2e/tests/landing/landing.spec.ts`**

Cover four things, using the deterministic seeding pattern from `e2e/tests/dashboard/dashboard.spec.ts` (`addInitScript` writing `localStorage`):

1. `/` serves the Landing Page — assert its `<h1>` text, and assert the app's Dashboard heading is **not** present.
2. The CTA navigates to the app — click `Open comp3tive`, expect the app shell (`.app`) and the Dashboard.
3. With `tb-community` pre-seeded, `/` redirects to the app.
4. With `tb-community` pre-seeded and `?stay` in the URL, `/` shows the Landing Page.

- [ ] **Step 4: Run the whole suite**

Run: `npx playwright test`
Expected: green, zero failures. The suite passed before this feature (`test-results/.last-run.json` records no failures), so any failure is caused by these changes.

> The suite runs `workers: 1` and `webServer.reuseExistingServer: true`. Stop any `npm run preview` you started by hand first, or Playwright will reuse a server built from a stale `dist/`.

- [ ] **Step 5: Checkpoint** — `npx playwright test` green; `npm test` and `npm run build` clean.

---

### Task 7: Verify the whole change

**Files:** (verification only)

- [ ] **Step 1: Full local verification**

```bash
npm run build
npx tsc --noEmit
npm test
npx playwright test
```

Expected: build emits both documents; type-check clean; unit suite green; Playwright green.

- [ ] **Step 2: Confirm data survives the path change**

In a browser that has used the app at `/`: load `/app` and confirm the community, players, sessions and tournaments are all present, and that `/` redirects there. This is the check that the origin-scoped storage assumption in ADR-0006 holds.

- [ ] **Step 3: Re-shoot the hero and confirm the script still passes**

Run: `npm run capture:hero`
Expected: both viewports captured, no assertion failure. If the design has changed, copy the new images into `public/hero/` and commit just those.

- [ ] **Step 4: Confirm the reserved path is untouched**

Expected: nothing serves `/api/*` — no static file, no redirect, no Worker route. It is reserved for the future backend (ADR-0006).

- [ ] **Step 5: Update `docs/FLOW.md`'s entry row**

Note that the app is now entered at `/app` and that the site root is the Landing Page. The rest of FLOW.md is unchanged by this feature (its stale hub count is tracked in `.scratch/app-correctness/issues/06-reconcile-stale-docs.md`).

---

## File Map Summary

| File | Action |
|------|--------|
| `index.html` | Becomes the Landing Page (markup, redirect script, stylesheet link) |
| `app/index.html` | Create — the app shell document |
| `vite.config.ts` | Add `build.rollupOptions.input` (both documents) and `appType: "mpa"` |
| `src/tokens.css` | Create — the token block moved out of `src/index.css` |
| `src/index.css` | Import `tokens.css`; tokens removed |
| `src/landing.css` | Create — Landing Page styles, tokens only |
| `public/hero/split-desktop.png`, `public/hero/split-mobile.png` | Already committed — the hero |
| `scripts/capture-hero.mjs`, `scripts/analyze-png.mjs` | Already committed — self-verifying capture + pixel diagnostic |
| `public/_headers` | Create — immutable assets, revalidating HTML |
| `public/404.html` | Create — styled not-found page |
| `wrangler.jsonc` | Create — Workers static assets config |
| `package.json` | Add the `capture:hero` script |
| `e2e/playwright.config.ts` | `baseURL` → the app |
| `e2e/tests/**/*.spec.ts` | Re-anchor 19 specs to `/app` |
| `e2e/tests/landing/landing.spec.ts` | Create — Landing Page + redirect coverage |
| `docs/FLOW.md` | Note the `/app` entry path |

---

## Self-Review Checklist

- [ ] **Spec coverage:** landing page at `/` → Task 3; app at `/app` → Task 1; returning-organizer redirect → Task 4; Cloudflare config → Task 5; e2e re-anchor → Task 6; tokens → Task 2; verification → Task 7
- [ ] **Placeholder scan:** no TBD/TODO. The one value not knowable from the repo — the Worker `name` — names exactly where to read it (the Cloudflare dashboard).
- [ ] **`base` untouched:** the config sets `appType` and `build.rollupOptions.input` only; no `base` key is added
- [ ] **`not_found_handling`:** `404-page`, never `single-page-application`, in both the file and the dashboard
- [ ] **Tickets match tasks:** `.scratch/landing-page/issues/01`…`06` mirror Tasks 1–6
- [ ] **Dependency order:** 01 → 02, 05, 06; 01 + 02 → 03; 03 → 04. Task 2 is independent of Task 1.
- [ ] **No new dependency:** `package.json` gains one script and no packages
- [ ] **Data migration:** none required, and Task 7 Step 2 verifies that
- [ ] **Sequencing noted:** the app's four known defects live in `.scratch/app-correctness/` and are independent of this plan
