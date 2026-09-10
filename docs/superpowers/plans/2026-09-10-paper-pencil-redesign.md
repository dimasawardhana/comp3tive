# Paper & Pencil Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign Team Builder's theme from "Sideline" (paper/ink/cobalt/whistle-red) to "Paper & Pencil" — maximum paper warmth, single deep-amber accent, Outfit display font, minimal surfaces, no noise texture.

**Architecture:** Update the design tokens in three layers: `DESIGN.md` (source of truth), `index.html` (font imports), `src/index.css` (CSS variables). Then update any hardcoded color references throughout the CSS to match the new palette. Fonts swap from Chakra Petch → Outfit (display) while keeping Familjen Grotesk for body.

**Tech Stack:** TypeScript, React, Tailwind CSS, Vite, Vitest — no new dependencies required.

**Spec:** `DESIGN.md` (rewrite tokens section)

## Global Constraints

- No new npm dependencies
- Font files load from Google Fonts via `index.html`
- CSS variables must be consistent across light/dark modes
- All hardcoded color values in CSS must match new palette
- Keep Familjen Grotesk as body font
- Dark mode must also be updated (not just light)
- Test pass, type-check pass, build pass after each commit

---

### Task 1: Update DESIGN.md tokens

**Files:**
- Modify: `DESIGN.md`

**Interfaces:**
- This task produces the source-of-truth tokens that all subsequent tasks reference.

- [ ] **Step 1: Rewrite the Tokens section of DESIGN.md**

Replace the entire Color table in `DESIGN.md` with:

```
| Token | Hex | Role |
| --- | --- | --- |
| `paper` | `#FAF8F5` | App background — warm white, like blank paper |
| `surface` | `#FFFFFF` | Elevated surfaces (cards, modals) |
| `ink` | `#1C1917` | Near-black — text, structure |
| `slate` | `#57534E` | Secondary text, captions |
| `amber` | `#C2410C` | One accent: focus rings, links, the live mark |
| `ink-ink` | `#FAF8F5` | Inverse text on dark surfaces |
```

Replace the type section:
```
- **Outfit** — geometric, confident, warm. The display voice. Used at 24px+ for h1, section kickers, the gap meter, the champion name. Never for body.
- **Familjen Grotesk** — humanist, warm, readable. The body voice. Used for inputs, lists, descriptions, everything that isn't display.
```

Update type scale:
- **h1**: 36px / 1.0 / -0.01em / Outfit 600, uppercase
- **kicker**: 11px / 0.14em / Outfit 700, uppercase (▸ accent in amber)
- **lede**: 16px / 1.45 / slate
- **body**: 14px / 1.5 / ink
- **caption**: 12px / 1.4 / slate
- **display-xl**: 56px / 0.95 / Outfit 700 (champion card, the gap meter)

Replace the Surfaces section:
```
- **Cards**: 1px hairline border, 12px radius, no shadow except on modals
- **Paper feel**: no noise texture — just the warm paper background
- **Inset surfaces** (form areas): `--surface-2` with 8px radius, hairline border
```

Update the signature moment section: remove "pencil mark" references, replace "whistle red" with "amber", update bib color references to be minimal.

Update the Dark mode section:
```
Dark mode is "the scoreboard at night" — surfaces invert to ink `#1C1917` (raised `#23201C`), text becomes paper `#FAF8F5`, amber brightens to `#EA580C`. Bib colors are unchanged. The split panel stays a raised dark surface so the team cards pop.
```

- [ ] **Step 2: Commit**

```bash
git add DESIGN.md
git commit -m "feat: update DESIGN.md tokens for Paper & Pencil direction"
```

---

### Task 2: Update font imports in index.html

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Swap font link from Chakra Petch to Outfit**

Replace the `<link>` in `index.html`:
```
href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Familjen+Grotesk:wght@400;500;600&display=swap"
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "feat: swap Chakra Petch for Outfit in font imports"
```

---

### Task 3: Update CSS variables in src/index.css

**Files:**
- Modify: `src/index.css`

This is the largest task. All CSS variable values change. The structure stays the same; the values change.

**Light mode changes (`:root`):**
- `--surface: #f2efe7` → `#faf8f5`
- `--surface-2: #ffffff` → keep `#ffffff`
- `--hairline: #e3ddcf` → `#e7e3dc`
- `--text: #14161a` → `#1c1917`
- `--text-2: #5a6270` → `#57534e`
- `--accent: #2b6bff` → `#c2410c`
- `--accent-ink: #ffffff` → keep `#ffffff`
- `--whistle: #e63946` → `#c2410c` (amber replaces whistle — unified accent)
- `--whistle-ink: #ffffff` → keep `#ffffff`
- `--ok: #6faf8e` → keep `#6faf8e`
- `--danger: #e63946` → `#c2410c`
- `--shadow: 0 1px 2px rgba(20, 22, 26, 0.06), 0 8px 24px rgba(20, 22, 26, 0.1)` → `0 1px 2px rgba(28, 25, 23, 0.04), 0 4px 12px rgba(28, 25, 23, 0.08)` (lighter shadows)
- `--r-lg: 20px` → `16px`
- `--r-md: 14px` → `12px`
- `--r-sm: 10px` → `8px`

