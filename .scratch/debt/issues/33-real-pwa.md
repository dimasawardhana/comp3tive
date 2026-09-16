# 33: A real PWA — manifest, service worker, self-hosted fonts

**Status:** ready-for-agent

**What to build:** comp3tive becomes installable and genuinely works with no signal. It ships a
web app manifest with real icons, a service worker that precaches both documents and every
hashed asset, four self-hosted woff2 font files served from the origin, and a version scheme
keyed to the build so a new deploy is never stuck behind a stale cache — and the landing page's
offline claim, removed by B14, is restored because it is now true.

**Evidence.** The app has no offline capability at all. Measured:

```
$ grep -rn "serviceWorker\|manifest.json\|workbox" src/ index.html app/index.html
(0 matches)
$ grep -rn "@font-face" src/ index.html
(0 matches)
$ ls public/
404.html  _headers  comp3tive.svg
```

Three documents fetch type from a third party: `index.html:25-29`, `app/index.html:7-11` and
`public/404.html:7-10` each carry `preconnect` to `fonts.googleapis.com` plus a
`css2?family=Outfit…&family=Familjen+Grotesk…` stylesheet link. There is no `<link rel="icon">`,
no `apple-touch-icon`, no `theme-color` and no `rel="manifest"` anywhere. `public/_headers` today
is:

```
/assets/*
  Cache-Control: public, max-age=31536000, immutable

/*.html
  Cache-Control: no-cache

/
  Cache-Control: no-cache
```

`wrangler.jsonc` sets `not_found_handling: "404-page"` with a comment forbidding
`single-page-application`, and `vite.config.ts` sets `appType: "mpa"` for the same reason: this
is a two-document site (`/` → landing, `/app/` → app) and the service worker must cover both.
The roadmap names stale-asset serving as the top D risk; the Cloudflare static-assets default is
`public, max-age=0, must-revalidate` plus a content-hash `ETag`, so `/sw.js` needs an explicit
rule rather than an implicit one.

Absorbed ticket `.scratch/app-health/issues/13` framed the fonts as an open either/or
("Both are defensible; neither is obviously right"). **That framing is stale: D4 locks
self-hosting.** Its other requirements still hold and are carried into the criteria below.

