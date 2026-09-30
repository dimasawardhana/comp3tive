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

### Buttons

One button family, one height: **52px** (`src/split.css:123-172`). The box is the line box plus the padding plus any border, and a button's `line-height` is `normal` — Chrome's UA `font` shorthand resets it, so `.btn` inherits no line-height from `body` and each variant's line box follows its own font-size. Measured out of flow, with the webfont applied: `.btn` at 16px is 50px (20 + 30), `.btn-ghost` is 52px (20 + 30 + 2 for its borders, which Chrome snaps down from 1.5px), `.btn-danger-ghost` is that same 52, and `.btn-primary` at 14px was 47px (17 + 30) before the padding below. Three numbers in the sheet, one of them historical, and the loudest control was the shortest.

**The 50px base is the family's floor rather than a member of it, and that is what makes the sentence above true.** No element in `src/` renders a bare `.btn`: every button carries a variant, which is `btn btn-ghost` 31 times (counting `ConfirmButton`'s own default), `btn btn-primary` 26, `btn btn-danger-ghost` 4, and `btn btn-ghost small` 3. So the 50px box is never a box a thumb meets, and the family is one number in practice because the base is not one of the things that ships. The Squads screen's four-action bar is the case that settles it: measured in a browser, `← Squads`, `Re-split`, `New tournament with these teams` and `Delete` are all 52, and there is no plain button under the primary for it to be shorter than.

**Unifying the two numbers would cost real layout and buy nothing, so the document records them instead.** `min-height: 52px` on `.btn` gives the base a number it never renders with and takes the three `.small` buttons from 34 to 52, reflowing the roster's select-all row and the two Remove buttons in the discipline editor. Raising the base padding to 16px instead lifts both bordered variants to 54 and leaves the primary at 52, which is a wider disagreement than the one it removes. Both are a button refactor across 64 call sites, and neither is a better family.

**`.small` is a second tier, and 34px is the one place the sentence above does not hold.** A 52px target is the wrong size for a control sitting inside a list row, so `src/index.css:657` sets 13px over 8px of padding and three buttons opt into it. It is named here because this section is what it was missing: a document that claims one height and records three numbers is the failure, and the number it had left out was the one a person can see.

**The primary is never shorter than the button beside it.** `.btn-primary` carries `padding: 17.5px 18px`, which is `(52 − 17) / 2`: it lands on the family height exactly, so a row holding a primary does not grow, and its horizontal padding is untouched, so no label changes width and no bar re-wraps. Measured across every context, the lone primary went 47 → 52 and nothing else moved; the 390 action bar grew 5px, 134 → 139, with its sticky bottom edge still seated at 780.

**Do not "fix" the 14px back to 16px.** Uppercase at 14px is optically about 16px, so the size is doing optical work and the hit area is what was wrong. Set it to 16px and every primary in the app widens: measured at 390, the tournament action bar goes from two lines to three, 139px of bar to 199px, because "Save teams to tournament →" no longer shares a line with "Share". It does not even reach the goal — 16px under the 15px padding is 50px, two short of the ghost beside it.

**A primary that shares a flex line is stretched by it, which is why this survived an audit.** Every action row is `display: flex` with the default `align-items: stretch`, so a primary beside a `.btn-ghost` renders at the ghost's 52px and already looked correct in the Save squad, Player edit, Bulk rate, Share sheet and Discipline edit rows, and at every desktop width. 47px appeared only where the primary is alone on its line: a lone modal CTA, the error boundary's reload, and the wrapped second line of the four-action bar at 390. Geometry a thumb feels has to be measured where it renders, not where it is easiest to see.

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
- Edit affordance: a `Swap` ghost in the action bar enters swap mode and the primary, relabelled `Done swapping`, is its only exit (`src/session/SplitScreen.tsx:513-526`). While the mode is on, each **player row inside** a card is the swap target — `role="button"`, a tab stop, `Enter`/`Space`, click (`src/session/SplitScreen.tsx:76-88`) — and two picks on different teams trade those players and recompute the gap. Outside the mode the same rows carry none of it and the click is inert, so the card is never the target.

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

- One ring, declared once for the whole page: `.landing :is(a, button, [tabindex]):focus-visible` (`src/landing.css:49`) — a 2px `--accent` outline at 3px offset. Scoped to `.landing` and built with `:is()` rather than `:where()` on purpose, so it keeps both the scope and a specificity comparable to the app's bare `:focus-visible`, which lives in a stylesheet this page does not load (`src/landing.css:43-48`). The `[tabindex]` arm is what rings the split screen's swap rows, which are focusable only inside swap mode. Components never restate it.
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

## Copy voice