**Dark mode changes (`:root[data-theme="dark"]`):**
- `--surface: #14161a` → `#1c1917`
- `--surface-2: #1c1f26` → `#23201c`
- `--hairline: #2a2e37` → `#332f2a`
- `--text: #f2efe7` → keep `#faf8f5`
- `--text-2: #a9b1c0` → `#a8a29e`
- `--accent: #6a9aff` → `#ea580c`
- `--accent-ink: #10131a` → keep `#10131a`
- `--whistle: #f25c66` → `#ea580c`
- `--whistle-ink: #10131a` → keep `#10131a`
- `--shadow: 0 1px 2px rgba(0, 0, 0, 0.3), 0 8px 24px rgba(0, 0, 0, 0.45)` → `0 1px 2px rgba(0, 0, 0, 0.2), 0 4px 12px rgba(0, 0, 0, 0.35)`

**Remove noise texture:**
- Delete the `background-image: radial-gradient(...)` rules from `:root` and `:root[data-theme="dark"]`
- Remove the `/* warm noise on the page background */` comment block

**Update hardcoded colors in CSS:**
- `.toast--success`: `#E8F5E9` → `#FEF3C7`, `#1B5E20` → `#92400E`, `#A5D6A7` → `#FCD34D`
- `.toast--error`: `#FFEBEE` → `#FFF7ED`, `#B71C1C` → `#9A3412`, `#EF9A9A` → `#FCA5A5`
- `.toast--info`: keep as-is (cobalt → amber: `#E3F2FD` → `#FFF7ED`, `#0D47A1` → `#9A3412`, `#90CAF9` → `#FCD34D`)
- `[data-theme="dark"] .player-name`: `#f2efe7` → `#faf8f5`

**Update font-family references:**
- Search for all `"Chakra Petch"` references in CSS and replace with `"Outfit"`
- Search for `font-family: "Chakra Petch"` in `.toast` and update to `"Outfit"`

- [ ] **Step 1: Apply all CSS variable and font changes**

Edit `src/index.css` systematically — replace all tokens, remove noise texture, update hardcoded colors, swap font references.

- [ ] **Step 2: Verify no Chakra Petch references remain**

Run: `grep -rn "Chakra Petch" src/index.css`
Expected: zero results. If any remain, update them.

- [ ] **Step 3: Verify no `#f2efe7` references remain**

Run: `grep -rn "#f2efe7" src/index.css`
Expected: zero results (all replaced with `#faf8f5`).

- [ ] **Step 4: Commit**

```bash
git add src/index.css
git commit -m "feat: update CSS variables to Paper & Pencil palette"
```

---

### Task 4: Verify build and tests

**Files:** (verification only, no new files)

- [ ] **Step 1: Run type-check**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 2: Run tests**

Run: `npx vitest run`
Expected: all 102 tests pass.

- [ ] **Step 3: Build**

Run: `npx vite build`
Expected: successful build, no errors.

- [ ] **Step 4: Commit**

```bash
git commit --allow-empty -m "feat: Paper & Pencil redesign verified"
```

---

## File Map Summary

| File | Action |
|------|--------|
| `DESIGN.md` | Rewrite tokens section (palette, type, surfaces, dark mode) |
| `index.html` | Swap font link: Chakra Petch → Outfit |
| `src/index.css` | Update all CSS variables, remove noise texture, update hardcoded colors, swap font-family references |

---

## Self-Review Checklist

- [ ] **Spec coverage:** DESIGN.md tokens → Task 1, index.html fonts → Task 2, index.css variables → Task 3, verification → Task 4
- [ ] **Placeholder scan:** No TBD/TODO/FILL IN — all steps have exact values
- [ ] **Type consistency:** CSS variable names (`--surface`, `--accent`, `--whistle`, etc.) stay the same; only values change
- [ ] **Font consistency:** Outfit replaces Chakra Petch everywhere — both in index.html and index.css
- [ ] **Dark mode covered:** Both light and dark mode tokens updated
- [ ] **Noise texture removed:** No `background-image: radial-gradient` noise rules remain