**Acceptance criteria:**
- [ ] `public/fonts/outfit-latin.woff2` (32,292 B), `public/fonts/outfit-latin-ext.woff2` (14,808 B), `public/fonts/familjen-grotesk-latin.woff2` (18,916 B), `public/fonts/familjen-grotesk-latin-ext.woff2` (15,468 B) and `public/fonts/OFL.txt` (the SIL OFL 1.1 text, covering both families) are committed; `sha256sum public/fonts/*.woff2` prints, in that order, `6c18d579…`, `0f53d1c0…`, `414d5dfe…`, `c53f18ec…`.
- [ ] `src/fonts.css` declares **two** `@font-face` rules per family — one latin, one latin-ext — each `font-display: swap`, `font-style: normal`, `font-weight: 100 900` (both files are variable and cover the whole weight axis), with the exact `unicode-range` values Google serves (`U+0000-00FF, U+0131, U+0152-0153, …` for latin; `U+0100-02BA, …` for latin-ext), `format("woff2-variations")` with a `format("woff2")` fallback, and `src: url("/fonts/…")`.
- [ ] The family names stay byte-identical: `font-family: "Outfit"` and `font-family: "Familjen Grotesk"`. `e2e/tests/community/community.spec.ts:21-26` asserts the computed `fontFamily` contains `Familjen Grotesk` and the weight is `600`; `src/index.css:13` and `:24` and `src/landing.css:21` name both faces. No declaration in any stylesheet changes.
- [ ] `@font-face` lives in exactly one place: the new `src/fonts.css`, imported by a single `@import "./fonts.css";` line added to `src/tokens.css`. Both surfaces already import `tokens.css` (`src/index.css:2`, `src/landing.css:7`), so one import reaches both documents and neither Phase B's `src/landing.css` nor Phase C's `src/index.css` is written to. No stylesheet declares `@font-face` anywhere else, so the two documents cannot drift.
- [ ] All three CDN blocks are gone: `index.html`, `app/index.html` and `public/404.html` contain no `fonts.googleapis.com`, no `fonts.gstatic.com` and no `preconnect` to either. Each instead carries `<link rel="preload" as="font" type="font/woff2" crossorigin href="/fonts/outfit-latin.woff2">` and the same for `familjen-grotesk-latin.woff2`.
- [ ] First paint does not regress: the two `preload` hints above replace the two `preconnect` hints one-for-one, and a `curl -sI https://<preview>/fonts/outfit-latin.woff2` returns `200` with `content-type: font/woff2` and an immutable cache header.
- [ ] No request leaves the origin at runtime: a Playwright spec records every request and asserts none has a host other than the base origin, on both `/` and `/app/`.
- [ ] `public/manifest.webmanifest` declares `name: "comp3tive"`, `short_name: "comp3tive"`, `start_url: "/app/"`, `scope: "/"`, `display: "standalone"`, `background_color: "#FAF8F5"`, `theme_color: "#C2410C"`, `description` matching `app/index.html`'s `<title>` intent, and `icons` of `192x192` and `512x512` plus a `maskable` 512 — sourced from `brand/3-icon.svg` (the squared icon variant) and committed as PNGs under `public/icons/`.
- [ ] Both documents link the manifest (`<link rel="manifest" href="/manifest.webmanifest">`) plus `theme-color` and an `apple-touch-icon`; `app/index.html` gains a `<link rel="icon" href="/icons/icon-192.png">`. Verified by a spec asserting `document.querySelector('link[rel=manifest]')` resolves on both.
- [ ] `public/sw.js` is a classic service worker (no imports, no bundler step, no workbox) registering `/` as its scope, and it: precaches `/`, `/app/`, `/manifest.webmanifest`, `/404.html`, the four font files and every `/assets/*` URL the build emitted (the URL list is generated at build time — a Vite plugin or a `closeBundle` hook writes the hashed filenames into the file); serves navigations network-first with the precached document as fallback; serves `/assets/*` and `/fonts/*` cache-first; deletes every cache whose name is not the current one on `activate`; and calls `skipWaiting()` in `install` and `clients.claim()` in `activate`.
- [ ] The cache name embeds a build-scoped version string — `comp3tive-<version>` where `<version>` is a value the build writes into `sw.js` (the same hash the asset filenames use, or `package.json`'s version plus a build timestamp). The version is read from one place and never hand-edited.
- [ ] `src/main.tsx` registers the worker **additively and after** Phase A05's error boundary: `if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js")` inside a `window.addEventListener("load", …)`, with the returned promise's rejection handled so a failed registration never surfaces an error to the user. The render call and the `<ErrorBoundary>` wrapper are unchanged.
- [ ] `public/_headers` is extended, keeping the three existing rules byte-identical, with `/fonts/*` (`public, max-age=31536000, immutable`), `/icons/*` (same), `/manifest.webmanifest` (`no-cache`) and `/sw.js` (`no-cache`) — the last one is what stops a new deploy from being pinned to an old worker.
- [ ] The stale-deploy escape hatch is real and observed: a spec loads `/app/`, waits for `navigator.serviceWorker.ready`, writes the served `sw.js` body with a different cache version, calls `registration.update()`, and asserts a new worker reaches `activated`; a second spec asserts that after activation the old cache name is gone from `caches.keys()`.
- [ ] Offline is proven for both documents, not one: a spec seeds and loads `/app/`, waits for the worker to be active, calls `context.setOffline(true)`, reloads, and asserts the app shell renders; a second spec does the same for `/`, asserting the landing `<h1>` renders offline.
- [ ] The offline landing claim is restored exactly as B14's handoff note specifies: `index.html`'s trust list row 3 becomes `Works with no signal. The court has no wifi.`, the `<meta name="description">` regains `Works offline, `, and `e2e/tests/landing/landing.spec.ts`'s trust assertions become `toHaveCount(3)` plus `toContainText(["proven minimum for a two-team split", "no signal", "stays on your device"])`. The count stays 3.
- [ ] `npx vite build` exits 0 and `dist/` contains `sw.js`, `manifest.webmanifest`, `fonts/` and `icons/`; `npx playwright test` passes, including the font assertion in `e2e/tests/community/community.spec.ts`.

**Blocked by:** 14 (B14 removes the offline claim and leaves the restore note; this ticket is the other half of that sequence)
