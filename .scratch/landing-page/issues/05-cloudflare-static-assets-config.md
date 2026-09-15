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

**Status:** ready-for-human

- [ ] `wrangler.jsonc` is committed with `assets.directory: "./dist"` and no `main`
- [ ] `not_found_handling` is `404-page` (not `single-page-application`) in the config **and** cleared in the dashboard if previously set
- [ ] `/` serves the Landing Page and `/app` serves the app on the deployed Worker
- [ ] An unmatched path serves the styled 404, never the Landing Page
- [ ] `public/_headers` is present in `dist/` after a build and HTML is served `no-cache`
- [ ] `public/404.html` renders in both light and dark mode and links back to `/`
- [ ] A redeploy after a code change serves new HTML (the stale-chunk case is covered)

**Design reference:** `DESIGN.md` for the 404 page; Cloudflare's Workers static-assets docs for the config keys.

## Answer

Built: `wrangler.jsonc` (`assets.directory: "./dist"`, `not_found_handling: "404-page"`, no `main`,
`html_handling` deliberately unset), `public/_headers`, `public/404.html`. All three land in `dist/`
and the config parses.

**One criterion is unmet and cannot be met from the repo: the Worker name.** It was not found in any
reachable source — no `wrangler.toml`/`wrangler.jsonc` existed, `git grep` across all revisions
finds no `workers.dev` host, the repo has no README or homepage, and `~/.config/.wrangler/` holds
only an expired/deleted OAuth token (every API call returns `9109 Invalid access token`; logs show
only failed `wrangler secret list` runs, never a deploy). `wrangler.jsonc` therefore carries
`"name": "comp3tive"` **as a placeholder**. Replace it with the existing Worker's name before the
first deploy, or the deploy creates a second Worker rather than updating the live one.

The remaining unmet criteria are dashboard facts, not repo work: confirming the Worker's
`not_found_handling` is not `single-page-application` (a dashboard value overrides the file), and
confirming the build command is `npm run build` with asset directory `./dist`.

**Notes:** With GitHub integration the build runs on Cloudflare, so the dashboard's build command must be `npm run build` and its asset directory `./dist`. The committed `wrangler.jsonc` is what makes that reproducible.
