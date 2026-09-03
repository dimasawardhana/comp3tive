# Design Direction — Team Builder

Direction: **Scoreboard.** Monochrome structure with one electric pop. The app reads like a tactical sheet: paper-white surfaces, ink structure, hairline rules, and a single saturated cobalt accent reserved for action and the live moment. The thesis of the app ("fair teams") is made visible in a single signature element: the **gap meter**, which reads like a live scoreboard readout.

## Tokens

### Color

| Token | Hex | Role |
| --- | --- | --- |
| `paper` | `#F4F5F2` | App background — warm white |
| `surface` | `#FFFFFF` | Elevated surfaces (rows, cards, inputs) |
| `ink` | `#14161A` | Near-black — text and structure |
| `slate` | `#5A6270` | Secondary text, labels, captions |
| `cobalt` | `#2B6BFF` | The one accent: CTAs, focus, the gap meter |
| `bib-a` | `#FFC400` | Yellow bib — Team A identity only |
| `bib-b` | `#FF4F9A` | Pink bib — Team B identity only |
| `bib-c/d/e` | `#4E8FDB` / `#6FAF8E` / `#C9A227` | Extra bibs for 3+ teams |
| `ink-panel` | `#14161A` | Split-screen backdrop (ink in light, raised in dark) |
| `ok` | `#2B6BFF` / `#6A9AFF` (dark) | Balanced state — the gap meter needle at rest |

**Restraint rule:** one accent (cobalt), used identically for action and the live moment. Bib colors appear *only* on team identity — never on buttons, never elsewhere; they are the only hues outside the monochrome + accent system. Selected chips are monochrome (ink on paper, inverted in dark), so cobalt stays concentrated at CTAs, focus, and the meter. `cobalt` + white text keeps the CTA at AA contrast.

### Dark mode

Dual theme from the start, via `prefers-color-scheme` plus a `data-theme="light"|"dark"` override (for a manual toggle and for testing). Dark mode is the scoreboard at night: surfaces invert to ink `#14161A` (raised surfaces `#1C1F26`), text becomes paper, cobalt brightens to `#6A9AFF`, and the split panel stays a raised dark surface. Bib colors are unchanged in dark; they carry team identity in both. One theme per session, no mid-page theme flips.

### Type

Two families, two voices:

| Role | Face | Usage |
| --- | --- | --- |
| Display + numerals | **Chakra Petch** 500/600/700 | Wordmark, screen titles, team names, all strength/gap numbers — squared, angular, game-HUD energy (the MLBB side) |
| Body + UI | **Familjen Grotesk** 400/500/600 | Labels, instructions, player names, captions — warm and readable (the social side) |

Scale: screen title 28/32 · lede 16/24 · body 15/22 · labels 11 caps, tracked wide · numerals inherit Chakra Petch at 16–22 for data moments. No third family; numbers come from Chakra Petch (tabular-feeling, scoreboard-esque).

## Layout

Mobile-first single column (used at the court on a phone), max-width ~480px, one screen per step. The flow is carried by a **sticky bottom action bar**, not numbered markers — the step is self-evident from where you are.

```
SQUAD                    MATCH                   SPLIT
┌──────────────┐        ┌──────────────┐        ┌─────────────────────┐
│ TEAM▪BUILDER │        │ TEAM▪BUILDER │        │ TEAM▪BUILDER        │
│ Tonight's    │        │ Who's here?  │        │ Tonight's teams     │
│ squad        │        │ (Budi)(Andi) │        │  ┌────────┐  ┌─────┐│
│  Budi FUT 4.2│        │ (Cici)(Dedi) │        │  │TEAM A  │  │TEAM B││
│  Andi ML 3.8 │        │ What's on?   │        │  │yellow  │  │ pink ││
│  …           │        │ [Futsal][ML] │        │  │GK Budi │  │…     ││
│              │        │ Teams  [2]   │        │  │4.2 avg │  │3.9   ││
│ [+ Add]      │        │              │        │  └────────┘  └─────┘│
│ [Pick tonight│        │ [SPLIT 6/10] │        │    gap meter ◠      │
│  's players] │        └──────────────┘        │  "Team A ahead 0.6" │
└──────────────┘                                │ [swap] [re-roll]    │
                                                └─────────────────────┘
```

- **Squad**: roster rows — name + discipline badges (FUTSAL / MLBB + strength numeral). Empty state invites action: "No players yet. Add your squad and we'll start splitting."
- **Match**: pool chips toggle who's here; two game cards (Futsal — "5 v 5 + subs", Mobile Legends — "5 v 5"); a team-count stepper. The bottom bar counts selections live: "Split 6/10".
- **Split**: two team cards facing each other on the turf panel, bib-colored name bars, roster with roles, average strength per team; the gap meter between them; referee-voice flags below; Swap / Re-roll actions.

## Signature: the gap meter

A balance scale drawn in court-line strokes: team strengths as numerals at either end, a needle pivoting at the center that leans toward the stronger team, and a live readout ("Team A is 0.6 ahead." or "Dead even. Fair game."). It re-settles on every edit (live gap indicator = real feature, now the visual identity). This is the one memorable thing; everything else stays quiet.

## Copy voice

Match-night, plain, active. People and what they do, never the system: "Split the teams," not "Run solver." Same name through a flow: the button that says "Split" produces "Tonight's teams." Referee-voice for flags: "No keeper on pink. Fitri is covering." Errors don't apologize and are never vague: "Not enough players for 2 teams. Add more or lower the team count." Empty screens are invitations to act.

**No em-dashes in visible copy.** Periods and commas carry the pauses. A zero-tolerance rule: the em-dash is the AI tell, so it is banned from UI strings entirely.

## Motion

One orchestrated moment: pressing **Split** deals the two team cards in and the needle swings to rest. Everything else static — hover micro-affordances only. `prefers-reduced-motion` disables the settle animation.

## Accessibility & quality floor

Mobile-first and thumb-friendly (bottom bar actions, 44px+ targets) · `min-height:100dvh` (no mobile viewport jumps) · visible `:focus-visible` rings in cobalt · text contrast ≥ 4.5:1 on every surface in both themes (`ink` on `paper`, `ink` on bibs, `paper` on `ink-panel`, `slate` labels at full strength) · responsive to desktop (the app column centers on a subtle hairline frame).

## What we rejected (so nobody re-proposes it)

- Cream + serif + terracotta, near-black + acid accent, broadsheet hairlines — the three AI defaults; none fit a scoreboard.
- **Court-green + ball-orange "match night" palette — the previous direction, retired.** The user's other apps share that color family, so it read as a default, not a choice. Replaced with monochrome + cobalt.
- Condensed jersey-type (Bebas/Oswald/Archivo) — the sports-template answer; Chakra Petch is angulared for the draft screen instead.
- Numbered `01/02/03` markers — the flow is carried by the bottom action bar, order is self-evident.
- Decorative icons/emoji for disciplines — type badges carry the information.
- Decorative status dots and em-dashes — the two favorite AI flourishes. Flags carry meaning with an orange left border; copy uses periods, not dashes.

## How the build tickets consume this

The running app is the reference now (the earlier `prototype/` was superseded when the app was built). The tokens below are the contract; every screen in the app follows them in both themes.

- **03 (Roster management)** — Squad screen: tokens, type scale, roster row anatomy, empty state copy.
- **04 (Session split flow)** — Match + Split screens: pool chips, game cards, team stepper, team card anatomy, the gap meter, referee flags.
- **05 (Editable results)** — live meter re-settle on swap, re-roll affordance.
- **06/08** — history list and discipline creation reuse the same tokens and row patterns.
