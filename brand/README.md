# comp3tive — Brand Marks

Three brand marks built around the digit **three** — the core of the brand name.

The wordmark **comp3tive** splits into three colored segments:
- `comp` — amber (`#C2410C`)
- `3` — amber → stone gradient (both brand colors bridged)
- `tive` — stone (`#57534E`)

The "3" is the pivot: the brand name means "three," and its middle character literally combines both identities.

## Marks

| Mark | File | Use |
|---|---|---|
| Core mark — the "3" | `brand/3.svg` | Primary logo, large formats |
| Full wordmark | `brand/comp3tive.svg` | Headers, body text alongside |
| Icon variant — squared | `brand/3-icon.svg` | Favicon, app icon, square crops |

## Brand Palette

| Role | Color | Hex |
|---|---|---|
| Primary (amber) | hl | `#C2410C` |
| Counterweight (stone) | st | `#57534E` |
| Wordmark amber | comp | `#C2410C` |
| Wordmark stone | tive | `#57534E` |
| Wordmark 3 gradient | 3 | `#C2410C` → `#57534E` |
| Background | paper | `#FAF8F5` |

## Wordmark: comp · 3 · tive

The wordmark is a single `<text>` element containing three `<tspan>` children:
- `comp` — `fill="#C2410C"` (amber)
- `3` — `fill="url(#g3)"`, a horizontal linear gradient amber → stone
- `tive` — `fill="#57534E"` (stone)

The gradient `id="g3"` is defined in each SVG's `<defs>` with `gradientUnits="objectBoundingBox"` so it spans the width of the "3" glyph. Outfit 600 loads from Google Fonts via `@font-face`; system-ui is the fallback with `letter-spacing: .06em`.

## Usage

- **Clear space:** minimum clear space = the width of the "3" glyph, on all sides.
- **Do not** recolor, stretch, or add effects to the wordmark segments — the amber/stone/gradient split is the identity.
- **On dark backgrounds**, use the reversed version (stone + amber swapped to white, gradient reversed stone → amber).
- **Font:** Outfit 600 for the wordmark. If Outfit is unavailable, system-ui sans-serif.

## Monochrome Variations

To make a single-color version, override the tspan fills:

- **Amber only:** all three tspans `fill="#C2410C"`
- **Stone only:** all three tspans `fill="#57534E"`
- **Reversed (dark bg):** `comp` → `#FAF8F5`, `3` → gradient `#FAF8F5`→`#C2410C`, `tive` → `#FAF8F5`