Match-night, plain, active. People and what they do, never the system: "Split the teams," not "Run solver." Same name through a flow: the button that says "Split" produces "Tonight's teams." Referee-voice for flags: "No keeper on pink. Fitri is covering." Errors don't apologize and are never vague — the shipped one is "Not enough eligible players for this game. Adjust the pool or change the discipline." (`src/session/SplitScreen.tsx:410`). Empty screens are invitations to act.

**No em-dashes in new visible copy.** Periods and commas carry the pauses. The em-dash is the AI tell, so it is out of UI strings.

**The shipped app does not meet this yet, and that is a known sweep rather than a claim.** Visible copy carries an em-dash on **13 lines / 15 characters**, and it is measured the way `src/emDash.test.ts` measures, so this paragraph and that test cannot drift apart: the tally is of **visible copy**, and em-dashes in *code comments* are not in scope. The method is `ts.createSourceFile` over every non-test `.ts`/`.tsx` under `src/`, reading only string literals and JSX text, plus the visible part of `index.html`, `app/index.html`, `public/404.html` and `prototype/index.html` with comments and `<script>`/`<style>` bodies blanked. Parsing rather than matching text is what keeps comments out for free, and "string literals" is a deliberate superset of what a reader sees: a dash in a class name or an `aria-label` is counted. The 13 lines are 9 in the components (`src/shell/usePlayerImport.ts:377`, `src/shell/AppChrome.tsx:104`, `src/ErrorBoundary.tsx:37`, `src/landing.tsx:97,104,111`, `src/domain/DisciplineEditModal.tsx:182`, `src/roster/PlayerEditModal.tsx:309`, `src/session/MatchScreen.tsx:181`), 2 in `index.html:129,173`, and 2 in `public/404.html:6,169` — `:6` being the document title, the one part of that page a reader sees before the body. 13 lines hold 15 characters because `src/shell/AppChrome.tsx:104` and `src/roster/PlayerEditModal.tsx:309` are the paired `— No community —` and `— None —`, two characters on one line each; the line count and the character count are different numbers, and only the second is what a search for `—` returns.

**Three lines were here and are gone, so the count is 13 and not 16.** `src/share/share-text.ts:61,62,78` shipped in Phase D carrying an em-dash each — the two gap sentences and the share headline — and they were **removed rather than added**. Those three addresses are historical, and the file no longer holds a dash on any of them: a reader looking for `src/share/share-text.ts:61` today finds the reworded gap sentence. A later sweep should not go looking for them: the copy now reads `Gap 0.4. The proven minimum for this pool.`, `Gap 0.4. The smallest gap known for this pool. A smaller one may exist.` and `Futsal · Thursday Crew, 2 teams`, and the share poster paints that same sentence because `src/share/share-image.ts:4` imports `closingLine` rather than writing a third one. The measurement above is taken after the removal; before it, measured the same way at the commit that removed them, the total was 16 lines and 18 characters.

**The three discipline-card em-dashes are one set, and that set is why the badminton card was reworded rather than swept.** `src/landing.tsx:97,104,111` are the `desc` strings of the three entries in the single `DISCIPLINES` array, rendered side by side as the Roster row's card set. Each opens with the same move, "thing — gloss", so dropping the dash from the badminton card alone would leave the set reading as two voices and make the reworded card the odd one out. They move together or not at all: a copy pass that takes the set sweeps all three in one edit, and the other ten pre-existing dashes go in that same pass rather than half-sweeping the set here. This is recorded so the next reader does not take the badminton card for an oversight.

**CORRECTION (2026-09-30, after `963f6f9` landed): the count above was right and the addresses were not; 7 of the 13 no longer pointed at an em-dash.** The paragraph was measured once in Phase D and never re-read, so it drifted into being a list of `file:line` pairs that looked complete and was not. A reader taking it as the acceptance list for the sweep would have gone to `index.html:101`, `src/roster/PlayerEditModal.tsx:262` and `src/shell/usePlayerImport.ts:226`, found no em-dash at any of them, and concluded the work was finished. Every backticked `file:line` in this file was read against the tree and resolved: **7 of the 13 line-cited references were stale, and every one of the 13 numbers has now been re-derived rather than carried.**

**The inventory was not merely out of date. It was out of date in a way that hid new violations.** Measured the way `src/emDash.test.ts` measures, the tree at `963f6f9^` held **17 lines / 20 characters**, not the 13 the paragraph claimed: four lines the ledger had never listed were shipping an em-dash, and the guard's first run is what found them. `src/shell/RosterScreen.tsx:158` carried two on one line (a `CAUSE_GROUPS` note), `src/shell/RosterScreen.tsx:689` carried one written `&mdash;` so that three searches for the character passed it, `src/shell/usePlayerImport.ts:95` carried one, and `src/roster/BulkRateModal.tsx:384` carried one from `dd1cbcf`. All four addresses still land on the sentence they once did, reworded, so a reader can confirm the fix at the exact place the ledger never pointed them at. That is the sentence worth keeping: an incomplete measurement is worse than none, because a stale address reads as the end of the work rather than as a reason to look again. `963f6f9` reworded all four, which is why the count is back to 13 lines / 15 characters — the same number, reached a different way. It was not a sweep that found them, and the ledger is not what kept them out.

