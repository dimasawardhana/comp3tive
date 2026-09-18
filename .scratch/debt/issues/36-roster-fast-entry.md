# 36: Roster fast entry — a documented CSV path and bulk rating

**Status:** ready-for-agent

**What to build:** Entering a roster stops being one player at a time by guesswork. The roster
screen offers a downloadable CSV template whose column order the app states in plain sight, the
import reports exactly which lines were skipped and why instead of silently dropping them, and
an organizer who already has a roster can rate a set of players in the discipline at once
instead of opening each player's editor.

**Evidence.** The CSV path is real but undocumented and wrong on quoting:

```
$ sed -n '574,578p' src/App.tsx
const parts = lines[i].split(",").map((p) => p.trim().replace(/^"|"$/g, ""));
const name = parts[0];
...
const disciplineShort = parts[1]?.toLowerCase() || "";
```

`"Smith, John", futsal, 4` splits into four parts and imports a player named `Smith`. No error
surfaces. Strength is applied to **every** attribute of the discipline as one flat number
(`attributeRatings: Object.fromEntries(matchedDiscipline.attributes.map((a) => [a.id,
Math.max(1, Math.min(5, strength))]))`), an unrecognised discipline yields `capability = null`
so the player is created silently unable to play anything, and `await file.text()` runs with no
size check. There is no CSV template and no in-app mention of the column order:

```
$ grep -rni "csv template\|downloadCsvTemplate" src/
(only `grid-template-columns` CSS hits)
```

Absorbed ticket `.scratch/app-correctness/issues/03` claimed "no production code path calls
`validatePlayer`". **That is partially stale — `PlayerEditModal.tsx:126` now calls it.** Only
`parseBackup` and the JSON/CSV import paths still bypass it, which is why the bulk write below
routes through it deliberately.

**Ownership boundary (frozen).** Phase A's A08 owns CSV parsing in
`src/data/player-import.ts`, exporting exactly: `MAX_IMPORT_BYTES = 5 * 1024 * 1024`,
`interface CsvRow { line: number; name: string; discipline: string; strength: number }`,
`interface ImportSkip { line: number; reason: string }`, `assertImportSize(bytes: number): void`
(throws naming the limit before any read), `parsePlayerCsv(text: string): { rows: CsvRow[];
skipped: ImportSkip[] }` (quoted-field parse, 1-based line numbers in `skipped`), and
`csvRowsToPlayers(rows, disciplines, communityId): { players: Player[]; skipped: ImportSkip[] }`
(unknown discipline → `skipped`, never a capability-less player). This ticket changes none of
that. Its template's column order must match the parser's: **name, discipline, strength**.

**Where the UI lives (frozen).** After C26/C27 the roster hub markup is `src/shell/RosterScreen.tsx`
and import state is `src/shell/usePlayerImport.ts`, which exports `usePlayerImport(deps) →
{ pendingMerge, confirmMerge, cancelMerge, lastReport: { imported: number; skipped: { line:
number; reason: string }[] } | null, importFile(file) }`. `contracts.md`'s Phase D row still said
`src/App.tsx (roster entry UI)`; that is stale and the contract has since been updated. This
ticket touches neither `src/App.tsx`'s handlers nor the parser.

