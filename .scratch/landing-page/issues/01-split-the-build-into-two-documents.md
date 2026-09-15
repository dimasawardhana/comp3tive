# 01: Split the build into two documents

**What to build:** The site root serves a Landing Page and the app lives at `/app`, as two HTML documents in one Vite build (ADR-0006). No router, no new dependency.

- Create `app/index.html` as a copy of the current root `index.html` (same `<div id="root">`, same `<script type="module" src="/src/main.tsx">`, same font links).
- Add to `vite.config.ts`:
  ```ts
  build: {
    rollupOptions: {
      input: {
        landing: resolve(import.meta.dirname, "index.html"),
        app: resolve(import.meta.dirname, "app/index.html"),
      },
    },
  },
  ```
  (`resolve` from `node:path`; `import.meta.dirname` is available on the repo's Node and `@types/node` v22.)
- Set `appType: "mpa"` so `vite preview` matches Cloudflare instead of rewriting unmatched paths to `/index.html`.
- **Do not set `base`.** Leaving it at the default `/` makes both documents reference `/assets/…`, which resolves from `/` and from `/app/`. A relative base would make the nested document look for `/app/assets/…`, where nothing is emitted.

**Blocked by:** —

**Status:** resolved

- [ ] `npm run build` emits both `dist/index.html` and `dist/app/index.html`
- [ ] Both emitted HTML files reference the same `/assets/…` hashed bundle
- [ ] `npm run preview` serves the app at `http://localhost:4173/app` (and `/app/`) with the app, not the Landing Page, rendered
- [ ] `npm run preview` serves the Landing Page at `http://localhost:4173/`
- [ ] `npm run dev` serves the app at `http://localhost:4173/app` (nested pages resolve by folder path)
- [ ] An unmatched path such as `/app/nope` returns a 404 rather than the Landing Page
- [ ] `npx tsc --noEmit` and `npm test` stay clean

**Design reference:** none — build mechanics only.

**Notes:** This ticket moves the app off `/` and therefore breaks every Playwright spec until ticket 06 lands. Land 01 and 06 together, or expect a red suite in between.
