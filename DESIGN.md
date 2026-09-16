# Design Direction — comp3tive

**Direction: "Paper & Pencil."** The app feels like a blank notebook — warm paper, quiet ink, and a single amber mark that draws the eye when action is needed. Calm by default, decisive when needed.

The same world carries the Landing Page at `/`, which is not a second language but this one at page scale: **"The Ledger"** — every claim about the tool set as a full-width row, the product's own verb in a narrow left rail, the measured evidence in the wide field beside it.

## Why this direction

The current "Sideline" direction was right about paper/ink warmth, but it leaned too hard into sports-tool territory (coach's clipboard, whistle, bib colors). A team-splitter is not a sports app — it's used on a couch, at a table, on a phone, with 14 people waiting. The visual language should match that scene: a clean notebook, not a tactical clipboard.

The page is a working surface. It has paper warmth, not glass. It has a single amber pencil mark — the live action — that draws the eye when it matters. Everything else recedes.

## Tokens

### Color

| Token | Hex | Role |
| --- | --- | --- |
| `paper` | `#FAF8F5` | App background — warm white, like blank paper |
| `surface` | `#FFFFFF` | Elevated surfaces (cards, modals) |
| `ink` | `#1C1917` | Near-black — text, structure |
| `slate` | `#57534E` | Secondary text, captions |
| `amber` | `#C2410C` | One accent: focus rings, links, the live action |
| `ink-ink` | `#FAF8F5` | Inverse text on dark surfaces |

**Restraint rule:** the *only* color that says "do this now" is `amber` (deep orange). Everything else is paper + ink. Bib colors are *only* on team identity — never on buttons, never on chips. The page reads as warm paper + dark ink + one orange mark; everything else is team paint.

### Dark mode

Dark mode is "the scoreboard at night" — surfaces invert to ink `#1C1917` (raised `#23201C`), text becomes paper `#FAF8F5`, amber brightens to `#EA580C`. Bib colors are unchanged. The split panel stays a raised dark surface so the team cards pop.

### Type

Two voices, used with intent:

- **Outfit** — geometric, confident, warm. The display voice. Used at 24px+ for h1, section kickers, the gap meter, the champion name. Never for body.
- **Familjen Grotesk** — humanist, warm, readable. The body voice. Used for inputs, lists, descriptions, everything that isn't display.

Type scale (one place this is non-negotiable):
- **h1**: 36px / 1.0 / -0.01em / Outfit 600, uppercase
- **kicker**: 11px / 0.14em / Outfit 700, uppercase (▸ accent in amber)
- **lede**: 16px / 1.45 / slate
- **body**: 14px / 1.5 / ink
- **caption**: 12px / 1.4 / slate
- **display-xl**: 56px / 0.95 / Outfit 700 (champion card, the gap meter)

### Spacing & rhythm

- Page padding: 20px horizontal, 24px top of content
- Section gap: 24px
- Card padding: 16px
- Tight rhythm: 8px scale (4, 8, 12, 16, 24, 32, 48, 64)

### Surfaces

- **Cards**: 1px hairline border, 12px radius, no shadow except on modals
- **Paper feel**: no noise texture — just the warm paper background
- **Inset surfaces** (form areas): `--surface-2` with 8px radius, hairline border

## Layout

### Topbar (masthead)
- Wordmark + horizontal rule
- **Community switcher** is a single bar with a label "COMMUNITY" (kicker), a select for the active community, and two icon buttons (✚, ✕)
- Right: Import / Export / Clear

### Roster screen
- Section kicker "MATCH SHEET · 01" in amber ▸
- h1 "comp3tive" in display uppercase
- Lede: "**[Community] · 8 players on the roster**"
- Toolbar: filter chips + Add Player + Import Players
- **Player list as lineup cards** (not flat rows): each card has the bib color as a 4px left stripe, the player name, a role badge row, and an action affordance
- Empty state: warm, directive, with a one-tap CTA

### Tournament screen
- Specs summary as a tight metadata strip
- **Bracket view** as a real bracket: rounds as columns, matches as connected cards, the line advancing drawn
- **Standings view** for swiss: rows with rank, team, W, game wins
- **Champion card** as the hero at the top when complete

### Split / match screen
- The "split" is the hero: a dark panel with team cards in bib colors
- **Gap meter** as a horizontal bar: teams as labels on either side, the needle in amber, the gap number in display type
- Edit affordance: each card is a swap target

## The signature moment

**The split result.** When the solver finishes, the screen shows:
- A dark panel (ink in light mode, raised ink in dark)
- N team cards in their bib color, each showing the team name, average strength, and the players as a tight grid with role chips
- The **gap meter** between the two extreme teams: a thin horizontal line with the weakest and strongest team on either end, the needle in amber, the gap number above

This is the *one* moment where the page has color. The rest of the app is paper + ink; the split is paper + ink + all the bibs. When the gap is zero, the needle disappears and a single line says "balanced."

## The Landing Page — "The Ledger"

**Composition: THE LEDGER.** The public front door at `/` (index.html, src/landing.css, src/landing.tsx) is Paper & Pencil at page scale, not a second visual language. Every claim about the tool is one full-width row: the product's own verb in a narrow left rail, the measured evidence in the wide field beside it. It refuses the category's hero-metric stack and its three-card feature grid; the repeat of the rail is the page's spine.

### The ledger row

The row is the page's only structural unit. Five of them, in reading order.

| Rail verb | Field |
| --- | --- |
| **Split** | The live `<SplitScreen>` component, mounted by src/landing.tsx into `#landing-hero` |
| **Edit** | The swap-and-re-roll claim |
| **Play** | The bracket preview, mounted into `#landing-play` |
| **Roster** | The discipline model, mounted into `#landing-disciplines` |
| **Open** | The trust list and the page's single action |

- The row is a two-track grid: `minmax(150px, 200px) minmax(0, 1fr)`, gap `clamp(24px, 5vw, 72px)`, `align-items: start`.
- Rows are divided by a 1px `--hairline` rule above and below. **Elevation is a border, not a shadow** — no row, rail, or field carries a radius; the ledger paints no background of its own and casts none.
- The intro (h1 + lede) opens inside the ledger, above the first row rule.
- The hero row is the ledger's one exception to flatness: its field holds a notebook sheet — 1px `--hairline` frame, `--r-lg` radius, `--surface-2` fill, and the page's only cast shadow. **Radius belongs to the hero sheet alone.** (The amber needle inside it carries a 1px amber halo: a mark, not an elevation.)
- The hero carries the app's real split screen, restyled from its dark panel to warm paper; team cards re-draw on `--surface` with `--r-md`, and their bib chips are the page's only saturated color.

### The rail

| Element | Rule |
| --- | --- |
| Label | Outfit 600, 13px, `0.18em`, uppercase, `--text` — the product's own verb, never a marketing noun |
| Label rule | 1.5px `--text` beneath the label — the only heavy rule on the page |
| Facts | A `<dl>`: `dt` at 11px / `0.14em` / uppercase / `--text-2` over `dd` at Outfit 600 / `clamp(20px, 2.4vw, 28px)` / `-0.02em` / `--text` |
| Numerals | `font-variant-numeric: tabular-nums` across the whole facts list, so figures align as a column and never reflow as they change |
| Accent | `--accent` on exactly one fact per rail — the live measurement. In the Split rail that is Gap; every other fact stays ink |

**The rail states measured facts, never typed ones.** The Split rail is filled at runtime from the solver result: `ROSTER.length` for players, `result.teams.length` for teams, and `result.gap.toFixed(2)` for the gap. The markup ships readable fallback figures for no-JS clients and the module overwrites them, so the page cannot drift from the code it demonstrates. `.toFixed(2)` is deliberate — a fixed two-decimal width keeps the rail from reflowing as the number changes. Measured in the shipped sample: 10 players, 2 teams, gap `0.10`.

### One action

- The Landing Page authors exactly one action: the pill at the close, `href="/app/"`. The page adds no nav, no secondary button, and no competing link.
- The hero is the one place other controls appear, and they are the mounted `<SplitScreen>`'s own: its breadcrumb is inert (`href="#"` with `preventDefault`, and no back button, because the mount passes no `onBack`), and its Re-roll re-solves the sample (the mount passes a no-op for `onPersistResult`). They belong to the mechanism being demonstrated, not to the page's offer to leave.
- The pill is `--accent` on `--accent-ink`, `border-radius: 999px`, `min-height: 52px`, Outfit 600 at 16px. It is the page's only amber-filled control — the only amber element that is also a target.
- The arrow is **nested, not naked**: the glyph sits inside its own 36px circular chip (`border-radius: 999px`, white at 16% alpha) held in the pill's right padding. The pill never carries a bare arrow.
- Hover deepens the fill and moves the chip 3px along the reading direction at 1.04 scale; `:active` presses the whole pill to `0.985`. Both use `cubic-bezier(0.22, 1, 0.36, 1)` over 0.5s — the app's component ease, distinct from the ledger's entry ease below.

### The deal

Mounted by src/landing.tsx into `#landing-deal`, ahead of the live `<SplitScreen>`, so the hero field opens by showing the mechanism. src/landingDeal.tsx (`SplitDeal`) parts ten rated players into the two teams the solver assigned: placement comes from the same `result` the page's `freshSplit` produced, every strength figure from `strengthOf`.

| Piece | Rule |
| --- | --- |
| Anchors | `.deal-anchors` (`aria-hidden`) holds one empty 38px cell per pool slot and per team slot — invisible cells that own the layout in normal flow |
| Chips | Each `.deal-chip` is `position: absolute` in `.deal-chips` (`inset: 0`, `pointer-events: none`); its width, height and translate x/y are measured from its anchor and set inline |

- **Inline geometry is required, not stylistic.** A chip must fit two different containers — a pool column and a team slot, laid out `5fr` / `8fr` — so its box is measured against the stage with `getBoundingClientRect()`, never authored. Chips hold `opacity: 0` until the first measurement lands.
- **Only `transform` and `opacity` animate**, so nothing reflows mid-flight. Travel is `transform 0.9s cubic-bezier(0.22, 1, 0.36, 1)`; each chip departs `55ms` (`STAGGER_MS`) after the previous one in roster order — the last leaves 495ms in.
- **The flip waits two frames.** The deal sits in the first viewport, so the observer fires on the opening frame; committing pool and teams in one paint would leave no changed value to interpolate and the chips would teleport. `startDeal` flips after two `requestAnimationFrame`s.
- **`data-dealt="true|false"` on `.deal-stage` is the observable state** — IntersectionObserver at `threshold: 0.3`, unobserved after first intersection, never a scroll listener.
- **Travel targets stay correct.** ResizeObserver on the stage and `document.fonts.ready` both re-measure, so a width change or a webfont swap re-aims every chip.
- **`Split again` (`.deal-replay`) resets and re-runs** through a double `requestAnimationFrame` — the reset must paint before the second pass, or the browser sees one step and interpolates nothing. The stagger belongs to the dealt leg only: `transitionDelay` is `0ms` at rest.
- **The outcome never depends on the animation.** Reduced motion calls `setDealt(true)` immediately, and its CSS block drops the transform transition while keeping a 0.3s opacity one; a client without IntersectionObserver gets the same immediate fallback. Teams, names and strengths are readable text in every case.
- **Team membership is never colour alone.** The anchor layer is `aria-hidden` and each chip carries its own `sr-only` `on Team A` span; the team average sits behind an `sr-only` `average strength` prefix rather than standing as a bare number.
- **Responsive.** At `<=860px` the anchors collapse to one column and the pool becomes two; the caption — a `--hairline` top rule, one line of `--text-2`, and the control — stacks. `.deal-chip-name` ellipsizes rather than wrapping or widening the chip.
- Each chip's dot takes the existing `--bib-a` … `--bib-e` in team order (`deal-dot-0` … `deal-dot-4`), held at 0.3 opacity until the deal commits, then full on `data-lit="yes"`.

### Motion

One authored entry moment. The ledger is never animated decoratively.

- `opacity` and `transform` only, over 0.9s with `cubic-bezier(0.16, 1, 0.3, 1)` on each ledger row and on the close block.
- **The resting state is visible.** src/landing.tsx is the only thing that adds `.is-pending` (`opacity: 0`, `translateY(18px)`), so a blocked, failed, or absent module — headless capture, print, throttled tab, no JS — leaves the page readable rather than blank.
- **Rows already inside the first viewport are never hidden**: at module run, any row whose top sits above 85% of `innerHeight` is skipped entirely.
- IntersectionObserver only, never a scroll listener — `rootMargin: 0px 0px -12% 0px`, `threshold: 0.05`, each row unobserved once revealed.
- Under `prefers-reduced-motion: reduce` every row renders visible and static and the transition is dropped; the landing's own reduced-motion block additionally drops the hero needle's animation and the team-card hover transition.

### Responsive

| Width | Composition |
| --- | --- |
| 861px and up | Two tracks. The rail holds 200px and is `position: sticky; top: 32px`; its facts stack vertically |
| Below 861px | One track. The rail is static and its label rule spans the full width; its facts become a horizontal strip |

- The facts switch from stacked to horizontal through `grid-auto-flow: column` — the same `<dl>` read left to right instead of top to bottom. The rail does not become a different component on a phone.
- Below 861px the bracket stops being a row of columns and stacks, its advancing arrow rotates 90°, and discipline cards drop their divider.
- **Zero horizontal overflow** at 390, 768, 1440 and 1920px, in both modes.

### Focus

- One ring, declared once for the whole page: `:where(a, button, [tabindex]):focus-visible` — a 2px `--accent` outline at 3px offset. Components never restate it.
- The ring is the same amber as the one action and the one live measurement: focus, action, and urgency are deliberately one color.

### Tokens

The Landing Page reads tokens from src/tokens.css — the same file the app reads, so the two surfaces cannot drift. It declares none of its own.

| Group | Tokens |
| --- | --- |
| Surface & ink | `--surface`, `--surface-2`, `--hairline`, `--text`, `--text-2` |
| Accent | `--accent`, `--accent-ink` |
| Team identity | `--bib-a` … `--bib-e` |
| Radii | `--r-sm`, `--r-md`, `--r-lg` |

**The Landing Page introduces no new tokens, no new fonts, and no new colors.** Every color in src/landing.css arrives through `var(...)`. The file's only literal values are alpha overlays of amber, ink, or white, plus the single darkening of the accent on CTA hover — all derived from the palette above, none of them a new color. Type is Outfit for display and Familjen Grotesk for body, exactly as the app uses them, loaded from the same two families.

## Things that don't change

- IndexedDB-only persistence
- JSON export/import (data portability is the migration path)
- Existing data model (Community, Player, Discipline, Tournament, Session, Match)
- Bottom nav: Roster, Games, History, Squads
- Solver, bracket machine, validation rules
