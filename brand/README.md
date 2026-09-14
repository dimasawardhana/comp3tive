# comp3tive — Logo Concepts

Three concepts, one brief: **the split** — dividing a group into fair teams. Amber (`#C2410C`) on paper (`#FAF8F5`), stone (`#57534E`) as the balanced counterweight. Outfit for the wordmark.

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
| Wordmark ink | wm | `#1C1917` |
| Background | paper | `#FAF8F5` |

## Usage

- **Clear space:** minimum clear space = the width of one half of the icon, on all sides.
- **Minimum size:** 48px wide for the horizontal lockup; 24px for icon-only.
- **Do not** recolor, stretch, or add effects.
- **On dark backgrounds**, use the reversed version (stone + amber swapped to white).
- **Font:** Outfit 600 for the wordmark. If Outfit is unavailable, system-ui sans-serif.

## Monochrome Variations

Append to any concept's SVG by overriding the fills:

- **Dark:** `.hl { fill: #C2410C; } .st { fill: #57534E; } .wm { fill: #1C1917; }`
- **Reversed (dark bg):** `.hl { fill: #FAF8F5; } .st { fill: #C2410C; } .wm { fill: #FAF8F5; }`
- **Single amber:** `.hl { fill: #C2410C; } .st { fill: #C2410C; } .wm { fill: #C2410C; }`
