# comp3tive — Brand Marks

Three brand marks built around the digit **three** — the core of the brand name.

The "3" is the pivot: the brand name means "three," and its middle character
splits into **amber on top, stone on bottom** — two solid colors meeting at
a hard line, no gradient.

- `comp` — amber (`#C2410C`)
- `3` — top half amber / bottom half stone
- `tive` — stone (`#57534E`)

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
| Wordmark 3 top | 3 top | `#C2410C` |
| Wordmark 3 bottom | 3 bottom | `#57534E` |
| Background | paper | `#FAF8F5` |

## Wordmark: comp · 3 · tive

The wordmark is a single `<text>` element containing three `<tspan>` children:
- `comp` — `fill="#C2410C"` (amber)
- `3` — `fill="#57534E"` (stone base)
- `tive` — `fill="#57534E"` (stone)

A `<rect>` covering the top half of the "3" is drawn in amber with a
`clip-path` referencing a `<clipPath>` whose shape is the "3" glyph.
The rect is restricted both to the top half (by its own height) and to
the "3" glyph area (by the clip path), so only the top half of the "3"
turns amber while the bottom stays stone. `comp` and `tive` are unaffected.

The clipPath "3" uses the same `@font-face`, font-weight, font-size, and
`letter-spacing` as the base wordmark so the glyph aligns exactly.

Outfit 600 loads from Google Fonts via `@font-face`; system-ui is the
fallback with `letter-spacing: .06em`.

## Usage

- **Clear space:** minimum clear space = the width of the "3" glyph, on all sides.
- **Do not** recolor, stretch, or add effects to the wordmark segments — the
  amber/stone split is the identity.
- **On dark backgrounds**, use the reversed version: `comp` → `#FAF8F5`,
  `3` top → `#FAF8F5` / bottom → `#C2410C`, `tive` → `#FAF8F5`.
- **Font:** Outfit 600 for the wordmark. If Outfit is unavailable, system-ui sans-serif.
