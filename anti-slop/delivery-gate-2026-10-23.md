# antislop Delivery Gate - UI/UX revamp

Run 2026-10-23 on branch `uiux-revamp`. Mode: **during** (session override).
Every PASS below names the check that produced it. A row without evidence is not a PASS.

## Gate results

| Gate | Result |
|---|---|
| antislop Delivery Gate | PASS (this document) |
| `inspect.mjs --app` at 1440 / 768 / 390 | **0 FAIL**, 2 WARN |
| `inspect.mjs` (page) at 1440 / 768 / 390 | **0 FAIL**, 2 WARN |
| `lint.mjs --app src` | **0 FAIL**, 9 WARN |
| contrast (`contrast-check.py`, 23 pairs, both themes) | all PASS, lowest 4.96:1 |
| `npx tsc -b` | exit 0 |
| `npx vitest run` | 984/984, 71 files |
| `npm run build` | clean |
| `npm run e2e` | 126 passed, 0 failed |

---

## Block 1: Hard Gate (all must be NO)

| Rule | Answer | Evidence |
|---|---|---|
| R-02 em dash in visible copy | **NO** | `src/emDash.test.ts` 7/7. 554 dashes exist in `src/`, all in code comments, which R-02 and `DESIGN.md` carve out. The landing's five endorsed entries and the three discipline descriptions were rewritten dash-free and their ledger entries struck. |
| R-03 mobile overflow / broken layout | **NO** | At 390px `document.scrollWidth === clientWidth` (390/390). Split cards stack at 322px each. Gate measured 390 on every screen. |
| R-17 unsourced statistics | **NO** | No statistic appears anywhere. Counts render from the community's own lists; a fresh community prints 0. |
| R-18 fictional testimonials | **NO** | There is no testimonials section. |
| R-23 assets created without instruction | **NO** | No logo, avatar or photo was generated. The brand wordmark is the existing `brand/comp3tive.svg`; player names in seeds are the repo's own fixtures. |
| R-24 nav links to nowhere | **NO** | Five destinations plus Settings, each landing on a real screen. Click-through below. |
| R-25 contrast below AA | **NO** | 23 pairs measured, lowest 4.96:1 (`--accent` on `--surface`). The one historical failure (white on `--bib-a` at 1.60:1) is fixed at the token: text on a bib is now `--bib-ink`, 5.23:1 to 10.95:1. |
| R-26 dead controls | **NO** | Click-through below. The disabled "Split match" on first run was removed rather than shipped dead. |
| R-27 missing states | **NO** | Every screen has empty and zero; `loading` renders on the History and Settings paths; the split's failure path renders "Solver failed" in a status line. |
| R-28 generic FAQ | **NO** | No FAQ exists on any surface. |
| R-32 keyboard / focus | **NO** | Skip link first in DOM; `:focus-visible` ring declared once in `index.css:812`; swap-mode rows are `role=button` + `tabindex=0` and respond to Enter and Space (verified); the phone sheet closes on Escape and returns focus. |
| R-33 patched via script | **NO** | All changes are source edits. No patch script exists for CSS. |
| R-34 one theme broken | **NO** | Both themes exercised: tokens declare every pair, and Dark/Light chips were clicked and confirmed to flip `data-theme` with all pairs still passing. |
| R-35 delivered without running | **NO** | Click-through list below, produced by driving the app in a browser. |
| R-36 fabricated claims | **NO** | No security, compliance or performance claim appears. |
| R-37 built without direction | **NO** | Direction is `DESIGN.md` (Accent Ladder, seed 318235376), dealt by the taste skill and adopted with two recorded redraws. |
| R-38 fabricated content | **NO** | Sample data is computed and labelled; no ghost links or fictional people. |

## Block 2: Purpose-Gate (technique allowed, reason written)

