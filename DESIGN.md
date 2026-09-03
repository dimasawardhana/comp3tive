# Design Direction — Team Builder

**Direction: "Sideline."** The app feels like a coach's bench clipboard — paper, ink, hairline rules, and one piece of *live* energy that you only see when something is happening. Calm by default, decisive when needed.

## Why this direction

The current "Scoreboard" direction was right about monochrome + a single accent, but it leaned toward generic-mobile-app. A team-splitter is not a generic app — it's used at a court, on a phone, with sweat on the screen and 14 people waiting. The visual language should match that scene: a tactical sheet, not a SaaS dashboard.

The bench is a working surface. It has paper texture, not glass. It has a single pencil mark — the live score — that draws the eye when it matters. Everything else recedes.

## Tokens

### Color

| Token | Hex | Role |
| --- | --- | --- |
| `paper` | `#F2EFE7` | App background — warm cream, like a coach's clipboard |
| `surface` | `#FFFFFF` | Elevated surfaces (cards, modals) |
| `ink` | `#14161A` | Near-black — text, structure, the "ink" on the page |
| `slate` | `#5A6270` | Secondary text, captions |
| `cobalt` | `#2B6BFF` | One accent: focus rings, links, info states |
| `whistle` | `#E63946` | The *live* accent: primary CTAs, active states, the gap meter needle |
| `bib-a` | `#FFC400` | Yellow bib — Team A identity only |
| `bib-b` | `#FF4F9A` | Pink bib — Team B identity only |
| `bib-c` | `#4E8FDB` | Blue bib — Team C identity only |
| `bib-d` | `#6FAF8E` | Green bib — Team D identity only |
| `bib-e` | `#C9A227` | Gold bib — Team E identity only |

**Restraint rule:** the *only* color that says "do this now" is `whistle` (red). Cobalt handles focus, info, links. Bib colors are *only* on team identity — never on buttons, never on chips. The page reads as paper + ink + one red mark; everything else is team paint.

### Dark mode

Dark mode is "the scoreboard at night" — surfaces invert to ink `#14161A` (raised `#1C1F26`), text becomes paper, cobalt brightens to `#6A9AFF`, whistle stays red but slightly warmer (`#F25C66`). Bib colors are unchanged. The split panel stays a raised dark surface so the team cards pop.

### Type

Two voices, used with intent:

- **Chakra Petch** — chunky, technical, slightly retro. The display voice. Used at 24px+ for h1, section kickers, the gap meter, the champion name. Never for body.
- **Familjen Grotesk** — humanist, warm, readable. The body voice. Used for inputs, lists, descriptions, everything that isn't display.

Type scale (one place this is non-negotiable):
- **h1**: 36px / 1.0 / -0.01em / Chakra Petch 600, uppercase
- **kicker**: 11px / 0.14em / Chakra Petch 700, uppercase (▸ accent in whistle red)
- **lede**: 16px / 1.45 / slate
- **body**: 14px / 1.5 / ink
- **caption**: 12px / 1.4 / slate
- **display-xl**: 56px / 0.95 / Chakra Petch 700 (champion card, the gap meter)

### Spacing & rhythm

- Page padding: 20px horizontal, 24px top of content
- Section gap: 24px
- Card padding: 16px
- Tight rhythm: 8px scale (4, 8, 12, 16, 24, 32, 48, 64)

### Surfaces

- **Cards**: 1.5px hairline border, 14px radius, no shadow except on modals
- **Paper feel**: a barely-there noise texture on the page background (1% opacity dots)
- **Inset surfaces** (form areas): `--surface-2` with 6px radius, hairline border

## Layout

### Topbar (masthead)
- Wordmark + horizontal rule
- **Community switcher** is a single bar with a label "COMMUNITY" (kicker), a select for the active community, and two icon buttons (✚, ✕)
- Right: Import / Export / Clear

### Roster screen
- Section kicker "MATCH SHEET · 01" in red ▸
- h1 "Team Builder" in display uppercase
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
- **Gap meter** as a horizontal bar: teams as labels on either side, the needle in whistle red, the gap number in display type
- Edit affordance: each card is a swap target

## The signature moment

**The split result.** When the solver finishes, the screen shows:
- A dark panel (ink in light mode, raised ink in dark)
- N team cards in their bib color, each showing the team name, average strength, and the players as a tight grid with role chips
- The **gap meter** between the two extreme teams: a thin horizontal line with the weakest and strongest team on either end, the needle in whistle red, the gap number above

This is the *one* moment where the page has color. The rest of the app is monochrome + cobalt; the split is paper + ink + all the bibs. When the gap is zero, the needle disappears and a single line says "balanced."

## Things that don't change

- IndexedDB-only persistence
- JSON export/import (data portability is the migration path)
- Existing data model (Community, Player, Discipline, Tournament, Session, Match)
- Bottom nav: Roster, Games, History, Squads
- Solver, bracket machine, validation rules
