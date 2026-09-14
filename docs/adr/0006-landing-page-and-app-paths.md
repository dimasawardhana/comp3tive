# Landing Page at the root, the app at /app — two documents, not a router

comp3tive needs a public entry point, so the site root becomes a **Landing Page** and the app moves to `/app`. We build it as **two HTML documents in one Vite build** (`index.html` and `app/index.html`) instead of adding a client-side router, because the app has no deep-link requirement — internal navigation is the in-memory `viewStack` from ADR-0004 — and a landing page and an app shell share no React tree worth unifying.

**Status**: accepted

**Considered Options**:

- **Single document + SPA fallback** (one `index.html` serving `/app/*` via the History API). The conventional choice, and it would make the app's screens addressable. Rejected because it *is* the router ADR-0004 rejected, whose stated revisit condition was "if the app gains a shareable URL surface" — we are not gaining one. It also costs a host rewrite rule and turns `viewStack` from the source of truth into derived state, re-anchoring every `pushView`/`goBack`/`gotoHub` call site and all 19 e2e specs for no benefit we want yet.
- **Hash route** (`/#/app`). Works on any static host with zero configuration, but it is still a router-shaped change to the shell with an uglier URL.
- **Keep the app at `/` and host the Landing Page elsewhere**. Rejected: the whole point is a link an organizer can paste into a group chat, and that link should be the bare domain.
- **Two documents, no router** (chosen). Each surface is a real document; the app's navigation is untouched; the only build change is one `build.rollupOptions.input` entry.

**Consequences**:

- **No deep links, deliberately.** `/app/roster` and `/app/tournament/<id>` 404. Sharing a live bracket is the genuinely attractive reason to revisit a router; it is a separate decision with its own bill, not a ride-along on this one.
- **`assets.not_found_handling` must not be `single-page-application`.** If it is, every unmatched app path serves `/index.html` — the Landing Page — at an app URL. The correct value is the default (`none`) or `404-page`. This is the one setting that silently breaks the split.
- **`base` stays at its default `/`.** Both documents then reference hashed assets at `/assets/…`, which resolves from `/` and from `/app/`. A relative base (`base: ''`/`'./'`) would make `app/index.html` emit `assets/…` resolved against `/app/`, where no assets live.
- **Existing data survives.** IndexedDB and `localStorage` are origin-scoped, not path-scoped, so moving the app from `/` to `/app` does not touch `comp3tive`/`team-builder` databases or the `tb-*` keys. A returning organizer therefore keeps their roster, and can be recognised and sent straight into the app.
- **The whole e2e suite re-anchors.** 22 occurrences of `localhost:4173` across `playwright.config.ts`, `e2e/pages/base.page.ts`, and the 19 specs point at what is now the Landing Page.
- **`/api/*` is reserved and unused.** Nothing is implemented, and nothing static may claim it, so the planned backend has an address. This is why the Landing Page must not own arbitrary paths.
- **The Landing Page holds no domain records** and is never community-scoped — recorded in `CONTEXT.md`, where it is also the reason **Dashboard** no longer claims the app "lands on it at load".
