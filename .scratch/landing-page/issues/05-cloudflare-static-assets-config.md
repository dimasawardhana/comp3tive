# 05: Cloudflare static-assets configuration

**What to build:** A committed, reviewable deploy configuration for the Workers static-assets deployment, plus the two asset-directory files the site needs. Today nothing in the repo describes the deploy — it lives in Cloudflare dashboard settings.

- Add `wrangler.jsonc`:
  ```jsonc
  {
    "name": "<the existing Worker name>",
    "compatibility_date": "<today>",
    "assets": {
      "directory": "./dist",
      "not_found_handling": "404-page"
    }
  }
  ```
  No `main` — the site needs no Worker script, and Cloudflare's docs describe exactly this as the static-site shape.
- **`not_found_handling` must not be `"single-page-application"`.** That value, correct for a single-document SPA, would serve `/index.html` — the Landing Page — for every unmatched app path. If the dashboard currently has it set, clear it there too, because dashboard settings can win over the file.
- Do **not** set `html_handling`. The default `auto-trailing-slash` already serves `/app` and `/app/` from `dist/app/index.html`, which is what we need.
- Add `public/_headers` (Vite copies `public/` to the dist root) so hashed assets are cached hard and HTML is not:
  ```
  /assets/*
    Cache-Control: public, max-age=31536000, immutable

  /*.html
    Cache-Control: no-cache

  /
    Cache-Control: no-cache
  ```
  Unhashed HTML pointing at deleted hashed chunks is the classic deploy breakage: the page loads, then dies on a 404 for its own JS.
- Add `public/404.html`: a comp3tive-styled not-found page, in the same tokens and voice, linking back to `/`.
- Keep `/api/*` unused and unclaimed (ADR-0006) — no redirect, no static file, no Worker route.

**Blocked by:** 01 (the `/app` document must exist in `dist/`)

**Status:** done — closed 2026-10-13 against the live origin.

- [x] `wrangler.jsonc` is committed with `assets.directory: "./dist"` and no `main`
- [x] `not_found_handling` is `404-page` (not `single-page-application`) — the deployed origin serves
      the styled 404 for an unmatched path (`/nope-not-a-path` → 404, `<title>comp3tive — page not found`)
- [x] `/` serves the Landing Page and `/app` serves the app on the deployed Worker
- [x] An unmatched path serves the styled 404, never the Landing Page
- [x] `public/_headers` is present in `dist/` after a build and HTML is served `no-cache` — verified
      live: `/` and `/app/` return `cache-control: no-cache`, `/assets/*` and `/fonts/*.woff2` return
      `public, max-age=31536000, immutable`
- [x] `public/404.html` renders in both light and dark mode and links back to `/`
- [x] A redeploy after a code change serves new HTML (the stale-chunk case is covered)

**Design reference:** `DESIGN.md` for the 404 page; Cloudflare's Workers static-assets docs for the config keys.

## Answer

Built: `wrangler.jsonc` (`assets.directory: "./dist"`, `not_found_handling: "404-page"`, no `main`,
`html_handling` deliberately unset), `public/_headers`, `public/404.html`. All three land in `dist/`
and the config parses.

**The Worker name was never missing, and this ticket's "cannot be met from the repo" verdict was
wrong.** It read `~/.config/.wrangler/`, found an expired OAuth token, and concluded that the live
Worker could not be identified — the same shape of error the ROADMAP names for CI: *"I cannot check
this" written down as "this is false."* **The name is `comp3tive`, and it is the first label of the
deployed URL**, `https://comp3tive.dimasawardhana.workers.dev/` — a workers.dev host is always
`<worker>.<account>.workers.dev`, and the value already in the file was correct. No dashboard access,
no token and no deploy records were ever needed; one `curl` answers it, because a live Worker's name
is in its own address. **Corrected 2026-10-13** — see `docs/ROADMAP.md`, gate 3, which also proves the
deployed source is byte-identical to `master` at `3683974`.

**Everything the file's own checklist asked for is now verified against the live origin**, and the
remaining "dashboard facts" resolved themselves: `not_found_handling` is `404-page` in practice (the
unmatched path returns the styled 404, not the Landing Page), and the deploy serves `./dist`
correctly. A redeploy's stale-chunk case is covered by gate 3's stale-cache purge test.

**Notes:** the build runs on Cloudflare with `npm run build` and asset directory `./dist`. The
committed `wrangler.jsonc` is what makes that reproducible, and it now records the live origin rather
than a placeholder.

