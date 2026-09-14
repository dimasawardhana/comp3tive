# 02: Extract the shared design tokens

**What to build:** One token source consumed by both surfaces, so the Landing Page and the app cannot drift apart visually.

- Move the token block from the top of `src/index.css` — the `:root` custom properties, the `[data-theme="dark"]` overrides, and the `prefers-color-scheme: dark` block — into a new `src/tokens.css`. The file contains **only** custom-property declarations and the mode selectors; no component rules.
- Import it from both consumers, as the first statement in each file:
  - `src/index.css` → `@import "./tokens.css";`
  - the Landing Page's stylesheet → `@import "./tokens.css";` (Vite inlines `@import` via postcss-import, in both dev and build)
- **This is a pure move.** No token is renamed, added, removed, or revalued. If any pixel changes, the move is wrong.

**Blocked by:** —

**Status:** resolved

- [ ] `src/tokens.css` holds every custom property that was at the top of `src/index.css`, including both dark-mode mechanisms
- [ ] `src/index.css` and the Landing Page's stylesheet both consume it, and neither redeclares a token
- [ ] **Pixel-identical proof:** capture the split screen before the move (`node scripts/capture-hero.mjs /tmp/before`) and after (`node scripts/capture-hero.mjs /tmp/after`), then confirm the PNGs are byte-identical (`cmp`). The capture script is deterministic — same fixture, same viewports, same assertions — and fails if the team bib colours are missing.
- [ ] Both light and dark mode render unchanged (the e2e specs assert computed styles, fonts: `familjen`, weight `600`, sticky topbar, fixed nav)
- [ ] `npm run build`, `npx tsc --noEmit`, `npm test` and the Playwright suite stay green
- [ ] No CSS declaration is duplicated between `src/tokens.css` and `src/index.css`

**Design reference:** `DESIGN.md` (tokens are the contract) and `docs/design.md`.
