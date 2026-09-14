# comp3tive — Logo Concepts

Three concepts, one brief: **the split** — dividing a group into fair teams. Amber (`#C2410C`) on paper (`#FAF8F5`), stone (`#57534E`) as the balanced counterweight. Outfit for the wordmark.

The wordmark **comp3tive** is itself a brand statement: `comp` in amber, `3` as an amber-to-stone gradient (both colors bridged), `tive` in stone. The "3" is the pivot that joins the two brand colors.

## Concept 1 — Split Capsule

A rounded capsule bisected vertically into two balanced halves. The capsule is the most "contained" shape — it reads as a single object that has been divided, which is exactly what the product does: take one group and split it fairly. The straight split line is calm and editorial, matching the Paper & Pencil direction.

**Use for:** Website header, business card, wherever a compact, confident mark is needed.

| Layout | File |
|---|---|
| Horizontal lockup | `brand/01-split-capsule/horizontal.svg` |
| Icon only | `brand/01-split-capsule/icon.svg` |

## Concept 2 — Split Circle

A circle bisected vertically. The circle is the "complete" shape — it says the group is whole before it splits. The soft curves read warmer and more approachable than the capsule, and the circular form echoes a ball (futsal, MLBB, badminton).

**Use for:** Social media profile, app icon, wherever a friendly, recognizable mark is needed.

| Layout | File |
|---|---|
| Horizontal lockup | `brand/02-split-circle/horizontal.svg` |
| Icon only | `brand/02-split-circle/icon.svg` |

## Concept 3 — Split Pill

A wide, low pill bisected vertically. The horizontal emphasis is dynamic — it reads like a scorebar being split, directly evoking the tournament moment. Most distinctive of the three; least "logo-like," so best where the mark must sit alongside other text.

**Use for:** Hero section, splash screen, wherever the mark needs to feel energetic and wide.

| Layout | File |
|---|---|
| Horizontal lockup | `brand/03-split-pill/horizontal.svg` |
| Icon only | `brand/03-split-pill/icon.svg` |

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

The wordmark is built from three `<tspan>` segments inside a single `<text>` element:
- `comp` — fill `#C2410C` (amber)
- `3` — fill `url(#g3)`, a horizontal linear gradient amber → stone
- `tive` — fill `#57534E` (stone)

The "3" sits between the two brand colors and bridges them. This is intentional: the brand name contains the word "three," and its middle character literally combines both identities.

The gradient is defined per-SVG in `<defs>` as `id="g3"` with `gradientUnits="objectBoundingBox"` so it spans the width of the "3" glyph. Outfit 600 loads from Google Fonts via `@font-face`; system-ui is the fallback with the same letter-spacing.

## Usage

- **Clear space:** minimum clear space = the width of one half of the icon, on all sides.
- **Minimum size:** 48px wide for the horizontal lockup; 24px for icon-only.
- **Do not** recolor, stretch, or add effects to the wordmark segments — the amber/stone/gradient split is the identity.
- **On dark backgrounds**, use the reversed version (stone + amber swapped to white, gradient reversed stone → amber).
- **Font:** Outfit 600 for the wordmark. If Outfit is unavailable, system-ui sans-serif with `letter-spacing: .06em`.

## Monochrome Variations

Append to any concept's SVG by overriding the fills:

- **Dark (single amber):** `.hl { fill: #C2410C; } .st { fill: #C2410C; } .wm { fill: #C2410C; }`
- **Reversed (dark bg):** `.hl { fill: #FAF8F5; } .st { fill: #C2410C; }` with wordmark reversed gradient
- **Single stone:** `.hl { fill: #57534E; } .st { fill: #57534E; }`
