# 29: Each document loads only what it needs

**Status:** ready-for-agent

**What to build:** The Landing Page loads neither the app's JS chunk nor its stylesheet: it
arrives with the tokens, its own rules, and the split screen it genuinely demonstrates — and the
build emits no warning.

**Evidence.** Baseline to compare against, from `npx vite build` on HEAD `d87ac7b`:

| Asset | Bytes | Loaded by |
|---|---|---|
| `index-B-AfBoP4.js` | 213,023 | **both** documents |
| `app-LNkAbv9g.js` | 105,487 | `dist/app/index.html` |
| `landing-BHu6e1_i.js` | 11,614 | `dist/index.html` |
| `index-CgrHkb71.css` | **47,834** | **both** documents |
| `landing-CJvxMLgK.css` | 15,207 | `dist/index.html` |

Verified from the built output: `grep -o 'assets/[^"]*' dist/index.html` returns
`landing-BHu6e1_i.js`, `index-B-AfBoP4.js`, `index-CgrHkb71.css`, `landing-CJvxMLgK.css`.
`dist/index.html` links the app's 47,834-byte stylesheet because `src/landing.tsx:7` imports
`./index.css` — every visitor to the public page downloads 47.8 kB of CSS for screens they cannot
reach. It **already does not link `app-LNkAbv9g.js`**, so the JS half of the roadmap's exit
criterion already holds; this ticket says so rather than claiming a change it did not make.

The build also emits one warning, verbatim:

> `src/data/sample-data.ts is dynamically imported by src/App.tsx but also statically imported by src/domain/useDisciplines.ts, dynamic import will not move module into another chunk.`

`sample-data/futsal-roster.json` (11,122 B) and `sample-data/mpl-id-roster.json` (11,444 B)
therefore ride in `app-LNkAbv9g.js` — confirmed by finding the roster name "Kairi" there once and
in no other chunk. The laziness `App.tsx:507`'s `await import("./data/sample-data")` was written
for never happened.

**1. The stylesheet split.** New `src/split.css` holds the rules the split screen and the shared
primitives it renders need. Both `src/index.css` and `src/landing.css` import it after
`tokens.css`, and `src/landing.tsx` **stops importing `./index.css` entirely**, so the Landing
Page links only `tokens.css` + `split.css` + `landing.css`, which Vite merges into one
`landing-*.css`.

The membership rule is decidable, not a guess: **a rule moves to `split.css` iff every selector
in it is reachable from `SplitScreen`'s rendered subtree or from a primitive that subtree
renders.** Measured against the shipped sheet that is **110 rules / 14,095 bytes** — 23 % of
`src/index.css`'s 60,902 bytes — in two disjoint groups:

- the 46-rule shared kit, 6,187 bytes — `.screen`, `.kicker`, `.bar`, the `.btn` family, `.badge`
  and `.badge--*`, `.num`, `.empty`, `.load-error`, `.field-label`, `.input`, `.flags`, `.flag`,
  `.sep`, `.breadcrumb`, and the `.modal-overlay` / `.modal-card` / `.modal-close` /
  `.modal-title` / `.modal-section` family, plus their `@media (min-width: 768px)` overrides at
  `src/index.css:1652-1663`;
- the whole split region, `src/index.css:1950-2359` — 64 rules / 7,908 bytes, from `.pitch` and
  the `.team` family through `.scale`/`.needle`/`.readout` to `.split-screen`, `.swap-banner*`,
  `.player-*` and `.rating-*`. The design spec lists every selector in this region; nothing
  outside lines 1950–2359 and the kit above moves.

The two sets share **zero** selectors, verified by set difference over the 431 parsed rules, and
`src/index.css` keeps the other 321 rules / 46,807 bytes — precisely what the Landing Page stops
downloading.

**2. Delete the dead animation** while in `landing.css`: `src/landing.css:535` declares
`animation: pulse-needle 2.4s … infinite`, and `@keyframes pulse-needle` is defined **nowhere in
the repository** (`grep -c "@keyframes" src/landing.css` → `0`; `index.css`'s only keyframes are
`@keyframes pulse` at `:327`). The declaration has never had an effect. Remove it and the
now-dead `animation: none` override at `:551`. No spec asserts it
(`grep -n "needle" e2e/tests/landing/landing.spec.ts` → no matches).