| Rule | Verdict | Reason on the record |
|---|---|---|
| R-01 gradients / glows | PASS | Zero gradients in any stylesheet. The landing's two radial washes were deleted. |
| R-04 generic icons | PASS | Every glyph replaced with inline SVG at 16px, currentColor, stroke 1.5. No sparkle, star, magic, lightning, diamond or orb. The champion card's star was deleted outright because the card already says "Champion". |
| R-06 typography | PASS | Two faces, one job each: Outfit for the wordmark and display, Familjen Grotesk for everything else. Both self-hosted; the reason is in `tokens.css` and `DESIGN.md`. Zero `text-transform: uppercase` in `landing.css`, `split.css` and the screen region of `index.css`; wide tracking (0.03em+) removed. Nothing below 12px. |
| R-07 background pattern | PASS | No grid, blueprint, graph-paper or dot pattern anywhere. |
| R-08 decorative arrows | PASS | Zero `→`, `↗` or `▸` in the landing, and the two in-app glyph arrows became SVG or words. |
| R-09 badges | PASS | The only pill is a status chip inside a row. Every eyebrow above a heading is gone: `PageHeader` no longer accepts a `kicker` prop, which removed 19 call sites in one change. |
| R-10 glassmorphism | PASS | Both `backdrop-filter` declarations in `split.css` removed; the overlay is an ink wash via `color-mix`. |
| R-12 shadow | PASS | 9 shadows remain, each on a real overlay (`.squad-menu`, `.dropdown-menu`, `.modal-card`, `.toast`) or as an inset selection ring on `.game[aria-pressed]`. None on a resting card. |
| R-13 glow | PASS | No glow anywhere. |
| R-14 identical feature cards | PASS | The dashboard's three metrics are one divided strip, not three icon cards; the bracket renders matches, not cards. |
| R-19 animations | PASS | One entrance rise per block plus control feedback, all under `prefers-reduced-motion: no-preference`. Verified: reduce = 0 animations, 0 hidden elements; no-preference = 8 running on load. |
| R-22 generic illustrations | PASS | There are no illustrations. Nothing pretends to be a product shot. |

## Block 3: Liveliness (all must be YES)

| Question | Answer | Evidence |
|---|---|---|
| Dials set and explicit? | **YES** | ENERGY 2 / RHYTHM 2 / MOTION 1, declared in `DESIGN.md` with the Design Read line. |
| Output consistent with the dials? | **YES** | Rhythm 2: the six screens have six different compositions (KPI strip, list, split result, bracket, table, card set) rather than one repeating block. Motion 1: entrance plus feedback, no choreography. |
| One clear focal point per screen? | **YES** | Each screen's largest block carries its question: the split result on `/app/` after a solve, the count strip plus roster on Roster, the bracket on Games. |
| Whitespace structural? | **YES** | One `--gap` of 24px throughout; section rhythm is a single value rather than accumulated margins. |
| One deliberate accent? | **YES** | Full-strength `--accent` appears only on the active nav icon, the gap needle, the data series and the focus ring. The primary button is near-black `--whistle`, explicitly so the hue never becomes the button colour. |
| Identity motif? | **YES** | The split: two bib-coloured team cards and the gap needle between them, built from `gapLean()` and carried onto the landing page's live hero. |
| Design Read declared before generation? | **YES** | `DESIGN.md`, first section. |

## Block 4: Craftsmanship & Quality Locks (all must be NO)