**Acceptance criteria:**
- [ ] `src/shell/RosterScreen.tsx` accepts a new prop `lastReport: ImportReport | null` (importing the type from `src/shell/usePlayerImport.ts`) and renders, whenever `lastReport` is non-null, a `.import-report` panel: `Imported N players.` and, when `lastReport.skipped.length > 0`, a `.import-skipped` list with one `.import-skipped-row` per entry reading `Line {line}: {reason}`.
- [ ] The panel persists across a subsequent render until the next import replaces it — it is rendered from `lastReport`, not from a transient toast — and a partial import (`imported > 0` with `skipped.length > 0`) shows both halves, never just the success count. A unit test drives `usePlayerImport` with a two-row import in which one row has an unknown discipline and asserts `lastReport` is `{ imported: 1, skipped: [ … ] }`.
- [ ] The roster toolbar keeps its existing controls (`+ Add Player`, `Import players`, `Export`, and the hidden `<input type="file" accept=".json,.csv,.txt">`) and gains `Download CSV template` (`data-testid="download-csv-template"`).
- [ ] New `src/data/csv-template.ts` exports `CSV_TEMPLATE: string` — a two-row example whose header is exactly `name,discipline,strength`. It is a D-owned new file, so A08's `src/data/player-import.ts` is never written to; the two are tied together by a test instead: `src/data/csv-template.test.ts` asserts `parsePlayerCsv(CSV_TEMPLATE)` returns two rows and zero skips when the example disciplines exist. `src/shell/RosterScreen.tsx` downloads it as `comp3tive-players-template.csv` through a Blob URL and an `<a download>` click, following the precedent at `src/data/sample-data.ts:52-60` (`downloadSampleData`).
- [ ] The column order is stated in the UI, not only in the file: the template button carries `title` and an adjacent `.import-hint` line reading exactly `CSV columns: name, discipline, strength.` — the same three tokens, in the parser's order.
- [ ] The hint documents the quoting rule too: the same `.import-hint` block reads `Names with a comma go in quotes: "Smith, John", futsal, 4.` A spec asserts both hint strings are visible on the Roster hub.
- [ ] Bulk rating is reachable from the roster: the existing filter chips select a visible set, and a `Rate selected` button opens `src/roster/BulkRateModal.tsx`, which offers one discipline (defaulting to the active filter's discipline when one is set) and one integer rating per attribute the discipline declares, each bounded by that attribute's `min`/`max`.
- [ ] Applying the bulk rating writes through `useRoster.savePlayer` — never the raw store — so the in-memory list updates exactly as the single-player editor does (`src/roster/useRoster.ts`).
- [ ] Every player the bulk write touches satisfies `validatePlayer(player, disciplines)` and `validateCapability(cap, discipline, path)` (`src/domain/validation.ts:9`, `:35`): ratings stay within `attribute.min`/`attribute.max`, at most one capability per discipline, `eligibleRoles` non-empty, `preferredRole` inside `eligibleRoles`. A player with no capability in the chosen discipline gains one whose `eligibleRoles` is the discipline's full role list and whose `preferredRole` is `null`; a player that already has one keeps its `eligibleRoles` and `preferredRole` and only its `attributeRatings` change. A unit test asserts both paths against `validatePlayer`.
- [ ] The modal reports its outcome in the app's existing vocabulary (`useToasts().notify` — C26's `src/shell/useToasts.ts` and `src/ui/Toasts.tsx`, lifted from the toast system that already exists at `src/App.tsx:163-171` and is unused by the import paths): `Rated N players in Futsal.` on success. No `alert`, no `window.confirm`.
- [ ] The modal is dismissible without writing anything (Cancel), and cancel leaves every player's `capabilities` byte-identical. A spec asserts this.
- [ ] `src/shell/RosterScreen.tsx` reads the discipline catalog from the `disciplines` prop it already receives — or from `useCommunityScope`'s `disciplinesById` where a scoped screen needs it — and does not build a second `Map` from the catalog.
- [ ] Existing import specs stay green unchanged: `e2e/tests/squads/saved-squad.spec.ts:21-24` (players-only JSON via the toolbar input) and `e2e/tests/panel/no-overlap.spec.ts:4` (community created, players imported via file).
- [ ] New e2e specs: importing a CSV whose second row has an unknown discipline shows `.import-skipped` containing that line number and still creates the first player; clicking `download-csv-template` fires a download named `comp3tive-players-template.csv`; `Rate selected` on two filtered players sets their ratings and the roster rows show the new values.
- [ ] `npx vitest run` exits 0 with the new parser/template/bulk-rating tests in the output; `npx tsc -b` exits 0.

**Blocked by:** 08 (A08 supplies `src/data/player-import.ts`; the template and the report panel render its `ImportSkip[]` shape), 26 (the roster UI and its import state must be in `src/shell/` before this ticket has a file to edit)