**3. The `sample-data` split.** The module separates at its real seam — "which sample data
exists" versus "fetch it". The registry holds no JSON, so importing it statically pulls nothing;
the loader owns both JSON imports and is reached only through `await import(...)`.

```ts
// src/data/sample-registry.ts — no JSON imports, safe to import statically
export const SAMPLE_DISCIPLINE_IDS: readonly string[] = ["mlbb", "futsal"];
export function hasSampleData(disciplineId: string): boolean;
export function addSampleData(disciplineId: string, jsonText: string): void;
export function listDisciplinesWithSampleData(): string[];
export function detectDisciplineFromSampleData(text: string): string | null;
export function autoGenerateSampleData(discipline: Discipline): string;
/** The registered text for a custom discipline, or null for a built-in one. */
export function generatedSampleData(disciplineId: string): string | null;

// src/data/sample-data.ts — owns both JSON imports; reached only dynamically
export async function loadSampleData(disciplineId: string): Promise<string | null>;
export async function getSampleDataInfo(disciplineId: string): Promise<{ fileName: string; playerCount: number } | null>;
export async function getSampleDataUrl(disciplineId: string): Promise<string | null>;
export async function downloadSampleData(disciplineId: string): Promise<void>;
```

`loadSampleData` resolves a built-in id with `await import("../../sample-data/mpl-id-roster.json")`
from a per-discipline map and falls back to `generatedSampleData(id)`. `getSampleDataInfo` and
`getSampleDataUrl` parse or blob the loaded text, so they become async too.
`src/domain/useDisciplines.ts:3` changes one import path to `./sample-registry`.

**Test edits, enumerated** (`src/data/sample-data.test.ts`): the `hasSampleData`,
`listDisciplinesWithSampleData` and `autoGenerateSampleData` blocks change only their import path
(registry functions stay synchronous); the `getSampleDataInfo` assertions (`:24-34`) and the two
URL assertions (`:36-42`) become `await`ed; `downloadSampleData` (`:45-49`) becomes awaited and its
`vi.stubGlobal("document", …)` stub needs no change; `src/App.tsx`'s wrapper (`:504-514`) gains one
`await`. If the diff grows past those five edits, fall back to the one-line static import and
record that the 22.6 kB of rosters ships with the app.

**Acceptance criteria:**
- [ ] `npm run build` completes with **zero warnings** (baseline: 1)
- [ ] `grep -rn 'import "./index.css"' src/landing.tsx` returns nothing
- [ ] `grep -o 'assets/[^"]*\.css' dist/index.html` names only `landing-*.css` — no `index-*.css`
- [ ] `grep -o 'assets/[^"]*\.js' dist/index.html` still names no `app-*.js`
- [ ] `grep -c "Kairi" dist/assets/app-*.js` → 0, and the roster string appears in a new asset fetched only on demand
- [ ] The Landing Page's CSS transfer falls by the 47,834 bytes it used to fetch (record the before/after table in the Answer, in the baseline's format)
- [ ] `grep -c "pulse-needle" src/landing.css` → 0, and `grep -c "@keyframes" src/landing.css` → 0
- [ ] `git diff --numstat src/index.css | head -1` shows only moved lines: no declaration is edited while moving
- [ ] `npx vitest run` is green including the four updated sample-data assertions
- [ ] The browser suite passes with no spec edited — `e2e/tests/landing/landing.spec.ts` (16 tests) covers the hero, the tokens in both themes and the redirect, and `npm run capture:hero` verifies its own DOM/PNG output green
- [ ] Every class name is unchanged — a before/after `getComputedStyle` diff of the hero subtree at 1280×720 and 390×844 matches

**Blocked by:** 28 — C28 changes the crumb markup inside the hero and C27 changes the modal
skeleton, both of which are in the CSS being moved.
