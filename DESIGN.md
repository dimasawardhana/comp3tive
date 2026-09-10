# Design Direction — comp3tive

**Direction: "Paper & Pencil."** The app feels like a blank notebook — warm paper, quiet ink, and a single amber mark that draws the eye when action is needed. Calm by default, decisive when needed.

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

## Things that don't change

- IndexedDB-only persistence
- JSON export/import (data portability is the migration path)
- Existing data model (Community, Player, Discipline, Tournament, Session, Match)
- Bottom nav: Roster, Games, History, Squads
- Solver, bracket machine, validation rules
