# Landing Page — a public front door

**Status:** resolved

## Problem Statement

comp3tive is usable, but it has no front door. The app is served at the site root, so the first thing anyone sees — an organizer you hand the link to, or a friend who bookmarks it — is the Dashboard of a community they have not created yet. There is nothing that says what the tool is, who it is for, or why it is worth trying. Sharing the link means sharing an app, with no explanation, and asking someone to reverse-engineer the product from an empty roster.

There is also no room for anything that is not the app. Every path on the domain belongs to the app's own shell, which leaves nothing for a public page now and nothing reserved for a backend later.

## Solution

The site root becomes a **Landing Page**: a small, static, hand-written document that explains comp3tive in the product's own plain voice and sends the visitor into the app with one action. The app moves to `/app` and is otherwise unchanged — same `viewStack` navigation, same storage, same data.

The Landing Page is built for the organizer who received a link, not for search engines: one sentence on what the tool is, three lines on what it does, the two or three facts that make it trustworthy, the split screen itself as the hero image, and one primary action — **Open comp3tive**. It ships no framework: a landing page that loads React to render a headline and three bullets is weight with nothing to show for it, and the repo already commits to hand-written CSS with design tokens.

An organizer who has already used comp3tive never needs to see it. The page detects the app's own `localStorage` marker and forwards them into `/app` before first paint, with an explicit escape (`?stay`) so the page can still be looked at and shown to someone.

## User Stories

1. As a visitor who was sent a link, I want to understand what comp3tive is and what it does in a few seconds, so that I can decide whether to open it.
2. As a visitor, I want one obvious action that opens the app, so that I do not have to hunt for it.
3. As a visitor, I want to know that my data stays on my own device and works without a signal, so that I trust it with a roster.
4. As an organizer who already uses comp3tive, I want my bookmark to keep working, so that a change to the site does not add a click to my routine.
5. As an organizer showing comp3tive to someone, I want to be able to open the Landing Page even though I already have data, so that I can display it.
6. As an organizer, I want the app to keep all of my communities, players, sessions, tournaments and squads across this change, so that nothing is lost.
7. As a visitor who mistypes a URL, I want a page that looks like comp3tive, so that a dead end does not look like a broken product.

## Implementation Decisions

- **Two documents in one Vite build** (ADR-0006): `index.html` at the project root is the Landing Page; `app/index.html` is the app. One `build.rollupOptions.input` entry covers both. No router, no new dependency.
- **`base` stays default.** Both documents reference `/assets/…`; a relative base would break the nested document.
- **`appType: "mpa"`** in `vite.config.ts` so `vite preview` matches Cloudflare. With the default `"spa"`, an unmatched path is rewritten to `/index.html` — locally that means `/app` can preview as the Landing Page, which makes the local check lie about production.
- **Shared design tokens, two consumers.** The token block at the top of `src/index.css` (`:root`, the `[data-theme="dark"]` overrides, and the `prefers-color-scheme` block) moves to `src/tokens.css`, imported by both `src/index.css` and the Landing Page's stylesheet, so the two surfaces cannot drift. **This is a pure move: no token value changes.**
- **No CSS framework, no JS framework** on the Landing Page. Plain HTML, one stylesheet, and — only for the returning-organizer check — a few lines of inline script in `<head>` so it runs before first paint.
- **Voice is the product's voice** (`PRODUCT.md`): plain verbs, no marketing-speak, no friendly chatter. Credibility is the pitch: the split is provably minimal, it works with no signal, and the data never leaves the device.
- **The hero is the split screen** — the product's signature moment. Captured from the real app (`public/hero/split-desktop.png`, `public/hero/split-mobile.png`) by `scripts/capture-hero.mjs`, which seeds a **fictional** roster rather than the real esports players in `sample-data/*.json`.
- **The returning-organizer check reads `localStorage["tb-community"]`**, the key the app already writes on first load (`src/domain/useCommunities.ts`). Synchronous, origin-scoped, and already load-bearing — no IndexedDB probe needed. `/` redirects only when the key is present and the URL carries no `?stay`.
- **Deployment is a Workers static-assets Worker** configured by a committed `wrangler.jsonc` (`assets.directory: "./dist"`, no `main`), so the deploy is reviewable instead of living in dashboard settings.
- **`/api/*` is reserved** for the planned backend and claimed by nothing.

## Testing Decisions

- The build itself is the primary test: `npm run build` must emit **both** `dist/index.html` and `dist/app/index.html`, with hashed assets resolving from each. A build that emits only one document is the failure mode worth catching.
- The e2e suite re-anchors to `/app` and stays the app's behavioural net. The existing specs are the regression test for "the app still works at its new path" — no new app-side tests are warranted for a path change.
- The Landing Page gets a small e2e spec of its own: the root serves the Landing Page (asserting its heading, not the app's), the primary action navigates to `/app`, and a pre-seeded `tb-community` redirects to `/app` while `?stay` does not.
- **The token move is verified visually, not by assertion.** Capture the split screen before the move (`scripts/capture-hero.mjs`), move the tokens, capture again, and require the two PNGs to be byte-identical — a token extraction that changes any pixel is a regression. Keep whichever image is the hero.
- Unit tests are unaffected: no domain logic changes, and the solver/bracket seams stay untouched.

## Out of Scope

- **Deep links.** `/app/roster`, a shareable bracket, browser back/forward — deferred (ADR-0006). The Landing Page links to `/app` and nothing deeper.
- **SEO and social metadata.** A shareable Open Graph image, structured data, and a sitemap are cheap follow-ons once the page exists; nothing here is built for ranking.
- **A favicon or brand mark beyond a text wordmark.** No mark exists in the repo, and commissioning one is a design exercise, not part of a routing change.
- **The backend**, including any `/api` implementation. The path is reserved only.
- **Copy in languages other than English**, and any analytics or tracking.
- **Reworking the app's own screens** — the Landing Page is a new document beside the app, not a redesign of it.

## Further Notes

- The app's data model is untouched. IndexedDB and `localStorage` are origin-scoped, so moving the app from `/` to `/app` preserves every community, player, session, tournament and squad, and no migration is needed.
- Four existing defects make the product worse the moment a landing page starts sending strangers into it — a Re-roll that returns identical teams while claiming a new roll, three deletes that leave the deleted row on screen, a malformed import that blanks the app, and an import merge that can orphan records across communities. They are tracked separately (`.scratch/app-correctness/`) and are **independent of this feature**, not a dependency of it; the sequencing is a priority call, not a technical one.
- The hero capture script is reusable and self-verifying: it hides the app chrome for the shot, waits for the pitch's entrance transition to settle, and fails if the team bib colours are missing from the output — so a re-shoot after a redesign cannot silently produce a broken image.
- `docs/FLOW.md` is the app's navigation contract and is unchanged by this feature, but its entry row should note that the app is now entered at `/app`.
