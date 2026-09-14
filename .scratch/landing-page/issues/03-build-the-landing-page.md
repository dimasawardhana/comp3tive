# 03: Build the Landing Page

**What to build:** The public page at `/` — static HTML, one stylesheet, the split screen as its hero — that explains comp3tive and sends the visitor into the app at `/app`.

Also add `scripts` support: `"capture:hero": "node scripts/capture-hero.mjs"` in `package.json`, so the hero can be re-shot after a redesign. The script already exists and is self-verifying.

## The page

One column, centered, max-width ~640px for text (the app's own measure), full-bleed hero. Plain verbs, no marketing-speak (`PRODUCT.md`).

- **Wordmark:** `comp3tive`
- **Kicker:** `FAIR SPLIT · TOURNAMENTS`
- **H1:** `Split the group into fair teams.`
- **Lede:** `comp3tive builds balanced teams from your roster — futsal, MLBB, badminton — then runs the tournament on those teams.`
- **Three lines, what it does:**
  - **Split.** `Pick who's here. Get teams with the smallest possible strength gap — exact, not guessed.`
  - **Edit.** `Swap anyone. The gap updates live, so you can see whether the change was fair.`
  - **Play.** `Run a series, single elimination, or Swiss. Record results as they happen.`
- **Trust list:**
  - `The gap is the proven minimum for your pool, not a heuristic.`
  - `Works with no signal. The court has no wifi.`
  - `Your data stays on your device. No account, no server.`
- **Primary action:** `Open comp3tive` → `/app` (a real `<a href="/app/">`, styled as a button — not a JS click handler)
- **Under the action:** `Free, no account. Runs in your browser.`
- **Footer:** `comp3tive — fair teams for futsal nights, MLBB sessions, and everything after.`

## The hero

```html
<picture>
  <source media="(max-width: 640px)" srcset="/hero/split-mobile.png" />
  <img src="/hero/split-desktop.png" width="890" height="625"
       alt="Two five-player Mobile Legends teams side by side, each showing average strength and role, with a gap meter reading 0.1." />
</picture>
```

Both images are committed in `public/hero/`. Keep `width`/`height` so the page does not shift as the image loads.

## Styling

- Create `src/landing.css`, starting with `@import "./tokens.css";` (ticket 02), consuming the existing tokens — `--surface`, `--text`, `--text-2`, `--accent`, `--hairline`, `--r-lg`. **No new colour literals**: everything comes from the tokens, so light and dark mode work by inheritance.
- Type: Outfit for the wordmark, H1 and the three feature titles (display voice); Familjen Grotesk for body copy. The same two families the app loads.
- The dark mode the app already supports must work here too — black/white/amber on paper is the whole look, in both modes.

## Accessibility

- `<html lang="en">`, one `<h1>`, feature titles as `<h2>` or `<dt>` — never a heading level skipped.
- Visible `:focus-visible` outline using `--accent`.
- Decorative kicker marked `aria-hidden` if it is stylised; the image alt describes the product, not the file.
- Body text ≥ 4.5:1 contrast in both modes; the CTA is a real link with an accessible name of "Open comp3tive".

**Blocked by:** 01, 02

**Status:** open

- [ ] `/` renders the Landing Page with the copy above; the app is not mounted on it
- [ ] The primary action navigates to `/app/` and is reachable by keyboard with visible focus
- [ ] The hero image loads at both breakpoints via `<picture>`, with no layout shift
- [ ] Light and dark mode both render correctly, using tokens only — no hard-coded colours
- [ ] No framework, no JS bundle on the page (the only script is ticket 04's redirect)
- [ ] The page works with JavaScript disabled (the CTA is a plain link)
- [ ] A Playwright spec covers: root serves the Landing Page (asserting its H1, not the app's), and the CTA lands on the app
- [ ] `npm run build` emits the page into `dist/index.html` with hashed CSS

**Design reference:** `DESIGN.md` and `docs/design.md` — "Paper & Pencil": warm paper, quiet ink, one amber accent. `public/hero/*.png` is the product image.