| Rule | Answer | Evidence |
|---|---|---|
| C-1 decision justified only as "the AI default" | **NO** | Every token carries a one-line reason in `tokens.css`; `DESIGN.md` records the two redraws and why. |
| C-2 interactive element does nothing | **NO** | Click-through below. |
| C-3 section exists only to fill a template | **NO** | The landing's five rows each carry a claim; the first-run screen's four steps are real destinations, and the fifth was removed when it had nothing to say. |
| C-4 breaks in a state, theme, breakpoint or without a mouse | **NO** | Both themes, 390/768/1440, keyboard path verified including swap mode and the sheet. |
| C-5 fabricated claim | **NO** | Same as R-36. |
| R-05 AI template layout | **NO** | No hero+cards, no three-step how-it-works, no "Trusted by" bar, no bento mosaic, no fake terminal, no three pricing columns, no uniform section rhythm. |
| R-11 all pills | **NO** | Radius is bimodal and tight: 8px cards, 6px controls. Pills remain only on the status chip. |
| R-15 generic CTAs | **NO** | "Split match", "+ Add Player", "Open comp3tive", "Replay". No "Get Started", "Learn More", "Explore" or "Discover". |
| R-16 buzzwords | **NO** | No "AI Powered", "Seamless", "Revolutionary", "Cutting Edge", "Effortless". |
| R-20 generic if the logo were swapped | **NO** | The split-and-gap motif and the bib palette are the product's own; the landing hero is the working split, not a mock. |
| R-21 dark mode deferred or forced | **NO** | Both themes ship and were exercised. Dark is true black `#0A0A0A`, not navy or slate. |
| R-29 palette over budget | **NO** | One hue plus neutrals plus five bib identity colours, which are identity and stay out of the charts. |
| R-30 clone of a popular product | **NO** | Not Linear, Vercel, Stripe, Notion or Apple. The split result is the product's own form. |
| R-31 decision without a one-line reason | **NO** | Tokens, direction, redraws and the shell geometry all carry their reasons in-file. |

---

## R-35 click-through (element by element)

Driven in a real browser against `http://localhost:5173`.

| Control | Action | Result |
|---|---|---|
| Nav: Home / Roster / Games / History / Squads | click | Each lands on its own `h1` (Dashboard, comp3tive, Games, History, Saved squads) |
| Sidebar footer Settings | click | Lands on `h1` Settings |
| Phone menu button | click | 48px bar, sheet opens with Home, Roster, Games, History, Squads, Settings |
| Phone sheet | Escape | Sheet closes, `aria-expanded` resets |
| Theme chips Dark / Light | click | `data-theme` flips dark then light |
| Layout chips Mobile / Desktop | click | `data-layout` flips mobile then desktop |
| Community switcher | click | Menu opens with the community list and the add/delete controls |
| Roster toolbar Actions | click | Menu opens with "+ Add Player", "Import players", "Download CSV template" |
| Actions → + Add Player | fill name, save | Modal closes, roster goes 10 → 11 rows |
| Dashboard header CTA "Split match" | click | Opens "Set the match" |
| Match setup game card (Mobile Legends) | click | Game becomes active, roster chips populate |
| "Split 2 teams" | click | 5v5 teams; bib chips render `rgb(28,25,23)` ink on every bib; gap 0.0; reads "Dead even. Fair game." |
| Swap | click | 10 rows become `role=button` + `tabindex=0` |
| Swap: pick a player | click | Banner names the pick: "Now tap a player on the other team to swap with Andi Pratama" |
| Swap: pick on the other team | click | Players trade, gap recomputes |
| Swap: exit | click | Rows return to inert (0 `role=button`) |
| Landing CTA "Open comp3tive" | href | `/app/`, exactly one on the page |
| Phone 390px | measure | `scrollWidth === clientWidth`; bar 48px; five destinations; Settings in the sheet |

## Contrast sweep (23 pairs, both themes)

| Pair | Ratio | Theme |
|---|---|---|
| `--text` on `--surface` | 16.98:1 | light |
| `--text-2` on `--surface` | 5.54:1 | light |
| `--accent` on `--surface` | **4.96:1** (lowest) | light |
| white on `--accent` | 5.18:1 | light |
| `--accent-deep` on `--accent-soft` | 8.45:1 | light |
| `--text` on `--surface-alt` | 16.12:1 | light |
| `--bib-ink` on bib a/b/c/d/e | 10.95 / 5.69 / 5.23 / 6.83 / 7.23:1 | both |
| `--text` on `--surface` | 18.97:1 | dark |
| `--text-2` on `--surface` | 9.55:1 | dark |
| `--accent` on `--surface` | 7.06:1 | dark |
| `--accent-ink` on `--accent` | 7.06:1 | dark |
| `--accent-deep` on `--accent-soft` | 10.56:1 | dark |
| `--text-2` on `--surface-2` | 9.11:1 | dark |
| `--accent-deep` on `--accent-track` (gap figure) | 7.19 / 9.01:1 | both |