**The count is stable now, and the reason is that this paragraph and the guard are the same measurement.** `src/emDash.test.ts` reads the whole shipped surface on every run, so a new em-dash in visible copy fails a test rather than waiting for a person to re-read this file; the second test in that file fails if a ledger entry no longer has a character behind it, so a reworded sentence cannot hide behind a dead one. **The number above is therefore no longer maintained by hand.** What a reader should take from this correction is narrower and firmer: a doc and a test that define "visible copy" differently is exactly how this paragraph went stale, and the two now share one definition — which is the fix; the rewritten paragraph above is only the visible part of it.

**The seven stale references split into two different failures, and only one of them is about a number moving.** Five were addresses that no longer point at the thing they claimed: `src/shell/usePlayerImport.ts:226` is now `:377`, `src/roster/PlayerEditModal.tsx:262` is now `:309`, `index.html:101,145` are now `index.html:129,173`, and `public/404.html:124` is now `:169` (its `:6`, the document title, was always right). Two were citations whose invariant still holds and whose address moved under it: `src/session/SplitScreen.tsx:376` was a ternary and the shipped error sentence is at `:410`, and `src/App.tsx:63-69` held the theme and layout preferences, with `NAV_ITEMS` now in `src/shell/nav-items.ts:5-11` — five hubs in the order this file's closing list names, which is the invariant, and it is unchanged. In both cases the fix was the citation, not the claim. The same distinction applies to the accessibility citations repaired alongside this one, and they are listed here because they were audited rather than assumed: `src/index.css:1951-1957` was `.chip[aria-pressed="true"] .str` and `.stepper`, and the split panel's `--panel-text` on `--panel` is `src/split.css:309,315`; `src/index.css:1982` was `.stepper .hint { color: var(--text-2) }` and the `#ffffff` drawn on a bib is `src/split.css:339`; `src/landing.css:478` was `text-transform: uppercase` and the `#ffffff` on the Landing Page's bib pill is `src/landing.css:481`; `src/tokens.css:19-23` was the surface and ink group and the bib values are `src/tokens.css:28-32` and `:75-79`. All four invariants were re-measured, not assumed: the bib values are byte-identical in the light and dark blocks, `--panel-text` on `--panel` is still 16.5:1 light and 15.3:1 dark, and the five bib ratios are unchanged at 1.60–3.35:1 for `#ffffff` and 5.23–10.95:1 / 1.51–3.16:1 for `--text`.

## Accessibility & quality floor

Mobile-first and thumb-friendly (bottom bar actions, 44px+ targets — the button family sits at 52px, see [Buttons](#buttons)) · `min-height:100dvh` (no mobile viewport jumps) · visible `:focus-visible` rings in amber (`--accent`) · text contrast ≥ 4.5:1 on every surface in both themes — `--text` on `--surface`, `--text-2` labels at full strength, and `--panel-text` on `--panel`, the pairing the split panel actually renders (`src/split.css:309,315`), measured at 16.5:1 light and 15.3:1 dark. The surface token on the panel is not `--surface`: in dark mode that is `#1c1917` on `--panel: #23201c`, 1.08:1 · responsive to desktop (the app column centers on a subtle hairline frame).

**Team bibs are the one surface this floor is not met on, and the gap is in the CSS.** The bib
colours do not change between themes (`src/tokens.css:28-32`, `:75-79`), and the text drawn on
them is `#ffffff` (`src/split.css:339`, `src/landing.css:481`), which measures **1.60–3.35:1**
across the five — below 4.5:1 in both themes, worst on `--bib-a` yellow at 1.60:1. The pairing
that would pass is `--text` on the bibs: 5.23–10.95:1 in light mode, but 1.51–3.16:1 in dark, and
it is not the one rendered in either theme. Closing this means changing a token or the chip, not
this sentence; the rule stands as written and the violation is named here so neither is mistaken
for the other.

## Things that don't change

- IndexedDB-only persistence
- JSON export/import (data portability is the migration path)
- Existing data model (Community, Player, Discipline, Tournament, Session, Match)
- Bottom nav: five hubs in `NAV_ITEMS` order — Home, Roster, Games, History, Squads (`src/shell/nav-items.ts:5-11`)
- Solver, bracket machine, validation rules

