# Product Completion — 2026-09-17

**Status:** ready-for-agent (wave 1 design artifact set; tickets 31–37, `.scratch/debt/issues/`)

Phase D is the last of four phases in the debt-repayment effort
(`docs/superpowers/specs/2026-09-17-debt-repayment-roadmap-design.md`). Its goal, quoted from the
roadmap: *"the organizer's evening closes. They can tell ten people the teams, and the app opens
on the court."* Phases A, B and C land before this one so the browser suite is green and the shell
is decomposed; this phase adds the four things a finished product has and this one does not.

## Problem Statement

Every claim below was measured by running the thing. The source of truth is the audit findings
document; nothing here is inferred.

**1. The result cannot leave the screen.** The organizing work ends with ten people needing to
know which team they are on, and the app offers them nothing. Measured:

```
$ grep -rn "navigator.clipboard\|window.print\|navigator.share\|toDataURL\|canvas" src/
(0 matches)
```

There is no share control, no clipboard call, no image export. `package.json` `dependencies` is
`{"react": "^19.1.0", "react-dom": "^19.1.0"}` and nothing else. The split screen's action bar
(`src/session/SplitScreen.tsx:372`, `<div className="bar split-bar">`) holds Back, Save squad,
submit-tournament and Re-roll — four controls, none of which gets the teams out of the app. The
organizer retypes the whole split into a group chat.

**2. "Works with no signal" is false.** The landing page promises offline operation
(`index.html:182`: *"Works with no signal. The court has no wifi."*) and the app cannot do it:

```
$ grep -rn "serviceWorker\|manifest.json\|workbox" src/ index.html app/index.html
(0 matches)
$ grep -rn "@font-face" src/ index.html
(0 matches)
$ ls public/
404.html  _headers  comp3tive.svg
```

No service worker, no manifest, no icons, no `rel="manifest"`, no `theme-color` — the app cannot
be installed to a home screen and does not open without a network. Three documents fetch type
from a third party (`index.html:25-29`, `app/index.html:7-11`, `public/404.html:7-10`), and with
no signal the typography silently degrades to a browser default, so `DESIGN.md`'s typographic
contract stops holding. This is the product's headline claim, and the code does not keep it.

**3. The data has no durability story.** ADR-0001 (`docs/adr/0001-client-only-first.md`, `Status:
accepted`) chose client-only storage with JSON export/import as the migration path off the
browser. The export works — `serializeBackup(...)` with `BackupData.version = 4`
(`src/data/transfer.ts:9`) — but nothing makes the user use it:

```
$ grep -rn "navigator.storage" src/
(0 matches)
```

No `persist()`, no `estimate()`, no reminder, no record of when the last export happened. Browser
eviction is indistinguishable from a fresh install: the app creates the `Default` community
(`src/domain/useCommunities.ts:7-9`) and lands on the `.dashboard-empty` state
(`src/DashboardScreen.tsx:100-108`) with no indication anything was lost.

**4. A 3-team or 5-team night cannot run a tournament.** Those sizes split fine and then dead-end:

```ts
// src/tournament/tournament-validation.ts:58-63
function getValidTeamCounts(format: TournamentFormat): number[] {
  return format === "series" ? [2]
       : format === "single-elim" ? [2, 4, 8]
       : format === "swiss" ? [4, 6, 8]
       : [];
}
```

`TournamentFormat = "series" | "single-elim" | "swiss"` (`src/domain/types.ts:25`). The split
flow replicates the rule at `src/App.tsx:328-331` (`bracketOk`), and the create modal's chip row
is hard-coded `[2, 4, 6, 8]` (`src/tournament/GamesScreen.tsx:334`) — so 3 and 5 are not even
selectable, and a 3- or 5-team squad prefills as Swiss (`:62-65`) and then fails validation.

**5. Roster entry is one player at a time, or a guess.** The CSV branch
(`src/App.tsx:574-608`) splits on commas without honouring quotes, so `"Smith, John", futsal, 4`
imports a player named `Smith`; it applies one flat strength to every attribute of the
discipline; an unrecognised discipline produces a player with no capabilities at all; and
`await file.text()` has no size check. There is no template and no in-app statement of the
column order (`grep -rni "csv template" src/` → only `grid-template-columns` CSS hits). There is
no way to rate a set of players at once.

**6. The split shows a number and explains nothing.** On a 4-team night the only language on
screen is a fallback string, `["All roles covered. Fair game."]`
(`src/session/SplitScreen.tsx:224-225`); on an unbalanced one the screen shows `Gap 0.4. Team A
leads.` and no explanation of what the gap is. The organizer is asked "why are these fair?" and
has nothing to say.

**The measured unfairness, for context.** The solver is not changed by this phase (D1), but it is
why the split copy has to be careful: on the pools this app is built for, the search exhausts its
`NODE_BUDGET = 4_000_000` and returns `optimal: false` — futsal 20 players / 4 teams → 4,000,001
nodes, 1,974 ms, gap 0.020; MLBB 25 / 5 → 0.320; MLBB 40 / 8 → 0.460. Phase B surfaces that
verdict; this phase must not contradict it.

## Scope

### In scope

- **D31** — copy the finished teams to the clipboard as text, with the same provenance verdict the
  screen shows.
- **D32** — render the same teams as a branded PNG, clipboard-first with a download fallback.
- **D33** — a real PWA: manifest, icons, a service worker covering both documents, four
  self-hosted woff2 font files, an extended `public/_headers`, and a cache version keyed to the
  build. Restores the offline landing claim that B14 removed.
- **D34** — request persistent storage, surface the outcome next to the export control, and add a
  dismissible, persisted export nudge on the Dashboard.
- **D35** — `"round-robin"` as a fourth tournament format for 3–8 teams, using the circle method,
  reusing the existing standings table.
- **D36** — a downloadable CSV template, the column order stated in the UI, a partial-import
  report, and bulk rating from the roster.
- **D37** — one plain sentence explaining why the split is fair, built from the strength data
  already on screen.

### Out of scope, explicitly