## Remaining WARNs, and why each stands

**App gate (2):**
- `hero-void` 44% and `unused-canvas` 193px: both measured on the **first-run** screen, which the inspector sees because it uses a clean profile. The screen is a two-column answer (the action you must take, and the four steps after it). A live account with players shows the stat strip, both teaser lists and the action links, so the void does not exist in the state the app is actually used in. The remaining right-hand inset is the screen's own 30px padding, matching on both sides.
- `font-not-dealt`: the sheet dealt DM Sans; the build ships Outfit and Familjen Grotesk. This is the recorded redraw: DM Sans is not on this machine, there is no DNS, the project forbids runtime font fetches (`src/fonts.test.ts`), and `src/share/share-image.ts` carries per-glyph advance tables keyed to the two shipped families.

**Page gate (2):**
- `no-real-pictures` and `no-footage`: impossible. `scripts/assets.mjs` needs network to reach an open collection, and this machine has no DNS. The project also forbids runtime fetches. Recorded as a defendable absence, not a silent one.

**Lint (9):**
- 4 shadow hits, all real overlays (`.squad-menu`, `.dropdown-menu`, `.modal-card`, `.toast`) or the inset selection ring.
- 4 `.kicker` mentions, now only in comments that explain why there is no kicker (the class itself is deleted; the one live use became `.status-label`).
- 1 em-dash count note: 68 dashes across the tree, all in code comments.

## Closing

The two numbers that moved: the app went from **5 FAIL to 0**, the landing from **7 FAIL to 0**, and lint from **15 FAIL to 0**. The one accessibility bug that was empirically real, white text on a bib at 1.60:1, is fixed at the token so no screen can reintroduce it.

---

## Correction (2026-10-24): two defended WARNs were real

The first version of this report defended the app gate's two warnings as
artefacts of the inspector's clean profile. That defence was wrong, and
measuring the geometry showed it:

| Claim in the first report | What the measurement showed |
|---|---|
| "a live account shows the stat strip, so the void does not exist in the state the app is used in" | The void was **independent of data**. `.screen` measured 469px on a 900px viewport because the height chain stopped at `.shell`, so every short screen hugged the top and left a dead band. Fixed by giving `.shell` `min-height: 100dvh` and letting `.screen` take the remainder. |
| "the remaining right-hand inset is the screen's own 30px padding, matching on both sides" | The inspector measures **text extents**, not boxes. The first-run block's right column was two stacked lines, so its text ended at **x=1249**, 191px short of the edge. Fixed by making the catalog rows label/value (name left, count right) and adding a third column. |

Two further defects were introduced and caught during the fix:

- The catalog pushed "Ready to play" under the sticky tab bar at 390px
  (`covered-text`, 100% hidden). The catalog is now withheld below 640px,
  where the first-run question is "how do I start" and the steps answer it.
- `align-content: center` produced a ~230px gap between the title and the work,
  because the rows were centred inside the 762px block. The block is now
  start-aligned and its rows fill from the top.

**Final measurements.** App gate: **0 FAIL, 0 WARN** at 1440/768/390. The
first-run screen now prints its counts as real zeros in the same divided strip a
populated account gets, carries the four steps and the discipline catalog with
each discipline's roles, and fills the canvas from the title down.

Verified after the change: `tsc` 0, `vitest` 984/984, `e2e` **127/127**,
`build` clean, page gate unchanged at 0 FAIL.
