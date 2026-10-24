# UI/UX revamp: Accent Ladder

Full visual rebuild of the app and the landing page on the `accent-ladder` app style (seed 318235376), keyed to the brand amber. `master` is untouched until this is reviewed.

## Before / after

| Gate | Before | After |
|---|---|---|
| `inspect.mjs --app` (app) | **5 FAIL**, 5 WARN | **0 FAIL**, 0 WARN |
| `inspect.mjs` (landing) | **7 FAIL**, 3 WARN | **0 FAIL**, 2 WARN |
| `lint.mjs --app src` | **15 FAIL**, 33 WARN | **0 FAIL**, 9 WARN |
| Real accessibility defect | white on `--bib-a` = **1.60:1** | `--bib-ink` on all five bibs = **5.23–10.95:1** |
| `npx tsc -b` | 0 | 0 |
| `npx vitest run` | 984/984 | **984/984** |
| `npm run e2e` | 127 passed | **127 passed** |
| `npm run build` | clean | clean |

Baseline is `anti-slop/audit-001-2026-10-23.md` (20 numbered findings); the PASS/FAIL report with the R-35 click-through is `anti-slop/delivery-gate-2026-10-23.md`.

## Direction and the two redraws

- **Style:** `accent-ladder` — one hue at full strength on small marks only, its pale tints carrying the areas.
- **Design Read:** *a local-first team tool for amateur-sports organizers, quiet utilitarian language, dial ENERGY 2 / RHYTHM 2 / MOTION 1.*
- **Palette redrawn** from the dealt raspberry `#B8336A` to the brand amber `#C2410C`. This is the style's own face option #1 ("the ladder built from the brand's own hue"), not a deviation: the wordmark's "3" is already amber over stone.
- **Type redrawn** from DM Sans to Outfit + Familjen Grotesk. Reasons: DM Sans is not on this machine, this shell and browser have no DNS, the project forbids runtime font fetches (`src/fonts.test.ts`), and `src/share/share-image.ts` carries per-glyph advance tables keyed to exactly these two families. Recorded in `.taste-skill/direction.json`.

**Signature element:** the split. Two bib-coloured team cards and the gap needle between them, built from one `gapLean()` helper and carried onto the landing page's live hero.

## What changed

**Tokens** (`src/tokens.css`)
- One hue for data and identity; **near-black `--whistle` for the action**, so the accent never becomes the button colour.
- True-black dark ground `#0A0A0A` (not the old warm `#1C1917`, and not navy or slate).
- `--bib-ink: #1C1917` is the only text colour on a bib, in both themes.
- Radius 8/6, one `--gap` of 24px, control height 32, type scale 24/16/24/14/12.

**Retirements** (antislop)
- **No kicker prop at all.** `PageHeader` is an `h1`, one lede and an optional right-aligned action, which deleted 19 eyebrow call sites across 9 files in one change.
- Every `text-transform: uppercase` and its wide tracking removed from `index.css`, `split.css` and `landing.css`; every 9/10/11px size raised to the 12px floor.
- Emoji-as-UI replaced with inline SVG: nav, close, caret, download, edit.
- Both radial gradients, both `backdrop-filter`s, every 999px pill radius, the decorative `←`/`→`/`↶`/`⇄`/`▾` arrows and the champion star are gone.
- Landing headline cut from ten words to five, and the page given the one call to action it never had.

**Structure**
- **Settings leaves the bottom bar** for the sidebar footer and the phone sheet: five destinations, which is the documented limit. `openSettings()` in the e2e helpers makes this invisible to specs.
- The dashboard's primary action moves into the masthead, so the most frequent job is one click from the first screen. The disabled "Split match" on first run was **removed** rather than shipped as a dead control.
- The first-run screen answers "what next" in two columns instead of one card alone in a 900px canvas.
- Phone: 48px top bar, full-screen menu sheet that focuses Close, respects Escape and closes on pick.

**Motion** — one entrance rise per block, staggered by a `--i` custom property, plus control feedback, all inside `@media (prefers-reduced-motion: no-preference)`. Verified: reduce = 0 animations and 0 hidden elements; no-preference = 8 running. Sticky action bars are excluded from the rise, because a transform on `position: sticky` lifts the bar off the tab bar it is seated above.

## Things worth reviewing closely

1. **`--bib-ink`** is a new token and the fix for the one empirically real accessibility defect. If a future screen renders text on a bib with anything else, that is a regression.
2. **Five destinations, not six.** This is a product decision as much as a design one; say so if you disagree and Settings can return.
3. **The removed disabled CTA.** A disabled control with no way to satisfy it is a dead control; the empty state now names the step that unblocks it instead.
4. **e2e changes.** 12 spec files were updated, all for real contract changes (the five-slot bar, Settings behind the sheet, the roster's Actions menu, the no-arrow labels, the new headline). No assertion was weakened to pass; where a value genuinely moved, the reason is in the file.
5. **Three defects were found by verifying rather than assuming**: the sticky-bar transform at 390, a fractional 52.0000038px against a strict `toContain(52)`, and two vision-model claims (Team B's chip, the gap pill) that measurement disproved.

## Defended warnings

- **`hero-void` / `unused-canvas` (app):** these were in the first cut of this PR and are now **fixed**, not defended. The two were real: `.screen` measured 469px on a 900px viewport because the height chain stopped at `.shell`, and the first-run right column's text ended 191px short of the edge because it was two stacked lines. See the Correction section of `delivery-gate-2026-10-23.md`.
- **`font-not-dealt`:** the recorded DM Sans redraw above.
- **`no-real-pictures` / `no-footage` (landing):** impossible here — no DNS, and the project forbids runtime fetches.
- **9 lint WARNs:** 4 shadows all on real overlays (`.squad-menu`, `.dropdown-menu`, `.modal-card`, `.toast`) or an inset selection ring; 4 `.kicker` mentions now only in comments explaining why there is no kicker; 1 em-dash count note (68 dashes across the tree, all in code comments, which R-02 carves out).

## Not in this PR

- No new dependencies. Stack unchanged (React 19, Vite, plain CSS).
- No data-model, solver, bracket or validation changes.
- `DESIGN.md` rewritten to describe what actually ships; the previous doc is backed up at `.scratch/backups-2026-10-19/DESIGN-paper-pencil.md`.