| Not in this phase | Why |
|---|---|
| The solver, its search, its node budget, `NODE_BUDGET`, `fairSplit`, `varietySplit` | D1 fixes the claim, not the engine. Solver reach is a deferred stretch bet after D lands (Phase B's stretch note). |
| Any backend, multi-user support, sync, accounts or a server | ADR-0001 and the product's "no account, no server" claim. Note only: `public/404.html` is the only static page. |
| ESLint, Prettier, or any formatter | Not proposed anywhere in this effort; `noUnusedLocals` (C22) is the compiler-level guard. |
| `playwright-report/` and `test-results/` untracking | A09's job. |
| CSV parsing internals — quoting, size limit, unknown-discipline handling | A08 owns `src/data/player-import.ts`. D36 renders its output and never edits it. |
| The gap-provenance verdict and its screen copy | B13 owns `src/session/gapProvenance.ts`, `gapKind` and `gapQualifier`. |
| The landing page's other claims, its lede, its badminton card | B14 and B19 own those. D33 restores exactly one claim and changes no other copy. |
| Navigation, community scoping, the shell decomposition, `src/App.tsx`'s size | Phase C. |
| Badminton discipline content | B19 ships it. D35 is format-only. |
| `src/App.tsx`'s roster entry UI | After C26/C27 that UI lives in `src/shell/RosterScreen.tsx`. This spec records the correction below. |

## Design

### Where the work goes

**Line references.** Every `file:line` in this spec and in the seven tickets is anchored to the
audit baseline, `HEAD d87ac7b`. Phases A, B and C land first (`contracts.md`: A before C, C before
D) and will shift line numbers in three files this phase touches — `src/session/SplitScreen.tsx`,
`src/tournament/bracket.ts` and `src/tournament/GamesScreen.tsx`. Each anchor therefore names its
**symbol or quoted string** beside the line, and the symbol is authoritative: `.split-bar`,
`.readout`, `GapMeter`, `roundsFor`, `requiredMatches`, `champion()`, `getValidTeamCounts`,
`TEAM_COUNTS`. Resolve the symbol, not the number.

**File ownership.** `contracts.md` grants Phase D exclusive write to `src/share/**` (new),
`public/manifest.webmanifest`, `public/sw.js` (new), `src/main.tsx` (SW registration),
`src/tournament/tournament-validation.ts`, `src/tournament/bracket.ts` (round robin only),
`src/data/round-robin*` (new), `public/fonts/**`, and the roster entry UI.

**One correction to that table, already reflected in `contracts.md` by wave 1/2 reconciliation.**
The row originally said `src/App.tsx (roster entry UI)`. Phase C's C26/C27 moved the roster hub's
markup to `src/shell/RosterScreen.tsx` and its import state to `src/shell/usePlayerImport.ts`,
leaving `src/App.tsx` under 400 lines with only the I/O handlers. **D36 targets
`src/shell/RosterScreen.tsx` and `src/shell/usePlayerImport.ts`.** Phase D touches no
C-owned file.

**Interfaces Phase D consumes, by exact exported name** (frozen in `contracts.md` and the A/B/C
specs; D changes none of them):

| Interface | From | D uses it for |
|---|---|---|
| `gapKind(result): GapKind`, `GapKind = "proven" \| "best-found"`, `gapQualifier(result): string \| null` (`src/session/gapProvenance.ts`) | B13 | D31 branches on `gapKind`; D37 must not restate what `gapQualifier` says |
| `parsePlayerCsv`, `csvRowsToPlayers`, `ImportSkip`, `MAX_IMPORT_BYTES`, `assertImportSize` (`src/data/player-import.ts`) | A08 | D36 renders `ImportSkip[]`; D36's template matches the parser's column order |
| `usePlayerImport(deps) → { pendingMerge, confirmMerge, cancelMerge, lastReport, importFile }` (`src/shell/usePlayerImport.ts`) | C27 | D36 renders `lastReport` |
| `hubButton(page, name)` (`e2e/support/seed.ts`) | A01/A11 | every new spec reaches a hub through it, never a `.bottom-nav` locator |
| `useToasts(): { toasts; notify(text, type?) }` (`src/shell/useToasts.ts`) | C26 | D36's bulk-rating message and D31's copy confirmation speak through it rather than a native dialog |
| `FORMAT_LABEL: Record<TournamentFormat, string>` (`src/ui/constants.ts`) | C23 | D35 adds the `"round-robin"` key |
| `useCommunityScope({ …, disciplines? })` | C25 | D36/D34 read scoped lists rather than adding a fifth filter |

**Four files D touches that another phase also touches, and the rule for each.** These follow
`contracts.md`'s overlap clause: scope the edit to this phase's concern and do not restructure.

| File | Other phase | D's edit, and only this |
|---|---|---|
| `src/session/SplitScreen.tsx` | A03 (`reroll`), B13 (gap copy) | Purely additive: one `share?` prop plus the `Share` button in `.split-bar`, and one `<p className="fairness">` after each `.readout`. Every existing line stays byte-identical. A and B both land before D (`contracts.md`: A before C, C before D), so this is an append to a quiescent file, not a race |
| `src/tokens.css` | C29 (the stylesheet split) | One added `@import "./fonts.css";` line. No token is added, removed or changed |
| `src/main.tsx` | A05 (the error boundary) | Registration is added on `window`'s `load` event and outside `<ErrorBoundary>`. The `createRoot(...).render(...)` call and A05's wrapper are not touched |
| `src/tournament/bracket.ts` | A07 (Swiss pairing) | Round-robin arms only — a new arm in `buildBracket`, a new arm in `roundsFor`, and the `champion()` condition extended to also accept `"round-robin"` (alongside the existing `"swiss"` arm, which is otherwise untouched). The `series`, `single-elim` and `swiss` arms are not modified; criterion 13 checks this by diff |

### D31 — Share the result as text

**New: `src/share/share-text.ts`.** One pure function, no DOM, no React, no solver import:

```ts
export function teamsAsText(input: {
  communityName: string;
  disciplineName: string;
  result: SplitResult;
  roster: Player[];
}): string;
```

Output shape, exactly: a headline `{Discipline} · {Community} — {N} teams`; a blank line; then one
block per team — `Team A · avg 3.8` followed by `• {name} ({strength})` per player, strongest
first, capability-less players last with no parenthesis; a blank line between blocks; a closing
gap line; and, only when `result.unassigned` is non-empty, a final `Not playing: {names}` line.

The closing line states the verdict in **both** cases, because a chat message has no surrounding
sentence:

- `gapKind(result) === "proven"` → `Gap 0.4 — the proven minimum for this pool.`
- `gapKind(result) === "best-found"` → `Gap 0.4 — the smallest gap known for this pool. A smaller one may exist.`

**Branch on `gapKind`, never on `gapQualifier() !== null`.** The qualifier is append-only and
returns `null` in the proven case — correct on screen, wrong in a message that must stand alone.
And do not hard-code "a re-roll is never proven": `varietySplit` stamps `optimal: false`
(`src/solver/solver.ts:419`) but falls back to `fairSplit` (`:409`), which can genuinely return
`optimal: true`. Read the field.

**New: `src/share/ShareSheet.tsx`.** A modal in the existing `.modal-overlay` / `.modal-card`
vocabulary — rendered through C23's shared `<Modal onClose={…}>` from `src/ui/Modal.tsx`, the
same skeleton the other five modals use, not a hand-rolled overlay — with a read-only
`<textarea className="share-preview">`, a `Copy text` button
(`data-testid="share-copy-text"`), a `.share-status` line, and the image control from D32. Copy
uses `navigator.clipboard.writeText` when it exists; otherwise, or on rejection, the sheet keeps
the text, says `Copy failed. Select the text above and copy it.`, and leaves the textarea focused
and selected. No `alert`.

**Entry point.** `src/session/SplitScreen.tsx`'s `.split-bar` (`:372`) gains a `Share` button
(`data-testid="share-teams"`) rendered only when a new optional prop `share?: { communityName:
string }` is passed. `src/App.tsx` passes it. `src/landing.tsx`'s hero mount at `:153` must not —
`e2e/tests/landing/landing.spec.ts:31-38` asserts the hero has no competing controls, and that
spec stays green unchanged.

### D32 — Share the result as an image

**Decision, stated with its tradeoff.** Hand-draw to `<canvas>`, **zero new runtime
dependencies**. A DOM-to-image library would reuse the existing CSS cards for free, but it would
make this a three-dependency app against ADR-0001's posture, ship a large bundle, and produce
output `vite.config.ts`'s `test.environment: "node"` cannot test at all. The canvas path costs one
file of hand-placed geometry whose layout is a pure function and therefore testable in node.
Reversing this decision requires an ADR.

**New: `src/share/share-image.ts`.** Two exports:

```ts
export function layoutShareImage(input: {
  disciplineName: string;
  result: SplitResult;
  roster: Player[];
}): { width: number; height: number; ops: DrawOp[] };

export async function renderShareImage(input: { /* same */ }): Promise<Blob>;
```

`DrawOp` is a discriminated union — `rect`, `text`, `roundRect` — so layout is pure and
`renderShareImage` is a thin replay. 1080 px wide; two teams as columns, three or more as stacked
full-width blocks; height derived from the block heights. Brand tokens by literal hex:
paper `#FAF8F5`, ink `#1C1917`, slate `#57534E`, amber `#C2410C`, hairline `#E7E3DC`, and each
team's `--bib-a … --bib-e` prefix bar. Outfit for the display figures, Familjen Grotesk for body
copy; never smaller than 34 px at 1080 px wide.

Two hard requirements that come from how the web actually behaves, not from taste:

- **The poster is always light.** It reads the literal token values above and never
  `prefers-color-scheme` or `data-theme`, so the same split yields the same image in dark mode.
- **`document.fonts.ready` is awaited before the first `fillText`.** Both faces are variable
  woff2; a draw before load silently renders a fallback face. `src/landingDeal.tsx` already
  re-measures on `document.fonts.ready` — same reason, precedent in-repo.

Clipboard-first when `ClipboardItem.supports?.("image/png")`; otherwise, and on rejection, fall
through to a `comp3tive-teams-<YYYY-MM-DD>.png` download that follows `src/data/sample-data.ts:52-60`'s
Blob-URL precedent. A copy failure never costs the user the text D31 already produced.

### D33 — A real PWA

**Shape.** A two-document MPA (`vite.config.ts` `appType: "mpa"`; `wrangler.jsonc`
`not_found_handling: "404-page"`, with a comment forbidding SPA fallback). The manifest and the
worker cover **both** `/` and `/app/`.

**Self-hosted fonts.** Four variable woff2 files replace three CDN blocks. Verified:

| File | Bytes | sha256 (prefix) | `unicode-range` |
|---|---|---|---|
| `public/fonts/outfit-latin.woff2` | 32,292 | `6c18d579…` | latin |
| `public/fonts/outfit-latin-ext.woff2` | 14,808 | `0f53d1c0…` | latin-ext |
| `public/fonts/familjen-grotesk-latin.woff2` | 18,916 | `414d5dfe…` | latin |
| `public/fonts/familjen-grotesk-latin-ext.woff2` | 15,468 | `c53f18ec…` | latin-ext |

**CORRECTION (2026-09-29, after Task 9 landed; amended 2026-09-30, because this correction was
itself wrong): the four file names in the table above do not exist, the byte counts are right,
and there are FIVE committed files, not four.** The committed files are
`outfit-latin-6c18d579.woff2`, `outfit-latin-ext-0f53d1c0.woff2`,
`familjen-grotesk-latin-414d5dfe.woff2`, `familjen-grotesk-latin-ext-c53f18ec.woff2` **and**
`familjen-grotesk-vietnamese-7c82a402.woff2` — the same bytes under the first 8 hex of their own
sha256, which is the `sha256 (prefix)` column this table already prints, and all five landed in
the one commit this correction is written about, `ce601c2`. So "four" is five, "≈81 kB" is
≈88 kB (87,776 B counted), "four `@font-face` rules, two per family" is five rules, and the
two licences are `public/fonts/outfit-OFL.txt` and `public/fonts/familjen-grotesk-OFL.txt`
rather than the single `public/fonts/OFL.txt` the paragraph below names. The list in this
correction used to end at four and mention the fifth in a subordinate clause, which made the
sentence it corrected true and this sentence false, in the same block.

**The fifth is a fifth, and dropping it is not tidying.** The live `css2` this app was loading
served three subsets for Familjen Grotesk and two for Outfit — `latin` and `latin-ext` for
both, plus `vietnamese` for **Familjen Grotesk only**, which is the only family that has it.
That response is still fetchable, and its `vietnamese` block carries a `unicode-range` byte-
identical to the one at `src/fonts.css:78`: thirteen comma-separated ranges over 111
codepoints. Remove that face and 87 of those codepoints — `U+0300`, `U+0301`, `U+0303`,
`U+0309`, `U+0323`, and `U+1EA0`–`U+1EF1`, the Vietnamese additions in Latin Extended Additional —
are covered by no other Familjen Grotesk face, so they move to whatever `--font-body`'s fallback
stack finds. `src/fonts.test.ts:79` asserts `toHaveLength(5)` for exactly that reason. One
number in this paragraph's own evidence did not check out, and it was in `src/` rather than here:
the comment at `src/fonts.css:69` called it "fifteen codepoint ranges" when the declaration it
describes carries thirteen, and — the larger error — counted *ranges* where only *codepoints*
mean anything, since four of those thirteen overlap `latin-ext`. **Repaired, in `9f729d3`**, with
the same 87-of-111 figure this paragraph uses, and with the overlap named so the two counts cannot
be confused again. It went unrepaired through one review round because the comment sat in `src/`
and every audit of this round was scoped to `docs/`. **That is the lesson worth keeping: a claim
can be recorded as a known defect in the right words and still be the only false thing left in the
tree, because fixing the record and fixing the thing are different acts.**

**Why this one survived an audit that found nothing, and why the next one might too.** The
sentence corrected above cited no `file:line` — this amendment does, but it did not when the
audit ran, and that is the whole mechanism. A line-resolution audit establishes that an
*address* resolves; it says nothing about whether the words printed beside the address are
true. A list has no address for such an audit to resolve — "the committed files are ⟨four
names⟩" is a claim about membership, and the only way to check it is to enumerate the directory
and compare. That was not done here, and the sentence sat in a block whose every other number
was correct, which is why it read as verified. **A claim carrying no anchor is not covered by an
audit that checks anchors.** That is the same reason the next uncorrected one will survive it
too.

**The unhashed name is not a name the tree can carry, which is why no table here can quote it.**
Content-hashing the subsets is the property that makes `/fonts/*.woff2 → 1yr immutable` correct
and is asserted mechanically by `src/fonts.test.ts`; a fixed `outfit-latin.woff2` would have to
mean a second, unhashed copy shipping beside the hashed one, or a rename the stylesheet and both
documents' `preload` hints do not follow. Every assertion in this phase therefore reads the
precache list or a glob (`public/fonts/outfit-latin-*.woff2`), never a typed name — including
`e2e/tests/pwa/offline.spec.ts`, whose own comment says a hard-coded one "is a test that fails on
an unrelated font edit and, worse, one that could name a file this build never cached."

≈81 kB total, plus `public/fonts/OFL.txt`. Both families are SIL OFL 1.1 (`google/fonts`
METADATA.pb: Outfit `license: "OFL"`, copyright *The Outfit Project Authors*; Familjen Grotesk
`license: "OFL"`, copyright *The Familjen Grotesk Project Authors*), so self-hosting is legally
clean and the licence text ships alongside. Each file is **one** variable font covering its whole
weight axis, so `@font-face` declares `font-weight: 100 900` — one rule per family per subset, two
per family, four total. Family names stay byte-identical (`"Outfit"`, `"Familjen Grotesk"`):
`e2e/tests/community/community.spec.ts:21-26` asserts the computed family and weight, and
`src/index.css:13`, `:24` and `src/landing.css:21` name both faces. No declaration changes.

**The three CDN blocks** (`index.html:25-29`, `app/index.html:7-11`, `public/404.html:7-10`) lose
`preconnect` and the `css2` link and gain two `<link rel="preload" as="font" type="font/woff2"
crossorigin>` hints each — one `preconnect` replaced one-for-one by one `preload`, so first paint
does not regress. `@font-face` lives in one new `src/fonts.css`, reached by a single
`@import "./fonts.css";` added to `src/tokens.css` — which both surfaces already import
(`src/index.css:2`, `src/landing.css:7`). One line, both documents, and neither Phase B's
`src/landing.css` nor Phase C's `src/index.css` is written to.

**Manifest.** `public/manifest.webmanifest`: `name`/`short_name` `comp3tive`, `start_url
"/app/"`, `scope "/"`, `display "standalone"`, `background_color "#FAF8F5"`, `theme_color
"#C2410C"`, icons 192 and 512 plus a `maskable` 512 — drawn from `brand/3-icon.svg`, the squared
icon variant the brand README reserves for exactly this. Both documents link it, and
`app/index.html` gains `theme-color` and `rel="icon"`.

**Service worker.** `public/sw.js`, a classic worker — no imports, no bundler step, no workbox.
`install` precaches `/`, `/app/`, `/manifest.webmanifest`, `/404.html`, the four font files and
every `/assets/*` URL the build emitted (generated at build time, not hand-listed), then
`skipWaiting()`; `activate` deletes every cache whose name is not the current one and
`clients.claim()`s. Navigations are network-first with the precached document as fallback;
`/assets/*` and `/fonts/*` are cache-first.

**Versioning, and the stale-deploy escape hatch.** The cache name is `comp3tive-<version>` where
`<version>` is written into `sw.js` by the build from one place. This matters more than it looks:
Cloudflare's static-assets default is `public, max-age=0, must-revalidate` plus a content-hash
ETag, so a hashed `sw.js` would not be safely cached without an explicit rule — which is exactly
why `public/_headers` gains `/sw.js` → `Cache-Control: no-cache`. The `_headers` file is parsed by
Workers from the static asset directory; multiple matching rules inherit, and the three existing
rules stay byte-identical:

```
/assets/*
  Cache-Control: public, max-age=31536000, immutable

/*.html
  Cache-Control: no-cache

/
  Cache-Control: no-cache

/fonts/*
  Cache-Control: public, max-age=31536000, immutable

/icons/*
  Cache-Control: public, max-age=31536000, immutable

/manifest.webmanifest
  Cache-Control: no-cache

/sw.js
  Cache-Control: no-cache
```

**CORRECTION (2026-09-29, after Task 11 landed): `/icons/*` ships `no-cache`, and the font rule is
`/fonts/*.woff2` with a `Content-Type` beside it.** The block above is this spec's, and it is wrong
for the icons on one property: **the icons are not content-hashed.** The fonts are, which is the
entire justification for the `immutable` year two rules up; `icon-192.png` keeps its name across a
redesign (`src/manifest.test.ts` pins it there), so an immutable year would hide a redrawn icon
from every returning visitor for a year. **The two assets differ in exactly the property that
decides the header, which is why no single rule covers both**, and the worker caches the icons
afterwards regardless, so the cost of `no-cache` is three small revalidations per visit.

The font rule also narrowed to `*.woff2` and gained `Content-Type: font/woff2`. Pages sends
`X-Content-Type-Options: nosniff`, and a font refused for its type fails silently behind the
page's fall-back stack, so the type is stated rather than trusted; the pattern matches `.woff2`
and nothing else, so the two OFL licence texts beside them keep Cloudflare's own `text/plain` —
a second `Content-Type` rule over the same path would be comma-joined onto this one, not
override it. The record is `public/_headers` itself, whose `:1-5` and `:29-33` say this in the
file.

**Registration.** `src/main.tsx` registers the worker **additively and after** A05's error
boundary, on `window`'s `load` event, with the promise's rejection handled so a failed
registration is silent. The render call and the `<ErrorBoundary>` wrapper are unchanged.

**Restoring the offline claim — sequenced with B14, frozen in `contracts.md`.** B14 deletes the
offline sentence and leaves a handoff note; D02 restores it because it is then true:
`index.html`'s trust list row 3 becomes `Works with no signal. The court has no wifi.`, the
`<meta name="description">` regains `Works offline, `, and
`e2e/tests/landing/landing.spec.ts`'s trust assertions become `toHaveCount(3)` plus
`toContainText(["proven minimum for a two-team split", "no signal", "stays on your device"])` —
still exactly three rows.

**CORRECTION (2026-09-30, after Task 12 shipped): the restore is a fourth row, the description is
scoped rather than restored, and the row-1 string in the assertion above is now forbidden.** Every
one of this paragraph's four predictions about the shape of the change was wrong, and the change
that shipped is better on the axis this paragraph was aiming at. Kept verbatim because it is what
this spec committed to, and the delta is the useful part.

- **The row is appended, not substituted.** `index.html:210-213` carries the three true rows
  untouched plus a fourth: *"Once comp3tive has run with a network, it opens and runs a tournament
  with no signal."* `landing.spec.ts:93` asserts `toHaveCount(4)`. The count was 3 because there
  were three true rows; swapping a true row out to hold the number would have deleted a claim
  nobody asked to delete.
- **The description is scoped, not restored.** Shipped `index.html:9` reads *"Works offline **after
  one online run**."* rather than the bare `Works offline, ` — because that is the condition the
  offline spec actually proves, and an unscoped sentence is the overclaim B14 existed to remove.
- **B14's `not.toContainText("no signal")` guard was inverted, and this paragraph never mentioned
  it.** Shipped `landing.spec.ts:112` asserts `toContainText("no signal")`. The guard is now the
  receipt that the proof and the copy cannot drift apart: it fails if the claim is ever removed
  again. **B14 was right while the promise was untrue and was deliberately superseded when it
  became true.**
- **Row 1's string is gone.** `landing.spec.ts:116` asserts the list does **not** contain
  `"proven minimum"` at all, so the `"proven minimum for a two-team split"` string in the assertion
  block above is one the suite now forbids. Two-team futsal pools of 32+ abort at `NODE_BUDGET`,
  so the two-team scope did not hold at every two-team size either.

The acceptance criterion this paragraph was written for is criterion 8, which was **unsatisfiable
as written** — it required `toHaveCount(3)` and a fourth item's text at the same time. Its
CORRECTION carries the full contradiction with B14 and which half of B14 died.

### D34 — The durability story

**The trigger, decided** (the absorbed ticket's design question; this template has no `## Answer`
section, so it lives here and in the acceptance criteria). The nudge appears when **all three**
hold: (a) `persist()` was refused or `navigator.storage` is absent, (b) the roster holds at least
5 players, and (c) no export has happened or the last was more than 14 days ago. Before 5 records
there is nothing worth losing, so a prompt is noise; after a loss it is useless; and mid-session —
on the split screen, getting teams onto the court — is the failure mode to avoid. So the nudge lives
on the Dashboard, a screen the organizer leaves.

**CORRECTION (2026-09-30, after Task 14 landed): there are FOUR conditions, not three, and the
dismissal is a snooze rather than a silence.** Both changes were made deliberately and survived
review; the review that produced them is
`.superpowers/sdd/2026-09-17-product-completion/task-14-report.md` §"the dismissal", and the
shipped code carries the reasoning at each site. This correction points at that record rather than
re-arguing it, because the arguments are already written down and are good.

**The fourth condition is (d): no live dismissal covers the roster.** It is not a fifth thing
bolted on — the shipped test names the gate as it stands: *"nudges only when all four hold:
refused, big enough, stale, and not dismissed"* (`src/shell/useDurability.test.ts:312`). The
decision is one pure function, `decideDurability` (`:313-315`), which is what makes the truth table
provable without a browser.

**What the plan stored, and why it could only ever be permanent.** The plan's design wrote the
dismissal as the **literal string `"1"`**:
`useState<boolean>(() => readPref(NUDGE_DISMISSED_KEY) === "1")`, and
`writePref(NUDGE_DISMISSED_KEY, "1")`. **A key that can only say "yes" cannot say which roster the
dismissal was about, and a dismissal with no subject has nothing to expire against** — so
permanent was not a policy that was chosen, it was the only behaviour the shape permitted. That is
the dismiss-at-5 / never-asked-at-50 defect: a user who closed the prompt at five players was never
asked again, however much data they subsequently added, and no later export changed it.

**What ships instead.** `dismissNudge` writes `{ at, playerCount }` — *when* the dismissal was made
and *how big the roster was then* (`src/shell/useDurability.ts:400-404`) — and `covers()`
(`:271-285`) lifts it on either of two conditions:

- **Time.** `DISMISSAL_TTL_MS` is **30 days** (`:80`). Past that, the dismissal no longer covers.
- **Size.** `playerCount >= dismissal.playerCount + MIN_PLAYERS_TO_NUDGE` — one more batch of
  players and the dismissal does not apply (`:283`). The user closed a prompt about the roster they
  had; that says nothing about the next batch, and the next batch is what makes this data worth
  losing.

Two more properties fell out of storing the record rather than a flag, and both are tested: a
dismissal dated in the **future** is not a dismissal and mutes nothing (a restored profile, a
hand-edited key, a machine whose clock was ahead), and an **export retires the dismissal in the
same beat** (`recordExport` clears both keys, `useDurability.ts:406-414`) — the user did the one
thing the prompt was asking for, so the snooze has nothing left to stand in for.

**The cost, stated because it is the honest half and a record that omits it is a sales pitch.** A
user who dismisses and comes back after 30 days **is asked again**, and that is a worse experience
than a permanent silence for someone who has already answered the question. The shipped code says
so in its own words: *"A dismissal is a snooze, never a silence. The user who closed the prompt has
backed nothing up, so a dismissal that never expired would leave someone who dismissed at five
players unasked for the rest of their life"* (`useDurability.ts:70-72`). The trade is deliberate
and it is a trade: **one cycle of nagging in exchange for never training someone to dismiss the
prompts that matter.** A month outlives one nudge cycle, so closing the prompt costs one cycle and
not every cycle. The number that would change the decision is named beside it — whether real users
read dismissals as "stop asking" — and if they do, the fix is a shorter gap between *asks*, not a
permanent mute.

**The risk-table row and criterion 9 below both still say "forever"; both are wrong in the same
way, and both are corrected in place.**

**New: `src/shell/useDurability.ts`** — exports `{ persisted, granted, lastExportAt, shouldNudge,
dismissNudge }`. It calls `navigator.storage?.persist?.()` once, feature-detected; a refusal is
caught and silent (no `notify`, no throw, no screen change); `persisted` is `null` before the
promise settles and on a browser without the API, so "unknown" and "refused" are never conflated.
`lastExportAt` persists under `tb-last-export` and dismissal under `tb-export-nudge-dismissed`,
following the `tb-` prefix convention (`tb-theme`, `tb-layout`, `tb-rail` from
`src/App.tsx:93-108`'s `useStoredPref`, which already wraps `localStorage` in try/catch, and
`tb-community` from `src/domain/useCommunities.ts:6`).

**Where it renders.** A `.nudge` row on the Dashboard between the stat cards
(`src/DashboardScreen.tsx:113-127`) and the teasers, reading `This browser can clear your data.
Export a backup and it can't.` with a `Dismiss` button — the app's inline vocabulary, not a modal,
not `alert`, not `window.confirm`. The persisted state is a `.durability-note` line beside the
`Export` control in `src/shell/RosterScreen.tsx`, reading one of three sentences for
`persisted === true` / `false` / `null`. **The stat cards are untouched** — still exactly three
`.tournament-meta-card.dashboard-stat` children labelled `Players`, `Saved squads`, `Tournaments`
— so `e2e/tests/dashboard/dashboard.spec.ts:114-118` and `:221-224` stay green unchanged.

**CORRECTION (2026-09-29, after Task 14 landed): the nudge sentence and all three
`.durability-note` sentences changed; the shapes did not.** Shipped
(`src/DashboardScreen.tsx:131`, `src/shell/RosterScreen.tsx:654-656`):

| place | shipped |
|---|---|
| `.nudge` | *This browser does not promise to keep this app's data. Export a backup from Roster.* |
| note, `persisted === true` | *This browser reported persistent storage for this app on this visit. Keep a backup anyway.* |
| note, `persisted === false` | *This browser reports this app's data is not stored persistently. Keep a backup.* |
| note, `persisted === null` | *This app could not confirm persistent storage here. Keep a backup.* |

Every word was argued and reviewed in
`.superpowers/sdd/2026-09-17-product-completion/task-14-report.md` §2.1–§2.4; this is the record
of the change, not a second argument. The rule the four sentences share is that the line **reports
what the browser said** and never predicts what will happen — which is why "Storage protected.
Eviction unlikely." is gone, and why the reassuring branch is the only one carrying "anyway."
`e2e/tests/dashboard/nudge.spec.ts` pins all four, and two unit tests assert the shipped strings
do not match `/safe|protect|guarantee|secure|never lose/i` or `/\bwill\b|lose|lost|delete/i`.
Criterion 9 below is unaffected: it asserts the presence of the row and the count of stat cards,
not the wording.

No sync, no cloud, no file-system integration. Export/import is the whole mechanism (ADR-0001).

### D35 — Round robin

**This is a small ticket, and the audit is why.** `standings(tournament)`
(`src/tournament/bracket.ts:303`) is format-agnostic — it reads only `records(tournament)`
(`:136`), which walks `t.matches` — and the `.standings` / `.standings-row` / `.standings-pos` /
`.standings-team` / `.standings-wins` markup already ships (`src/tournament/TournamentScreen.tsx:493-503`,
styles at `src/index.css:2486`). Round robin needs **no new table and no new CSS**. The roadmap's
ticket table treats D3 as "add a format", implying substantial work; the audit's reading, plus a
second measurement, shows four small changes and two UI touch-ups. **This spec follows the audit.**

**The changes.**

1. `src/domain/types.ts:25` — add `"round-robin"` to `TournamentFormat`.
2. `src/ui/constants.ts` — `FORMAT_LABEL` gains `"round-robin": "Round robin"`. The record is
   declared as an explicit `Record<TournamentFormat, string>`, so the compiler fails at that
   object literal until the key exists. That failure is the signal, not a surprise.
3. **New: `src/data/round-robin.ts`** — `roundRobinSchedule(n): { round; teamA; teamB: number |
   null }[]`, pure, pairing team **indices** so it has no dependency on the domain types. The
   algorithm is the **circle method**: for odd `n` append one `null` placeholder giving `m = n + 1`
   slots; keep slot 0 fixed; rotate slots 1..m-1 one position per round; pair slot `i` with
   `m - 1 - i`. A `null` on either side is a bye. Round counts: `n - 1` even, `n` odd;
   matches `n(n-1)/2`. Verified by hand for n = 3, 4, 5, 6, 7, 8: every pair meets exactly once,
   no team twice per round, odd counts get exactly one bye per round and one bye per team.
4. `src/tournament/bracket.ts` — four reads:
   - a round-robin arm in `buildBracket` before the Swiss fallthrough (`:122`), mapping the
     schedule onto `emptyMatch(round, position)` (`:56`); `winnerNext` and `loserNext` stay
     `null`, so `settle`'s re-derivation loop is correctly a no-op;
   - `roundsFor` (`:53`) gains a round-robin arm rather than being bypassed;
   - `requiredMatches` (`:191`) needs **no** arm — its final fallthrough already returns every
     match in the last round, and for round robin the last round is the last matches, so "all
     matches required" is correct; this is asserted by a test, not assumed;
   - **`champion()` (`:317`) is a required change.** Today only `"swiss"` takes the
     standings branch; everything else falls to the single-elim final-round lookup, which finds no
     final for round robin and returns `null` **silently**. The condition becomes
     `format === "swiss" || format === "round-robin"`. This is the specific silent breakage the
     roadmap's generic "existing bracket tests" risk row does not name.
5. `src/tournament/tournament-validation.ts:58-63` — `getValidTeamCounts` returns
   `[3, 4, 5, 6, 7, 8]` for round robin; `isValidTeamCountForFormat` (`:66`) needs no change.
6. `src/shell/useSplitFlow.ts`'s `consumeTeams` — the post-C26 home of `src/App.tsx:328-331`'s
   `bracketOk` — gains `n >= 3 && n <= 8` for round robin; everything else byte-identical.
7. `src/tournament/GamesScreen.tsx` — `TEAM_COUNTS` (`:36-40`) gains the round-robin counts; the
   chip array (`:334`) becomes `[2, 3, 4, 5, 6, 7, 8]` so 3 and 5 are selectable while
   out-of-format chips stay `disabled`; the hint (`:354-358`) gains
   `Round robin: 3 to 8 teams.`; the preview (`:374-378`) gains the round count and `every team
   plays every other`; and the prefill chain (`:62-65`) stops routing 3- and 5-team squads into
   Swiss, where validation then rejects them.
8. `src/tournament/TournamentScreen.tsx:359-363` — the branch becomes
   `format === "swiss" || format === "round-robin" ? <StandingsView> : <BracketView>`.
   `StandingsView` is unchanged; it already renders whatever rounds exist.

**Untouched, and proven so.** The `series`, `single-elim` and `swiss` paths in `bracket.ts` are
not modified. All existing bracket tests stay green with **no spec edited** —
`src/tournament/bracket.test.ts:268` (Swiss tiebreak order) and `:254` (standings crown the
leader) in particular, which A07 also has in flight. New coverage goes in a new
`src/data/round-robin.test.ts` plus new `describe` blocks in `bracket.test.ts`.

**CORRECTION (2026-09-29, after Task 7 landed): the `requiredMatches` read above is wrong, and the
"untouched" claim above it holds for `single-elim` and `swiss` but not for `series`.** The bullet
said `requiredMatches` (`:191`) "needs **no** arm — its final fallthrough already returns every
match in the last round, and for round robin the last round is the last matches, so 'all matches
required' is correct." It is the opposite. A round robin books every fixture up front, so the last
round is a **column**, not the last of the work: a 5-team round robin is 5 rounds and 10 fixtures,
the fallthrough returns 2, and `statusOf` completes a tournament the moment those 2 have winners.
`src/tournament/bracket.ts:287` now reads
`if (t.format === "round-robin" || t.format === "series") return t.matches;`.

**Consequence for the two claims this section makes elsewhere.** "The `series`, `single-elim` and
`swiss` paths in `bracket.ts` are not modified" is true of `single-elim` and `swiss` and false of
`series` in this one function: the diff replaces `if (t.format === "series") return t.matches;`
with the two-format condition, so a `series` line was edited rather than added beside. Everything
else the section claims stands — the `single-elim` arm is byte-identical, the Swiss fallthrough is
unchanged, and all existing bracket tests stayed green with no spec edited. Commit `bc17fe7` is
the record; the round count named elsewhere in this phase is `roundRobinRounds(n)`, never
`roundRobinSchedule(n).length`, which counts rows and byes.

**CORRECTION (2026-09-29, after Task 7 landed): the `roundsFor` bullet above is wrong twice over,
and the same wrong claim is also in the shared-file table earlier in this spec.** The bullet reads
`roundsFor` (`:53`) "gains a round-robin arm rather than being bypassed", and the table row for
`src/tournament/bracket.ts` lists "a new arm in `roundsFor`" among the round-robin changes.
**There is no round-robin arm.** The shipped `src/tournament/bracket.ts:66` types the parameter
`("single-elim" | "swiss")` and its docstring says why the question is closed: *"Round robin is
deliberately not answerable here… Naming the two formats in the signature keeps a call site from
asking the wrong question: there is no third arm to keep honest."* The arm was added and is
unreachable, so it was deleted again. The round count a caller wants is a different function
entirely — `roundRobinRounds(n)` in `src/data/round-robin.ts:122` — whose own docstring refuses
`roundRobinSchedule(n).length` by name.

The plan records this reversal in full; there is no need to re-argue it here. See the CORRECTION
at `docs/superpowers/plans/2026-09-17-product-completion.md` Task 7 Step 5
"**do not extend `roundsFor` for round robin**", and the same file's prose at Task 7's
"Two things stated up front". The two files briefly disagreed here — the plan's 2026-09-28
correction got the decision right and the value wrong, and it has since been amended — which is
why the shared-file table and the D35 bullet are both named above rather than one of them.

### D36 — Roster fast entry

**The boundary, kept.** A08 owns `src/data/player-import.ts` and its semantics — quoted-field
parsing, `MAX_IMPORT_BYTES`, `assertImportSize`, unknown discipline → `skipped`, never a
capability-less player. D36 renders its `ImportSkip[]` and matches its **column order: name,
discipline, strength**. D36 does not edit the parser.

**The UI, in its post-C26 home.** `src/shell/RosterScreen.tsx` accepts `lastReport: ImportReport
| null` and renders a `.import-report` panel with `Imported N players.` plus a `.import-skipped`
list of `Line {line}: {reason}` rows whenever `lastReport` is non-null. It comes from
`usePlayerImport`'s `lastReport`, so it persists across renders rather than flashing as a toast,
and a partial import shows both halves. The existing toolbar (`+ Add Player`, `Import players`,
`Export`, the hidden file input) is kept and gains `Download CSV template`
(`data-testid="download-csv-template"`), which downloads `CSV_TEMPLATE` from
`src/data/csv-template.ts` (new, D-owned — A08's parser file is never written to) as `comp3tive-players-template.csv` through the Blob-URL pattern at
`src/data/sample-data.ts:52-60`.

**The column order is stated in the app, not only in the file.** An `.import-hint` line reads
exactly `CSV columns: name, discipline, strength.` and, beneath it, `Names with a comma go in
quotes: "Smith, John", futsal, 4.`

**Bulk rating.** `Rate selected` opens `src/roster/BulkRateModal.tsx` with one integer rating per
attribute the discipline declares, bounded by that attribute's `min`/`max`. Writes go through
`useRoster.savePlayer` (`src/roster/useRoster.ts`) — never the raw store — so the in-memory list
updates exactly as the single-player editor does, and every touched player satisfies
`validatePlayer` / `validateCapability` (`src/domain/validation.ts:9`, `:35`): ratings in range,
at most one capability per discipline, `eligibleRoles` non-empty, `preferredRole` inside it. A
player with no capability in the chosen discipline gains one with the discipline's full role list
and `preferredRole: null`; a player who already has one keeps its roles and only its ratings
change. Success speaks through the existing `notify` (`src/App.tsx:163-171`), which is already
there and unused by these paths. After C26 it is `useToasts().notify` from
`src/shell/useToasts.ts`, which C's spec names as the shared toast seam the share sheet and this
modal both call. There is no `alert` and no `window.confirm`.

**Correction carried forward.** `.scratch/app-correctness/issues/03` claims no production path
calls `validatePlayer`. Partially stale: `PlayerEditModal.tsx:126` calls it. Only `parseBackup`
and the JSON/CSV import paths still bypass it — which is precisely why the bulk write routes
through it.

### D37 — Why the split is fair

**New: `src/share/fairness.ts`** — `explainFairness({ result, discipline, roster }): { averages:
string; trade: string }`, pure, no DOM, no React, no solver import.

- `averages`: `Every team averages {low} to {high}.` from the min and max of
  `result.teams[].avgStrength` to one decimal; the singular form `Every team averages {low}.` when
  they agree.
- `trade`: `{name} ({v}) is {Team X}'s best; {name} ({v}) is {Team Y}'s weakest.` — the strongest
  player on the highest-averaging team against the weakest on the lowest-averaging team, read
  through `strengthOf(player, discipline)` (`src/session/flow.ts:29`) and labelled with
  `teamName(index)` (`:23`). Players with a `null` strength are excluded; ties break by slot
  order so the output is deterministic. Fewer than two teams, or no rated players, yields `""`.

**The boundary with B13, stated explicitly and enforced mechanically.** B13 owns *"is this
proven?"* — `gapKind`, `gapQualifier`, and the on-screen `Best gap found.` suffix. D37 owns *"why
is this fair?"* — what the number measures and where the strength sits. **D37's copy must not
restate or contradict a provenance word.** The acceptance criteria make that checkable rather
than a matter of taste: a unit test asserts neither returned string contains any of `proven`,
`best gap`, `best-found`, `exact`, `minimum`, `optimal`, `solver`, `search`, `node`, `heuristic`
or `aborted`, and that neither contains an em-dash (`DESIGN.md:200` bans em-dashes in visible
copy). If the sentence is identical in both provenance cases, D37 does not import
`gapProvenance.ts` at all.

**Where it renders.** A `<p className="fairness">` immediately after the existing `.readout` at
both live branches (`src/session/SplitScreen.tsx:135` in `GapMeter`, and `:339` in the 3+ stack).
Two additive edits; every existing line stays byte-identical, so B13's qualifier and A03's
`reroll` work are untouched. It does not render on the empty state, which has no teams to explain.
Styling reuses `.readout` / `.readout .fine` (`src/index.css:2142`, `:2149`) with at most a
`text-align` and a margin — no new token, no new component. The landing hero gains nothing
(`src/landing.tsx:153` passes no new prop), so `landing.spec.ts`'s hero and 390×844 overflow
assertions stay green.

## Acceptance criteria

**The phase is done when:**

1. `npx tsc -b` exits 0.
2. `npx vite build` exits 0 and `dist/` contains `sw.js`, `manifest.webmanifest`, `fonts/` (4 woff2 + `OFL.txt`) and `icons/`.
3. `npx vitest run` exits 0, 0 failed, with `src/share/share-text.test.ts`, `src/share/share-image.test.ts`, `src/share/fairness.test.ts`, `src/data/round-robin.test.ts` and `src/shell/useDurability.test.ts` in the output. (Unit tests live in `.ts` files: `vite.config.ts` sets `include: ["src/**/*.test.ts"]`, so `.tsx` is not collected.)
4. `npm run e2e` (A10's script) exits 0 with the new Phase D specs in the output.
5. **D31 proven:** the share spec grants `clipboard-read`/`clipboard-write`, clicks `share-copy-text`, and asserts `navigator.clipboard.readText()` returns text starting with the headline and containing each seeded team name. A second spec deletes `navigator.clipboard` in an init script, clicks the same button, and asserts `.share-status` reads `Copy failed. Select the text above and copy it.` with the textarea still populated.
6. **D32 proven:** the image spec clicks `share-image`, reads `navigator.clipboard.read()`, and asserts the first item's type is `image/png` with a blob over 10,000 bytes. A second spec deletes `window.ClipboardItem` and asserts a download named `comp3tive-teams-YYYY-MM-DD.png`.
7. **D33 proven:** a spec records every request on `/` and `/app/` and asserts no host other than the base origin; a spec loads `/app/`, waits for `navigator.serviceWorker.ready`, sets `context.setOffline(true)`, reloads, and asserts the shell renders; a second does the same for `/` and asserts the landing `<h1>`; a spec mutates the cached `sw.js`'s version, calls `registration.update()`, and asserts a new worker reaches `activated` and the old cache name is gone from `caches.keys()`.
8. **ORIGINALLY: D33's claim restored:** `landing.spec.ts` passes with trust assertions
   `toHaveCount(3)` and `toContainText(["proven minimum for a two-team split", "no signal", "stays
   on your device"])`, and the page contains no `fonts.googleapis.com` reference.

   **CORRECTION (2026-09-30, after Task 12 shipped): this criterion is unsatisfiable as written, and
   it is unsatisfiable because it contradicts Phase B's B14 — the two requirements cannot both
   hold.** `toHaveCount(3)` and `"no signal"` name a three-item list containing a fourth item's
   text. **A list cannot have three items and contain a fourth item's text**, and no implementation
   satisfies both clauses.

   **The contradiction, stated with the other side.** B14's acceptance criterion in
   `docs/superpowers/specs/2026-09-17-honest-claims-design.md` requires "the trust list has exactly
   three items and contains **no substring `no signal`**". B14 was correct while the offline
   promise was untrue, and this criterion was written to honour B14's shape exactly — which is
   what carried the impossibility across. **The resolution goes in the direction the code took, and
   the reason is not a preference: B14's clause was a guard against claiming offline support the
   app did not have. Task 12 proved a whole tournament plays with the network cut, and then made
   the app able to keep the claim, so keeping B14's guard would forbid the truth.** B14 was
   deliberately superseded at the moment it stopped being protective.

   **Which half of B14 died, because the two halves are in different states and a reader needs
   both.** The `no signal` half is **no longer a live requirement at all** — not narrowed, gone;
   D02 flipped B14's own guard from asserting absence to asserting presence
   (`e2e/tests/landing/landing.spec.ts:112`), so B14's rule was *chosen away*, not forgotten. The
   "exactly three items" half is **superseded to four**.

   **What shipped, against the three strings this criterion names** — one present as required, one
   present in a form this spec now forbids, and one absent as a count:

   | this criterion requires | shipped | where |
   |---|---|---|
   | `toHaveCount(3)` | `toHaveCount(4)` | `e2e/tests/landing/landing.spec.ts:93` |
   | `"no signal"` | present, **scoped**: *"Once comp3tive has run with a network, it opens and runs a tournament with no signal."* | `index.html:213` |
   | `"proven minimum for a two-team split"` | **forbidden** — the list must **not** contain `"proven minimum"` | `e2e/tests/landing/landing.spec.ts:116` |

   The count went to four because the offline row was **appended, not swapped in**: the three rows
   that were already true are all still there, and swapping one out to hold the number at 3 would
   delete a claim nobody asked to delete. The count was 3 because there were three true rows, and
   there are now four. The `"proven minimum"` string is gone for a measured reason, not a stylistic
   one — two-team futsal pools of 32+ abort at `NODE_BUDGET`, so even the two-team claim did not
   hold at every two-team size, and row 1 is now *"The screen says when the gap is the best it
   found, not proven."*

   **The criterion as it should be read:** the page contains no `fonts.googleapis.com` reference
   (**holds**), the trust list carries the offline claim **scoped to the condition Task 12 proved**
   (**holds, in a fourth row**), and the suite pins that scope whole rather than by keyword, so a
   reword that drops "once comp3tive has run with a network" cannot pass on the strength of
   `"no signal"` alone. The `toHaveCount(3)` clause is the part that is void, and it is void
   because Phase B and Phase D each stated the same count for the same list and the list grew
   between them.
9. **D34 proven:** a spec seeds 6 players with no export record, asserts `.nudge` is visible, clicks `Dismiss`, reloads, and asserts `.nudge` is still absent; a second spec seeds 2 players and asserts `.nudge` never appears; a third asserts `.dashboard-stats .dashboard-stat` still has exactly 3 children. `navigator.storage` deleted in an init script produces no error and `persisted === null`.

   **CORRECTION (2026-09-30, after Task 14 landed): every clause above holds, and the first one is
   a weaker claim than it reads.** "Reloads and asserts `.nudge` is still absent" is a test of a
   **snooze surviving a page load**, not of permanence — and permanence is not what shipped. The
   shipped test says so in its own title: *"dismissing the nudge is the hook's snooze, not a hidden
   row"* (`e2e/tests/dashboard/nudge.spec.ts:56`), and it asserts the stored record's **shape**,
   not merely its presence:

   ```ts
   const dismissal = JSON.parse(String(stored)) as { at: number; playerCount: number };
   expect(dismissal.playerCount).toBe(6);
   expect(Number.isFinite(dismissal.at)).toBe(true);
   ```

   A `useState(false)` in the screen would pass a bare "still absent after reload" and lose the
   snooze entirely, so the shape assertion is the part that carries the criterion. The unit tests
   carry the rest of the contract this criterion does not name: that a dismissal lifts after 30
   days, lifts when the roster grows by another batch, does **not** mute anything if its timestamp
   is in the future, and is retired by an export
   (`src/shell/useDurability.test.ts:339`, `:344`, `:362`, `:378`).

   The `.dashboard-stat` clause is correct and is checked at `nudge.spec.ts:100`, not at the two
   `dashboard.spec.ts` lines the risk row above cites — see that row's own correction.
10. **D35 proven:** `src/data/round-robin.test.ts` enumerates n = 3, 4, 5, 6, 7, 8 and asserts every pair exactly once, no team twice per round, one bye per round for odd n, one bye per team across the schedule, and the round/match counts. A bracket test plays a full 4-team round robin and asserts `status` reaches `"complete"` and `champion()` returns the most-wins team and is not `null`. A spec creates a 3-team round-robin tournament, splits 3 teams into it, records every match and asserts the standings and champion render. **`src/tournament/bracket.test.ts`'s existing assertions are unmodified and green** — `git diff --stat src/tournament/bracket.test.ts` shows additions only.
11. **D36 proven:** a spec imports a CSV whose second row has an unknown discipline, asserts `.import-skipped` contains that line number and the first player was created; a spec clicks `download-csv-template` and asserts a download named `comp3tive-players-template.csv`; a spec rates two filtered players via `BulkRateModal` and asserts the roster rows show the new values; `.import-hint` contains both documented strings.
12. **D37 proven:** a spec asserts `.fairness` is visible on a seeded split, contains `Every team averages`, and contains none of the banned provenance substrings. `node scripts/capture-hero.mjs` still passes its own DOM and pixel verification.
13. `git diff --stat src/tournament/bracket.ts` touches round-robin arms only — no `single-elim` or `swiss` line is modified.

**CORRECTION (2026-09-29, after Task 7 landed): criterion 13 cannot be satisfied as written, and
the round-robin risk row in the table below is corrected with it.** The diff to `bracket.ts` does
`"round-robin" || "series"` — so "touches round-robin arms only" was true of the design and false
of the change. The check that was reaching for is still worth running in its narrower form: **no
`single-elim` and no `swiss` arm is modified**, which is what the `bracket.test.ts` diff in
criterion 10 asserts for the tests. `requiredMatches` is the single place round robin and an
existing format share a line, and it shares it because they have the same answer — every fixture
is required — not because the arm is format-neutral.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| The service worker serves stale assets, pinning users to an old build | Worse than no offline support: the app is frozen and the fix cannot reach them | Cache name keyed to a build-written version; `/sw.js` served `no-cache` in `public/_headers`; `skipWaiting` + `clients.claim`; an `update()` spec asserts a new worker activates and the old cache is purged (criterion 7) |
| The worker's precache list drifts from the real hashed asset names | Either a broken offline load or a worker that 404s on every fetch | The list is generated at build time from the emitted assets, not hand-written, and the offline-load spec fails loudly if a URL is missing |
| Self-hosting fonts regresses first paint versus the `preconnect`ed CDN | The typography gets correct and the page gets slower — a net loss the user feels | Two `preload` hints replace the two `preconnect` hints one-for-one; the latin subsets are 32 kB and 19 kB; `/fonts/*` is immutable-cached and swept into the precache |
| A font family name drifts during self-hosting | `e2e/tests/community/community.spec.ts:21-26` fails, and so does every computed-style assertion on the landing page | Family names stay byte-identical (`"Outfit"`, `"Familjen Grotesk"`); no stylesheet declaration changes; the spec is the check |
| `champion()` is missed because `standings` already works | Round robin completes with a silent `null` champion — a wrong result, not a crash | Ticket 35 names `champion()` as a required change with its own test asserting it is **not** `null`; criterion 10 makes that a phase gate |
| Round robin perturbs the shared `roundsFor` / `requiredMatches` helpers | Existing `single-elim` and `swiss` tests break; A07's Swiss work collides | New arms only, never edits to existing arms; `requiredMatches` needs no change and is asserted rather than assumed; criterion 13 checks the diff is additive |
| The canvas poster draws fallback faces | The image looks wrong in the one place it is public — a group chat | `document.fonts.ready` is awaited before the first `fillText`, with `src/landingDeal.tsx` as in-repo precedent; the layout is a pure function unit-tested for size, colour and type scale |
| `ClipboardItem` is unavailable or the write is rejected | The image feature silently does nothing for some users | Feature detection via `ClipboardItem.supports?.("image/png")`, a download fallback that always works, and never losing D31's text when the image fails |
| D37's copy collides with B13's qualifier | Two provenance statements on one screen, one of them wrong | The banned-substring unit test and the em-dash check make the separation mechanical; D37 imports `gapProvenance` only if a branch truly needs the verdict |
| D36 edits a Phase C-owned file, or D34 assumes the roster UI is still in `src/App.tsx` | Overlapping writes and a spec that cannot land | Both tickets name `src/shell/RosterScreen.tsx` and `src/shell/usePlayerImport.ts` explicitly; D touches no C-owned file |
| Persistence is requested on every load and nags | The user is prompted repeatedly about something they cannot change | `persist()` is called once from a hook, a refusal is silent, and `shouldNudge` is gated on refusal **and** ≥5 players **and** no recent export; dismissal persists forever — **the last clause is wrong, see the CORRECTION below** |
| The nudge pushes the third stat card | the dashboard spec fails for an unrelated reason | The nudge renders between the stat cards and the teasers; the stat card markup is untouched; criterion 9 asserts exactly 3 `.dashboard-stat` children, and the shipped assertion is `nudge.spec.ts:100` — **not** at the `dashboard.spec.ts:114-118` / `:221-224` this row originally cited, which are a "switch to Beta" click and a seed record |

**CORRECTION (2026-09-30, after Task 14 landed): "dismissal persists forever" is the wrong
mitigation, and it was the wrong mitigation because the shape this spec designed could not be any
other.** The rest of the row holds and was re-verified: `persist()` is called once, a refusal is
silent, and the gate is `refusal ∧ ≥5 players ∧ no recent export`. **The gate is a fourth condition
too** — no live dismissal covers the roster — and the shipped test names all four
(`src/shell/useDurability.test.ts:312`).

The plan's design stored the dismissal as the literal `"1"`, so permanence was not a policy but the
only thing the shape allowed: a key that can only say "yes" cannot record which roster the
dismissal was about, and so has nothing to expire against. That is the dismiss-at-5 /
never-asked-at-50 defect. **Shipped**, `dismissNudge` writes `{ at, playerCount }` and `covers()`
(`src/shell/useDurability.ts:271-285`) lifts the dismissal on a **month**
(`DISMISSAL_TTL_MS`, `:80`) or on the roster growing by another batch (`:283`); an export retires it
in the same beat (`:406-414`). The reasoning is in
`.superpowers/sdd/2026-09-17-product-completion/task-14-report.md` and is not re-argued here.

**The cost this row's original wording was chosen to avoid is now paid instead, and it is worth
naming in a risk table rather than only in a report.** A user who dismisses and returns after 30
days is asked again, which is a worse experience than a permanent silence for someone who has
already answered. The risk this row names — being nagged about something you cannot change — did
not disappear; it was traded down from "forever" to "once per thirty days, and never at all after
you have exported". **That is a deliberate trade with a named losing side, not a fix**, and a
reader deciding whether to reopen it needs both halves. The full statement, including what number
would change the decision, is in the D34 design section above.

**CORRECTION (2026-09-29, after Task 7 landed): the mitigation in the round-robin risk row above
is half right, and the half that is wrong is the part that would have caught the bug.** The row
reads "`requiredMatches` needs no change and is asserted rather than assumed; criterion 13 checks
the diff is additive." `requiredMatches` **does** change — see the CORRECTION in D35 and commit
`bc17fe7` — and the assertion that was relied on passed anyway, because driving a tournament to
`"complete"` on a schedule whose earlier rounds were blank is a real completion rather than a
refutation. The row's first clause, "new arms only, never edits to existing arms", is the rule
that had to bend, and it bent for a reason worth keeping: round robin shares its *answer* with
`series`, and expressing that honestly means widening the condition on a `series` line. The test
that now holds it records the **last round first**, reads `"complete"` before the fix, and only
reaches `"complete"` on the full schedule after it.

## Files

| Action | Path |
|---|---|
| Create | `docs/superpowers/specs/2026-09-17-product-completion-design.md` (this file) |
| Create | `.scratch/debt/issues/31-share-teams-as-text.md` |
| Create | `.scratch/debt/issues/32-share-teams-as-image.md` |
| Create | `.scratch/debt/issues/33-real-pwa.md` |
| Create | `.scratch/debt/issues/34-durability-story.md` |
| Create | `.scratch/debt/issues/35-round-robin.md` |
| Create | `.scratch/debt/issues/36-roster-fast-entry.md` |
| Create | `.scratch/debt/issues/37-split-fair-in-words.md` |
| Create | `src/share/share-text.ts`, `src/share/share-text.test.ts` |
| Create | `src/share/share-image.ts`, `src/share/share-image.test.ts` |
| Create | `src/share/ShareSheet.tsx` |
| Create | `src/share/fairness.ts`, `src/share/fairness.test.ts` |
| Create | `src/data/round-robin.ts`, `src/data/round-robin.test.ts` |
| Create | `src/data/csv-template.ts`, `src/data/csv-template.test.ts` |
| Create | `src/shell/useDurability.ts`, `src/shell/useDurability.test.ts` |
| Create | `src/roster/BulkRateModal.tsx` |
| Create | `src/fonts.css` |
| Create | `public/manifest.webmanifest`, `public/sw.js` |
| Create | `public/fonts/outfit-latin.woff2`, `public/fonts/outfit-latin-ext.woff2`, `public/fonts/familjen-grotesk-latin.woff2`, `public/fonts/familjen-grotesk-latin-ext.woff2`, `public/fonts/OFL.txt` |
| Create | `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/maskable-512.png` |
| Create | `e2e/tests/share/share.spec.ts`, `e2e/tests/pwa/offline.spec.ts`, `e2e/tests/tournament/round-robin.spec.ts`, `e2e/tests/roster/fast-entry.spec.ts`, `e2e/tests/split/fairness.spec.ts` |
| Modify | `src/session/SplitScreen.tsx` (additive only: the share prop + button, the fairness line) |
| Modify | `src/domain/types.ts` (`TournamentFormat` union) |
| Modify | `src/tournament/bracket.ts` (round-robin arms only) |
| Modify | `src/tournament/tournament-validation.ts` (round-robin counts) |
| Modify | `src/tournament/GamesScreen.tsx` (counts, chips, hint, preview, prefill) |
| Modify | `src/tournament/TournamentScreen.tsx` (the format branch at `:359`) |
| Modify | `src/shell/useSplitFlow.ts` (`consumeTeams` guard) |
| Modify | `src/shell/RosterScreen.tsx` (import report, template button, hint, bulk-rate entry, durability note) |
| Modify | `src/DashboardScreen.tsx` (the nudge row) |
| Modify | `src/main.tsx` (SW registration, after A05's boundary) |
| Modify | `src/tokens.css` (one `@import "./fonts.css";` — reaches both documents) |
| Modify | `index.html`, `app/index.html`, `public/404.html` (fonts, manifest, icons, restored claim) |
| Modify | `public/_headers` (fonts, icons, manifest, sw) |
| Modify | `src/ui/constants.ts` (`FORMAT_LABEL` key) |
| Modify | `vite.config.ts` (additive: one plugin entry that writes the asset list and version into `sw.js`) |
| Modify | `e2e/tests/landing/landing.spec.ts` (D33 restores the offline trust assertion) |
| Modify | `src/tournament/bracket.test.ts` (new round-robin `describe` blocks; no existing assertion changed) |

### Three additions beyond the contract row, and one shared file D never writes

`contracts.md`'s Phase D row names `src/shell/RosterScreen.tsx` and `src/shell/usePlayerImport.ts`
as D's shell surface. D also **creates** `src/shell/useDurability.ts` and
`src/roster/BulkRateModal.tsx` (already D's directory — `src/roster/PlayerEditModal.tsx` is the
sibling precedent), and adds **one** plugin entry to C's `vite.config.ts`. All three are stated
here rather than left implicit:

- `src/shell/useDurability.ts` is a new file, not an edit to a C-owned one. C has landed by the
  time D runs (`contracts.md`: A before C, C before D), so there is no concurrent writer in
  `src/shell/`. The hook follows C27's shape — one hook, one concern, injected dependencies — and
  is the reason D34 does not add state to `App.tsx`.
- `vite.config.ts` is C's file. D's edit is **additive only**: one entry in `plugins[]` whose
  `closeBundle` hook writes the emitted asset URLs and the version string into `dist/sw.js`. C29's
  `rollupOptions.input` and `appType: "mpa"` are not touched. This is the one place D and C both
  write, and it is the smallest edit that makes the worker's precache list generated rather than
  hand-maintained.
- `src/data/player-import.ts` (A08) and `src/session/gapProvenance.ts` (B13) are **read, never
  written**. D36's CSV template is a separate new file, `src/data/csv-template.ts`, tied to the
  parser by a test rather than by co-location.

## Spec Self-Review

**Checklist, ran against the seven tickets and this spec.**

- **Placeholders:** none in the seven tickets or in this spec's instructions. The check quoted here is self-defeating as written — `grep -nEi "TBD|TODO|FIXME|handle edge cases|etc\.|similar to (ticket|task)"` matches this bullet, which is the only hit, so "returns no matches" was never true of the spec itself; over the seven ticket files it does return none. Every ticket names exact files, exact exported symbols, exact CSS classes and exact copy strings, and every acceptance criterion is observable by running a command or reading a rendered value.
- **Internal consistency:** the ticket numbers are 31–37, the range `contracts.md` assigns to Phase D, and the seven files match the roadmap's Phase D table one-for-one (31, 32, 33→`app-health/13`, 34→`app-health/12`, 35, 36, 37). The dependency edges agree with the tickets: 32 blocked by 31, 33 by 14, 36 by 08 and 26, 37 by 13. No ticket claims a file another phase owns; D34 and D36 both name `src/shell/RosterScreen.tsx`, and both name the same post-C26 location `contracts.md` now records. D31's `gapKind` branch and D37's banned-substring rule are the two halves of the same boundary with B13 and do not overlap. D33 restores exactly one landing claim and B14's handoff note names the same three edits. D35 reuses `standings` and explicitly does not touch the Swiss or single-elim arms, which is what A07's in-flight work requires. Fixed inline during this review: D37's module location was stated without justification against the ownership table, and its `SplitScreen.tsx` criterion read "exactly two additive lines" while describing an import plus an element; both now say what they mean, name `src/share/**` as D's granted directory, and record the rename option rather than renaming unilaterally. Four more fixes, made after a second pass against the sibling specs rather than against this document alone. (1) D36's CSV template originally lived in `src/data/player-import.ts`, which is **A08's file** — it now lives in a new D-owned `src/data/csv-template.ts` tied to the parser by a test. (2) D33's `@font-face` was imported by `src/index.css` *and* `src/landing.css`, both of which belong to other phases — it is now one `@import` in `src/tokens.css`, which both surfaces already load. (3) D36's success message and D31's copy confirmation now name C26's `useToasts().notify` seam rather than the pre-C location, and `ShareSheet` renders through C23's shared `<Modal>`. (4) `vite.config.ts` turned out to be a file two phases write; D's edit is stated as additive-only with the exact hook named, and the four cross-phase files are tabulated with the rule for each. A line-reference note was also added: every `file:line` is anchored to `HEAD d87ac7b`, and A/B/C will shift some of them, so each anchor names its symbol and the symbol is authoritative.
- **Scope check:** this is one phase with seven tickets, which is what the roadmap assigns; it is not one implementation plan. The work is bounded by the tickets: two share modules, one PWA, one durability hook, one tournament format, one roster path, one copy line. Nothing here requires solving the solver, a backend, or another phase's file. Out of scope is an explicit table with a reason per row.
- **Ambiguity check:** three places where the earlier drafts were genuinely ambiguous. (1) D32's dependency question — answered: canvas, zero dependencies, with the tradeoff written out and the reversal path named as an ADR. (2) D34's nudge trigger — answered with three conjunctive conditions and the reason each exists; the absorbed ticket asked for an `## Answer` section this template does not have, and the correction is recorded in ticket 34's comments. (3) D35's `roundsFor` — **this answer was wrong and has since been reversed.** It read "extended with a round-robin arm rather than bypassed, and `requiredMatches` explicitly needs no arm with a test asserting that"; neither half shipped. `roundsFor` gained no arm, and `requiredMatches` did gain one. Both reversals are recorded in the D35 CORRECTION above, and the shared-file table's `bracket.ts` row is corrected with them. Every remaining criterion names a file, a symbol, a string or a number.

**CORRECTION (2026-09-30): the D34 answer in item (2) above is half stale — it is FOUR conjunctive
conditions now, not three, and the fourth is the dismissal.** The shipped gate is
`refusal ∧ ≥5 players ∧ no recent export ∧ no live dismissal`, and the shipped test names all four
(`src/shell/useDurability.test.ts:312`). The three conditions this bullet lists are still the three
the design decided and the reason each exists is unchanged; what was added is a gate on the
dismissal itself, which is a decision the review took rather than one this section took. The
dismissal's **shape** also changed — a snooze that expires rather than a permanent mute — which is
recorded in full, with the cost stated, in the D34 design section above and in the risk-row
CORRECTION. The three conditions are kept above because the reasons given for them are the part
that still holds.

**Result: the checklist passes, with the corrections in this file read as part of it.** The seven tickets and this spec are internally consistent, free of placeholders in their instructions, and scoped to one phase. They are no longer unambiguous at every decision point on their own: seven CORRECTIONs now sit in this spec, each recording a decision the body above still states the other way, and a reader who takes a body claim without its correction will implement something that was tried and reversed. The checklist passed against the tickets as drafted; it is the corrections, not a re-run, that make the spec match the code.

**CORRECTION (2026-09-30): there are twelve CORRECTIONs in this file now, not seven, and one clause
of the Internal consistency bullet above is false.** The count is stated in the sentence above and
was true when written; five have landed since — the D02 restore shape, criterion 8's mutual
exclusion with B14, the nudge dismissal's expiry, criterion 9's weaker-than-it-reads reload check,
and the `dashboard.spec.ts` anchors in the stat-card risk row. A count that goes stale is a small
thing; it is recorded because this file's whole argument is that a reader must be able to tell
which body claims have been reversed, and a wrong count is one more claim that is quietly wrong.

**The Internal consistency clause that no longer holds:** "D33 restores exactly one landing claim
and B14's handoff note names the same three edits." Two problems. D33's restore was **appended,
not substituted** — the trust list went from three rows to four, so "exactly one" understated the
scope of the copy change rather than describing it. And B14's handoff named the wrong three: it
said trust-list *row 3* becomes the offline sentence (it became a fourth row), that the meta
description *regains* the bare `Works offline, ` (it was scoped to "after one online run"), and
that the *third* trust assertion flips back to `"no signal"` (the count grew first). The handoff
also said nothing about the `not.toContainText("no signal")` guard B14 had added, which is the
omission that actually mattered, because D02 had to invert it. Both sides of that are recorded
under D33's design and at acceptance criterion 8.

**Two of the seven tickets ended in a state this section does not have a word for**, and naming
them is more useful than a count. **D33 and D34 ran, and each produced something other than what
this spec told it to produce — with the implementation right and the instruction the defect.** That
is a third outcome distinct from the two the Result paragraph already distinguishes (met, and
reversed-with-a-correction); nothing in this file's own vocabulary covers "the criterion was
unsatisfiable and the code found the satisfiable version", and criterion 8 is the case where the
two specs' requirements were literally mutually exclusive. The Plan's Self-Review now separates the
three outcomes rather than reporting only the reversal.
