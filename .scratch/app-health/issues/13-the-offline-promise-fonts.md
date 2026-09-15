# 13 — The offline promise: fonts

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

**Status:** ready-for-agent

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
