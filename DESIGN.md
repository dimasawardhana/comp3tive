# Design Direction: comp3tive

**Direction: "Accent Ladder."** One hue at full strength on small marks, its pale
tints carrying the areas. The hue is the brand amber, so the ladder and the
wordmark are the same colour rather than two.

Dealt by `design-taste-frontend` (`--app --kind community`), seed **318235376**,
style `accent-ladder`. The palette was redrawn from the dealt raspberry
`#B8336A` to the brand amber `#C2410C`; the style's own face option is "the
ladder built from the brand's own hue", so this is that option, not a deviation.
The type was redrawn from the dealt DM Sans to Outfit + Familjen Grotesk (see
[Type](#type)); reasons recorded in `.taste-skill/direction.json`.

## Design Read

> Reading this as: a local-first team tool for amateur-sports organizers, in a
> quiet utilitarian language, dial ENERGY 2 / RHYTHM 2 / MOTION 1.

| Dial | Value | Why |
|---|---|---|
| **ENERGY** 2 | present, not loud | Used mid-conversation with 14 people waiting, not browsed |
| **RHYTHM** 2 | a few breaks | Six hubs must not read as the same screen, but none is a poster |
| **MOTION** 1 | hover, focus, one signature move | Motion here means "the split landed", not decoration. The move lives on the Landing Page's deal, and it has to be inside the first viewport: a signature move below the fold is a still picture |

## Why this direction

The previous direction ("Paper & Pencil") was warm paper, ink, one amber mark.
It was right about restraint and wrong about two things: the cream ground read as
a yellow tint against antislop's palette rule, and the accent was asked to do
five jobs at once (focus, links, chips, the live action, the danger colour).

Accent Ladder keeps the restraint and fixes the division of labour: **the hue is
data and identity; near-black is the action.** It also gives the app a place to
put its one genuinely ownable thing, the split result, without reaching for a
second accent family.

## Tokens

Single source of truth: `src/tokens.css`. Every value below is declared there and
consumed by `src/index.css`, `src/split.css` and `src/landing.css`; no stylesheet
declares its own colour.

### Colour

| Token | Light | Dark | Role |
|---|---|---|---|
| `--surface` | `#F9FAFB` | `#0A0A0A` | Page ground |
| `--surface-2` | `#FFFFFF` | `#111111` | Cards and panels |
| `--surface-alt` | `#F3F4F6` | `#191919` | Raised step: table headers, inset panels |
| `--hairline` | `#E5E7EB` | `#262626` | The one border tone |
| `--border` | `#D1D5DB` | `#363636` | Controls, one step stronger |
| `--text` | `#111827` | `#FAFAFA` | Running text, full strength |
| `--text-2` | `#5F6672` | `#B4B4B4` | Secondary text and captions |
| `--accent` | `#C2410C` | `#F97316` | **Data and identity only** |
| `--accent-soft` | `#FDF1EA` | `#24140A` | Selected rows, the user's chat bubble |
| `--accent-track` | `#F8DCCD` | `#3A1F0E` | Track behind a progress or gap bar |
| `--accent-deep` | `#7C2D12` | `#FDBA74` | Ink *of* the hue, for text on a tint |
| `--whistle` | `#111827` | `#FAFAFA` | The primary action: near-black, inverted in dark |
| `--ok` / `--danger` | `#247B50` / `#C4242A` | `#3FC07A` / `#FF6B6B` | Status, only on the fact that needs it |

**The accent budget.** The primary button is `--whistle`, never the hue: that
part holds and is the rule worth keeping. The hue itself is NOT confined to four
places. Measured on the shipped tree, `var(--accent)` appears **43 times** across
the three stylesheets: 27 focus outlines, 5 `accent-color` / caret uses, 4 data
and gap marks, 3 status texts (`.badge--mlbb`, `.standings-wins`,
`.bteam.winner`), the pressed icon button's fill, the join-code label, the
landing's accent facts and discipline sizes, and 5 `color-mix` tints. So the
budget is a **direction, not a count**: the hue marks interaction and data, and
it is never the primary action's fill. An earlier draft of this document claimed
it appeared in four places and nowhere else, which the tree contradicted.

**Team identity.** `--bib-a` … `--bib-e` are identity, not data: they never
appear in a chart and never carry text as a fill. Text on a bib is `--bib-ink`
(`#1C1917`), measured at **5.23:1 to 10.95:1** on all five. White on the same
bibs fails at **1.60:1 to 3.35:1** and is banned.

**Measured, not assumed.** Contrast for every pair above was run through
`antislop-human/contrast-check.py`. The lowest passing pair in the set is
`--text-2` on `--surface` at **5.54:1**.

### Type

Two faces, one job each. Both are self-hosted in `public/fonts/` and declared in
`src/fonts.css`; the app makes no runtime font request.

- **Outfit** (display, 600/700): the wordmark's letterform and section titles.
  Retained because `brand/comp3tive.svg` draws the "3" in it and
  `src/share/share-image.ts` carries per-glyph advance tables keyed to it.
- **Familjen Grotesk** (body, 400/500/600): every other string.

The dealt face was DM Sans. The two stacks this app ships are **unchanged from
the previous direction**: `master` already declared Outfit and Familjen Grotesk,
and this branch did not touch `src/fonts.css` or `public/fonts/`. So the dealing
step chose *not to reseat the type*, rather than redrawing it; the reasons are
DM Sans is not on this machine, the project forbids runtime font fetches, and
the share-image advance tables are keyed to these two families. Recorded in
`.taste-skill/direction.json` (seed `1797242605`).

Scale: title 24px · section 16px · KPI 24px · body 14px · small 12px. Three sizes
do the visible work. **The floor is 12px**, and two rules used to break it
(`.ai-assistant-who` at `0.7rem` = 11.2px and `.ai-assistant-tools li` at
`0.72rem` = 11.5px); both were raised to 12px on this branch. Data sits at 13 to
14px. Tabular figures on every number that changes or aligns in a column.

### Shape and rhythm

- Radius is bimodal and tight: **8px** cards, **6px** controls. One pill remains,
  `.bracket-tag`, which is a non-interactive status label inside a bracket card;
  control radii are `--r-sm`, and `.chip` (a filter button) was moved off 999px
  for that reason.
- One gap value: **24px**, horizontally and vertically.
- Control height **32px**, row pitch **44px**.
- Elevation is a step in tone (`--surface` to `--surface-2` to `--surface-alt`) or
  a 1px `--hairline`. A shadow exists only on real overlays: menu, dialog, toast.

### AI assistant
- A **balloon at the bottom-right corner**, clearing the tab bar (`--tabbar-h`) and, on desktop,
  sitting on the app card's 24px bottom inset (`src/index.css:2725`)
- The corner is shared with the split/match sticky action bars (`src/split.css:789`), so the
  balloon overlays the right end of the bar on those screens. Measured at 390: the balloon covers
  48px of the 262px primary, leaving the label and the rest of the button live. Accepted, not
  overlooked — the alternative was a launcher in the middle of the right edge
- It sits on the app card's edge (`max(16px, calc((100vw - 640px) / 2 + 16px))`, 1200 above 1024),
  so on a wide monitor it stays beside the content instead of drifting to the window edge
- Ink-filled circle, 52px; open, it keeps its place and turns into the close chip (`aria-expanded`)
- The panel opens **to the left of the balloon**, 380px wide, absolutely positioned off the chip
  with its bottom flush to the chip's and growing upward, so opening it cannot move the chip; its
  `max-height` is everything above the chip less 16px, so a short viewport shortens the panel
  rather than pushing it off the top. No modal overlay and no focus trap: it is a panel you can
  ignore while the roster stays usable
- The transcript renders with `.ai-who` labels ("YOU" / "ASSISTANT"), turns on `--surface-2`, tool
  calls as hairline chips, and the empty state in `--text-2` copy

## The signature moment

**The split result.** Team cards in their bib colour, each with its strength
average, and the **gap needle** between the two extremes: the reading is the
product, and it is the one place the accent is allowed to be an event.

- The needle is 1px `--accent` with the gap figure in `--accent-deep`.
- When the gap is zero the needle disappears and one sentence says `balanced.`
- Team membership is never colour alone: each card carries its name and each
  player row its own text.
- On a phone the cards stack and the needle becomes a horizontal bar between
  them, same data, no horizontal scroll.

## Layout

### Shell

A 230px sidebar on the page ground, nothing but a hairline between it and the
canvas. No top bar chrome. The community switcher sits at the top of the
sidebar; primary nav on a 34px pitch; utilities at the bottom.

**Five destinations, not six.** Home, Roster, Games, History, Squads. Settings
moves to a utility in the sidebar footer, because a bottom bar of six violates
the five-destination limit and Settings is not a place you go mid-game.

On a phone the sidebar folds into a 48px top bar holding the screen's name and a
menu button that opens a full-screen sheet; the bottom bar carries the same five.

### Screens

Each hub answers one question first, and its most frequent job is one click from
the first screen.

| Screen | The question | The job |
|---|---|---|
| Dashboard | Is tonight set up? | Split tonight's teams |
| Roster | Who is on the team, and can I trust their ratings? | Add or rate a player |
| Split | Is this the fairest split it can prove? | Re-roll, or accept |
| Games | What is the state of the tournament? | Open the next fixture |
| History | What happened last time? | Open a past session |
| Squads | Which combinations have I saved? | Load or delete a squad |

Composition must differ between neighbours: Dashboard is a KPI strip plus a
question block, Roster is a list with count cards, Split is a full-width result,
Games is a bracket, History is a table, Squads is a card set. No two adjacent
screens share a layout.

### The Landing Page

`/` is a page, not an app screen, and it is read in one pass. It shares the
palette and the two faces, and its structure is the product's own verb in a
narrow left rail with the measured evidence in the wide field beside it. The
first row opens with the deal, which is the mechanism and the only thing on the
page that moves on load, and then shows the live split component it produced.
The product demonstrates itself rather than describing itself, and it does so
above the fold. It carries exactly one action.

## Copy voice

Match-night, plain, active. People and what they do, never the system: "Split the
teams", not "Run solver". Same name through a flow: the button that says "Split"
produces "Tonight's teams".

- **No em dashes in visible copy.** Periods and commas carry the pause. Guarded
  by `src/emDash.test.ts`, which reads the shipped surface on every run.
- Errors do not apologise and are never vague: "Not enough eligible players for
  this game. Adjust the pool or change the discipline."
- Empty screens are invitations to act, not apologies.
- No invented numbers. If a figure has no real source it is not shown.

## Motion

Energy 2, motion 1: one authored moment, then restraint.

- The signature move is the split landing: cards settle and the needle travels
  once. Transform and opacity only.
- On the Landing Page that move is the deal in `src/landingDeal.tsx`: ten rated
  chips leaving the pool for the teams the solver assigned, staggered 85ms over
  a five-phase loop whose durations come from the same constants the transitions
  are written from. It is placed **above** the live SplitScreen panel, and it
  must stay there. It was below it, and measured at y979 on a 1280x900 screen:
  the one authored moment on the page started 79px past the fold, so the first
  viewport was a still picture of a page that advertises motion. Moving it up
  cost two margins and changed no animation. The dial did not move: this is the
  move MOTION 1 already promised, finally happening where it can be seen.
- Below 900px the deal cannot share the first screen with the headline and the
  panel, so the promise narrows to what fits: the pool and the first chip's
  whole flight stay in view, and the rest is one scroll away. Do not shrink the
  chip pitch to close that gap; 38px of chip and 8px of air is what keeps ten
  names readable while they move.
- Every section's heading, then text, then data enter staggered 60 to 90ms,
  rising 16 to 32px, triggered once.
- Every control has press, hover and focus feedback.
- Under `prefers-reduced-motion` everything renders visible and static. The
  block lives in `src/tokens.css` so both surfaces inherit it.
- `e2e/tests/landing/motion.spec.ts` holds all of the above to numbers: the fold
  position at scroll 0, the chip's start and landing boxes on a phone, and a
  sweep of `document.getAnimations()` for any transitioned layout property.

## Accessibility floor

- Text contrast at or above 4.5:1 on every surface in both themes; measured, not
  assumed. Large text at or above 3:1.
- Visible `:focus-visible` ring in `--accent`. There are **20 such rules** across
  the three stylesheets, not one: the outline is 2px or 3px depending on the
  control, and the offset is 1, 2, 3 or -2px (the negative pair sits on inputs
  whose ring must fall inside the field). The bare `:focus-visible` rule carries
  3px over a 2px offset and covers anything without its own.
- Touch targets at or above 44px; the button family sits at 52px.
- Full keyboard operation: Tab order follows visual order, Enter and Space
  activate, Escape closes dialogs, and swap mode's rows are real tab stops.
- Both themes ship and are verified; `data-theme` and `prefers-color-scheme`
  must agree. The bibs are the one place contrast is carried by a dedicated
  ink token rather than the surface.
- Mobile is the design, not a fallback: no horizontal overflow at 390px.

## Things that don't change

- Local-first persistence: IndexedDB is the read path, and it holds a
  signed-out Organizer's data outright.
- JSON export and import: data portability is the migration path.
- The data model: Community, Player, Discipline, Tournament, Session, Match.
- The solver, the bracket machine and the validation rules.
- The five hubs in `NAV_ITEMS` order, with Settings as the utility beside them.
