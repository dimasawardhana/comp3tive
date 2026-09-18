# 32: Share the result — render the teams as an image

**Status:** ready-for-agent

**What to build:** The share sheet gains a second action that turns the same teams into a
PNG poster drawn in the app's own brand — paper ground, ink type, one amber figure, a bib
colour per team — and puts it on the clipboard as an image, falling back to a file download
when the browser cannot write an image to the clipboard, so the organizer can paste a
legible team sheet into a group chat.

**Evidence.** `package.json` `dependencies` is `{"react": "^19.1.0", "react-dom": "^19.1.0"}`
— there is no DOM-to-image or canvas library, and ADR-0001 (`docs/adr/0001-client-only-first.md`,
`Status: accepted`) is the reason the runtime stays this small. `grep -rn "toDataURL\|canvas"
src/` returns 0 matches, so nothing in the repo has ever drawn a bitmap. The brand tokens the
poster must use are declared in `src/tokens.css` and `DESIGN.md`: paper `#FAF8F5`, surface
`#FFFFFF`, ink `#1C1917`, slate `#57534E`, amber `#C2410C`, hairline `#E7E3DC`, and the five
bib colours `--bib-a #FFC400`, `--bib-b #FF4F9A`, `--bib-c #4E8FDB`, `--bib-d #6FAF8E`,
`--bib-e #C9A227`. Display face is Outfit, body face is Familjen Grotesk — both self-hosted by
ticket 33. `src/landingDeal.tsx` already re-measures on `document.fonts.ready`, which is the
precedent for awaiting fonts: a `fillText` before the face is loaded silently draws a fallback.

**Task 32 — the dependency decision, stated.** Hand-draw to `<canvas>` with **zero new runtime
dependencies**. The tradeoff is real and this is the honest reading of it: a DOM-to-image
dependency would reuse the existing CSS cards for free, but it would add a third runtime
dependency to a two-dependency app, ship a large bundle, and produce output this repo's node
test environment (`vite.config.ts` sets `test.environment: "node"`) cannot test at all. The
canvas path costs roughly one file of hand-placed geometry, which is unit-testable in node
because the layout is a pure function. Reversing this decision requires an ADR.

**Acceptance criteria:**
- [ ] `src/share/share-image.ts` exports `layoutShareImage(input: { disciplineName: string; result: SplitResult; roster: Player[] }): { width: number; height: number; ops: DrawOp[] }`, a pure function with no canvas import; `DrawOp` is a discriminated union of `{ kind: "rect"; x; y; w; h; fill: string }`, `{ kind: "text"; x; y; text: string; font: string; fill: string; align: "left" | "center" }` and `{ kind: "roundRect"; x; y; w; h; r; fill: string }`.
- [ ] The canvas is 1080 px wide. Height is `240 + (sum of per-team block heights) + 160`, rounded up to the next 8 px, where a block is `96 + players.length * 56 + 32`. Two teams render as two columns; three or more render as stacked full-width blocks. A unit test asserts the height for 2, 3 and 4 teams.
- [ ] Layout uses the brand tokens by literal hex, not by CSS variable: background `#FAF8F5`, team name and the gap figure `#1C1917`, player names `#57534E`, the hairline rules `#E7E3DC`, the gap figure's number `#C2410C`, and each team's prefix bar its `--bib-*` value in roster order `a`,`b`,`c`,`d`,`e`.
- [ ] Type sizes are fixed and no glyph is smaller than 34 px at 1080 px wide: team name Outfit 600 at 48 px, player name Familjen Grotesk 500 at 34 px, per-team average Familjen Grotesk 500 at 34 px, gap figure Outfit 700 at 64 px. Contrast clears 4.5:1 — slate on paper is ≈7:1 and ink on paper ≈16:1.
- [ ] The poster is always light: it is rendered from the literal token values above and never reads `prefers-color-scheme` or `data-theme`, so the same split produces the same image in dark mode. A unit test asserts that `layoutShareImage` output for the same input is byte-identical when `document` is absent.
- [ ] `src/share/share-image.ts` exports `async renderShareImage(input): Promise<Blob>` that creates an `OffscreenCanvas` (falling back to a detached `<canvas>`), awaits `document.fonts.ready` **before** the first `fillText`, replays `layoutShareImage`'s ops, and resolves `canvas.convertToBlob({ type: "image/png" })` (or `toBlob` wrapped in a Promise).
- [ ] `src/share/ShareSheet.tsx` (from ticket 31) renders `Copy image` when `typeof ClipboardItem !== "undefined" && ClipboardItem.supports?.("image/png")`, and otherwise renders `Download image`; both use `data-testid="share-image"`.
- [ ] `Copy image` writes `new ClipboardItem({ "image/png": blob })`; on rejection it falls through to the download path and reports it in `.share-status` as `Couldn't copy the image. Saved it instead.` — the text of the under-`text` action is never lost by this failure.
- [ ] `Download image` saves `comp3tive-teams-<YYYY-MM-DD>.png` through a Blob URL and a `<a download>` click, matching the existing precedent at `src/data/sample-data.ts:52-60`.
- [ ] An e2e spec asserts the clipboard route: grant `clipboard-read`, click `Copy image`, `page.evaluate(() => navigator.clipboard.read())`, and assert the first item's type is `image/png` and its blob size exceeds 10 000 bytes.
- [ ] An e2e spec asserts the fallback: a second page with `page.addInitScript(() => { delete window.ClipboardItem; })`, click `share-image`, and assert `page.waitForEvent("download")` fires and its `suggestedFilename()` matches `^comp3tive-teams-\d{4}-\d{2}-\d{2}\.png$`.
- [ ] `npx vitest run` exits 0 with `src/share/share-image.test.ts` in the output; `npx tsc -b` exits 0.

**Blocked by:** 31
