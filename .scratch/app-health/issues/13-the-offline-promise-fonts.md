# 13 — The offline promise: fonts

> **Superseded.** This ticket's work shipped inside
> [`debt/33`](../../debt/issues/33-real-pwa.md) — self-hosted fonts were one of that ticket's three
> subjects. This file is history; see [`.scratch/app-health/README.md`](../README.md) for the
> pairing of all sixteen.

**What to build:** The app stops depending on a network request to look like itself — either by
carrying the two font families, or by recording plainly that the fallback is deliberate.

**Evidence.** `PRODUCT.md` promises the tool works "at the futsal court with no signal". The app
loads both of its typefaces from a CDN:

- `index.html` links `fonts.googleapis.com` with `preconnect` and **no** Subresource Integrity
- There is no Content-Security-Policy anywhere in the repo
- The CSS names `Outfit` and `Familjen Grotesk` with no `@font-face` fallback definition, so with no
  signal the typography silently degrades to whatever the browser picks — and `DESIGN.md`'s
  typographic contract quietly stops holding

The app still *functions* offline (it is only fonts), which is exactly why this sits at the bottom of
the list: it is not a correctness defect, it is a claim the product makes and the code does not keep.

**Blocked by:** `.scratch/landing-page/01` — that ticket splits the build into two HTML documents
(`index.html` for the Landing Page, `app/index.html` for the app). Whether fonts load from one
document, the other, or a shared stylesheet is decided there, and duplicating the decision into two
files is how the two surfaces drift.

**Status:** resolved

- [ ] Either both families are self-hosted and loaded from the same origin — in which case the
      `fonts.googleapis.com` requests are removed entirely — or the decision to depend on the CDN is
      recorded in `DESIGN.md` with its consequence stated
- [ ] If self-hosted: the two surfaces load them the same way, and no network request leaves the
      origin at runtime
- [ ] If self-hosted: the loading strategy does not regress first paint relative to today (the
      current links are `preconnect`ed; a naive `@font-face` swap can be slower)
- [ ] If the CDN stays: a fallback stack that preserves the intended character is declared rather
      than left to the browser default
- [ ] The choice is recorded in the ticket's Answer, with the reason
- [ ] The Playwright specs asserting font family and weight still pass (or are updated in the same
      change if the family genuinely changes, with that called out)

**Design reference:** `DESIGN.md` and `docs/design.md` — the typography is part of the "Paper &
Pencil" direction, not an incidental choice.

**Notes (fact only, not a recommendation):** Self-hosting two families is roughly 4–8 files and adds
weight to the repo, and removes the only third-party request in an app whose product brief commits to
offline operation. Keeping the CDN keeps the repo small and the typography fragile. Both are
defensible; neither is obviously right, so make the call explicit rather than leaving it implied by
inaction.

This is the lowest-priority ticket in the thread. It is here so the decision is made on purpose.

## Comments

**Re-checked 2026-10-01 against `d98b95c`, against the code rather than against debt 33's
status — shipped, on the self-hosting branch. Resolved.**

- Row 1's first clause holds. `grep -rn "fonts.googleapis\|fonts.gstatic" index.html app/index.html
  src/` returns **nothing**, and both typefaces ship from the origin: five `woff2` files in
  `public/fonts/` with their two OFL licences, declared by six `@font-face` rules in
  `src/fonts.css:36-80`, each pointing at `/fonts/…` (`:41,49,57,65,80`).
- Row 2 holds. `src/fonts.css` is imported from exactly one place — `src/tokens.css:1` — so the
  Landing Page and the app cannot load the fonts differently, and
  `e2e/tests/pwa/offline.spec.ts` asserts no third-party host on either document.
- Row 3 holds: first paint is not left to `font-display: swap`. Each document carries two
  `rel="preload" as="font"` hints instead of the old `preconnect`
  (`index.html:34,41` and `app/index.html:15,22`), and the rationale for preloading exactly those
  two is written at `index.html:24-27`.
- Row 5's "choice is recorded" is satisfied, though not where the ticket assumed. The template has
  no `## Answer` section, so the decision and its reason live in the stylesheet header
  (`src/fonts.css:1-13`) and in debt 33's `## Comments` — which is where the next reader will
  look, since that is the file that declares them.

**A live defect this ticket's resolution did not clean up, in a file it does not own.** `README.md`
still tells a newcomer the opposite of what shipped: its "What this README does not claim"
section says *"Both documents load their two typefaces from a CDN, so a first visit with no signal
renders in whatever fallback the browser picks"* and points at **this ticket** as the tracking
item. That paragraph is false of the build it sits beside. It is not this ticket's acceptance —
row 5 asks that the *choice* be recorded, and it is — so this ticket stays `resolved`, but the
false statement is tracked on [`debt/30`](../../debt/issues/30-project-hygiene.md), which is where
the README is owned and which is still open for it.
